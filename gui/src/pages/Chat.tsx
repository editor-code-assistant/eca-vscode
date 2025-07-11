import { useState } from "react"

export function Chat() {
    const [messages, setMessages] = useState<string[]>([])
    const [inputValue, setInputValue] = useState('')

    const sendMessage = () => {
        if (inputValue.trim()) {
            setMessages([...messages, inputValue])
            setInputValue('')
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
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask, plan, build..."
                    className="prompt-field"
                />
            </div>
        </div>
    );
}
