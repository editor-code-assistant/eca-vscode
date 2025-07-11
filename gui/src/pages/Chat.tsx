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
            <div className="messages-container">
                {messages.map((message, index) => (
                    <div key={index} className="message">
                        {message}
                    </div>
                ))}
            </div>

            <div className="input-container">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask, plan, build..."
                    className="message-input"
                />
                <button onClick={sendMessage} className="send-button">
                    Send
                </button>
            </div>
        </div>
    );
}
