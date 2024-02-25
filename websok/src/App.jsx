import { useState } from 'react';
import Textarea from 'rc-textarea';

import { Icon } from '@iconify/react';
import { Board } from './soko/board.js';

import TiledBoard from './components/TiledBoard.jsx';

const initSize = 16;
const initCell = new Array(initSize**2).fill(1);
const initGrammarText = 'bee _ : _ bee.\n';
export default function App() {
    let [grammarText, setGrammarText] = useState(initGrammarText);
    let [icons, setIcons] = useState({bee: {icon: 'game-icons:bee', color: 'orange'}});
    let [board, setBoard] = useState(new Board({size:initSize, cell:initCell, types:['_','bee'], grammar:initGrammarText}));

    const { types } = board.typesIncludingUnknowns()

    const onGrammarTextChange = (e) => {
        const {
          target: { value: currentValue },
        } = e;
        setGrammarText(currentValue);
      };

return (
<>
<div>Board</div>

<TiledBoard board={board} types={types} icons={icons} />

<div>Grammar</div>
<Textarea autoSize value={grammarText} onChange={onGrammarTextChange}/>
</>
);
}