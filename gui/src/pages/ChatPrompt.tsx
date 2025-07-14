import { useContext, useState } from "react";
import { IdeContext } from "../Ide";
import './ChatPrompt.scss';

interface ChatPromptProps {
    enabled: boolean,
}

export function ChatPrompt({ enabled }: ChatPromptProps) {
    const [promptValue, setPromptValue] = useState('');

    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [behaviors, setBehaviors] = useState<string[]>([]);
    const [selectedBehavior, setSelectedBehavior] = useState('');

    const ideContext = useContext(IdeContext);

    ideContext.handleMessage('chat/setBehaviors', ({ behaviors, selectedBehavior }: { behaviors: string[], selectedBehavior: string }) => {
        setBehaviors(behaviors);
        setSelectedBehavior(selectedBehavior);
    });

    ideContext.handleMessage('chat/setModels', ({ models, selectedModel }: { models: string[], selectedModel: string }) => {
        setModels(models);
        setSelectedModel(selectedModel);
    });


    const sendPrompt = () => {
        if (promptValue.trim()) {
            ideContext.sendMessage('chat/userPrompt',
                { prompt: promptValue },
            );
            setPromptValue('')
        }
    }

    const handleModelChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;

        ideContext.sendMessage('chat/selectedModelChanged', { value: newModel });
        setSelectedModel(newModel);
    }

    const handleBehaviorChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBehavior = e.target.value;

        ideContext.sendMessage('chat/selectedBehaviorChanged', { value: newBehavior });
        setSelectedBehavior(newBehavior);
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
            <select value={selectedBehavior}
                defaultValue={selectedBehavior}
                className="behaviors"
                onChange={handleBehaviorChanged}
            >
                {behaviors.map((behavior) => (
                    <option value={behavior}>{behavior}</option>
                ))}
            </select>
            <select onChange={handleModelChanged}
                value={selectedModel}
                defaultValue={selectedModel}
                className="models">
                {models.map((model) => (
                    <option value={model}>{model}</option>
                ))}
            </select>
        </div>
    );
}
