import './ChatMessages.scss';
import { ChatToolCall } from './ChatToolCall';
import { MarkdownContent } from './MarkdownContent';

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

interface ChatMessagesProps {
    children: React.ReactNode,
    contentReceiveds: ChatContentReceived[],
}

export function ChatMessages({ children, contentReceiveds }: ChatMessagesProps) {
    let chatMessages: ChatMessage[] = [];

    contentReceiveds.forEach(({ role, content }) => {
        switch (content.type) {
            case 'text': {
                switch (role) {
                    case 'user':
                    case 'system': {
                        chatMessages.push({
                            type: 'text',
                            role: role,
                            value: content.text,
                        });
                        return;
                    }
                    case 'assistant': {
                        const lastMessage = chatMessages[chatMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                            lastMessage.value += content.text;
                        } else {
                            chatMessages.push({
                                type: 'text',
                                role: role,
                                value: content.text,
                            });
                        }
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

                const existingIndex = chatMessages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                if (existingIndex === -1) {
                    chatMessages.push(tool);
                } else {
                    chatMessages[existingIndex] = tool;
                }
                return;
            }
            case 'toolCallRun': {
                const existingIndex = chatMessages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                let tool = chatMessages[existingIndex] as ChatMessageToolCall;
                tool.status = 'run';
                tool.argumentsText = JSON.stringify(content.arguments);
                chatMessages[existingIndex] = tool;
                return;
            }
            case 'toolCalled': {
                const existingIndex = chatMessages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                let tool = chatMessages[existingIndex] as ChatMessageToolCall;
                // TODO handle multiple outputs
                const output = content.outputs[0];
                tool.outputs = content.outputs
                tool.status = output?.error ? 'failed' : 'succeeded';
                chatMessages[existingIndex] = tool;
                return;
            }
        }
    });

    return (
        <div className="messages-container scrollable">
            {children}
            {chatMessages.map((message, index) => {
                if (message.type === 'text') {
                    return (<div key={index} className={`${message.role}-message text-message `}>
                        {message.role === 'assistant' && (
                            <MarkdownContent content={message.value} />
                        )}
                        {message.role != 'assistant' && (
                            <span>{message.value}</span>
                        )}
                    </div>)
                }

                if (message.type == 'toolCall') {
                    return (
                        <div key={index}>
                            <ChatToolCall
                                name={message.name}
                                origin={message.origin}
                                status={message.status}
                                outputs={message.outputs}
                                argumentsText={message.argumentsText}
                            />
                        </div>
                    );
                }

            })}
        </div>
    );
}
