import { ITooltip, Tooltip } from "react-tooltip";
import './ToolTip.scss';

export function ToolTip(props: ITooltip) {
    const className = `${props.className} eca-tooltip`;

    return (
        <Tooltip
            className={className}
            {...props}
            noArrow
            opacity={1}
            delayShow={200} />
    );
}
