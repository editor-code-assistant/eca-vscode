import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ChatContext } from "../../protocol";
import { incRequestId } from "../slices/chat";
import { ThunkApiType } from "../store";

export const sendPrompt = createAsyncThunk<void, { chatId?: string, prompt: string }, ThunkApiType>(
    "chat/sendPrompt",
    async ({ prompt, chatId }, { dispatch, getState }) => {
        const state = getState();
        let requestId = chatId ? state.chat.chats[chatId].lastRequestId : 0;

        if (chatId) {
            dispatch(incRequestId(chatId));
        }

        const contexts = state.chat.addedContexts;

        webviewSend('chat/userPrompt',
            {
                chatId,
                requestId,
                prompt,
                contexts,
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

export const queryContext = createAsyncThunk<void, { chatId?: string, query: string, contexts: ChatContext[] }, ThunkApiType>(
    "chat/queryContext",
    async ({ chatId, query, contexts }, _) => {
        webviewSend('chat/queryContext', { chatId, query, contexts });
    }
);
