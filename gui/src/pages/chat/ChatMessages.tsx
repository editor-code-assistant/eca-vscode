import { useSelector } from 'react-redux';
import { State } from '../../redux/store';
import './ChatMessages.scss';
import { ChatToolCall } from './ChatToolCall';
import { MarkdownContent } from './MarkdownContent';

interface ChatMessagesProps {
    children: React.ReactNode,
    chatId?: string,
}

export function ChatMessages({ chatId, children }: ChatMessagesProps) {
    const messages = useSelector((state: State) => chatId && state.chat.chats[chatId].messages);

    return (
        <div className="messages-container scrollable">
            {children}
            {messages && messages.map((message, index) => {
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
