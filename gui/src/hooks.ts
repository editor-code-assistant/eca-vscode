import { useEffect } from "react";

export function useWebviewListener<T>(
    type: string,
    handle: (message: T) => any,
    dependencies: any[] = [],
) {
    useEffect(
        () => {
            const handler = (event: MessageEvent) => {
                const message = event.data;
                if (message.type === type) {
                    handle(message.data);
                }
            };
            window.addEventListener('message', handler);
            return () => window.removeEventListener('message', handler);
        },
        dependencies,
    );
}

interface vscode {
    postMessage(message: any): vscode;
}

declare const vscode: any;

export function useWebviewSender<T>(
    type: string, data: T,
    dependencies: any[] = [],
) {
    useEffect(
        () => {
            const msg = { type, data }
            vscode.postMessage(msg);
        },
        dependencies,
    );
}
