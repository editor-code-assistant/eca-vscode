import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as protocol from './protocol';

export class Session {
    public models: string[] = [];
    public chatBehavior?: string;
    public chatWelcomeMessage?: string;
    public status: string = 'stopped';

    constructor(
        public process: cp.ChildProcessWithoutNullStreams,
        public workspaceFolders: protocol.WorkspaceFolder[],
        public connection: rpc.MessageConnection,
    ) {
        this.process = process;
        this.workspaceFolders = workspaceFolders;
        this.connection = connection;
    }
}

let session: Session | undefined;

export function curSession() { return session; }

export function initSession(
    process: cp.ChildProcessWithoutNullStreams,
    workspaceFolders: protocol.WorkspaceFolder[],
    connection: rpc.MessageConnection,
) {
    session = new Session(process, workspaceFolders, connection);
}
