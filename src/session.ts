import * as cp from 'child_process';
import * as protocol from './protocol';

class Session {
    public process: cp.ChildProcess;
    public workspaceFolders: protocol.WorkspaceFolder[];
    public models: string[] = [];
    public chatBehavior?: string;
    public chatWelcomeMessage?: string;
    public status: string = 'stopped';

    constructor(process: cp.ChildProcess, workspaceFolders: protocol.WorkspaceFolder[]) {
        this.process = process;
        this.workspaceFolders = workspaceFolders;
    }
}

export let session: Session;

export function init(process: cp.ChildProcess, workspaceFolders: protocol.WorkspaceFolder[]) {
    session = new Session(process, workspaceFolders);
}
