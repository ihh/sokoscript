import { Icon } from '@iconify/react';

const emptyIcon = "codicon:blank";
const unknownIcon = "mdi:circle";

export default function Tile(props) {
    const { type, icon, ...otherProps } = props;
    const name = icon?.name || (type==='_' ? emptyIcon : unknownIcon);
    const color = icon?.color || icon?.defaultColor;
    const title = type === '_' ? '' : type;
    return (<Icon icon={name} color={color} title={title} {...otherProps}/>);
}
