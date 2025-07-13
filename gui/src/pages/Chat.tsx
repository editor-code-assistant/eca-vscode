import { useContext, useState } from "react";
import { SyncLoader } from "react-spinners";
import { IdeContext } from "../Ide";
import './Chat.scss';

interface TextContent {
    type: 'text';
    text: string;
}

interface ProgressContent {
    type: 'progress';
    state: 'running' | 'finished';
    text?: string;
}

type ChatContent = TextContent | ProgressContent | any;

interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: ChatContent;
}

export function Chat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [promptValue, setPromptValue] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [progress, setProgress] = useState('');

    const [enabled, setEnabled] = useState(false);

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/contentReceived', (params: ChatMessage) => {
        setMessages(prev => [...prev, params]);
    });

    ideContext.handleMessage('chat/setEnable', (params: any) => {
        setEnabled(_prev => params.enabled);
    });

    ideContext.handleMessage('chat/setWelcomeMessage', (params: any) => {
        setWelcomeMessage(_prev => params.message);
    });

    const sendPrompt = () => {
        if (promptValue.trim()) {
            ideContext.sendMessage('chat/userPrompt',
                { prompt: promptValue },
            );
            setPromptValue('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && enabled) {
            sendPrompt();
        }
    }

    let chatMessages: { role: string, value: string }[] = [];
    let assistantMessages = '';

    messages.forEach(({ role, content }) => {
        switch (content.type) {
            case 'text': {
                switch (role) {
                    case 'user':
                    case 'system': {
                        assistantMessages = '';
                        chatMessages.push({
                            role: role,
                            value: content.text,
                        });
                        return;
                    }
                    case 'assistant': {
                        assistantMessages += content.text;
                        return;
                    }
                }
            }
            case 'progress': {
                switch (content.state) {
                    case 'running': {
                        setProgress(content.text);
                        return;
                    }
                    case 'finished': {
                        setProgress('');
                        return;
                    }
                }
            }
        }
    });

    return (
        <div className="chat-container">
            {!enabled &&
                <div className="loading">
                    <div className="content">
                        <p>Waiting for server to start... </p>
                        <img width="80em" src={`${window.vscodeMediaUrl}/loading.png`} />
                    </div>
                </div>
            }
            <div className="messages-area">
                {enabled && (
                    <div className="welcome-message">
                        <h2>{welcomeMessage}</h2>
                    </div>)
                }
                {chatMessages.map(({ role, value }, index) => (
                    <div key={index} className={`${role}-message`}>
                        {value}
                    </div>
                ))}
            </div>

            {progress != '' && (
                <div className="progress-area">
                    <p>{progress}</p>
                    <SyncLoader className="spinner" size={2} />
                </div>)
            }

            <div className="prompt-area">
                <input
                    type="textarea"
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask, plan, build..."
                    className="prompt-field"
                />
            </div>
        </div>
    );
}
