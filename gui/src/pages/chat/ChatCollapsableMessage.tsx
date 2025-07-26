import { memo, useState } from "react";
import './ChatCollapsableMessage.scss';

interface Props {
    className: string,
    header: (toggleOpen: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void) => React.ReactNode,
    content?: React.ReactNode,
}

export const ChatCollapsableMessage = memo(({ header, content, className }: Props) => {
    const [open, setOpen] = useState(false);

    const toggleOpen = (_event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        setOpen(!open);
    }

    return (
        <div className={`collapsable ${open ? 'open' : ''} ${className}`}>
            <div className="header">
                <i onClick={toggleOpen} className="chrevron codicon codicon-chevron-right"></i>
                {header(toggleOpen)}
            </div>
            <div className="content">
                {content}
            </div>
        </div>
    );

});
