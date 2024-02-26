import { Icon } from '@iconify/react';

const emptyIcon = "codicon:blank";
const unknownIcon = "mdi:circle";

export default function Tile(props) {
    const { type, icon } = props;
    const color = icon?.color || icon?.defaultColor;
    return (<span className="tile" title={type==='_'?'':type}>
        {icon?.name
            ? (<Icon icon={icon.name} color={color}/>)
            : (<Icon icon={type==='_' ? emptyIcon : unknownIcon} color={color}/>)}
       </span>);
}
