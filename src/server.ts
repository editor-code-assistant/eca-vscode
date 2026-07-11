import * as cp from 'child_process';
import * as extractZip from 'extract-zip';
import { https } from 'follow-redirects';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
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
    private _startCounter = 0;

    private _serverPathFinder: EcaServerPathFinder;
    private _channel: vscode.OutputChannel;
    private _status = EcaServerStatus.Stopped;
    private _onStarted: (rpcConnection: rpc.MessageConnection) => void;
    private _onStatusChanged: (status: EcaServerStatus) => void;

    // Optional log sink. Wired by extension.ts to the shared LogStore so
    // server stderr + lifecycle messages also show up in the webview's
    // Settings → Logs tab. We keep the existing OutputChannel writes
    // unchanged (users who prefer VS Code's native Output panel still
    // see everything) and mirror each line through `onLog` on top.
    onLog: (msg: string) => void = () => {};

    constructor({ serverPathFinder, channel, onStarted, onStatusChanged }: EcaServerArgs) {
        this._serverPathFinder = serverPathFinder;
        this._channel = channel;
        this._onStarted = onStarted;
        this._onStatusChanged = onStatusChanged;
    }

    private log(msg: string) {
        // Mirror every log line to both sinks so the Output panel and
        // the Logs tab stay in sync even if only one is open.
        this._channel.appendLine(msg);
        try { this.onLog(msg); } catch { /* subscriber must not poison producers */ }
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
        if (this._status === EcaServerStatus.Starting ||
            this._status === EcaServerStatus.Running) {
            this.log(`[VSCODE] server already ${this._status}, ignoring start request`);
            return;
        }

        this.changeStatus(EcaServerStatus.Starting);
        // Identifies this start attempt so async continuations (download,
        // spawn, initialize) can bail out when a stop/restart superseded them
        // in the meantime, instead of spawning a zombie process.
        const startId = ++this._startCounter;

        // Shell env is a nice-to-have; a broken user shell must not prevent
        // the server from starting with the plain process env.
        const userShellEnv = await util.getUserShellEnv().catch((err) => {
            this.log(`[VSCODE] could not load user shell env (${err}), continuing with process env`);
            return {};
        });

        const config = vscode.workspace.getConfiguration('eca');
        const customServerArgsStr = config.get<string>('serverArgs');
        const customServerArgs = customServerArgsStr?.trim()
            ? customServerArgsStr.split(' ')
            : [];

        let args = ['server', ...customServerArgs];

        this._serverPathFinder.find().then((serverPath) => {
            if (startId !== this._startCounter || this._status !== EcaServerStatus.Starting) {
                this.log('[VSCODE] server start superseded, not spawning');
                return;
            }

            this.log(`[VSCODE] spawning server: ${serverPath} with args: ${args.join(' ')}`);

            let session = s.getSession()!;
            const envAll = { ...process.env, ...userShellEnv };

            let proc: cp.ChildProcessWithoutNullStreams;
            if (process.platform === 'win32' && serverPath.endsWith('.bat')) {
                proc = cp.spawn('cmd.exe', ['/s', '/c', 'call', serverPath, ...args], {
                    cwd: path.dirname(serverPath),
                    env: envAll,
                });
            } else {
                proc = cp.spawn(serverPath, args, {
                    cwd: path.dirname(serverPath),
                    env: envAll,
                });
            }
            this._proc = proc;

            proc.on('close', (code, signal) => {
                this.log(`[VSCODE] server process closed: code=${code} signal=${signal}`);
                // Only react if this is still the current process; a close
                // event from a previous (stopped/restarted) process must not
                // flip the status of the current one.
                if (this._proc !== proc) {
                    return;
                }
                if (this._status !== EcaServerStatus.Stopped &&
                    this._status !== EcaServerStatus.Failed) {
                    if (process.platform === 'darwin' && (signal === 'SIGKILL' || code === 137)) {
                        // macOS SIGKILLs binaries whose code signature fails
                        // validation (e.g. corrupted download). Drop the
                        // version cache so the next start re-downloads a fresh
                        // binary instead of reusing the broken one forever.
                        this.log('[VSCODE] server killed with SIGKILL, likely macOS code signature validation, invalidating downloaded server so the next start fetches a fresh one');
                        this._serverPathFinder.invalidateCache();
                    }
                    this.changeStatus(EcaServerStatus.Failed);
                }
            });

            proc.on('error', (err) => {
                this.log(`[VSCODE] server process error: ${err}`);
                if (this._proc === proc &&
                    this._status !== EcaServerStatus.Stopped &&
                    this._status !== EcaServerStatus.Failed) {
                    this.changeStatus(EcaServerStatus.Failed);
                }
            });

            proc.stderr.on('data', (data) => {
                // `data` arrives as chunks, which can split mid-line. We still
                // forward them as-is: the Logs tab and the OutputChannel both
                // tolerate partial lines, and collapsing into lines here would
                // buffer the very errors users most need to see in real time.
                this.log(data.toString());
            });
            this._connection = rpc.createMessageConnection(
                new rpc.StreamMessageReader(proc.stdout),
                new rpc.StreamMessageWriter(proc.stdin));

            this.connection.listen();

            // Fail loudly if the server never answers initialize (e.g. the
            // process died before jsonrpc noticed, or hung) instead of staying
            // on Starting forever with no way out.
            let initTimer: NodeJS.Timeout | undefined;
            const initTimeout = new Promise<never>((_, reject) => {
                initTimer = setTimeout(
                    () => reject(new Error('timed out after 60s waiting for the initialize response')),
                    60000);
            });

            Promise.race([
                this.connection.sendRequest(ecaApi.initialize, {
                    processId: process.pid,
                    clientInfo: {
                        name: 'VsCode',
                        version: 'XXX'
                    },
                    capabilities: {
                        codeAssistant: {
                            chat: true,
                            rewrite: true,
                            editor: { diagnostics: true },
                            chatCapabilities: { askQuestion: true }
                        }
                    },
                    initializationOptions: {
                        // TODO custom setting chatAgent
                    },
                    workspaceFolders: session.workspaceFolders,
                }),
                initTimeout,
            ]).then((_) => {
                if (this._proc !== proc || this._status !== EcaServerStatus.Starting) {
                    return;
                }
                this.changeStatus(EcaServerStatus.Running);
                this.connection.sendNotification(ecaApi.initialized, {});
                this._onStarted(this.connection);
            }).catch((err) => {
                this.log(`[VSCODE] server initialize failed: ${err}`);
                if (this._proc === proc && this._status === EcaServerStatus.Starting) {
                    this.changeStatus(EcaServerStatus.Failed);
                    this.killProcess();
                }
            }).finally(() => {
                if (initTimer) {
                    clearTimeout(initTimer);
                }
            });
        }).catch((err) => {
            this.log(`[VSCODE] Fail to find eca server path: ${err}`);
            vscode.window.showErrorMessage(`ECA server failed to start: ${err}`);
            if (this._status !== EcaServerStatus.Stopped &&
                this._status !== EcaServerStatus.Failed) {
                this.changeStatus(EcaServerStatus.Failed);
            }
        }
        );
    }

    private killProcess() {
        const proc = this._proc;
        if (proc && proc.exitCode === null && proc.signalCode === null && !proc.killed) {
            try {
                proc.kill();
            } catch (err) {
                this.log(`[VSCODE] failed to kill server process: ${err}`);
            }
        }
    }

    async stop() {
        const connection = this._connection;
        try {
            if (isClosable(this._status) && connection) {
                // Ask for a graceful shutdown, but don't hang forever when the
                // process is dead or unresponsive: a request written to a dead
                // pipe never settles, which used to make this command a no-op
                // exactly when users most need it.
                const graceful = (async () => {
                    await connection.sendRequest(ecaApi.shutdown, {});
                    connection.sendNotification(ecaApi.exit, {});
                })();
                // Settled via the race below; without this a late rejection
                // (e.g. connection disposed) becomes an unhandled rejection.
                graceful.catch(() => { });
                await Promise.race([
                    graceful,
                    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
                ]);
            }
        } catch (err) {
            this.log(`[VSCODE] error on server shutdown request: ${err}`);
        } finally {
            try {
                connection?.dispose();
            } catch { /* may already be disposed */ }
            this._connection = undefined;
            this.killProcess();
            this._proc = undefined;
            this.changeStatus(EcaServerStatus.Stopped);
        }
    }

    async restart() {
        await this.stop();
        await this.start();
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
        private _channel: vscode.OutputChannel,
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

    private downloadFile(url: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    response.resume(); // Consume response to free up memory
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                // pipeline only settles after the write stream fully flushed
                // and closed (or either side errored). Resolving earlier, e.g.
                // on the response 'end' event, can leave a truncated artifact
                // behind, which corrupts the macOS code signature and gets the
                // binary SIGKILLed on spawn.
                pipeline(response, fs.createWriteStream(destPath))
                    .then(() => resolve())
                    .catch(reject);
            });
            request.on('error', reject);
            // Inactivity timeout so a stalled connection fails loudly instead
            // of leaving the server status on Starting forever.
            request.setTimeout(60000, () => {
                request.destroy(new Error(`Download timed out: ${url}`));
            });
        });
    }

    private async fetchExpectedSha256(artifactUrl: string): Promise<string | undefined> {
        try {
            const content = await util.fetchFromUrl(`${artifactUrl}.sha256`);
            const sha256 = content.trim().split(/\s+/)[0]?.toLowerCase();
            if (sha256 && /^[0-9a-f]{64}$/.test(sha256)) {
                return sha256;
            }
            this._channel.appendLine(`Unexpected content in ${artifactUrl}.sha256, skipping integrity check`);
        } catch (e) {
            this._channel.appendLine(`Could not fetch ${artifactUrl}.sha256 (${e}), skipping integrity check`);
        }
        return undefined;
    }

    private async sha256sum(filePath: string): Promise<string> {
        const hash = crypto.createHash('sha256');
        await pipeline(fs.createReadStream(filePath), hash);
        return hash.digest('hex');
    }

    // Extraction can hang or silently truncate on rare setups: seen in the
    // wild on macOS aarch64, where the trailing ~13KB of the binary (the
    // Mach-O code signature, which sits at the end of the file) never got
    // written even though the zip on disk was checksum-verified, so the
    // kernel SIGKILLed the binary on spawn. Extract into a staging dir,
    // enforce a timeout, and record the sizes the zip declares per entry so
    // the result can be verified before install.
    private async extractToStage(zipPath: string, stageDir: string, entrySizes: Map<string, number>): Promise<void> {
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('zip extraction timed out after 120s')), 120000);
        });
        try {
            await Promise.race([
                extractZip.default(zipPath, {
                    dir: stageDir,
                    onEntry: (entry) => {
                        if (!entry.fileName.endsWith('/')) {
                            entrySizes.set(entry.fileName, entry.uncompressedSize);
                        }
                    },
                }),
                timeout,
            ]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    private async extractedBinaryOk(binaryPath: string, expectedSize?: number): Promise<boolean> {
        try {
            const stat = await fs.promises.stat(binaryPath);
            if (expectedSize !== undefined && stat.size !== expectedSize) {
                this._channel.appendLine(`Extracted ${path.basename(binaryPath)} has ${stat.size} bytes but the zip declares ${expectedSize} bytes`);
                return false;
            }
            return stat.size > 0;
        } catch {
            return false;
        }
    }

    private systemUnzip(zipPath: string, destDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            cp.execFile('unzip', ['-o', '-q', zipPath, '-d', destDir], { timeout: 120000 }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private async installServerBinary(downloadPath: string, serverPath: string): Promise<void> {
        const extensionPath = this._context.extensionPath;
        const binaryName = path.basename(serverPath);
        const stageDir = path.join(extensionPath, `.eca-stage-${process.pid}-${Date.now()}`);
        const stagedBinary = path.join(stageDir, binaryName);
        const entrySizes = new Map<string, number>();
        const canFallback = process.platform !== 'win32';
        let usedFallback = false;
        try {
            try {
                await this.extractToStage(downloadPath, stageDir, entrySizes);
            } catch (err) {
                if (!canFallback) {
                    throw err;
                }
                this._channel.appendLine(`Extraction failed (${err}), retrying with system unzip...`);
                await this.systemUnzip(downloadPath, stageDir);
                usedFallback = true;
            }
            let ok = await this.extractedBinaryOk(stagedBinary, entrySizes.get(binaryName));
            if (!ok && canFallback && !usedFallback) {
                this._channel.appendLine('Extracted binary looks corrupted, retrying with system unzip...');
                await fs.promises.rm(stagedBinary, { force: true });
                await this.systemUnzip(downloadPath, stageDir);
                ok = await this.extractedBinaryOk(stagedBinary, entrySizes.get(binaryName));
            }
            if (!ok) {
                throw new Error(`Extracted ${binaryName} is corrupted or missing (does not match the size declared by the zip)`);
            }
            if (path.extname(serverPath) === '') {
                await fs.promises.chmod(stagedBinary, 0o775);
            }
            // Atomic install: rename swaps the directory entry in one step, so
            // nothing can ever observe a partially written binary and the
            // previous binary stays intact until the swap.
            try {
                await fs.promises.rename(stagedBinary, serverPath);
            } catch {
                // Windows can refuse to rename over an existing/locked exe.
                await fs.promises.rm(serverPath, { force: true });
                await fs.promises.rename(stagedBinary, serverPath);
            }
            this._channel.appendLine(`ECA server binary installed at ${serverPath}`);
        } finally {
            await fs.promises.rm(stageDir, { recursive: true, force: true }).catch(() => { });
        }
    }

    private async cleanupStaleStageDirs(extensionPath: string): Promise<void> {
        try {
            for (const entry of await fs.promises.readdir(extensionPath)) {
                if (entry.startsWith('.eca-stage-')) {
                    await fs.promises.rm(path.join(extensionPath, entry), { recursive: true, force: true });
                }
            }
        } catch { /* best-effort */ }
    }

    private async downloadAndVerify(url: string, downloadPath: string): Promise<void> {
        await this.downloadFile(url, downloadPath);
        this._channel.appendLine(`ECA artifact downloaded to ${downloadPath}`);

        const expectedSha256 = await this.fetchExpectedSha256(url);
        if (!expectedSha256) {
            return;
        }
        const actualSha256 = await this.sha256sum(downloadPath);
        if (actualSha256 !== expectedSha256) {
            await fs.promises.rm(downloadPath, { force: true });
            throw new Error(`Checksum mismatch (expected ${expectedSha256}, got ${actualSha256}), download is corrupted`);
        }
        this._channel.appendLine(`Checksum OK (sha256 ${actualSha256})`);
    }

    private async downloadLatestServer(serverPath: string, version: string) {
        const extensionPath = this._context.extensionPath;
        const artifactName = this.getArtifactName();
        const url = `https://github.com/editor-code-assistant/eca/releases/download/${version}/${artifactName}`;

        const downloadPath = path.join(extensionPath, artifactName);

        this._channel.appendLine(`Downloading eca from ${url} to ${downloadPath}`);

        try {
            await this.cleanupStaleStageDirs(extensionPath);
            try {
                await this.downloadAndVerify(url, downloadPath);
            } catch (e) {
                this._channel.appendLine(`Download failed (${e}), retrying once...`);
                await fs.promises.rm(downloadPath, { force: true });
                await this.downloadAndVerify(url, downloadPath);
            }

            if (path.extname(downloadPath) === '.zip') {
                // Staged extraction + verification + atomic swap; the old
                // binary is only replaced by a fully verified new one.
                await this.installServerBinary(downloadPath, serverPath);
            } else if (path.extname(serverPath) === '') {
                // Non-zip artifact: the downloaded file is the server itself.
                await fs.promises.chmod(serverPath, 0o775);
            }
            // Cache the version only after download, verification and
            // extraction all succeeded, otherwise a broken attempt would be
            // reused forever instead of re-downloaded on the next start.
            this.writeVersionFile(version);
        } catch (e) {
            // Remove the zip so the next start re-downloads. The server
            // binary itself is never partial anymore (staged + atomic
            // rename), so an intact previous binary is left alone.
            await fs.promises.rm(downloadPath, { force: true }).catch(() => { });
            throw new Error(`Error downloading eca from ${url}: ${e}`);
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
            console.error('Could not fetch latest server version', err);
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
            console.error('Could not write eca version file.', e);
        }

    }

    // Drops the cached version marker so the next find() re-downloads the
    // server even if the binary file still exists. Used when the downloaded
    // binary proves unusable at runtime (e.g. SIGKILLed by macOS for a broken
    // code signature).
    invalidateCache() {
        try {
            fs.rmSync(this.getVersionFilePath(), { force: true });
            fs.rmSync(this.getExtensionServerPath(), { force: true });
        } catch (e) {
            console.error('Could not invalidate eca server cache.', e);
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

        if (!exists || (latestVersion !== '' && currentVersion !== latestVersion)) {
            await this.downloadLatestServer(serverPath, latestVersion);
        }

        return serverPath;
    }

}


export { EcaServer, EcaServerPathFinder };
