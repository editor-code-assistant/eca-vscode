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
