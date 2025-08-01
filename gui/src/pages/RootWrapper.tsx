import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useWebviewListener, webviewSend } from "../hooks";
import { ChatContentReceived, ChatContext, ChatQueryCommandsResult, ChatQueryContextResult, ToolServerUpdatedParams, WorkspaceFolder } from "../protocol";
import { addContentReceived, addContext, setBehaviors, setCommands, setContexts, setModels, setSelectedBehavior, setSelectedModel, setWelcomeMessage } from "../redux/slices/chat";
import { setMcpServers } from "../redux/slices/mcp";
import { ServerStatus, setConfig, setWorkspaceFolders } from "../redux/slices/server";
import { useEcaDispatch } from "../redux/store";
import { statusChanged } from "../redux/thunks/server";

interface NavigateTo {
    path: string,
    toggle?: boolean,
}

const RootWrapper = () => {
    const navigate = useNavigate();
    const dispatch = useEcaDispatch();

    useWebviewListener(
        "navigateTo",
        async (data: NavigateTo) => {
            if (data.toggle && location.pathname === data.path) {
                navigate("/");
            } else {
                navigate(data.path);
            }
        },
        [location, navigate],
    );

    useWebviewListener('server/statusChanged', (status: ServerStatus) => {
        dispatch(statusChanged({ status: status }));
    });

    useWebviewListener('server/setWorkspaceFolders', (workspaceFolders: WorkspaceFolder[]) => {
        dispatch(setWorkspaceFolders(workspaceFolders));
    });

    useWebviewListener('chat/setBehaviors', ({ behaviors, selectedBehavior }: { behaviors: string[], selectedBehavior: string }) => {
        dispatch(setBehaviors(behaviors));
        dispatch(setSelectedBehavior(selectedBehavior));
    });

    useWebviewListener('chat/setModels', ({ models, selectedModel }: { models: string[], selectedModel: string }) => {
        dispatch(setModels(models));
        dispatch(setSelectedModel(selectedModel));
    });

    useWebviewListener('chat/setWelcomeMessage', (params: any) => {
        dispatch(setWelcomeMessage(params.message));
    });

    useWebviewListener('chat/contentReceived', (contentReceived: ChatContentReceived) => {
        dispatch(addContentReceived(contentReceived))
    });

    useWebviewListener('chat/queryContext', (result: ChatQueryContextResult) => {
        dispatch(setContexts(result));
    });

    useWebviewListener('chat/addContext', (context: ChatContext) => {
        dispatch(addContext(context));
    });

    useWebviewListener('chat/queryCommands', (result: ChatQueryCommandsResult) => {
        dispatch(setCommands(result));
    });

    useWebviewListener('tool/serversUpdated', (mcps: ToolServerUpdatedParams) => {
        dispatch(setMcpServers(mcps));
    });

    useWebviewListener('config/updated', (config: { [key: string]: any }) => {
        dispatch(setConfig(config));
    });

    useEffect(() => {
        webviewSend('webview/ready', {});
    }, []);

    return (
        <Outlet />
    );
}

export default RootWrapper;
