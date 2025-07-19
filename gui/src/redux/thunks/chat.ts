import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { incRequestId } from "../slices/chat";
import { ThunkApiType } from "../store";

export const sendPrompt = createAsyncThunk<void, { chatId?: string, prompt: string }, ThunkApiType>(
    "chat/sendPrompt",
    async ({ prompt, chatId }, { dispatch, getState }) => {
        let requestId = chatId ? getState().chat.chats[chatId].lastRequestId : 0;

        if (chatId) {
            dispatch(incRequestId(chatId));
        }

        webviewSend('chat/userPrompt',
            {
                chatId,
                requestId,
                prompt,
            },
        );
    }
);

export const stopPrompt = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/stopPrompt",
    async ({ chatId }, _) => {
        webviewSend('chat/promptStop', { chatId });
    }
);
