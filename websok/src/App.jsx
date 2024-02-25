import { useState } from 'react';
import Textarea from 'rc-textarea';
import DebounceInput from 'react-debounce-input';

import { Board } from './soko/board.js';
import { parseOrUndefined } from './soko/gramutil.js';
import { hexMD5 } from './soko/md5.js';

import TiledBoard from './components/TiledBoard.jsx';
import Tile from './components/Tile.jsx';

const initSize = 16;
const initCell = new Array(initSize**2).fill(0).map((_,i) => i%7 ? 0 : 1);
const initGrammarText = 'bee _ : _ bee.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);

export default function App() {
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [icons, setIcons] = useState({bee: {name: 'game-icons:bee', color: 'orange'}});
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [boardTime, setBoardTime] = useState(board.time);
    let [timer, setTimer] = useState(null);
    let [errorMessage, setErrorMessage] = useState(undefined);

    const { types } = board.typesIncludingUnknowns();
    const typeCount = board.typeCountsIncludingUnknowns();
    const boardJson = board.toJSON();

    let newIcons = {};
    types.forEach ((type) => {
        if (!icons[type]) {
            const hash = hexMD5(type);
            const hue = Math.floor (360 * parseInt(hash.substring(0,3),16) / 0x1000);
            const sat = 30 + Math.floor (40 * parseInt(hash.substring(3,5),16) / 0x100);
            const lev = 30 + Math.floor (40 * parseInt(hash.substring(5,7),16) / 0x100);
            newIcons[type] = { defaultColor: `hsl(${hue},${sat}%,${lev}%)` };
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

return (
<>
<div>Board</div>

<TiledBoard size={boardJson.size} cell={boardJson.cell} types={types} icons={icons} />
<button onClick={onPauseRestart}>{timer ? "Pause" : "Start"}</button>
<span>Time: {(Number(boardTime >> BigInt(22)) / 1024).toFixed(2)}s</span>
<div className="typeCounts">
  {Object.keys(typeCount).map((type) => type === '?' ? '' : (<div key={`typeCount-${type}`}>
    <Tile type={type} icon={icons[type]}/>
    {type==='_'?(<i>none</i>):type} ({typeCount[type]})
  </div>))}
</div>
<div>Grammar</div>
<DebounceInput element={Textarea} autoSize debounceTimeout={500} value={grammarText} onChange={onGrammarTextChange}/>
<div>{errorMessage}</div>
</>
);
}