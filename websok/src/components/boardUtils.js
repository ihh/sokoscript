import { useState } from 'react';
import { fromString, fromRgba } from 'css-color-converter';

const useBoardUtils = (opts) => {
    const { onPaint, onHover, onDrag } = opts;

    let [mouseState, setMouseState] = useState({mouseDown:false});
    let [mouseCell, setMouseCell] = useState({});

    const onMouseDown = (stateAtMouseDown) => (evt) => {
        const xOrig = evt.clientX;
        const yOrig = evt.clientY;
        setMouseState({mouseDown:true,xOrig,yOrig,stateAtMouseDown});
        onPaint && onPaint({ x: mouseCell.x, y: mouseCell.y });
    };
    const onMouseUp = () => setMouseState({mouseDown:false});
    const onMouseLeave = () => {
        onHover && onHover(undefined);
        onMouseUp();
    };
    const onMouseMove = (evt) => {
        if (mouseState.mouseDown && onDrag) {
            const x = evt.clientX;
            const y = evt.clientY;
            onDrag (x-mouseState.xOrig, y-mouseState.yOrig, mouseState.stateAtMouseDown);
        }
    }
    const onMouseEnterCell = (x, y) => {
        setMouseCell ({x, y});
        mouseState.mouseDown && onPaint && onPaint({x, y}); 
        onHover && onHover({x, y});
    }

    return { onMouseDown, onMouseUp, onMouseMove, onMouseLeave, onMouseEnterCell };
}

const focusCssColor = (icons, alpha) => {
    const bg = fromString(icons._.color || icons._.defaultColor).toRgbaArray();
    const focusRectRgbaArray = bg.slice(0,3).map((c)=>c^0xc0).concat([typeof(alpha) === 'undefined' ? 1 : alpha]);
    return fromRgba(focusRectRgbaArray).toRgbString();
}


export { useBoardUtils, focusCssColor };
