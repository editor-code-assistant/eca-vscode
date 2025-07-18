import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { useWebviewListener } from '../../hooks';
import { clearHistory } from '../../redux/slices/chat';
import { useEcaDispatch } from '../../redux/store';
import './ChatHeader.scss';

interface Props {
    chatId?: string,
}

export function ChatHeader({ chatId }: Props) {
    const [failed, setFailed] = useState(0);
    const [starting, setStarting] = useState(0);
    const [running, setRunning] = useState(0);
    const dispatch = useEcaDispatch();
    const navigate = useNavigate();

    const clearChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(clearHistory(chatId!));
    }

    return (
        <div className="chat-header">
            <div className="details">
                <div onClick={() => navigate(ROUTES.MCP_DETAILS)} className="mcps">
                    <span>MCPs </span>
                    {failed > 0 &&
                        <span className="failed">{failed}</span>}
                    {(failed > 0 && (starting > 0 || running > 0)) &&
                        <span>/</span>}
                    {starting > 0 &&
                        <span className="starting">{starting}</span>}
                    {(starting > 0 && running > 0) &&
                        <span>/</span>}
                    {running > 0 &&
                        <span className="running">{running}</span>}
                </div>
            </div>
            <div className="actions">
                {chatId && (
                    <div className="action"><i onClick={clearChat} className="codicon codicon-trash"></i></div>)}
            </div>
        </div>
    );
}
