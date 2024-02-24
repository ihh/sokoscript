import { useState } from 'react';
import Textarea from 'rc-textarea';

import { Icon } from '@iconify/react';
import { Board } from './soko/board.js';

import TiledBoard from './components/TiledBoard.jsx';

export default function App() {
    let [grammarText, setGrammarText] = useState('bee _ : _ bee.\n');
    let [icons, setIcons] = useState({'bee': 'game-icons:bee'});
    let [board, setBoard] = useState(new Board());
    console.log(board);

    const onGrammarTextChange = (e) => {
        const {
          target: { value: currentValue },
        } = e;
        setGrammarText(currentValue);
      };

return (
<>
<div>Hello World</div>
<Icon icon="game-icons:brass-eye" />

<Textarea autoSize value={grammarText} onChange={onGrammarTextChange}/>
<TiledBoard board={board} icons={icons} />
</>
);
}