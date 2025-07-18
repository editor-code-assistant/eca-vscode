import { useSelector } from 'react-redux';
import { State } from '../../redux/store';
import './ChatMessages.scss';
import { ChatToolCall } from './ChatToolCall';
import { MarkdownContent } from './MarkdownContent';
import { useEffect, useRef } from 'react';

interface ChatMessagesProps {
    children: React.ReactNode,
    chatId?: string,
}

export function ChatMessages({ chatId, children }: ChatMessagesProps) {
    const messages = useSelector((state: State) => chatId && state.chat.chats[chatId].messages);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
          const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
          const isAtBottom = scrollHeight - scrollTop <= clientHeight + 30;

          if (isAtBottom) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      }, [messages]);

    return (
        <div className="messages-container scrollable" ref={scrollRef} >
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
