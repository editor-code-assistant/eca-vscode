import { createSlice } from "@reduxjs/toolkit";
import { ChatContentReceived, ChatContentRole, ChatContext, ToolCallOrigin, ToolCallOutput } from "../../protocol";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
}

interface ChatMessageToolCall {
    type: 'toolCall',
    status: 'preparing' | 'run' | 'succeeded' | 'failed' | 'rejected',
    role: ChatContentRole,
    id: string,
    name: string,
    argumentsText?: string,
    outputs?: ToolCallOutput[],
    origin: ToolCallOrigin,
    manualApproval: boolean,
}

export type ChatMessage = ChatMessageText | ChatMessageToolCall;

interface Chat {
    id: string,
    lastRequestId: number,
    progress?: string,
    messages: ChatMessage[],
    usage?: ChatUsage,
}

interface ChatUsage {
    messageInputTokens: number,
    messageOutputTokens: number,
    sessionTokens: number,
    messageCost?: string,
    sessionCost?: string,
}

export const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        behaviors: [],
        models: [],
        selectedBehavior: "",
        selectedModel: "",
        welcomeMessage: "",
        chats: {} as { [key: string]: Chat },
        contexts: undefined as (ChatContext[] | undefined),
        addedContexts: [{type: 'repoMap'}] as ChatContext[],
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
        incRequestId: (state, action) => {
            const chatId = action.payload.chatId;
            state.chats[chatId] = {
                ...state.chats[chatId],
                lastRequestId: (state.chats[chatId]?.lastRequestId || 0) + 1,
            };
        },
        resetChat: (state, action) => {
            const chatId = action.payload;
            delete state.chats[chatId];
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
                            chat.messages = [...chat.messages, {
                                type: 'text',
                                role: role,
                                value: content.text,
                            }];
                            break;
                        }
                        case 'assistant': {
                            const lastMessage = chat.messages[chat.messages.length - 1];
                            if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                                const newMsg = { ...lastMessage } as ChatMessageText;
                                newMsg.value += content.text;
                                chat.messages[chat.messages.length - 1] = newMsg;
                            } else {
                                chat.messages = [...chat.messages, {
                                    type: 'text',
                                    role: role,
                                    value: content.text,
                                }];
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
                    tool.manualApproval = content.manualApproval;
                    tool.argumentsText = JSON.stringify(content.arguments);

                    chat.messages[existingIndex] = tool;
                    break;
                }
                case 'toolCallRejected': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.status = 'rejected';
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
                case 'usage': {
                    chat.usage = content;
                    break;
                }
            }
            state.chats[chatId] = chat;
        },
        setContexts: (state, action) => {
            state.contexts = action.payload.contexts;
        },
        addContext: (state, action) => {
            state.addedContexts = [...state.addedContexts, action.payload];
        },
        removeContext: (state, action) => {
            const toRemove = JSON.stringify(action.payload);
            const i = state.addedContexts.findIndex(context => JSON.stringify(context) === toRemove);
            state.addedContexts = [...state.addedContexts.slice(0, i), ...state.addedContexts.slice(i + 1)];
        },
    },
});

export const {
    setBehaviors,
    setModels,
    setSelectedBehavior,
    setSelectedModel,
    setWelcomeMessage,
    incRequestId,
    addContentReceived,
    resetChat,
    setContexts,
    addContext,
    removeContext,
} = chatSlice.actions
