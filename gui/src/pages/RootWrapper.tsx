import { Outlet, useNavigate } from "react-router-dom";
import { useWebviewListener } from "../hooks";

interface NavigateTo {
    path: string,
    toggle?: boolean,
}

const RootWrapper = () => {
    const navigate = useNavigate();

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

    return (
        <Outlet />
    );
}

export default RootWrapper;
