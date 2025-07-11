import * as rpc from 'vscode-jsonrpc/node';

export interface WorkspaceFolder {
    name: string;
    uri: string;
}

export interface InitializeParams {
    processId: number;
    clientInfo: {
        name: string;
        version: string;
    };
    capabilities: {
        codeAssistant: {
            chat: boolean;
        };
    };
    initializationOptions?: any;
    workspaceFolders: WorkspaceFolder[];
}

export interface InitializeResult {
    chatWelcomeMessage: string;
    chatBehavior: string;
    models: string[];
}

export const initialize = new rpc.RequestType<InitializeParams, InitializeResult, void>('initialize');

interface FileContext {
    type: 'file';
    path: string;
}

interface DirectoryContext {
    type: 'directory';
    path: string;
}

interface WebContext {
    type: 'web';
    url: string;
}

type ChatContext = FileContext | DirectoryContext | WebContext;
type ChatBehavior = 'agent' | 'ask';

export interface ChatPromptParams {
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    behavior?: ChatBehavior;
    contexts?: ChatContext[];
}

export interface ChatPromptResult {
    chatId: string;
    model: string;
}

export const chatPrompt = new rpc.RequestType<ChatPromptParams, ChatPromptResult, void>('chat/prompt');
