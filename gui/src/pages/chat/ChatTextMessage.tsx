import { memo } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    role: string,
    text: string,
}

export const ChatTextMessage = memo(({ role, text }: Props) => {
    return (
        <div className={`${role}-message text-message `}>
            {role === 'system' && (
                <span>{text}</span>
            )}
            {role != 'system' && (
                <MarkdownContent content={text} />
            )}
        </div>);
});
