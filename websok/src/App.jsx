import { useState } from 'react';
import Textarea from 'rc-textarea';
import Input from 'rc-input';
import DebounceInput from 'react-debounce-input';
import { Icon } from '@iconify/react';

import { Board } from './soko/board.js';
import { parseOrUndefined } from './soko/gramutil.js';
import { hexMD5 } from './soko/md5.js';
import { charLookup } from './soko/lookups.js';
import { xy2index } from './soko/board.js';

import TiledBoard from './components/TiledBoard.jsx';
import PixelMap from './components/PixelMap.jsx';
import Tile from './components/Tile.jsx';
import BoardSizeSelector from './components/BoardSizeSelector.jsx';

import './App.css';

const initSize = 16;
const initCell = new Array(initSize**2).fill(0).map((_,i) => i%7 ? 0 : 1);
const initGrammarText = 'bee _ : _ bee.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);

const defaultBackgroundColor = 'black';

const moveIcon = "oi:move";

const timerFunc = ({ board, setTimer, setBoardTime }) => () => {
  window.requestIdleCallback (() => {
    let queuedMoveList = [];
    board.evolveAndProcess (board.time + boardTimeInterval, queuedMoveList, false);
    setBoardTime(board.time);
    setTimer (setTimeout(timerFunc({ board, setTimer, setBoardTime }), timerInterval));
  })
};

export default function App() {
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [hoverCell, setHoverCell] = useState({x:0,y:0});
    let [navState, setNavState] = useState({top:0,left:0,pixelsPerTile:32,tilesPerSide:8});
    let [boardTime, setBoardTime] = useState(board.time);
    let [timer, setTimer] = useState(null);
    let [icons, setIcons] = useState({bee: {name: 'bee', color: 'orange'}});
    let [moveCounter, setMoveCounter] = useState(0);  // hacky way to force updates without cloning Board object
    let [selectedType, setSelectedType] = useState(undefined);
    let [typePaintState, setTypePaintState] = useState({});
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [errorMessage, setErrorMessage] = useState(undefined);

    const { types } = board.typesIncludingUnknowns();
    const typeCount = board.typeCountsIncludingUnknowns();
    const boardJson = board.toJSON();

    const updateIcon = (type, prop, value) => {
      if (value === '')
        delete icons[type][prop];
      else
        icons[type][prop] = value;
      setIcons({...icons});
    }
    let newIcons = {};
    types.forEach ((type) => {
        if (!icons[type]?.defaultColor) {
            if (type === '_')
                newIcons[type] = { ...icons[type] || {}, defaultColor: defaultBackgroundColor };
            else {
              const hash = hexMD5(type);
              const hue = Math.floor (360 * parseInt(hash.substring(0,3),16) / 0x1000);
              const sat = 30 + Math.floor (40 * parseInt(hash.substring(3,5),16) / 0x100);
              const lev = 30 + Math.floor (40 * parseInt(hash.substring(5,7),16) / 0x100);
              newIcons[type] = { ...icons[type] || {}, defaultColor: `hsl(${hue},${sat}%,${lev}%)` };
            }
        }
    });
    if (Object.keys(newIcons).length > 0)
        setIcons(icons = {...icons, ...newIcons});

    const background = icons['_']?.color || defaultBackgroundColor;

    const onGrammarTextChange = (e) => {
        const { target: { value: currentValue } } = e;
        const isValid = parseOrUndefined(currentValue,{error:setErrorMessage});
        if (isValid) {
          board.updateGrammar(currentValue);
          setErrorMessage(undefined);
        }
        setGrammarText(currentValue);
      };

    const pause = () => {
      clearTimeout(timer);
      setTimer(null);
    }
    const resume = (board) => {
      if (timer)
        clearTimeout(timer);
      setTimer (setTimeout(timerFunc({board,setTimer,setBoardTime}), timerInterval));
    }
    const onPauseRestart = () => timer ? pause() : resume(board);

    const wrapCoord = (coord) => {
      while (coord < 0) coord += board.size;
      return coord % board.size;
    };

    const paintState = (type) => (typePaintState[type] || '').replaceAll(/@([NSEW])/g, (_m,g) => charLookup.absDir[g]);

    const paint = ({ x, y }) => {
      board.setCellTypeByName(x, y, selectedType, paintState(selectedType));
      setBoard(board);
      setMoveCounter(moveCounter+1);
    };
    const tiledBoardPaint = ({ x, y }) => {
      if (selectedType)
        paint({ x, y });
      else {
        // TODO: select cell
      }
    };
    const pixelMapPaint = ({ x, y }) => {
      if (selectedType)
        paint({ x, y });
      else {
        const offset = navState.tilesPerSide >> 1;
        setNavState ({ ...navState, left: wrapCoord (x - offset), top: wrapCoord (y - offset) })
      }
    };

    const onDrag = (dx, dy) => {
      if (selectedType !== undefined) return;
      setNavState ({...navState, left: wrapCoord(navState.left - Math.round(dx)), top: wrapCoord(navState.top - Math.round(dy))});
    };

    const mapPixelsPerCell = Math.max (1, Math.floor (navState.pixelsPerTile * navState.tilesPerSide / board.size));
    const cursor = typeof(selectedType) === 'undefined' ? 'grab' : 'crosshair';

return (
<>
<div className="NavigationPanel">
<TiledBoard
  board={board}
  size={boardJson.size}
  cell={boardJson.cell}
  types={types} 
  icons={icons} 
  onPaint={tiledBoardPaint} 
  onHover={setHoverCell}
  onDrag={onDrag}
  pixelsPerTile={navState.pixelsPerTile} 
  tilesPerSide={navState.tilesPerSide} 
  top={navState.top}
  left={navState.left}
  hoverCell={hoverCell}
  cursor={cursor}
  background={background}/>
<PixelMap 
  board={board}
  size={boardJson.size} 
  cell={boardJson.cell} 
  types={types} 
  icons={icons} 
  onPaint={pixelMapPaint} 
  onHover={setHoverCell}
  cursor={cursor}
  pixelsPerCell={mapPixelsPerCell} 
  focusRect={{top:navState.top,left:navState.left,width:navState.tilesPerSide+2,height:navState.tilesPerSide+2}}
  background={background}/>
</div>
  <span>{hoverCell ? (`(${hoverCell.x},${hoverCell.y}) ` + board.getCellDescriptorString(hoverCell.x,hoverCell.y)) : (<i>Hover over cell to see state</i>)}</span>
<div>Time: {(Number(boardTime >> BigInt(22)) / 1024).toFixed(2)}s</div>
<button onClick={onPauseRestart}>{timer ? "Pause" : "Start"}</button>
<fieldset><table className="palette">
  <tbody>
  {Object.keys(typeCount).map((type) => type === '?'
     ? ''
     : (<tr key={`typeCount-${type}`}>
    <td><span><label><input type="radio" name="palette" id={type} checked={selectedType===type} onChange={(evt)=>{evt.target.checked && setSelectedType(type)}}/></label></span></td>
    <td><label htmlFor={type}><span className="paletteTypeIcon"><Tile type={type} state={paintState(type)} value={type} icon={icons[type]}/></span></label></td>
    <td><label htmlFor={type}><span className="paletteTypeName">{type==='_'?(<i>empty</i>):type}</span></label></td>
    <td><label htmlFor={type}><span className="paletteTypeCount">({typeCount[type]})</span></label></td>
    <td><DebounceInput element={Input} debounceTimeout={500} value={icons[type].color} placeholder={type==='_'?defaultBackgroundColor:icons[type].defaultColor} onChange={(evt)=>updateIcon(type,'color',evt.target.value)}/></td>
    <td>{type==='_'?'':<DebounceInput element={Input} debounceTimeout={500} value={icons[type].name} placeholder="Icon name" onChange={(evt)=>updateIcon(type,'name',evt.target.value)}/>}</td>
    <td>{type==='_'?'':(<span className="paletteRotationCheckbox"><input type="checkbox" defaultChecked={!!icons[type].rotate} id={type+'-rotate'} onClick={(evt)=>updateIcon(type,'rotate',!icons[type].rotate)}/><label htmlFor={type+'-rotate'}>Rotate</label></span>)}</td>
  </tr>))}
  <tr>
    <td><span><label><input type="radio" name="palette" id="=move" checked={typeof(selectedType)==='undefined'} onChange={(evt)=>{evt.target.checked && setSelectedType(undefined)}}/></label></span></td>
    <td><label htmlFor="=move"><span className="paletteTypeIcon"><Icon icon={moveIcon}/></span></label></td>
    </tr>
  </tbody></table></fieldset>
<div>{selectedType
      ? (<span>Click on map to
         {selectedType === '_'
          ? ' erase'
          : (<> paint {selectedType}/<DebounceInput element={Input} debounceTimeout={500} value={typePaintState[selectedType] || ''} placeholder={'@N, @S, @E, @W...'} onChange={(evt)=>setTypePaintState({...typePaintState,[selectedType]:evt.target.value})}/></>)}
          </span>)
      : (<span>Drag map to move</span>)}
</div>
<BoardSizeSelector board={board} setBoard={setBoard} navState={navState} setNavState={setNavState} pause={pause}/>
<div>Grammar</div>
<DebounceInput element={Textarea} debounceTimeout={500} cols={80} autoSize value={grammarText} onChange={onGrammarTextChange}/>
<div>{errorMessage}</div>
</>
);
}