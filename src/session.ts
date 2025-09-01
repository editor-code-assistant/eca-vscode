import * as protocol from './protocol';
import { EcaServer } from './server';

export class Session {
    public mcpServers: { [name: string]: protocol.ToolServerUpdatedParams } = {};

    constructor(
        public server: EcaServer,
        public workspaceFolders: protocol.WorkspaceFolder[],
    ) {
    }
}

let session: Session | undefined;

export function getSession() { return session; }

export function initSession(
    server: EcaServer,
    workspaceFolders: protocol.WorkspaceFolder[],
) {
    session = new Session(server, workspaceFolders);
}
