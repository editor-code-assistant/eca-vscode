import { createSlice } from "@reduxjs/toolkit";

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

export const serverSlice = createSlice({
    name: 'server',
    initialState: {
        status: ServerStatus.Stopped,
    },
    reducers: {
        setStatus: (state, status) => {
            state.status = status.payload;
        },
    },
});

export const { setStatus } = serverSlice.actions
