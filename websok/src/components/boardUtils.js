import { useState } from 'react';

export default function useBoardUtils (opts) {
    const { onPaint } = opts;

    let [mouseDown, setMouseDown] = useState(false);
    let [mouseCell, setMouseCell] = useState({});

    const onMouseDown = () => {
        setMouseDown(true);
        onPaint && onPaint(mouseCell.x, mouseCell.y);
    };
    const onMouseUp = () => setMouseDown(false);
    const onMouseEnterCell = (x, y) => {
        setMouseCell ({x, y});
        mouseDown && onPaint && onPaint(x, y); 
    }

    return { onMouseDown, onMouseUp, onMouseEnterCell };
}