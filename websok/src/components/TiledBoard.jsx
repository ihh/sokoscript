import { useState, useRef } from 'react';
import Tile from './Tile.jsx';
import { useBoardUtils, focusCssColor } from './boardUtils.js';
import { xy2index } from '../soko/board.js';
import './TiledBoard.css';

export default function TiledBoard(props) {
    const { size, cell, types, icons, onPaint, onDrag, onHover, pixelsPerTile, tilesPerSide, top, left, hoverCell, cursor, background } = props;

    const onHoverWrap = (x, y) => {
        x = x / pixelsPerTile + left;
        y = y / pixelsPerTile + top;
        if (onHover)
            onHover(x,y);
    };
    const onDragWrap = (x, y, stateAtMouseDown) => {
        x = x / pixelsPerTile + left - stateAtMouseDown.left;
        y = y / pixelsPerTile + top - stateAtMouseDown.top;
        if (onDrag)
            onDrag(x,y);
    };
    const { onMouseDown, onMouseUp, onMouseLeave, onMouseMove, onMouseEnterCell } = useBoardUtils({onPaint,onHover,onDrag:onDragWrap});

    const xIndex = new Array(tilesPerSide+1).fill(0).map ((_, x) => (x + left) % size);
    const yIndex = new Array(tilesPerSide+1).fill(0).map ((_, y) => (y + top) % size);

    const [fontSize, innerSize, outerSize, offset] = [1, tilesPerSide+1, tilesPerSide, -1/2].map ((s) => s * pixelsPerTile);
    const focusColor = focusCssColor (icons, 1);
    const idColor = focusCssColor (icons, .5);

return (
<>
<div className="TiledBoard" style={{width:outerSize,height:outerSize,cursor}}>
<div className="TiledBoardInner" onMouseDown={onMouseDown({top,left})} onMouseUp={onMouseUp} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{fontSize,width:innerSize,height:innerSize,top:offset,left:offset,background}}>
{yIndex.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {xIndex.map((x) => {
        const xyCell = cell[xy2index(x,y,size)];
        const typeIndex = typeof(xyCell) === 'number' ? xyCell : xyCell[0];
        const type = types[typeIndex];
        const state = typeof(xyCell) === 'number' ? '' : xyCell[1];
        const meta = typeof(xyCell) === 'number' ? undefined : xyCell[2];
        const icon = icons[type];
        return (<Tile 
            key={'tiledBoardRow'+y+'Cell'+x} 
            onMouseEnter={()=>onMouseEnterCell(x,y)} 
            icon={icon} 
            type={type} 
            state={state} 
            meta={meta}
            focusColor={focusColor}
            idColor={idColor}
            hover={hoverCell?.x === x && hoverCell?.y === y}
            />)
    })}
    </div>))}
</div>
</div>
</>
);
}