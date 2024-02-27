import { useState, useCallback } from 'react';
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
const initGrammarText = 'bee _ : $2 $1.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);

const defaultBackgroundColor = 'black';

const moveIcon = "oi:move";

export default function App() {
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [hoverCell, setHoverCell] = useState(undefined);
    let [navState, setNavState] = useState({top:0,left:0,pixelsPerTile:32,tilesPerSide:8});
    let [timers] = useState({boardTimer:null});
    let [icons, setIcons] = useState({bee: {name: 'bee', color: 'orange'}});
    let [moveCounter, setMoveCounter] = useState(0);  // hacky way to force updates without cloning Board object
    let [selectedType, setSelectedType] = useState(undefined);
    let [typePaintState, setTypePaintState] = useState({});
    let [paintId, setPaintId] = useState(undefined);
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [errorMessage, setErrorMessage] = useState(undefined);

    const { types } = board.typesIncludingUnknowns();
    const typeCount = board.typeCountsIncludingUnknowns();
    const boardJson = board.toJSON();

    const forceUpdate = useCallback (() => setMoveCounter(moveCounter+1), [moveCounter]);

    const updateIcon = useCallback ((type, prop, value) => {
      if (value === '')
        delete icons[type][prop];
      else
        icons[type][prop] = value;
      setIcons({...icons});
    }, [icons]);

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

    const onGrammarTextChange = useCallback ((e) => {
        const { target: { value: currentValue } } = e;
        const isValid = parseOrUndefined(currentValue,{error:setErrorMessage});
        if (isValid) {
          board.updateGrammar(currentValue);
          setErrorMessage(undefined);
        }
        setGrammarText(currentValue);
      }, [board]);

    const startTimer = useCallback (() => {
      timers.boardTimer = setTimeout (timers.timerFunc, timerInterval);
    }, [timers]);
    const stopTimer = useCallback (() => {
      if (timers.boardTimer)
        clearTimeout(timers.boardTimer);
      timers.boardTimer = null;
    }, [timers]);
    const pause = useCallback (() => {
      stopTimer();
      forceUpdate();
    }, [stopTimer, forceUpdate]);
    const resume = useCallback (() => {
      stopTimer();
      startTimer();
      forceUpdate();
    }, [stopTimer, startTimer, forceUpdate]);
    timers.timerFunc = useCallback (() => {
      let queuedMoveList = [];
      board.evolveAndProcess (board.time + boardTimeInterval, queuedMoveList, false);
      startTimer();
      forceUpdate();
    }, [board, startTimer, forceUpdate]);
    
    const onPauseRestart = timers.boardTimer ? pause : resume;

    const wrapCoord = useCallback ((coord) => {
      while (coord < 0) coord += board.size;
      return coord % board.size;
    }, [board.size]);

    const paintState = useCallback ((type) => (typePaintState[type] || '').replaceAll(/@([NSEW])/g, (_m,g) => charLookup.absDir[g]), [typePaintState]);

    const paint = useCallback (({ x, y }) => {
      let meta;
      if (selectedType !== '_') {
        if (paintId === 'player')
          meta = { id: 'Player' };  // uppercase avoids collision with any type named 'player'
        else if (paintId === 'unique')
          meta = { id: board.getUniqueID(selectedType) };
      }
      board.setCellTypeByName(x, y, selectedType, paintState(selectedType), meta);
      forceUpdate();
    }, [selectedType, paintState, paintId, board, forceUpdate]);

    const tiledBoardPaint = useCallback (({ x, y }) => {
      if (selectedType)
        paint({ x, y });
      else {
        // TODO: select cell
      }
    }, [selectedType, paint]);

    const pixelMapPaint = useCallback (({ x, y }) => {
      if (selectedType)
        paint({ x, y });
      else {
        const offset = navState.tilesPerSide >> 1;
        setNavState ({ ...navState, left: wrapCoord (x - offset), top: wrapCoord (y - offset) })
      }
    }, [navState, wrapCoord, selectedType, paint]);

    const onDrag = useCallback ((dx, dy) => {
      if (selectedType !== undefined) return;
      setNavState ({...navState, left: wrapCoord(navState.left - Math.round(dx)), top: wrapCoord(navState.top - Math.round(dy))});
    }, [navState, wrapCoord, selectedType]);

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
<div>Time: {(Number(board.time >> BigInt(22)) / 1024).toFixed(2)}s</div>
<button onClick={onPauseRestart}>{timers.boardTimer ? "Pause" : "Start"}</button>
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
          : (<> place {selectedType}/<DebounceInput element={Input} debounceTimeout={500} value={typePaintState[selectedType] || ''} placeholder={'@N, @S, @E, @W...'} onChange={(evt)=>setTypePaintState({...typePaintState,[selectedType]:evt.target.value})}/>
          <select id="=id" value={paintId} onChange={(evt)=>setPaintId(evt.target.value)}>
            <option value="anon">as anonymous cell</option>
            <option value="player">as player</option>
            <option value="unique">with unique ID</option>
          </select></>)}
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