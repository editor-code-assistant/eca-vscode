import { memo } from "react";
import { ChatCollapsableMessage } from "./ChatCollapsableMessage";
import './ChatReason.scss';

interface Props {
    id: string,
    status: string,
    content?: string,
}

export const ChatReason = memo(({ id, status, content }: Props) => {
    let label;
    let extraIconClass;
    if (status === 'done') {
        label = 'Thoughts';
        extraIconClass = 'codicon-sparkle';
    } else {
        label = 'Thinking';
        extraIconClass = 'codicon-loading codicon-modifier-spin';
    }

    return (
        <ChatCollapsableMessage
            className="reason"
            header={(toggleOpen) => [
                <span key={`reason-${id}-label`} onClick={toggleOpen}>{label}</span>,
                <i key={`reason-${id}-icon`} onClick={toggleOpen} className={`icon codicon ${extraIconClass}`}></i>
            ]}
            content={
                <p>{content}</p>
            }
        />
    );

});
