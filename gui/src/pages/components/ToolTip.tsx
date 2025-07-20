import { ITooltip, Tooltip, TooltipRefProps } from "react-tooltip";
import './ToolTip.scss';
import { RefAttributes } from "react";

export function ToolTip(props: (ITooltip & RefAttributes<TooltipRefProps>)) {
    const className = `${props.className} eca-tooltip`;
    return (
        <Tooltip
            {...props}
            className={className}
            noArrow
            opacity={1}
            delayShow={props.delayShow || 200} />
    );
}
