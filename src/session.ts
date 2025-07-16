import * as protocol from './protocol';
import { EcaServer } from './server';

export class Session {
    public models: string[] = [];
    public chatSelectedModel?: string;
    public chatBehaviors?: string[] = [];
    public chatSelectedBehavior?: protocol.ChatBehavior;
    public chatWelcomeMessage?: string;
    public mcpServers: { [name: string]: protocol.MCPServerUpdatedParams } = {};

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
