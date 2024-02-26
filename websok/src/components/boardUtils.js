import { useState } from 'react';

export default function useBoardUtils (opts) {
    const { onPaint, onDrag } = opts;

    let [mouseState, setMouseState] = useState({mouseDown:false});
    let [mouseCell, setMouseCell] = useState({});

    const onMouseDown = (evt) => {
        const rect = evt.target.getBoundingClientRect();
        const xOrig = evt.clientX - rect.left;
        const yOrig = evt.clientY - rect.top;
        setMouseState({mouseDown:true,xOrig,yOrig});
        onPaint && onPaint(mouseCell.x, mouseCell.y);
    };
    const onMouseUp = () => setMouseState({mouseDown:false});
    const onMouseMove = (evt) => {
        if (mouseState.mouseDown && onDrag) {
            const rect = evt.target.getBoundingClientRect();
            const x = evt.clientX;
            const y = evt.clientY - rect.top;
            onDrag(x-xOrig,y-yOrig);
        }
    }
    const onMouseEnterCell = (x, y) => {
        setMouseCell ({x, y});
        mouseState.mouseDown && onPaint && onPaint(x, y); 
    }

    return { onMouseDown, onMouseUp, onMouseMove, onMouseEnterCell };
}