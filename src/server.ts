import * as protocol from '@protocol/protocol';
import * as cp from 'child_process';
import * as extractZip from 'extract-zip';
import { https } from 'follow-redirects';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as ecaApi from './ecaApi';
import * as s from './session';
import * as util from './util';

export enum EcaServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

function isClosable(status?: EcaServerStatus) {
    return status === EcaServerStatus.Starting ||
        status === EcaServerStatus.Running;
}

interface EcaServerArgs {
    serverPathFinder: EcaServerPathFinder,
    channel: vscode.OutputChannel,
    onStarted: (rpcConnection: rpc.MessageConnection) => void,
    onStatusChanged: (status: EcaServerStatus) => void;
}

class EcaServer {
    private _proc?: cp.ChildProcessWithoutNullStreams;
    private _connection?: rpc.MessageConnection;

    private _serverPathFinder: EcaServerPathFinder;
    private _channel: vscode.OutputChannel;
    private _status = EcaServerStatus.Stopped;
    private _onStarted: (rpcConnection: rpc.MessageConnection) => void;
    private _onStatusChanged: (status: EcaServerStatus) => void;

    constructor({ serverPathFinder, channel, onStarted, onStatusChanged }: EcaServerArgs) {
        this._serverPathFinder = serverPathFinder;
        this._channel = channel;
        this._onStarted = onStarted;
        this._onStatusChanged = onStatusChanged;
    }

    get connection() {
        return this._connection!;
    };

    get status() {
        return this._status;
    }

    private changeStatus(newStatus: EcaServerStatus) {
        this._status = newStatus;
        this._onStatusChanged(newStatus);
    }

    async start() {
        this.changeStatus(EcaServerStatus.Starting);

        const userShellEnv = await util.getUserShellEnv();

        const config = vscode.workspace.getConfiguration('eca');
        const customServerArgs = config.get<string>('serverArgs');

        let args = ['server'];
        if (customServerArgs) {
            args.push(customServerArgs);
        }

        this._serverPathFinder.find().then((serverPath) => {
            this._proc = cp.spawn(
                serverPath,
                args,
                {
                    env: { ...process.env, ...userShellEnv }
                }
            );

            this._proc.stderr.on('data', (data) => {
                this._channel.appendLine(data.toString());
            });
            this._connection = rpc.createMessageConnection(
                new rpc.StreamMessageReader(this._proc.stdout),
                new rpc.StreamMessageWriter(this._proc.stdin));

            let session = s.getSession()!;

            this.connection.listen();

            this.connection.sendRequest(ecaApi.initialize, {
                processId: process.pid,
                clientInfo: {
                    name: 'VsCode',
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
                session.chatSelectedModel = result.chatDefaultModel;
                session.chatBehaviors = result.chatBehaviors;
                session.chatSelectedBehavior = result.chatDefaultBehavior;
                this.changeStatus(EcaServerStatus.Running);
                this.connection.sendNotification(ecaApi.initialized, {});
                this._onStarted(this.connection);
            });
        }).catch((err) => console.error('Fail to find eca server path.', err));
    }

    async stop() {
        if (isClosable(this._status)) {
            await this.connection.sendRequest(ecaApi.shutdown, {});
            this.connection.sendNotification(ecaApi.exit, {});
            this.connection.dispose();
        }
        this.changeStatus(EcaServerStatus.Stopped);
    }
}

const artifacts: { [key: string]: any } = {
    darwin: {
        x64: 'eca-native-macos-amd64.zip',
        arm64: 'eca-native-macos-aarch64.zip',
    },
    linux: {
        x64: 'eca-native-static-linux-amd64.zip',
        arm64: 'eca-native-linux-aarch64.zip',
    },
    win32: {
        x64: 'eca-native-windows-amd64.zip',
    },
};

const versionFileName = 'eca-version';

class EcaServerPathFinder {

    constructor(
        private _context: vscode.ExtensionContext,
    ) {
    }

    private getArtifactName(
        platform: string = process.platform,
        arch: string = process.arch
    ): string {
        return artifacts[platform]?.[arch] ?? 'eca.jar';
    }

    private getExtensionServerPath(
        platform: string = process.platform,
        arch: string = process.arch
    ): string {
        let name = this.getArtifactName(platform, arch);
        if (path.extname(name).toLowerCase() !== '.jar') {
            name = platform === 'win32' ? 'eca.exe' : 'eca';
        }
        return path.join(this._context.extensionPath, name);
    }

    private async downloadLatestServer(serverPath: string, version: string) {
        const extensionPath = this._context.extensionPath;
        const artifactName = this.getArtifactName();
        const url = `https://github.com/editor-code-assistant/eca/releases/download/${version}/${artifactName}`;

        const downloadPath = path.join(extensionPath, artifactName);

        console.log(`Downloading eca from ${url} to ${downloadPath}`);

        try {
            await new Promise((resolve, reject) => {
                https
                    .get(url, (response) => {
                        if (response.statusCode === 200) {
                            const writeStream = fs.createWriteStream(downloadPath);
                            response
                                .on('end', () => {
                                    writeStream.close();
                                    console.log('ECA artifact downloaded to', downloadPath);
                                    resolve(true);
                                })
                                .pipe(writeStream);
                        } else {
                            response.resume(); // Consume response to free up memory
                            reject(new Error(response.statusMessage));
                        }
                    })
                    .on('error', reject);
            });
            if (path.extname(downloadPath) === '.zip') {
                await extractZip.default(downloadPath, { dir: extensionPath });
            }
            if (path.extname(serverPath) === '') {
                await fs.promises.chmod(serverPath, 0o775);
            }
            this.writeVersionFile(version);
        } catch (e) {
            console.log(`Error downloading eca, from ${url}`, e);
            throw new Error(`Error downloading eca, from ${url}`);
        }

    }

    private async getLatestVersion(): Promise<string> {
        try {
            const releasesJSON = await util.fetchFromUrl(
                'https://api.github.com/repos/editor-code-assistant/eca/releases'
            );
            const releases = JSON.parse(releasesJSON);
            return releases[0].tag_name;
        } catch (err) {
            return '';
        }
    }

    private getVersionFilePath(): string {
        return path.join(this._context.extensionPath, versionFileName);
    }

    private async readVersionFile() {
        const filePath = this.getVersionFilePath();
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (e) {
            console.error('Could not read eca version file.', e);
        }
    }

    private async writeVersionFile(version: string) {
        const filePath = this.getVersionFilePath();
        try {
            fs.writeFileSync(filePath, version);
        } catch (e) {
            console.log('Could not write eca version file.', e);
        }

    }

    async find() {
        const config = vscode.workspace.getConfiguration('eca');
        const customServerPath = config.get<string>('serverPath');
        if (customServerPath?.trim() !== "") {
            return customServerPath!;
        }

        const serverPath = this.getExtensionServerPath();
        const latestVersion = await this.getLatestVersion();
        const currentVersion = await this.readVersionFile();

        const exists = await fs.promises
            .stat(serverPath)
            .then(() => true)
            .catch((err) => {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
                return false;
            });

        if (latestVersion === '' && !exists) {
            throw new Error('Could not fetch latest version of eca. Please check your internet connection and try again. You can also download eca manually and set the path in the vscode settings.');
        }

        if (!exists || (currentVersion !== latestVersion)) {
            await this.downloadLatestServer(serverPath, latestVersion);
        }

        return serverPath;
    }

}


export { EcaServer, EcaServerPathFinder };
