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
    <span>
        <label htmlFor="=boardSize">Board size:</label>
        <select id="=boardSize" onChange={requestBoardResize({ board, setBoard, navState, setNavState, pause })} value={board.size}>
        {[16,32,64,128,256].map((size) => (<option key={`boardSize${size}`} value={size} disabled={size<=navState.tilesPerSide}>{size}</option>))}
        </select>
    </span>
    <span>
        <label htmlFor="=viewSize">Viewport size:</label>
        <select id="=viewSize" onChange={(evt)=>setNavState({...navState,tilesPerSide:parseInt(evt.target.value)})} value={navState.tilesPerSide}>
        {[8,16,32,64,128].map((size) => (<option key={`viewSize${size}`} value={size} disabled={size>=board.size}>{size}</option>))}
        </select>
    </span>
    <span>
        <label htmlFor="=tileSize">Pixels per tile:</label>
        <select id="=tileSize" onChange={(evt)=>setNavState({...navState,pixelsPerTile:parseInt(evt.target.value)})} value={navState.pixelsPerTile}>
        {[8,16,32,48,64].map((size) => (<option key={`tileSize${size}`} value={size}>{size}</option>))}
        </select>
    </span>
</div>)
}