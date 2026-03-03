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

// ── Presets ──────────────────────────────────────────────────────────────────

const presets = {
  'Forest Fire': {
    grammar: `// Forest Fire - A firefighting cellular automata game
// Control your fireman with WASD. Walk into fires to extinguish them.
// Trees grow, lightning strikes, fires spread. Save the forest!

// Tree growth (grass sprouts trees)
grass : tree, rate=0.005.

// Lightning (rare spontaneous fire)
tree : fire, rate=0.002.

// Fire spreads to adjacent trees
tree fire : fire fire, rate=3.

// Fire burns out to ash
fire : ash, rate=0.2.

// Ash decays back to grass
ash : grass, rate=0.05.

// Water evaporates
water : grass, rate=0.3.

// Fireman extinguishes adjacent fire (WASD, put out fire and score!)
fireman >N> fire : fireman water, key={w} score=1.
fireman >S> fire : fireman water, key={s} score=1.
fireman >E> fire : fireman water, key={d} score=1.
fireman >W> fire : fireman water, key={a} score=1.

// Fireman movement on empty ground (WASD)
fireman >N> _ : _ fireman, key={w}.
fireman >S> _ : _ fireman, key={s}.
fireman >E> _ : _ fireman, key={d}.
fireman >W> _ : _ fireman, key={a}.

// Fireman can walk over grass
fireman >N> grass : _ fireman, key={w}.
fireman >S> grass : _ fireman, key={s}.
fireman >E> grass : _ fireman, key={d}.
fireman >W> grass : _ fireman, key={a}.

// Fireman can walk over ash
fireman >N> ash : _ fireman, key={w}.
fireman >S> ash : _ fireman, key={s}.
fireman >E> ash : _ fireman, key={d}.
fireman >W> ash : _ fireman, key={a}.

// Fireman can walk over water
fireman >N> water : _ fireman, key={w}.
fireman >S> water : _ fireman, key={s}.
fireman >E> water : _ fireman, key={d}.
fireman >W> water : _ fireman, key={a}.
`,
    size: 16,
    icons: {
      grass: { name: 'grass', color: 'limegreen' },
      tree: { name: 'pine-tree', color: 'darkgreen' },
      fire: { name: 'fire', color: 'orangered' },
      ash: { name: 'powder', color: 'gray' },
      water: { name: 'droplet', color: 'dodgerblue' },
      fireman: { name: 'fire-extinguisher', color: 'yellow' },
    },
    setup: (board) => {
      for (let x = 0; x < board.size; x++)
        for (let y = 0; y < board.size; y++)
          board.setCellTypeByName(x, y, Math.random() < 0.4 ? 'tree' : 'grass');
      board.setCellTypeByName(3, 5, 'fire');
      board.setCellTypeByName(10, 2, 'fire');
      board.setCellTypeByName(8, 8, 'fireman', '', { id: 'Player' });
    },
  },

  'Sokoban': {
    grammar: `// Sokoban - Push crates onto targets
// Control the player with WASD. Push crates onto targets to score!

// Player movement (WASD) - walk on empty ground or floor
player >N> _ : _ player, key={w}.
player >S> _ : _ player, key={s}.
player >E> _ : _ player, key={d}.
player >W> _ : _ player, key={a}.

// Player walks onto target (target stays, shown via player state)
player >N> target : _ player, key={w}.
player >S> target : _ player, key={s}.
player >E> target : _ player, key={d}.
player >W> target : _ player, key={a}.

// Player pushes crate onto empty space
player >N> crate >N> _ : _ player crate, key={w}.
player >S> crate >S> _ : _ player crate, key={s}.
player >E> crate >E> _ : _ player crate, key={d}.
player >W> crate >W> _ : _ player crate, key={a}.

// Player pushes crate onto target (score!)
player >N> crate >N> target : _ player goal, key={w} score=1.
player >S> crate >S> target : _ player goal, key={s} score=1.
player >E> crate >E> target : _ player goal, key={d} score=1.
player >W> crate >W> target : _ player goal, key={a} score=1.
`,
    size: 16,
    icons: {
      player: { name: 'person', color: 'dodgerblue' },
      crate: { name: 'cube', color: 'sienna' },
      target: { name: 'target', color: 'gold' },
      goal: { name: 'trophy', color: 'lime' },
      wall: { name: 'brick-wall', color: 'slategray' },
    },
    setup: (board) => {
      // Build walls around a room
      for (let i = 2; i < 14; i++) {
        board.setCellTypeByName(2, i, 'wall');
        board.setCellTypeByName(13, i, 'wall');
        board.setCellTypeByName(i, 2, 'wall');
        board.setCellTypeByName(i, 13, 'wall');
      }
      // Crates and targets
      board.setCellTypeByName(5, 5, 'crate');
      board.setCellTypeByName(8, 6, 'crate');
      board.setCellTypeByName(6, 9, 'crate');
      board.setCellTypeByName(10, 4, 'target');
      board.setCellTypeByName(10, 8, 'target');
      board.setCellTypeByName(4, 10, 'target');
      // Player
      board.setCellTypeByName(7, 7, 'player', '', { id: 'Player' });
    },
  },

  'Ecosystem': {
    grammar: `// Ecosystem - A prey-predator-plant simulation
// Watch plants grow, herbivores graze, and predators hunt.
// A balanced ecosystem emerges from simple rules.

// Plants grow on empty ground
soil : plant, rate=0.05.

// Plants spread to adjacent soil
plant soil : plant plant, rate=0.02.

// Herbivores eat plants (reproduce by eating)
herbivore plant : herbivore herbivore, rate=2.

// Herbivores wander
herbivore soil : soil herbivore, rate=0.5.

// Herbivores starve without food (slow death)
herbivore : soil, rate=0.02.

// Predators eat herbivores (reproduce by eating)
predator herbivore : predator predator, rate=3.

// Predators wander
predator soil : soil predator, rate=1.

// Predators starve without prey (faster than herbivores)
predator : soil, rate=0.05.
`,
    size: 32,
    icons: {
      soil: { name: 'grass', color: '#3a2a1a' },
      plant: { name: 'sprout', color: 'limegreen' },
      herbivore: { name: 'rabbit', color: 'wheat' },
      predator: { name: 'wolf-head', color: 'orangered' },
    },
    setup: (board) => {
      for (let x = 0; x < board.size; x++)
        for (let y = 0; y < board.size; y++) {
          const r = Math.random();
          if (r < 0.3) board.setCellTypeByName(x, y, 'plant');
          else if (r < 0.35) board.setCellTypeByName(x, y, 'herbivore');
          else if (r < 0.37) board.setCellTypeByName(x, y, 'predator');
          else board.setCellTypeByName(x, y, 'soil');
        }
    },
  },

  'Rock Paper Scissors': {
    grammar: `bee _ : $2 $1, rate=999.
rock = bee.
scissors = bee.
paper = bee.
bee : _, rate=0.01.
bee _ : $1 $1, rate=0.05.
bee bee: _ _, rate=0.01.
rock scissors: $1 $1, rate=999.
scissors paper: $1 $1, rate=999.
paper rock: $1 $1, rate=999.
`,
    size: 64,
    icons: {
      rock: { name: 'rock', color: 'slategray' },
      scissors: { name: 'scissors', color: 'orangered' },
      paper: { name: 'scroll', color: 'lightyellow' },
    },
    setup: (board) => {
      for (let x = 0; x < board.size; x++)
        for (let y = 0; y < board.size; y++) {
          const r = Math.random();
          if (r < 0.3) board.setCellTypeByName(x, y, 'rock');
          else if (r < 0.6) board.setCellTypeByName(x, y, 'scissors');
          else board.setCellTypeByName(x, y, 'paper');
        }
    },
  },

  'Sandpile': {
    grammar: `bee:_.
sandpile: $1/0.
sandpile/[0123]: $1/@add(@int(1),$#1), rate=0.1.
sandpile/4 : avalanche/@F4~1.
avalanche/?[1234] _: $1/@clock($1#1)@sub($1#2,@int(1)) sandpile/1, rate=10.
avalanche/?[1234] sandpile/[0123]: $1/@clock($1#1)@sub($1#2,@int(1)) $2/@add(@int(1),$2#1), rate=10.
avalanche/?0: sandpile/0~1.
`,
    size: 32,
    icons: {
      sandpile: { name: 'mountain', color: 'sandybrown' },
      avalanche: { name: 'landslide', color: 'peru' },
    },
    setup: (board) => {
      const cx = board.size >> 1, cy = board.size >> 1;
      board.setCellTypeByName(cx, cy, 'sandpile');
    },
  },

  'Diffusion': {
    grammar: 'bee _ : $2 $1.\n',
    size: 16,
    icons: {
      bee: { name: 'bee', color: 'orange' },
    },
    setup: (board) => {
      board.setCellTypeByName(8, 8, 'bee');
      board.setCellTypeByName(4, 4, 'bee');
      board.setCellTypeByName(12, 12, 'bee');
    },
  },
};

// ── Constants ────────────────────────────────────────────────────────────────

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

// ── App ──────────────────────────────────────────────────────────────────────

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

    const loadPreset = useCallback ((presetName) => {
      const preset = presets[presetName];
      if (!preset) return;
      stopTimer();
      const newBoard = new Board({ size: preset.size, grammar: preset.grammar });
      if (preset.setup) preset.setup(newBoard);
      setBoard(board = newBoard);
      setGrammarText(preset.grammar);
      setErrorMessage(undefined);
      const mergedIcons = {};
      Object.entries(preset.icons || {}).forEach(([type, icon]) => {
        mergedIcons[type] = icon;
      });
      setIcons(mergedIcons);
      setSelectedType(undefined);
      setTrackedId(undefined);
      setTypePaintState({});
      setPaintId(undefined);
      moveQueue.moves = [];
      const viewSize = preset.size <= 16 ? 8 : preset.size <= 32 ? 16 : 32;
      setNavState({ top: 0, left: 0, pixelsPerTile: 32, tilesPerSide: viewSize });
      forceUpdate();
    }, [stopTimer, forceUpdate, moveQueue]);

return (
<div className="App" onKeyDown={makeMoveForKey} tabIndex="0">

<div className="AppHeader">
  <h1>SokoScript</h1>
  <div className="preset-controls">
    <select defaultValue="" onChange={(evt) => { if (evt.target.value) { loadPreset(evt.target.value); evt.target.value = ''; } }}>
      <option value="" disabled>Load preset...</option>
      {Object.keys(presets).map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
  </div>
</div>

<div className="MainLayout">
  <div className="BoardPanel">
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

    <div className="StatusBar">
      <span className="cell-info">{hoverCell ? board.getCellDescriptorStringWithCoords(hoverCell.x,hoverCell.y) : (<i>Hover over cell</i>)}</span>
      <ScoreDisplay score={playerCell?.meta?.score}/>
      <span className="time-display">{(Number(board.time >> BigInt(22)) / 1024).toFixed(2)}s</span>
    </div>

    <div className="TransportControls">
      <button className={timers.boardTimer ? '' : 'primary'} onClick={onPauseRestart}>{timers.boardTimer ? "Pause" : "Start"}</button>
      <div className="PlayerControls">
        {playerCommands.length===0 ? '' : (<><span className="command-label">Commands:</span>
        {playerCommands.map((command,n)=>(<button key={`command-${n}`}
       onClick={()=>makeMoveForCommand(command)}
      >{command}{playerCommandKey[command] ? (<em> ({playerCommandKey[command]})</em>) : ''}</button>))}</>)}
        <span className="MoveQueue">
          {moveQueue.moves.map((move,n)=>(<span key={`move-${n}`}> {move.command || move.key}</span>))}
        </span>
      </div>
    </div>
  </div>

  <div className="SidePanel">
    <div className="PaletteSection">
      <div className="section-header">Palette</div>
      <table className="palette">
        <tbody>
        {Object.keys(typeCount).map((type) => type === '?'
           ? ''
           : (<tr key={`typeCount-${type}`} className={selectedType===type ? 'selected-type' : ''}>
          <td><label><input type="radio" name="palette" id={type} checked={selectedType===type} onChange={(evt)=>{evt.target.checked && setSelectedType(type)}}/></label></td>
          <td><label htmlFor={type}><span className="paletteTypeIcon"><Tile type={type} state={paintState(type)} value={type} icon={icons[type]}/></span></label></td>
          <td><label htmlFor={type}><span className="paletteTypeName">{type==='_'?(<i>empty</i>):type}</span></label></td>
          <td><label htmlFor={type}><span className="paletteTypeCount">({typeCount[type]})</span></label></td>
          <td><DebounceInput element={Input} debounceTimeout={500} value={icons[type]?.color || ''} placeholder={type==='_'?defaultBackgroundColor:icons[type]?.defaultColor} onChange={(evt)=>updateIcon(type,'color',evt.target.value)}/></td>
          <td>{type==='_'?'':<DebounceInput element={Input} debounceTimeout={500} value={icons[type]?.name || ''} placeholder="Icon name" onChange={(evt)=>updateIcon(type,'name',evt.target.value)}/>}</td>
          <td>{type==='_'?'':(<span className="paletteRotationCheckbox"><input type="checkbox" defaultChecked={!!icons[type]?.rotate} id={type+'-rotate'} onClick={()=>updateIcon(type,'rotate',!icons[type]?.rotate)}/><label htmlFor={type+'-rotate'}>Rot</label></span>)}</td>
        </tr>))}
        <tr className={typeof(selectedType)==='undefined' ? 'selected-type' : ''}>
          <td><label><input type="radio" name="palette" id="=move" checked={typeof(selectedType)==='undefined'} onChange={(evt)=>{evt.target.checked && setSelectedType(undefined)}}/></label></td>
          <td><label htmlFor="=move"><span className="paletteTypeIcon"><Icon icon={moveIcon}/></span></label></td>
          <td colSpan="5"><label htmlFor="=move">Navigate</label></td>
          </tr>
        </tbody></table>
    </div>

    <div className="PaintMode">{selectedType
        ? (<span>Click to
           {selectedType === '_'
            ? ' erase'
            : (<> place <b>{selectedType}</b>/<DebounceInput element={Input} debounceTimeout={500} value={typePaintState[selectedType] || ''} placeholder={'@N, @S, @E, @W...'} onChange={(evt)=>setTypePaintState({...typePaintState,[selectedType]:evt.target.value})}/>
            {' '}<select id="=id" value={paintId} onChange={(evt)=>setPaintId(evt.target.value)}>
              <option value="anon">anonymous</option>
              <option value="player">as player</option>
              <option value="unique">unique ID</option>
            </select></>)}
            </span>)
        : (<span>Drag to pan</span>)}
    </div>

    {ids.length===0 ? '' : (<div className="trackedIds">
      Tracked: {ids.map((id)=>{
        return (<button key={'=tracked-'+id} className={id===trackedId?'SelectedId':'UnselectedId'} onClick={()=>{centerId(id);setTrackedId(id===trackedId?undefined:id)}}>{id}</button>);
      })}</div>)}

    <div className="BoardControls">
      <BoardSizeSelector board={board} setBoard={setBoard} navState={navState} setNavState={setNavState} pause={pause}/>
    </div>
  </div>
</div>

<div className="GrammarSection">
  <div className="section-header">Grammar</div>
  <DebounceInput element={Textarea} debounceTimeout={500} cols={80} autoSize value={grammarText} onChange={onGrammarTextChange}/>
  {errorMessage ? <div className="ErrorMessage">{errorMessage}</div> : ''}
</div>

<div className="IOControls">
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

</div>
);
}
