import { Icon } from '@iconify/react';
import { charRotLookup } from '../soko/lookups.js';

const emptyIcon = "codicon:blank";
const unknownIcon = "mdi:circle";
const unknownRotatableIcon = "mdi:triangle";
const defaultPrefix = "game-icons";

export default function Tile(props) {
    const { type, state, meta, icon, hover, focusColor, idColor, style, ...otherProps } = props;
    let name = icon?.name || (type==='_' ? emptyIcon : (icon?.rotate ? unknownRotatableIcon : unknownIcon));
    if (name.indexOf(':') < 0)
        name = defaultPrefix + ':' + name;
    const color = icon?.color || icon?.defaultColor;
    let tileStyle = { ...style || {}, borderColor: focusColor };
    if (icon?.rotate && state?.length > 0)
        tileStyle.transform = 'rotate(' + (charRotLookup[state.charAt(0)] || 0) + 'deg)';
    if (meta?.id)
        tileStyle.background = idColor;
    return (<Icon className={hover?'hover':''} icon={name} color={color} style={tileStyle} {...otherProps}/>);
}
