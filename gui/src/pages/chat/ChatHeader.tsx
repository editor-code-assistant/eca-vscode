import './ChatHeader.scss';

interface Props {
    onClear: () => any;
}

export function ChatHeader({onClear}: Props) {
    const clearChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        onClear();
    }

    return (
        <div className="chat-header">
            <div className="actions">
                <div className="action"><i onClick={clearChat} className="codicon codicon-trash"></i></div>
            </div>
        </div>
    );
}
