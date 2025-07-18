import { Outlet, useNavigate } from "react-router-dom";
import { useWebviewListener } from "../hooks";
import { ChatContentReceived, MCPServerUpdatedParams } from "../protocol";
import { addContentReceived, setBehaviors, setModels, setSelectedBehavior, setSelectedModel, setWelcomeMessage } from "../redux/slices/chat";
import { setMcpServers } from "../redux/slices/mcp";
import { ServerStatus, setStatus } from "../redux/slices/server";
import { useEcaDispatch } from "../redux/store";

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
        dispatch(setStatus(status));
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

    useWebviewListener('mcp/serversUpdated', (mcps: MCPServerUpdatedParams) => {
        dispatch(setMcpServers(mcps));
    });

    return (
        <Outlet />
    );
}

export default RootWrapper;
