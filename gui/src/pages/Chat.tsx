import { useContext, useState } from "react";
import { IdeContext } from "../Ide";

export function Chat() {
    const [messages, setMessages] = useState<string[]>([]);
    const [promptValue, setPromptValue] = useState('');

    const [enabled, setEnabled] = useState(false);

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/contentReceived', (params: any) => {
        setMessages(prev => [...prev, params.content.text]);
    });

    ideContext.handleMessage('chat/setEnable', (params: any) => {
        setEnabled(_prev => params.enabled);
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
                    <p>Waiting for server start...</p>
                </div>
            }
            <div className="messages-area">
                {messages.map((message, index) => (
                    <div key={index} className="user-message">
                        {message}
                    </div>
                ))}
            </div>

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
