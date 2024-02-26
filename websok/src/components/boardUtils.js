import { useState } from 'react';

export default function useBoardUtils (opts) {
    const { onPaint, onDrag } = opts;

    let [mouseState, setMouseState] = useState({mouseDown:false});
    let [mouseCell, setMouseCell] = useState({});

    const onMouseDown = (stateAtMouseDown) => (evt) => {
        const xOrig = evt.clientX;
        const yOrig = evt.clientY;
        setMouseState({mouseDown:true,xOrig,yOrig,stateAtMouseDown});
        onPaint && onPaint(mouseCell.x, mouseCell.y);
    };
    const onMouseUp = () => setMouseState({mouseDown:false});
    const onMouseMove = (evt) => {
        if (mouseState.mouseDown && onDrag) {
            const x = evt.clientX;
            const y = evt.clientY;
            onDrag (x-mouseState.xOrig, y-mouseState.yOrig, mouseState.stateAtMouseDown);
        }
    }
    const onMouseEnterCell = (x, y) => {
        setMouseCell ({x, y});
        mouseState.mouseDown && onPaint && onPaint(x, y); 
    }

    return { onMouseDown, onMouseUp, onMouseMove, onMouseEnterCell };
}