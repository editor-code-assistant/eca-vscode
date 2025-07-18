import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { clearHistory } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import './ChatHeader.scss';

interface Props {
    chatId?: string,
}

export function ChatHeader({ chatId }: Props) {
    const dispatch = useEcaDispatch();
    const navigate = useNavigate();

    const clearChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(clearHistory(chatId!));
    }

    const mcpServers = useSelector((state: State) => state.mcp.servers);

    let failed = 0;
    let starting = 0;
    let running = 0;

    mcpServers.forEach((mcp: any) => {
        switch (mcp.status) {
            case 'failed':
                failed++;
                break;
            case 'starting':
                starting++;
                break;
            case 'running':
                running++;
                break;
        }
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
                {chatId && (
                    <div className="action"><i onClick={clearChat} className="codicon codicon-trash"></i></div>)}
            </div>
        </div>
    );
}
