import { useState } from 'react';

export default function ScoreDisplay(props) {
    let { score } = props;
    let [lastScore, setLastScore] = useState(undefined);
    let prefix = "Player score";
    if (typeof(score) === 'undefined') {
        score = lastScore;
        prefix = "Last score";
    } else if (score !== lastScore)
        setLastScore(score);
    return typeof(score) === 'undefined' ? '' : (<div className="ScoreDisplay">{prefix}: {score}</div>);
}
