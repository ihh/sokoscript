import Tile from './Tile.jsx';
import { xy2index } from '../soko/board.js';

export default function TiledBoard(props) {
    const { size, cell, types, icons } = props;
    const index = new Array(size).fill(0).map ((_, i) => i);
return (
<>
<div className="tileGrid">
{index.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {index.map((x) => {
        const xyCell = cell[xy2index(x,y,size)];
        const typeIndex = typeof(xyCell) === 'number' ? xyCell : xyCell[0];
        const type = types[typeIndex];
        const icon = icons[type];
        return (<Tile key={'tiledBoardRow'+y+'Cell'+x} icon={icon} type={type}/>)
    })}
    </div>))}
</div>
</>
);
}