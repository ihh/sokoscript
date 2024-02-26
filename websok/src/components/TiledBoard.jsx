import { useState } from 'react';
import Tile from './Tile.jsx';
import useBoardUtils from './boardUtils.js';
import { xy2index } from '../soko/board.js';
import './TiledBoard.css';

export default function TiledBoard(props) {
    const { size, cell, types, icons, onPaint, tileSize } = props;
    const { onMouseDown, onMouseUp, onMouseEnterCell } = useBoardUtils({onPaint});

    const index = new Array(size).fill(0).map ((_, i) => i);

return (
<>
<div className="TiledBoard" onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} style={{fontSize:tileSize+'px',width:(size*tileSize)+'px',height:(size*tileSize)+'px'}}>
{index.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {index.map((x) => {
        const xyCell = cell[xy2index(x,y,size)];
        const typeIndex = typeof(xyCell) === 'number' ? xyCell : xyCell[0];
        const type = types[typeIndex];
        const icon = icons[type];
        return (<Tile key={'tiledBoardRow'+y+'Cell'+x} onMouseEnter={()=>onMouseEnterCell(x,y)} icon={icon} type={type}/>)
    })}
    </div>))}
</div>
</>
);
}