import { useState } from 'react';
import Textarea from 'rc-textarea';

import { Board } from './soko/board.js';
import { parseOrUndefined } from './soko/gramutil.js';

import TiledBoard from './components/TiledBoard.jsx';

const initSize = 16;
const initCell = new Array(initSize**2).fill(0).map((_,i) => i%7 ? 0 : 1);
const initGrammarText = 'bee _ : _ bee.\n';

const timerInterval = 20;  // ms
const boardTimeInterval = (BigInt(timerInterval) << BigInt(32)) / BigInt(1000);

export default function App() {
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [icons, setIcons] = useState({bee: {icon: 'game-icons:bee', color: 'orange'}});
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));
    let [boardTime, setBoardTime] = useState(board.time);
    let [timer, setTimer] = useState(null);
    let [errorMessage, setErrorMessage] = useState(undefined);

    const { types } = board.typesIncludingUnknowns();
    const typeCount = board.typeCountsIncludingUnknowns();
    const boardJson = board.toJSON();

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
  {Object.keys(typeCount).map((type) => type === '_' || type == '?' ? '' : (<div key={`typeCount-${type}`}>{type}: {typeCount[type]}</div>))}
</div>
<div>Grammar</div>
<Textarea autoSize value={grammarText} onChange={onGrammarTextChange}/>
<div>{errorMessage}</div>
</>
);
}