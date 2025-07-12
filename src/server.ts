import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as protocol from './protocol';
import * as s from './session';
import * as status_bar from './status-bar';

export enum EcaServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

function isClosable(status?: EcaServerStatus) {
    return status == EcaServerStatus.Starting ||
        status == EcaServerStatus.Running;
}

class EcaServer {
    private _proc?: cp.ChildProcessWithoutNullStreams;
    private _connection?: rpc.MessageConnection;
    private _status = EcaServerStatus.Stopped;

    constructor(
        private _statusBar: vscode.StatusBarItem,
        private _channel: vscode.OutputChannel,
        private _onStart: (connection: rpc.MessageConnection) => void,
    ) {}

    get connection() {
        return this._connection!;
    };

    get status() {
        return this._status;
    }

    start() {
        this._status = EcaServerStatus.Starting;
        status_bar.update(this._statusBar, this._status);

        this._proc = cp.spawn('/home/greg/dev/eca/eca', ['server']);
        this._proc.stderr.on('data', (data) => {
            this._channel.appendLine(data.toString());
        });
        this._connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(this._proc.stdout),
            new rpc.StreamMessageWriter(this._proc.stdin));

        let session = s.getSession()!;

        this.connection.listen();

        this.connection.sendRequest(protocol.initialize, {
            processId: process.pid,
            clientInfo: {
                name: "VsCode",
                version: 'XXX'
            },
            capabilities: {
                codeAssistant: {
                    chat: true
                }
            },
            initializationOptions: {
                // TODO custom setting chatBehavior
            },
            workspaceFolders: session.workspaceFolders,
        }).then((result: protocol.InitializeResult) => {
            session.models = result.models;
            session.chatWelcomeMessage = result.chatWelcomeMessage;
            session.chatBehavior = result.chatBehavior;
            this._status = EcaServerStatus.Running;
            status_bar.update(this._statusBar, this._status);
            this._onStart(this.connection);
        });
    }

    async stop() {
        if (isClosable(this._status)) {
            await this.connection.sendRequest(protocol.shutdown, {});
            this.connection.sendNotification(protocol.exit, {});
            this.connection.dispose();
        }
        this._status = EcaServerStatus.Stopped;
        status_bar.update(this._statusBar, this._status);
    }
}

export { EcaServer };
