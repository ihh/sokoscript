import { useState } from 'react';
import Textarea from 'rc-textarea';
import Input from 'rc-input';
import DebounceInput from 'react-debounce-input';

import { Board } from './soko/board.js';
import { parseOrUndefined } from './soko/gramutil.js';
import { hexMD5 } from './soko/md5.js';

import TiledBoard from './components/TiledBoard.jsx';
import PixelMap from './components/PixelMap.jsx';
import Tile from './components/Tile.jsx';

const initSize = 16;
const initCell = new Array(initSize**2).fill(0).map((_,i) => i%7 ? 0 : 1);
const initGrammarText = 'bee _ : _ bee.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);

export default function App() {
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [boardTime, setBoardTime] = useState(board.time);
    let [timer, setTimer] = useState(null);
    let [icons, setIcons] = useState({bee: {name: 'game-icons:bee', color: 'orange'}});
    let [moveCounter, setMoveCounter] = useState(0);  // hacky way to force updates without cloning Board object
    let [selectedType, setSelectedType] = useState(undefined);
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
            const hash = hexMD5(type);
            const hue = Math.floor (360 * parseInt(hash.substring(0,3),16) / 0x1000);
            const sat = 30 + Math.floor (40 * parseInt(hash.substring(3,5),16) / 0x100);
            const lev = 30 + Math.floor (40 * parseInt(hash.substring(5,7),16) / 0x100);
            newIcons[type] = { ...icons[type] || {}, defaultColor: `hsl(${hue},${sat}%,${lev}%)` };
        }
    });
    if (Object.keys(newIcons).length > 0)
        setIcons(icons = {...icons, ...newIcons});

    const onGrammarTextChange = (e) => {
        const { target: { value: currentValue } } = e;
        const isValid = parseOrUndefined(currentValue,{error:setErrorMessage});
        if (isValid) {
          board.updateGrammar(currentValue);
          setErrorMessage(undefined);
        }
        setGrammarText(currentValue);
      };

    const onPauseRestart = () => {
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      } else {
        setTimer(setInterval(() => {
          let queuedMoveList = [];
          board.evolveAndProcess (board.time + boardTimeInterval, queuedMoveList, false);
          setBoardTime(board.time);
        }, timerInterval));
      }
    };

    const onPaint = (x, y) => {
      if (selectedType === undefined) return;
      board.setCellTypeByName(x, y, selectedType);
      setBoard(board);
      setMoveCounter(moveCounter+1);
    };

return (
<>
<div>Board</div>

<TiledBoard size={boardJson.size} cell={boardJson.cell} types={types} icons={icons} onPaint={onPaint} tileSize={16} />
<PixelMap size={boardJson.size} cell={boardJson.cell} types={types} icons={icons} onPaint={onPaint} zoom={4}/>
<div>Time: {(Number(boardTime >> BigInt(22)) / 1024).toFixed(2)}s</div>
<button onClick={onPauseRestart}>{timer ? "Pause" : "Start"}</button>
<fieldset><table className="palette">
  <tbody>
  {Object.keys(typeCount).map((type) => type === '?'
     ? ''
     : (<tr key={`typeCount-${type}`}>
    <td><span><label><input type="radio" name="palette" id={type} checked={selectedType===type} onChange={(evt)=>{evt.target.checked && setSelectedType(type)}}/></label></span></td>
    <td><label htmlFor={type}><span className="paletteTypeIcon"><Tile type={type} value={type} icon={icons[type]}/></span></label></td>
    <td><label htmlFor={type}><span className="paletteTypeName">{type==='_'?(<i>empty</i>):type}</span></label></td>
    <td><label htmlFor={type}><span className="paletteTypeCount">{typeCount[type]}</span></label></td>
    <td>{type==='_'?'':<DebounceInput element={Input} debounceTimeout={500} value={icons[type].name} placeholder="Icon name" onChange={(evt)=>updateIcon(type,'name',evt.target.value)}/>}</td>
    <td>{type==='_'?'':<DebounceInput element={Input} debounceTimeout={500} value={icons[type].color} placeholder={icons[type].defaultColor} onChange={(evt)=>updateIcon(type,'color',evt.target.value)}/>}</td>
  </tr>))}
  </tbody></table></fieldset>
<div>Grammar</div>
<DebounceInput element={Textarea} debounceTimeout={500} cols={80} autoSize value={grammarText} onChange={onGrammarTextChange}/>
<div>{errorMessage}</div>
</>
);
}