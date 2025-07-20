import { useSelector } from 'react-redux';
import { State } from '../../redux/store';
import './MCPDetails.scss';
import { ToolTip } from '../components/ToolTip';

export function MCPDetails() {
    const mcpServers = useSelector((state: State) => state.mcp.servers);

    return (
        <div className="mcp-details-container scrollable">
            <div className="servers">
                <h2 className="title">MCP Servers</h2>
                <p className="description">MCPs are extra tools that can offer more power to ECA, for more details check <a href="https://modelcontextprotocol.io">MCP</a></p>
                {mcpServers.map((server, index) => {
                    const commandTxt = server.command + " " + (server.args?.join(" ") || "");

                    return (
                        <div key={index} className="server">
                            <span className="name">{server.name}</span>
                            <i className={`status ${server.status}`}></i>
                            <dl>
                                <dt>Tools: </dt>
                                <dd className="tools">
                                    {server.tools?.map((tool) => {
                                        let parametersTxt = '';
                                        if (tool.parameters && tool.parameters.properties) {
                                            parametersTxt = Object.entries(tool.parameters.properties)
                                                .map(([key, value]) => `${key}: ${value.description || 'No description'}`)
                                                .join(', ');
                                        }

                                        return (
                                            <div style={{display: "inline-block"}}>
                                                <span className="tool" data-tooltip-id={`tool-description-${tool.name}`}>{tool.name}</span>
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
                                <dt>Command: </dt>
                                <dd className="command">{commandTxt}</dd>
                            </dl>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
