import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { useWebviewListener } from '../../hooks';
import './ChatHeader.scss';

interface Props {
    onClear: () => any;
}

export function ChatHeader({ onClear }: Props) {
    const [failed, setFailed] = useState(0);
    const [starting, setStarting] = useState(0);
    const [running, setRunning] = useState(0);
    const navigate = useNavigate();

    const clearChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        onClear();
    }

    useWebviewListener('chat/mcpServersUpdated', (mcps: any) => {
        let failedCount = 0;
        let startingCount = 0;
        let runningCount = 0;

        mcps.forEach((mcp: any) => {
            switch (mcp.status) {
                case 'failed':
                    failedCount++;
                    break;
                case 'starting':
                    startingCount++;
                    break;
                case 'running':
                    runningCount++;
                    break;
            }
        });

        setFailed(failedCount);
        setStarting(startingCount);
        setRunning(runningCount);
    });

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
                <div className="action"><i onClick={clearChat} className="codicon codicon-trash"></i></div>
            </div>
        </div>
    );
}
