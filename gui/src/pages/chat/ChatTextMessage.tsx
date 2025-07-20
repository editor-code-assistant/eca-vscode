import { memo } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    role: string,
    text: string,
}

export const ChatTextMessage = memo(({ role, text }: Props) => {
    return (<div className={`${role}-message text-message `}>
        {role === 'assistant' && (
            <MarkdownContent content={text} />
        )}
        {role != 'assistant' && (
            <span>{text}</span>
        )}
    </div>);
});
