import { createContext, useContext, useState } from "react";
import { useWebviewListener } from "../hooks";

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

export interface Server {
    status: ServerStatus,
}

const initState: Server = {
    status: ServerStatus.Stopped
};

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<ServerStatus>(initState.status);

    useWebviewListener('server/statusChanged', (status: ServerStatus) => {
        setStatus(status);
    });

    const server: Server = {
        status,
    }

    return (
        <ServerContext value={server}>
            {children}
        </ServerContext>
    );
}

const ServerContext = createContext<Server>(initState);

export const useServerProvider = (): Server => useContext(ServerContext);
