import { useContext, useState } from "react";
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { IdeContext } from "../../Ide";
import './ChatMessages.scss';

interface ChatMessage {
    role: string,
    value: string,
}

interface ChatMessagesProps {
    children: React.ReactNode,
}

export function ChatMessages({ children }: ChatMessagesProps) {
    const [contentReceiveds, setContentReceiveds] = useState<ChatContentReceived[]>([]);

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/contentReceived', (params: ChatContentReceived) => {
        setContentReceiveds(prev => [...prev, params]);
    });

    let chatMessages: ChatMessage[] = [];

    contentReceiveds.forEach(({ role, content }) => {
        switch (content.type) {
            case 'text': {
                switch (role) {
                    case 'user':
                    case 'system': {
                        chatMessages.push({
                            role: role,
                            value: content.text,
                        });
                        return;
                    }
                    case 'assistant': {
                        const lastMessage = chatMessages[chatMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            lastMessage.value += content.text;
                        } else {
                            chatMessages.push({
                                role: role,
                                value: content.text,
                            });
                        }
                        return;
                    }
                }
            }
        }
    });

    return (
        <div className="messages-container">
            {children}
            {chatMessages.map(({ role, value }, index) => (

                <div key={index} className={`${role}-message message`}>
                    {role === 'assistant' && (
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            children={value}
                            components={{
                                code(props) {
                                    const { children, className, node, ...rest } = props
                                    const match = /language-(\w+)/.exec(className || '')
                                    return match ? (
                                        <SyntaxHighlighter
                                            PreTag="div"
                                            children={String(children).replace(/\n$/, '')}
                                            language={match[1]}
                                            style={dracula}
                                        />
                                    ) : (
                                        <code {...rest} className={className}>
                                            {children}
                                        </code>
                                    )
                                }
                            }}
                        />
                    )}
                    {role != 'assistant' && (
                        <span>{value}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
