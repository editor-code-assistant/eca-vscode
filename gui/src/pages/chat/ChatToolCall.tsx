import { memo } from 'react';
import { ToolCallOutput } from '@protocol/protocol';
import { useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { ChatCollapsableMessage } from './ChatCollapsableMessage';
import './ChatToolCall.scss';
import { MarkdownContent } from './MarkdownContent';

interface Props {
    chatId?: string,
    toolCallId: string,
    name: string,
    status: string,
    origin: string,
    argumentsText?: string,
    manualApproval: boolean,
    outputs?: ToolCallOutput[],
}

export const ChatToolCall = memo(({ chatId, toolCallId, name, status, origin, argumentsText, outputs, manualApproval }: Props) => {
    const argsTxt = '```javascript\n' + argumentsText + '\n```';
    const dispatch = useEcaDispatch();

    const originTxt = origin === 'mcp' ? 'MCP' : 'ECA';
    const showOutput = status === 'succeeded' || status === 'failed';

    let iconClass: string;
    let verb: string;
    switch (status) {
        case 'preparing':
            verb = 'Calling';
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'run':
            verb = 'Calling';
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'succeeded':
            verb = 'Called';
            iconClass = 'codicon-check succeeded';
            break;
        case 'failed':
            verb = 'Called';
            iconClass = 'codicon-error failed';
            break;
        case 'rejected':
            verb = 'Rejected';
            iconClass = 'codicon-error failed';
            break;
        default:
            verb = 'Calling';
            iconClass = 'codicon-question';
    }

    const description = `${verb} ${originTxt} tool`;
    const waitingApproval = manualApproval && status === 'run';

    const rejectToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallReject({ chatId: chatId!, toolCallId }));
    }

    const approveToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallApprove({ chatId: chatId!, toolCallId }));
    }

    return (
        <ChatCollapsableMessage
            className="tool-call"
            header={(toggleOpen) => (
                <div style={{ display: 'inline' }}>
                    <span onClick={toggleOpen} className="description">{description}</span>
                    <span onClick={toggleOpen} className="name">{name}</span>
                    <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>
                    {waitingApproval && (
                        <div className="approval-actions">
                            <button onClick={rejectToolCall} className="cancel">Cancel</button>
                            <button onClick={approveToolCall} className="run">Run</button>
                        </div>
                    )}
                </div>
            )}
            content={
                <div style={{ display: 'inline' }}>
                    <p>Parameters:</p>
                    <MarkdownContent content={argsTxt} />
                    {showOutput &&
                        <div>
                            <p>Result:</p>
                            {outputs!.map((output, index) => {
                                const outputTxt = '```javascript\n' + output.content + '\n```';
                                return (<MarkdownContent key={index} content={outputTxt} />)
                            })}
                        </div>}
                </div>
            }
        />
    );
});
