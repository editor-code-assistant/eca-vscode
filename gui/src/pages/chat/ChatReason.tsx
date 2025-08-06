import { memo } from "react";
import { ChatCollapsableMessage } from "./ChatCollapsableMessage";
import './ChatReason.scss';

interface Props {
    status: string,
    content?: string,
}

export const ChatReason = memo(({ status, content }: Props) => {
    let label;
    let extraIconClass;
    if (status === 'done') {
        label = 'Thought';
        extraIconClass = 'codicon-symbol-misc';
    } else {
        label = 'Thinking';
        extraIconClass = 'codicon-loading codicon-modifier-spin';
    }

    return (
        <ChatCollapsableMessage
            className="reason"
            header={(toggleOpen) => [
                <span onClick={toggleOpen}>{label}</span>,
                <i onClick={toggleOpen} className={`icon codicon ${extraIconClass}`}></i>
            ]}
            content={
                <p>{content}</p>
            }
        />
    );

});
