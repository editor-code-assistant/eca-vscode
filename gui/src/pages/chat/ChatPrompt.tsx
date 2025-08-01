import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { webviewSend } from "../../hooks";
import { setSelectedBehavior, setSelectedModel } from "../../redux/slices/chat";
import { State, useEcaDispatch } from "../../redux/store";
import { sendPrompt } from "../../redux/thunks/chat";
import { ChatCommands } from "./ChatCommands";
import { ChatContexts } from "./ChatContexts";
import './ChatPrompt.scss';

interface ChatPromptProps {
    enabled: boolean,
    chatId?: string,
}

export const ChatPrompt = memo(({ chatId, enabled }: ChatPromptProps) => {
    const [promptValue, setPromptValue] = useState('');
    const [inputCompleting, setInputCompleting] = useState(false);
    const dispatch = useEcaDispatch();

    const selectedBehavior = useSelector((state: State) => state.chat.selectedBehavior);
    const behaviors = useSelector((state: State) => state.chat.behaviors);
    const selectedModel = useSelector((state: State) => state.chat.selectedModel);
    const models = useSelector((state: State) => state.chat.models);

    const sendPromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && !inputCompleting) {
            dispatch(sendPrompt({ prompt: prompt, chatId }));
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

    const inputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [enabled]);

    const onPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPromptValue(event.target.value);
    }

    return (
        <div className="prompt-area">
            <ChatContexts enabled={enabled} chatId={chatId} />
            <ChatCommands
                input={inputRef.current}
                chatId={chatId}
                onCommandSelected={(command) => {
                    setPromptValue(`/${command.name} `);
                    inputRef.current?.focus();
                }}
                onCompleting={setInputCompleting}
            />
            <textarea
                ref={inputRef}
                autoFocus
                value={promptValue}
                onChange={onPromptChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask, plan, build..."
                className="field"
            />
            {enabled && (
                <div>
                    <select value={selectedBehavior}
                        className="behaviors"
                        onChange={handleBehaviorChanged}
                    >
                        {behaviors.map((behavior) => (
                            <option key={behavior} value={behavior}>{behavior}</option>
                        ))}
                    </select>
                    <select onChange={handleModelChanged}
                        value={selectedModel}
                        className="models">
                        {models.map((model) => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="spacing"></div>
            <div className="send"><i onClick={sendPromptValue} className="codicon codicon-send"></i></div>
        </div>
    );
});
