import { createSlice } from "@reduxjs/toolkit";
import { WorkspaceFolder } from "@protocol/protocol";

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

interface EcaConfig {
    usageStringFormat: string;
}

export const serverSlice = createSlice({
    name: 'server',
    initialState: {
        status: ServerStatus.Stopped,
        workspaceFolders: [] as WorkspaceFolder[],
        config: {} as EcaConfig,
    },
    reducers: {
        setStatus: (state, action) => {
            state.status = action.payload;
        },
        setWorkspaceFolders: (state, action) => {
            state.workspaceFolders = action.payload;
        },
        setConfig: (state, action) => {
            state.config = action.payload;
        }
    },
});

export const {
    setStatus,
    setWorkspaceFolders,
    setConfig,
} = serverSlice.actions
