import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as protocol from './protocol';

export class Session {
    public process: cp.ChildProcess;
    public workspaceFolders: protocol.WorkspaceFolder[];
    public models: string[] = [];
    public chatBehavior?: string;
    public chatWelcomeMessage?: string;
    public status: string = 'stopped';
    public connection: rpc.MessageConnection;

    constructor(
        process: cp.ChildProcess,
        workspaceFolders: protocol.WorkspaceFolder[],
        connection: rpc.MessageConnection,
    ) {
        this.process = process;
        this.workspaceFolders = workspaceFolders;
        this.connection = connection;
    }
}

export function newSession(process: cp.ChildProcess, workspaceFolders: protocol.WorkspaceFolder[], connection: rpc.MessageConnection) {
    return new Session(process, workspaceFolders, connection);
}
