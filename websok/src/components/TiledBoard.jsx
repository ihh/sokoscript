import { useState, useRef } from 'react';
import Tile from './Tile.jsx';
import useBoardUtils from './boardUtils.js';
import { xy2index } from '../soko/board.js';
import './TiledBoard.css';

export default function TiledBoard(props) {
    const { size, cell, types, icons, onPaint, onDrag, pixelsPerTile, tilesPerSide, top, left, background } = props;

    const onDragWrap = (x, y, stateAtMouseDown) => {
        x = x / pixelsPerTile + left - stateAtMouseDown.left;
        y = y / pixelsPerTile + top - stateAtMouseDown.top;
        if (onDrag)
            onDrag(x,y);
    };
    const { onMouseDown, onMouseUp, onMouseMove, onMouseEnterCell } = useBoardUtils({onPaint,onDrag:onDragWrap});

    const xIndex = new Array(tilesPerSide).fill(0).map ((_, x) => (x + left) % size);
    const yIndex = new Array(tilesPerSide).fill(0).map ((_, y) => (y + top) % size);

return (
<>
<div className="TiledBoard" onMouseDown={onMouseDown({top,left})} onMouseUp={onMouseUp} onMouseMove={onMouseMove} onMouseLeave={onMouseUp} style={{fontSize:pixelsPerTile+'px',width:(tilesPerSide*pixelsPerTile)+'px',height:(tilesPerSide*pixelsPerTile)+'px',background}}>
{yIndex.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {xIndex.map((x) => {
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