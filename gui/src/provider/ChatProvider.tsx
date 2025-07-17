import { createContext, useContext, useState } from "react";
import { useWebviewListener } from "../hooks";

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

export interface Chat {
    welcomeMessage: string,
    behaviors: string[],
    models: string[],
    selectedModel: string,
    selectedBehavior: string,
    messages: ChatMessage[],
    progress?: string,

    setSelectedModel: (model: string) => void;
    setSelectedBehavior: (behavior: string) => void;
    clearHistory: () => void;
}

const initState: Chat = {
    welcomeMessage: "",
    behaviors: [],
    models: [],
    selectedModel: "",
    selectedBehavior: "",
    messages: [],

    setSelectedModel: () => {},
    setSelectedBehavior: () => {},
    clearHistory: () => {},
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [welcomeMessage, setWelcomeMessage] = useState<string>(initState.welcomeMessage);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [behaviors, setBehaviors] = useState<string[]>([]);
    const [selectedBehavior, setSelectedBehavior] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [progress, setProgress] = useState<string>();

    useWebviewListener('chat/setBehaviors', ({ behaviors, selectedBehavior }: { behaviors: string[], selectedBehavior: string }) => {
        setBehaviors(behaviors);
        setSelectedBehavior(selectedBehavior);
    });

    useWebviewListener('chat/setModels', ({ models, selectedModel }: { models: string[], selectedModel: string }) => {
        setModels(models);
        setSelectedModel(selectedModel);
    });

    useWebviewListener('chat/setWelcomeMessage', (params: any) => {
        setWelcomeMessage(_prev => params.message);
    });

    useWebviewListener('chat/contentReceived', ({ role, content }: ChatContentReceived) => {
        switch (content.type) {
            case 'progress': {
                switch (content.state) {
                    case 'running': {
                        setProgress(content.text!);
                        return;
                    }
                    case 'finished': {
                        setProgress(undefined);
                        return;
                    }
                }
            }
            case 'text': {
                switch (role) {
                    case 'user':
                    case 'system': {
                        const newMesssages = messages;
                        newMesssages.push({
                            type: 'text',
                            role: role,
                            value: content.text,
                        });
                        setMessages(newMesssages);
                        return;
                    }
                    case 'assistant': {
                        const newMessages = messages;
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                            lastMessage.value += content.text;
                        } else {
                            newMessages.push({
                                type: 'text',
                                role: role,
                                value: content.text,
                            });
                        }
                        setMessages(newMessages);
                        return;
                    }
                }
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

                const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                if (existingIndex === -1) {
                    setMessages(prev => [...prev, tool]);
                } else {
                    setMessages(prev => {
                        prev[existingIndex] = tool;
                        return prev;
                    });
                }
                return;
            }
            case 'toolCallRun': {
                const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                let tool = messages[existingIndex] as ChatMessageToolCall;
                tool.status = 'run';
                tool.argumentsText = JSON.stringify(content.arguments);

                setMessages(prev => {
                    prev[existingIndex] = tool;
                    return prev;
                });
                return;
            }
            case 'toolCalled': {
                const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                let tool = messages[existingIndex] as ChatMessageToolCall;
                // TODO handle multiple outputs
                const output = content.outputs[0];
                tool.outputs = content.outputs
                tool.status = output?.error ? 'failed' : 'succeeded';
                setMessages(prev => {
                    prev[existingIndex] = tool;
                    return prev;
                });
                return;
            }
        }
    });

    const clearHistory = () => {
        setMessages([]);
    };

    const value: Chat = {
        welcomeMessage,
        behaviors,
        models,
        selectedBehavior,
        selectedModel,
        setSelectedBehavior,
        setSelectedModel,
        messages,
        progress,
        clearHistory,
    }

    return (
        <ChatContext value={value}>
            {children}
        </ChatContext>
    );
}

const ChatContext = createContext<Chat>(initState);

export const useChatProvider = (): Chat => useContext(ChatContext);
