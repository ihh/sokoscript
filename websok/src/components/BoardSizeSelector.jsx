import { Board, xy2index } from "../soko/board.js";

const requestBoardResize = ({ board, setBoard, navState, setNavState, pause }) => (evt) => {
    const newSize = parseInt(evt.target.value);
    if (newSize < board.size) {
        let nonempty = false;
        for (let x = 0; !nonempty && x < board.size; ++x)
            for (let y = 0; !nonempty && y < board.size; ++y) {
                if ((x >= newSize || y >= newSize) && board.getCell(x,y).type !== 0)
                    nonempty = true;
            }
        if (nonempty && !window.confirm('Shrink board and lose nonempty cells?'))
            return;
    }
    const boardJson = board.toJSON();
    let cell = new Array(newSize**2).fill(0);
    for (let x = 0; x < Math.min(newSize,board.size); ++x)
        for (let y = 0; y < Math.min(newSize,board.size); ++y)
        cell[xy2index(x,y,newSize)] = boardJson.cell[xy2index(x,y,board.size)];
    
    setBoard(new Board({...boardJson, size:newSize, cell}));
    setNavState({...navState,top:navState.top%newSize,left:navState.left%newSize});
    if (pause) pause();
};

export default function BoardSizeSelector({ board, setBoard, navState, setNavState, pause }) {
return (<div>
 <label htmlFor="=size">Board size:</label>
 <select id="=size" onChange={requestBoardResize({ board, setBoard, navState, setNavState, pause })} value={board.size}>
  {[16,32,64,128,256].map((size) => (<option key={`boardSize${size}`} value={size}>{size}</option>))}
 </select>
</div>)
}