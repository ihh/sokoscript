import { Icon } from '@iconify/react';

export default function TiledBoard(props) {
    const { board, types, icons } = props;
    const index = new Array(board.size).fill(0).map ((_, i) => i);
return (
<>
<div className="tileGrid">
{index.map((y) => (<div className="tileRow" key={'tiledBoardRow'+y}>
    {index.map((x) => {
        const cell = board.getCell(x, y);
        const type = (cell.meta && cell.meta.type) || types[cell.type];
        const icon = icons[type];
        return (<span className="tile" key={'tiledBoardRow'+y+'Cell'+x}>
            {icon && <Icon icon={icon.icon} color={icon.color} />}
            </span>)
    })}
    </div>))}
</div>
</>
);
}