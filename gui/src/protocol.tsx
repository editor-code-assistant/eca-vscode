interface TextContent {
    type: 'text';
    text: string;
}

interface ProgressContent {
    type: 'progress';
    state: 'running' | 'finished';
    text?: string;
}

type ChatContent = {type: string} & (TextContent | ProgressContent);

interface ChatContentReceived {
    role: 'user' | 'system' | 'assistant';
    content: ChatContent;
}
