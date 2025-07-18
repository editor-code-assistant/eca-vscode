import { Provider } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Chat from "./pages";
import RootWrapper from "./pages/RootWrapper";
import { MCPDetails } from "./pages/settings/MCPDetails";
import { store } from "./redux/store";

export const ROUTES = {
    CHAT: "/",
    MCP_DETAILS: "/mcp-details",
};

const router = createMemoryRouter([
    {
        path: ROUTES.CHAT,
        element: <RootWrapper />,
        /* errorElement: <Error />, */
        children: [
            {
                path: "/index.html",
                element: <Chat />,
            },
            {
                path: ROUTES.CHAT,
                element: <Chat />,
            },
            {
                path: ROUTES.MCP_DETAILS,
                element: <MCPDetails />,
            },
        ],
    },
]);

function App() {
    return (
        <Provider store={store}>
            <RouterProvider router={router} />
        </Provider>
    );
}

export default App
