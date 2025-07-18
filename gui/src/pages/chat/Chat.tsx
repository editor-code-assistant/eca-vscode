import { useSelector } from "react-redux";
import { SyncLoader } from "react-spinners";
import { ServerStatus } from "../../redux/slices/server";
import { State } from "../../redux/store";
import './Chat.scss';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatPrompt } from "./ChatPrompt";

export function Chat() {
    const status = useSelector((state: State) => state.server.status);
    const running = status === ServerStatus.Running;

    const allChats = useSelector((state: State) => state.chat.chats);

    //TODO Support multiple chats
    const chatId = Object.values(allChats)[0]?.id;

    const chat = chatId ? allChats[chatId] : undefined;

    const welcomeMessage = useSelector((state: State) => state.chat.welcomeMessage);

    return (
        <div className="chat-container">
            <ChatHeader chatId={chatId} />
            {!running &&
                <div className="loading">
                    <div className="content">
                        <p>Waiting for server to start... </p>
                        <img width="80em" src={`${window.vscodeMediaUrl}/loading.png`} />
                    </div>
                </div>
            }

            <ChatMessages chatId={chatId}>
                {running && (
                    <div className="welcome-message">
                        <h2>{welcomeMessage}</h2>
                    </div>)
                }
            </ChatMessages>

            {chat && chat.progress && (
                <div className="progress-area">
                    <p>{chat.progress}</p>
                    <SyncLoader className="spinner" size={2} />
                </div>)
            }

            <ChatPrompt chatId={chatId} enabled={running} />
        </div>
    );
}
