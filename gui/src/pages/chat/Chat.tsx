import { SyncLoader } from "react-spinners";
import { useChatProvider } from "../../provider/ChatProvider";
import { ServerStatus, useServerProvider } from "../../provider/ServerProvider";
import './Chat.scss';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatPrompt } from "./ChatPrompt";

export function Chat() {
    const server = useServerProvider();
    const running = server.status === ServerStatus.Running;

    const chat = useChatProvider();

    const onClear = () => {
        chat.clearHistory();
    };

    return (
        <div className="chat-container">
            <ChatHeader onClear={onClear} />
            {!running &&
                <div className="loading">
                    <div className="content">
                        <p>Waiting for server to start... </p>
                        <img width="80em" src={`${window.vscodeMediaUrl}/loading.png`} />
                    </div>
                </div>
            }

            <ChatMessages>
                {running && (
                    <div className="welcome-message">
                        <h2>{chat.welcomeMessage}</h2>
                    </div>)
                }
            </ChatMessages>

            {chat.progress && (
                <div className="progress-area">
                    <p>{chat.progress}</p>
                    <SyncLoader className="spinner" size={2} />
                </div>)
            }

            <ChatPrompt enabled={running} />
        </div>
    );
}
