import { useContext } from 'react';
import { IdeContext } from '../../Ide';
import './ChatHeader.scss';

interface Props {
}

export function ChatHeader({}: Props) {
    const ideContext = useContext(IdeContext);

    const newChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        ideContext.sendMessage('chat/new', {});
    }

    const clearChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        ideContext.sendMessage('chat/clear', {});
    }

    const closeChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        ideContext.sendMessage('chat/close', {});
    }

    return (
        <div className="chat-header">
            <div className="actions">
                <div className="action"><i onClick={newChat} className="codicon codicon-add"></i></div>
                <div className="action"><i onClick={clearChat} className="codicon codicon-trash"></i></div>
                <div className="action"><i onClick={closeChat} className="codicon codicon-chrome-close"></i></div>
            </div>
        </div>
    );
}
