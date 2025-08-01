import { createAsyncThunk } from "@reduxjs/toolkit";
import { ServerStatus, setStatus } from "../slices/server";
import { ThunkApiType } from "../store";
import { resetChats } from "../slices/chat";

export const statusChanged = createAsyncThunk<void, { status: ServerStatus }, ThunkApiType>(
    "server/statusChanged",
    async ({ status }, { dispatch }) => {
        dispatch(setStatus(status));
        if (status === ServerStatus.Stopped) {
            dispatch(resetChats());
        }
    }
);
