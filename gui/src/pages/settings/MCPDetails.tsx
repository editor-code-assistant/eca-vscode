import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { ToolServerUpdatedParams } from '../../protocol';
import { State, useEcaDispatch } from '../../redux/store';
import { startServer, stopServer } from '../../redux/thunks/mcp';
import { Toggle } from '../components/Toggle';
import { ToolTip } from '../components/ToolTip';
import './MCPDetails.scss';

export function MCPDetails() {
    const mcpServers = useSelector((state: State) => state.mcp.servers);
    const navigate = useNavigate();
    const dispatch = useEcaDispatch();

    const changeServerStatus = (enabled: boolean, server: ToolServerUpdatedParams) => {
        if (enabled) {
            dispatch(startServer({ name: server.name }));
        } else {
            dispatch(stopServer({ name: server.name }));
        }
    }

    return (
        <div className="mcp-details-container scrollable">
            <div className="header">
                <button onClick={() => navigate(ROUTES.CHAT)} className="link">
                    <i className={`codicon codicon-arrow-left`}></i>
                </button>
            </div>
            <div className="servers">
                <h2 className="title">MCP Servers</h2>
                <p className="description">MCPs are extra tools that can offer more power to ECA, for more details check <a href="https://modelcontextprotocol.io">MCP</a></p>
                {mcpServers.map((server, index) => {
                    let commandTxt;
                    if (server.type === 'mcp') {
                        commandTxt = server.command + " " + (server.args?.join(" ") || "");
                    }

                    const stoppable = server.status === 'running' || server.status === 'starting';

                    return (
                        <div key={index} className="server">
                            <span className="name">{server.name}</span>
                            <i data-tooltip-id={`status-${server.name}`} className={`status ${server.status}`}></i>
                            <ToolTip id={`status-${server.name}`}>
                                <span>{server.status}</span>
                            </ToolTip>
                            <div className="divider"></div>
                            <Toggle
                                defaultChecked={stoppable}
                                onChange={(enabled) => changeServerStatus(enabled, server)} />
                            <dl>
                                <dt>Tools: </dt>
                                <dd className="tools">
                                    {server.tools?.map((tool, index) => {
                                        let parametersTxt = '';
                                        if (tool.parameters && tool.parameters.properties) {
                                            parametersTxt = Object.entries(tool.parameters.properties)
                                                .map(([key, value]) => `${key}: ${value.description || 'No description'}`)
                                                .join(', ');
                                        }

                                        return (
                                            <div key={index} style={{ display: "inline-block" }}>
                                                <span className={`tool ${tool.disabled ? 'disabled' : ''}`} data-tooltip-id={`tool-description-${tool.name}`}>{tool.name}</span>
                                                <ToolTip id={`tool-description-${tool.name}`}>
                                                    <p>{tool.description}</p>
                                                    {parametersTxt &&
                                                        <div>
                                                            <span>Parameters:</span>
                                                            <p>{parametersTxt}</p>
                                                        </div>}
                                                </ToolTip>
                                            </div>
                                        );
                                    })}
                                </dd>
                                {commandTxt && <dt>Command: </dt>}
                                {commandTxt && <dd className="command">{commandTxt}</dd>}
                            </dl>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
