import { useState } from "react";
import { SyncLoader } from "react-spinners";
import { useWebviewListener } from "../../hooks";
import './Chat.scss';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatPrompt } from "./ChatPrompt";

export function Chat() {
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [contentReceiveds, setContentReceiveds] = useState<ChatContentReceived[]>([]);
    const [progressValue, setProgressValue] = useState('');

    const [enabled, setEnabled] = useState(false);

    useWebviewListener('chat/setEnable', (params: any) => {
        setEnabled(_prev => params.enabled);
    });

    useWebviewListener('chat/setEnable', (params: any) => {
        setEnabled(_prev => params.enabled);
    });

    useWebviewListener('chat/setWelcomeMessage', (params: any) => {
        setWelcomeMessage(_prev => params.message);
    });

    const onClear = () => {
        setContentReceiveds([]);
    };

    useWebviewListener('chat/contentReceived', (params: ChatContentReceived) => {
        setContentReceiveds(prev => [...prev, params]);
        if (params.content.type === 'progress') {
            switch (params.content.state) {
                case 'running': {
                    setProgressValue(params.content.text!);
                    return;
                }
                case 'finished': {
                    setProgressValue('');
                    return;
                }
            }
        }
    });

    return (
        <div className="chat-container">
            <ChatHeader onClear={onClear} />
            {!enabled &&
                <div className="loading">
                    <div className="content">
                        <p>Waiting for server to start... </p>
                        <img width="80em" src={`${window.vscodeMediaUrl}/loading.png`} />
                    </div>
                </div>
            }

            <ChatMessages
                contentReceiveds={contentReceiveds}>
                {enabled && (
                    <div className="welcome-message">
                        <h2>{welcomeMessage}</h2>
                    </div>)
                }
            </ChatMessages>

            {progressValue != '' && (
                <div className="progress-area">
                    <p>{progressValue}</p>
                    <SyncLoader className="spinner" size={2} />
                </div>)
            }

            <ChatPrompt enabled={enabled} />
        </div>
    );
}
