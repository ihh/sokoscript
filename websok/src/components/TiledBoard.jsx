import { Icon } from '@iconify/react';

import { xy2index } from '../soko/board.js';
import { hexMD5 } from '../soko/md5.js';

const emptyIcon = "codicon:blank";
const unknownIcon = "mdi:circle";

export default function TiledBoard(props) {
    const { size, cell, types, icons } = props;
    const index = new Array(size).fill(0).map ((_, i) => i);
    let autoColor = {};
    types.forEach ((type) => {
        if (!icons[type]) {
            const hash = hexMD5(type);
            const hue = Math.floor (360 * parseInt(hash.substring(0,3),16) / 0x1000);
            const sat = 30 + Math.floor (40 * parseInt(hash.substring(3,5),16) / 0x100);
            const lev = 30 + Math.floor (40 * parseInt(hash.substring(5,7),16) / 0x100);
            autoColor[type] = `hsl(${hue},${sat}%,${lev}%)`;
        }
    });
return (
<>
<div className="tileGrid">
{index.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {index.map((x) => {
        const xyCell = cell[xy2index(x,y,size)];
        const typeIndex = typeof(xyCell) === 'number' ? xyCell : xyCell[0];
        const type = types[typeIndex];
        const icon = icons[type];
        return (<span className="tile" key={'tiledBoardRow'+y+'Cell'+x} title={typeIndex?type:""}>
            {icon
             ? <Icon icon={icon.icon} color={icon.color}/>
             : <Icon icon={typeIndex ? unknownIcon : emptyIcon} color={autoColor[type]}/>}
        </span>)
    })}
    </div>))}
</div>
</>
);
}