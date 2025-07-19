import { useState } from "react";
import { useSelector } from "react-redux";
import { webviewSend } from "../../hooks";
import { setSelectedBehavior, setSelectedModel } from "../../redux/slices/chat";
import { State, useEcaDispatch } from "../../redux/store";
import { sendPrompt } from "../../redux/thunks/chat";
import './ChatPrompt.scss';

interface ChatPromptProps {
    enabled: boolean,
    chatId?: string,
}

export function ChatPrompt({ chatId, enabled }: ChatPromptProps) {
    const [promptValue, setPromptValue] = useState('');
    const dispatch = useEcaDispatch();

    const chat = useSelector((state: State) => state.chat);

    const sendPromptValue = () => {
        if (promptValue.trim()) {
            dispatch(sendPrompt({ prompt: promptValue, chatId }));
            setPromptValue('')
        }
    }

    const handleModelChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;

        webviewSend('chat/selectedModelChanged', { value: newModel });
        dispatch(setSelectedModel(newModel));
    }

    const handleBehaviorChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBehavior = e.target.value;

        webviewSend('chat/selectedBehaviorChanged', { value: newBehavior });
        dispatch(setSelectedBehavior(newBehavior));
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && enabled) {
            sendPromptValue();
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
            {enabled && (
                <div>
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
                </div>
            )}
            <div className="spacing"></div>
            <div className="send"><i onClick={sendPromptValue} className="codicon codicon-send"></i></div>
        </div>
    );
}
