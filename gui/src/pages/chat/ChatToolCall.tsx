import { FileChangeDetails, ToolCallDetails, ToolCallOutput } from '@protocol/protocol';
import { memo } from 'react';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { openFileInEditor } from '../../redux/thunks/vscode';
import { ChatCollapsableMessage } from './ChatCollapsableMessage';
import './ChatToolCall.scss';
import { MarkdownContent } from './MarkdownContent';

function genericToolCall(
    { toolCallId, name, summary, status, origin, argumentsText, outputs }: Props,
    iconClass: string,
    approvalComp: React.ReactNode,
) {
    const argsTxt = '```javascript\n' + argumentsText + '\n```';

    const originTxt = origin === 'mcp' ? 'MCP' : 'ECA';
    const showOutput = status === 'succeeded' || status === 'failed';

    let verb: string;
    switch (status) {
        case 'preparing':
            verb = 'Calling';
            break;
        case 'run':
            verb = 'Calling';
            break;
        case 'succeeded':
            verb = 'Called';
            break;
        case 'failed':
            verb = 'Called';
            break;
        case 'rejected':
            verb = 'Rejected';
            break;
        default:
            verb = 'Calling';
    }

    const description = summary || `${verb} ${originTxt} tool`;

    return (
        <ChatCollapsableMessage
            className="tool-call"
            header={(toggleOpen) => [
                <span onClick={toggleOpen} className="description">{description}</span>,
                !summary ?
                    <span onClick={toggleOpen} className="name">{name}</span> : null,
                <span onClick={toggleOpen} className="spacing"></span>,
                <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>,
                approvalComp
            ]}
            content={
                <div style={{ display: 'inline' }}>
                    <p>Parameters:</p>
                    <MarkdownContent content={argsTxt} />
                    {showOutput &&
                        <div>
                            <p>Result:</p>
                            {outputs!.map((output, index) => {
                                const outputTxt = '```javascript\n' + output.text + '\n```';
                                return (<MarkdownContent key={toolCallId + index} content={outputTxt} />)
                            })}
                        </div>}
                </div>
            }
        />
    );
}
function fileChangeToolCall({ path, diff, linesAdded, linesRemoved }: FileChangeDetails, iconClass: string, approvalComp: React.ReactNode) {
    const fileDiffs = parseDiff('--- a/' + path + '\n+++ b/' + path + '\n' + diff);
    const fileName = path.split('/').pop();
    const dispatch = useEcaDispatch();

    const openFile = (_event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
        dispatch(openFileInEditor({ path }));
    }

    return (
        <ChatCollapsableMessage
            className="tool-call"
            defaultOpen={true}
            header={(toggleOpen) => [
                <span onClick={openFile} className="file-change-name">{fileName}</span>,
                <span onClick={toggleOpen} className="file-change-lines-added">+{linesAdded}</span>,
                <span onClick={toggleOpen} className="file-change-lines-removed">-{linesRemoved}</span>,
                <span onClick={toggleOpen} className="spacing"></span>,
                <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>,
                approvalComp
            ]}
            content={
                <div>
                    {fileDiffs.map(({ oldRevision, newRevision, type, hunks }) => {
                        return (
                            <Diff key={oldRevision + '-' + newRevision} viewType="unified" gutterType='none' diffType={type} hunks={hunks}>
                                {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                            </Diff>
                        );
                    })}
                </div>
            }
        />
    );
}


interface Props {
    chatId?: string,
    toolCallId: string,
    name: string,
    status: string,
    origin: string,
    argumentsText?: string,
    manualApproval: boolean,
    outputs?: ToolCallOutput[],
    details?: ToolCallDetails,
    summary?: string,
}

export const ChatToolCall = memo((props: Props) => {
    const dispatch = useEcaDispatch();

    const waitingApproval = props.manualApproval && props.status === 'run';

    const rejectToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallReject({ chatId: props.chatId!, toolCallId: props.toolCallId }));
    }

    const approveToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallApprove({ chatId: props.chatId!, toolCallId: props.toolCallId }));
    }

    let iconClass: string;
    switch (props.status) {
        case 'preparing':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'run':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'succeeded':
            iconClass = 'codicon-check succeeded';
            break;
        case 'failed':
            iconClass = 'codicon-error failed';
            break;
        case 'rejected':
            iconClass = 'codicon-error failed';
            break;
        default:
            iconClass = 'codicon-question';
    }

    const approvalComp = waitingApproval && (
        <div className="approval-actions">
            <button onClick={rejectToolCall} className="cancel">Reject</button>
            <button onClick={approveToolCall} className="run">Run</button>
        </div>
    )

    if (props.details?.type === 'fileChange') {
        return fileChangeToolCall(props.details, iconClass, approvalComp);
    } else {
        return genericToolCall(props, iconClass, approvalComp);
    }
});
