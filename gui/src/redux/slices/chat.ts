import { createSlice } from "@reduxjs/toolkit";
import { useWebviewSender } from "../../hooks";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
}

interface ChatMessageToolCall {
    type: 'toolCall',
    status: 'preparing' | 'run' | 'succeeded' | 'failed',
    role: ChatContentRole,
    id: string,
    name: string,
    argumentsText?: string,
    outputs?: ToolCallOutput[],
    origin: ToolCallOrigin,
    manualApproval: boolean,
}

type ChatMessage = ChatMessageText | ChatMessageToolCall;

interface Chat {
    id: string,
    lastRequestId: number,
    progress?: string,
    messages: ChatMessage[],
}

export const chatSlice = createSlice({
    name: 'server',
    initialState: {
        behaviors: [],
        models: [],
        selectedBehavior: "",
        selectedModel: "",
        welcomeMessage: "",
        chats: {} as { [key: string]: Chat },
    },
    reducers: {
        setBehaviors: (state, action) => {
            state.behaviors = action.payload;
        },
        setSelectedBehavior: (state, action) => {
            state.selectedBehavior = action.payload;
        },
        setModels: (state, action) => {
            state.models = action.payload;
        },
        setSelectedModel: (state, action) => {
            state.selectedModel = action.payload;
        },
        setWelcomeMessage: (state, action) => {
            state.welcomeMessage = action.payload;
        },
        sendPrompt: (state, action) => {
            let chatId = action.payload.chatId;
            let requestId = chatId ? state.chats[chatId].lastRequestId++ : 0;
            const prompt = action.payload.prompt;

            useWebviewSender('chat/userPrompt',
                {
                    chatId,
                    requestId,
                    prompt,
                },
            );
        },
        clearHistory: (state, action) => {
            const chatId = action.payload;
            state.chats[chatId].messages = [];
        },
        addContentReceived: (state, action) => {
            const { chatId, role, content } = action.payload as ChatContentReceived;
            let chat = state.chats[chatId] || { id: chatId, lastRequestId: 0, messages: [] };

            switch (content.type) {
                case 'progress': {
                    switch (content.state) {
                        case 'running': {
                            chat.progress = content.text!;
                            break;
                        }
                        case 'finished': {
                            chat.progress = undefined;
                            break;
                        }
                    }
                    break;
                }
                case 'text': {
                    switch (role) {
                        case 'user':
                        case 'system': {
                            chat.messages.push({
                                type: 'text',
                                role: role,
                                value: content.text,
                            })
                            break;
                        }
                        case 'assistant': {
                            const lastMessage = chat.messages[chat.messages.length - 1];
                            if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                                lastMessage.value += content.text;
                            } else {
                                chat.messages.push({
                                    type: 'text',
                                    role: role,
                                    value: content.text,
                                });
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'toolCallPrepare': {
                    const tool: ChatMessageToolCall = {
                        type: 'toolCall',
                        status: 'preparing',
                        role: role,
                        id: content.id,
                        name: content.name,
                        origin: content.origin,
                        argumentsText: content.argumentsText,
                        manualApproval: content.manualApproval,
                    };

                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    if (existingIndex === -1) {
                        chat.messages.push(tool);
                    } else {
                        chat.messages[existingIndex] = tool;
                    }
                    break;
                }
                case 'toolCallRun': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.status = 'run';
                    tool.argumentsText = JSON.stringify(content.arguments);

                    chat.messages[existingIndex] = tool;
                    break;
                }
                case 'toolCalled': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    const output = content.outputs[0];
                    tool.outputs = content.outputs
                    tool.status = output?.error ? 'failed' : 'succeeded';
                    chat.messages[existingIndex] = tool;
                    break;
                }
            }
            state.chats[chatId] = chat;
        }
    },
});

export const {
    setBehaviors,
    setModels,
    setSelectedBehavior,
    setSelectedModel,
    setWelcomeMessage,
    sendPrompt,
    addContentReceived,
    clearHistory,
} = chatSlice.actions
