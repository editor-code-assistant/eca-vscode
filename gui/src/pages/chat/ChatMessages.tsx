import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChatMessage } from '../../redux/slices/chat';
import { State } from '../../redux/store';
import './ChatMessages.scss';
import { ChatTextMessage } from './ChatTextMessage';
import { ChatToolCall } from './ChatToolCall';

interface ChatMessagesProps {
    children: React.ReactNode,
    chatId?: string,
}

export function ChatMessages({ chatId, children }: ChatMessagesProps) {
    const messages = useSelector((state: State) => chatId && state.chat.chats[chatId].messages || []);

    const scrollRef = useRef<HTMLDivElement>(null);
    useAutoScroll(scrollRef, messages);

    return (
        <div className="messages-container scrollable" ref={scrollRef} >
            {children}
            {messages && messages.map((message, index) => {
                if (message.type === 'text') {
                    return (
                        <div key={index}>
                            <ChatTextMessage
                                text={message.value}
                                role={message.role} />
                        </div>
                    );
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

const useAutoScroll = (ref: RefObject<HTMLDivElement | null>, messages: ChatMessage[]) => {
    const [userScrolled, setUserScrolled] = useState(false);
    const userMsgsCount = useMemo(() => messages.filter((msg) => msg.role === 'user').length, [messages.length]);

    useEffect(() => {
        setUserScrolled(false);
    }, [userMsgsCount]);

    useEffect(() => {
        if (!ref.current || messages.length === 0) return;

        const handleScroll = () => {
            const elem = ref.current;
            if (!elem) return;

            const isAtBottom =
                Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1;
            setUserScrolled(!isAtBottom);
        };

        const resizeObserver = new ResizeObserver(() => {
            const elem = ref.current;
            if (!elem || userScrolled) return;
            elem.scrollTop = elem.scrollHeight;
        });

        ref.current.addEventListener("scroll", handleScroll);

        resizeObserver.observe(ref.current);

        Array.from(ref.current.children).forEach((child) => {
            resizeObserver.observe(child);
        });

        return () => {
            resizeObserver.disconnect();
            ref.current?.removeEventListener("scroll", handleScroll);
        };
    }, [ref, messages.length, userScrolled]);
}
