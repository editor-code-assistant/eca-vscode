import { useContext, useState } from "react";
import { SyncLoader } from "react-spinners";
import { IdeContext } from "../Ide";
import './Chat.scss';
import { ChatMessages } from "./ChatMessages";

export function Chat() {
    const [promptValue, setPromptValue] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [progressValue, setProgressValue] = useState('');

    const [enabled, setEnabled] = useState(false);

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/setEnable', (params: any) => {
        setEnabled(_prev => params.enabled);
    });

    ideContext.handleMessage('chat/setWelcomeMessage', (params: any) => {
        setWelcomeMessage(_prev => params.message);
    });

    ideContext.handleMessage('chat/contentReceived', ({ content }: ChatContentReceived) => {
        if (content.type === 'progress') {
            switch (content.state) {
                case 'running': {
                    setProgressValue(content.text!);
                    return;
                }
                case 'finished': {
                    setProgressValue('');
                    return;
                }
            }
        }
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
            {enabled && (
                <div className="welcome-message">
                    <h2>{welcomeMessage}</h2>
                </div>)
            }

            <ChatMessages />

            {progressValue != '' && (
                <div className="progress-area">
                    <p>{progressValue}</p>
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
