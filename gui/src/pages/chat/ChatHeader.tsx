import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { State, useEcaDispatch } from '../../redux/store';
import { deleteChat } from '../../redux/thunks/chat';
import { ToolTip } from '../components/ToolTip';
import './ChatHeader.scss';

interface Props {
    chatId?: string,
}

export function ChatHeader({ chatId }: Props) {
    const dispatch = useEcaDispatch();
    const navigate = useNavigate();

    const deleteCurrentChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(deleteChat({ chatId: chatId! }));
    }

    const mcpServers = useSelector((state: State) => state.mcp.servers);

    const usage = useSelector((state: State) => chatId && state.chat.chats[chatId].usage);
    const usageStringFormat = useSelector((state: State) => state.server.config.usageStringFormat);

    let usageString;
    if (usage && usageStringFormat) {
        usageString = usageStringFormat
            .replace('{sessionTokens}', usage.sessionTokens.toString())
            .replace('{messageInputTokens}', usage.messageInputTokens.toString())
            .replace('{messageOutputTokens}', usage.messageOutputTokens.toString())
            .replace('{messageCost}', usage.messageCost ? `$${usage.messageCost}` : '')
            .replace('{sessionCost}', usage.sessionCost ? `$${usage.sessionCost}` : '');
    }

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
                <div data-tooltip-id="details-mcps" onClick={() => navigate(ROUTES.MCP_DETAILS)} className="mcps">
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
                <ToolTip id="details-mcps" className="details-tooltip">
                    <p>Failed: {failed}</p>
                    <p>Starting: {starting}</p>
                    <p>Running: {running}</p>
                    <p>Click for more details.</p>
                </ToolTip>
                {usageString && (
                    <div>
                        <div data-tooltip-id="details-usage" className="usage">
                            <span>{usageString}</span>
                        </div>
                        {usage && (
                            <ToolTip id="details-usage" className="details-tooltip">
                                <p>Input tokens: {usage.messageInputTokens}</p>
                                <p>Output tokens: {usage.messageOutputTokens}</p>
                                <p>Session tokens: {usage.sessionTokens}</p>
                                <p>Last message cost: ${usage.messageCost}</p>
                                <p>Session cost: ${usage.sessionCost}</p>
                            </ToolTip>
                        )}
                    </div>
                )}
            </div>
            <div className="actions">
                {chatId && (
                    <div className="action"><i onClick={deleteCurrentChat} className="codicon codicon-trash"></i></div>)}
            </div>
        </div>
    );
}
