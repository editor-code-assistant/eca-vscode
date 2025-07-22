import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ChatContext } from "../../protocol";
import { incRequestId, resetChat } from "../slices/chat";
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

export const toolCallApprove = createAsyncThunk<void, { chatId: string, toolCallId: string }, ThunkApiType>(
    "chat/toolCallApprove",
    async ({ chatId, toolCallId }, _) => {
        webviewSend('chat/toolCallApprove', { chatId, toolCallId });
    }
);

export const toolCallReject = createAsyncThunk<void, { chatId: string, toolCallId: string }, ThunkApiType>(
    "chat/toolCallReject",
    async ({ chatId, toolCallId }, _) => {
        webviewSend('chat/toolCallReject', { chatId, toolCallId });
    }
);

export const stopPrompt = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/stopPrompt",
    async ({ chatId }, _) => {
        webviewSend('chat/promptStop', { chatId });
    }
);

export const deleteChat = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/delete",
    async ({ chatId }, { dispatch }) => {
        webviewSend('chat/delete', { chatId });
        dispatch(resetChat(chatId));
    }
);

export const queryContext = createAsyncThunk<void, { chatId?: string, query: string, contexts: ChatContext[] }, ThunkApiType>(
    "chat/queryContext",
    async ({ chatId, query, contexts }, _) => {
        webviewSend('chat/queryContext', { chatId, query, contexts });
    }
);
