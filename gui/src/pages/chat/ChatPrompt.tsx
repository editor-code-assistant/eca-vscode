import { useState } from "react";
import { useWebviewSender } from "../../hooks";
import { useChatProvider } from "../../provider/ChatProvider";
import './ChatPrompt.scss';

interface ChatPromptProps {
    enabled: boolean,
}

export function ChatPrompt({ enabled }: ChatPromptProps) {
    const [promptValue, setPromptValue] = useState('');

    const chat = useChatProvider();

    const sendPrompt = () => {
        if (promptValue.trim()) {
            useWebviewSender('chat/userPrompt',
                { prompt: promptValue },
            );
            setPromptValue('')
        }
    }

    const handleModelChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;

        useWebviewSender('chat/selectedModelChanged', { value: newModel });
        chat.setSelectedModel(newModel);
    }

    const handleBehaviorChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBehavior = e.target.value;

        useWebviewSender('chat/selectedBehaviorChanged', { value: newBehavior });
        chat.setSelectedBehavior(newBehavior);
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && enabled) {
            sendPrompt();
            e.preventDefault();
        }
    }

    return (
        <div className="prompt-area">
            <div className="contexts">
            </div>
            <textarea
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask, plan, build..."
                className="field"
            />
            <select value={chat.selectedBehavior}
                className="behaviors"
                onChange={handleBehaviorChanged}
            >
                {chat.behaviors.map((behavior) => (
                    <option key={behavior} value={behavior}>{behavior}</option>
                ))}
            </select>
            <select onChange={handleModelChanged}
                value={chat.selectedModel}
                className="models">
                {chat.models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                ))}
            </select>
            <div className="spacing"></div>
            <div className="send"><i onClick={sendPrompt} className="codicon codicon-send"></i></div>
        </div>
    );
}
