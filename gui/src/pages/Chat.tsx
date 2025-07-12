import { useContext, useState } from "react";
import { IdeContext } from "../Ide";

export function Chat() {
    const [messages, setMessages] = useState<string[]>([])
    const [promptValue, setPromptValue] = useState('')

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/contentReceived', (params: any) => {
        setMessages(prev => [...prev, params.content.text]);
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
        if (e.key === "Enter") {
            sendPrompt();
        }
    }

    return (
        <div className="chat-container">
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
