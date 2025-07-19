import { memo, useState } from 'react';
import { ToolCallOutput } from '../../protocol';
import './ChatToolCall.scss';
import { MarkdownContent } from './MarkdownContent';

interface Props {
    name: string,
    status: string,
    origin: string,
    argumentsText?: string,
    outputs?: ToolCallOutput[],
}

export const ChatToolCall = memo(({ name, status, origin, argumentsText, outputs }: Props) => {
    const argsTxt = '```javascript\n' + argumentsText + '\n```';

    const [open, setOpen] = useState(false);

    const verb = status === 'preparing' || status === 'run' ? 'Calling' : 'Called';
    const originTxt = origin === 'mcp' ? 'MCP' : 'ECA';
    const description = `${verb} ${originTxt} tool`;
    const showOutput = status === 'succeeded' || status === 'failed';

    let iconClass: string;
    switch (status) {
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
        default:
            iconClass = 'codicon-question';
    }

    const toggleOpen = (_event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        setOpen(!open);
    }

    return (
        <div className={`tool-call ${open ? 'open' : ''}`}>
            <div onClick={toggleOpen} className="header">
                <i className="chrevron codicon codicon-chevron-right"></i>
                <span className="description">{description}</span>
                <span className="name">{name}</span>
                <i className={`status codicon ${iconClass}`}></i>
            </div>
            <div className="content">
                {showOutput &&
                    <p>Parameters:</p>}
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
        </div>

    );
});
