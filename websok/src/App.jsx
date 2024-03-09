import { useState, useCallback } from 'react';
import Textarea from 'rc-textarea';
import Input from 'rc-input';
import DebounceInput from 'react-debounce-input';
import { Icon } from '@iconify/react';
import natsort from 'natsort';
import csscolors from 'css-color-names';

import { Board } from './soko/board.js';
import { matchLhs } from './soko/engine.js';
import { parseOrUndefined } from './soko/gramutil.js';
import { hexMD5 } from './soko/md5.js';
import { charLookup, dirs } from './soko/lookups.js';

import TiledBoard from './components/TiledBoard.jsx';
import PixelMap from './components/PixelMap.jsx';
import Tile from './components/Tile.jsx';
import BoardSizeSelector from './components/BoardSizeSelector.jsx';
import ScoreDisplay from './components/ScoreDisplay.jsx';

import './App.css';

const initSize = 16;
const initCell = new Array(initSize**2).fill(0).map((_,i) => i%7 ? 0 : 1);
const initGrammarText = 'bee _ : $2 $1.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);
const nextMoveTime = (board) => board.time + boardTimeInterval;

const playerId = 'Player';

const defaultBackgroundColor = 'black';

const moveIcon = "oi:move";

const cssColorNames = Object.keys(csscolors).filter ((color) => color !== 'black' && color !== 'transparent' && color.indexOf('white') < 0).sort();

export default function App() {
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [moveQueue] = useState({moves:[]});
    let [hoverCell, setHoverCell] = useState(undefined);
    let [navState, setNavState] = useState({top:0,left:0,pixelsPerTile:32,tilesPerSide:8});
    let [timers] = useState({boardTimer:null});
    let [icons, setIcons] = useState({bee: {name: 'bee', color: 'orange'}});
    let [moveCounter, setMoveCounter] = useState(0);  // hacky way to force updates without cloning Board object
    let [selectedType, setSelectedType] = useState(undefined);
    let [trackedId, setTrackedId] = useState(undefined);
    let [typePaintState, setTypePaintState] = useState({});
    let [paintId, setPaintId] = useState(undefined);
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [errorMessage, setErrorMessage] = useState(undefined);
    let [importFile, setImportFile] = useState();

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
              const defaultColor = cssColorNames[parseInt(hash.substring(0,3),16) % cssColorNames.length];
              newIcons[type] = { ...icons[type] || {}, defaultColor };
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
      board.evolveAndProcess (nextMoveTime(board), moveQueue.moves, false);
      moveQueue.moves = [];
      if (trackedId) {
        if (trackedId in board.byID)
          centerId(trackedId);
        else
          setTrackedId(undefined);
      }
      startTimer();
      forceUpdate();
    }, [board, startTimer, forceUpdate, trackedId]);
    
    const onPauseRestart = timers.boardTimer ? pause : resume;

    const makeMove = useCallback ((rule, dir) => {
      moveQueue.moves.push({type:'command',time:nextMoveTime(board)+1n,id:playerId,dir,command:rule.command,key:rule.key});
      forceUpdate();
    }, [moveQueue, board, forceUpdate]);

    const wrapCoord = useCallback ((coord) => {
      while (coord < 0) coord += board.size;
      return coord % board.size;
    }, [board.size]);

    const paintState = useCallback ((type) => (typePaintState[type] || '').replaceAll(/@([NSEW])/g, (_m,g) => charLookup.absDir[g]), [typePaintState]);

    const paint = useCallback (({ x, y }) => {
      let meta;
      if (selectedType !== '_') {
        if (paintId === 'player')
          meta = { id: playerId };  // uppercase avoids collision with any type named 'player'
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

    const centerMap = useCallback (({ x, y }) => {
      const offset = navState.tilesPerSide >> 1;
      setNavState ({ ...navState, left: wrapCoord (x - offset), top: wrapCoord (y - offset) })
    }, [navState, wrapCoord]);
    const centerId = useCallback ((id) => {
      const [x, y] = board.index2xy(board.byID[id]);
      centerMap ({ x, y });
    }, [board, centerMap]);

    const pixelMapPaint = useCallback (({ x, y }) => {
      if (selectedType)
        paint({ x, y });
      else
        centerMap ({ x, y });
    }, [selectedType, paint, centerMap]);

    const onDrag = useCallback ((dx, dy) => {
      if (selectedType !== undefined) return;
      setNavState ({...navState, left: wrapCoord(navState.left - Math.round(dx)), top: wrapCoord(navState.top - Math.round(dy))});
      setTrackedId (undefined);
    }, [navState, wrapCoord, selectedType]);

    const mapPixelsPerCell = Math.max (1, Math.floor (navState.pixelsPerTile * navState.tilesPerSide / board.size));

    const ids = Object.keys(board.byID).sort(natsort());

    const playerCell = playerId in board.byID && board.cell[board.byID[playerId]];
    const playerRules = playerCell && board.grammar.transform[playerCell.type];
    let playerKeyDirs = {}, playerCommandDirs = {}, playerCommandKey = {};
    if (playerRules) {
      const [x,y] = board.index2xy(board.byID[playerId]);
      playerRules.forEach((rule) => {
        dirs.forEach ((dir) => {
          if (!matchLhs(board,x,y,dir,rule).failed) {
            if (rule.key)
              playerKeyDirs[rule.key] = (playerKeyDirs[rule.key] || []).concat ([dir]);
            if (rule.command) {
              playerCommandDirs[rule.command] = (playerCommandDirs[rule.command] || []).concat ([dir]);
              if (rule.key && !(rule.command in playerCommandKey))
                playerCommandKey[rule.command] = rule.key;
            }
          }
        })
      });
    }
    const playerCommands = Object.keys(playerCommandDirs);

    const makeMoveForKey = useCallback ((evt) => {
      const key = evt.key;
      const targetTag = evt.target.tagName.toUpperCase();
      const ruleDirs = playerKeyDirs[key];
      if (targetTag !== 'INPUT' && targetTag !== 'TEXTAREA' && ruleDirs) {
        const dir = ruleDirs[Math.floor(Math.random()*ruleDirs.length)];
        makeMove({key}, dir);
      }
    }, [makeMove, playerKeyDirs]);

    const makeMoveForCommand = useCallback ((command) => {
      const ruleDirs = playerCommandDirs[command];
      if (ruleDirs) {
        const dir = ruleDirs[Math.floor(Math.random()*ruleDirs.length)];
        makeMove({command}, dir);
      }
    }, [makeMove, playerCommandDirs]);

return (
<div className="App" onKeyDown={makeMoveForKey} tabIndex="0">
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
  selectedType={selectedType}
  background={background}/>
<PixelMap 
  board={board}
  size={boardJson.size} 
  cell={boardJson.cell} 
  types={types} 
  icons={icons} 
  onPaint={pixelMapPaint} 
  onHover={setHoverCell}
  selectedType={selectedType}
  pixelsPerCell={mapPixelsPerCell} 
  focusRect={{top:navState.top,left:navState.left,width:navState.tilesPerSide+2,height:navState.tilesPerSide+2}}
  background={background}/>
</div>
<span>{hoverCell ? board.getCellDescriptorStringWithCoords(hoverCell.x,hoverCell.y) : (<i>Hover over cell to see state</i>)}</span>
<ScoreDisplay score={playerCell?.meta?.score}/>
<div className="PlayerControls">
  {playerCommands.length===0 ? '' : (<><span>Available player commands:</span>
  <span> {playerCommands.map((command,n)=>(<button key={`command-${n}`}
 onClick={()=>makeMoveForCommand(command)}
>{command}{playerCommandKey[command] ? (<em> ({playerCommandKey[command]})</em>) : ''}</button>)) || ''} </span></>)}
  <span className="MoveQueue">
    {moveQueue.moves.map((move,n)=>(<span key={`move-${n}`}> {move.command || move.key}</span>))}
  </span></div>
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
{ids.length===0 ? '' : (<div className="trackedIds">
Tracked cells: {ids.map((id)=>{
  return (<button key={'=tracked-'+id} className={id===trackedId?'SelectedId':'UnselectedId'} onClick={()=>{centerId(id);setTrackedId(id===trackedId?undefined:id)}}>{id}</button>);
})}</div>)}
<BoardSizeSelector board={board} setBoard={setBoard} navState={navState} setNavState={setNavState} pause={pause}/>
<div>Grammar</div>
<DebounceInput element={Textarea} debounceTimeout={500} cols={80} autoSize value={grammarText} onChange={onGrammarTextChange}/>
<div>{errorMessage}</div>
<button onClick={()=>{
  const json = {boardJson,icons,typePaintState,selectedType,trackedId,paintId,navState};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(json)],{type:'application/json'}));
  a.download = 'board.json';
  a.click();
}}>Export</button>
<input type="file" onChange={(evt)=>setImportFile(evt.target.files[0])}/>
{importFile ? (<button onClick={()=>{
  const reader = new FileReader();
  reader.onload = (evt) => {
    const json = JSON.parse(evt.target.result);
    const {boardJson,icons,typePaintState,selectedType,trackedId,paintId,navState} = json;
    board = new Board(boardJson);
    setBoard(board);
    setIcons(icons);
    setTypePaintState(typePaintState);
    setSelectedType(selectedType);
    setTrackedId(trackedId);
    setPaintId(paintId);
    setNavState(navState);
    setImportFile(undefined);
  };
  reader.readAsText(importFile);
}}>Import</button>) : ''}
</div>
);
}