import { createContext, useEffect } from "react";

export interface Message<T = any> {
    type: string;
    data: T;
}

interface vscode {
    postMessage(message: any): vscode;
}

declare const vscode: any;

export interface IIde {
    sendMessage<T>(
        type: string,
        data: T,
    ): void;

    handleMessage<T>(
        type: string,
        handle: (message: T) => any,
    ): void;
}

export class Ide implements IIde {
    sendMessage<T>(type: string, data: T): void {
        const msg = { type, data }
        vscode.postMessage(msg);
    }

    handleMessage<T>(type: string, handle: (mesage: T) => any): void {
        useEffect(() => {
            const handler = (event: MessageEvent) => {
                const message = event.data;
                if (message.type === type) {
                    handle(message.data);
                }
            };
            window.addEventListener('message', handler);
            return () => window.removeEventListener('message', handler);
        }, []);


    }
}

export const IdeContext = createContext<IIde>(
    new Ide(),
);
