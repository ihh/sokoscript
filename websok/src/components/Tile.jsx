import { Icon } from '@iconify/react';

const emptyIcon = "codicon:blank";
const unknownIcon = "mdi:circle";

export default function Tile(props) {
    const { type, icon } = props;
    return (<span className="tile" title={type==='_'?'':type}>
        {icon?.name
            ? (<Icon icon={icon.name} color={icon.color}/>)
            : (<Icon icon={type==='_' ? emptyIcon : unknownIcon} color={icon?.color || icon?.defaultColor}/>)}
       </span>);
}
