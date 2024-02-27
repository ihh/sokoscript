import { useState, useRef, useEffect } from 'react';
import { useBoardUtils, focusCssColor } from './boardUtils.js';
import { fromString } from 'css-color-converter';
import { xy2index } from '../soko/board.js';

export default function PixelMap(props) {
    let { size, pixelsPerCell, cell, types, icons, onPaint, onHover, background, focusRect, ...otherProps } = props;
    const { onMouseDown, onMouseUp, onMouseLeave, onMouseEnterCell } = useBoardUtils({onPaint,onHover});

    const canvasRef = useRef(null);    

    const typeRgbaArray = types.map ((type, typeIndex) => {
        const icon = icons[type];
        const cssColor = icon?.color || icon?.defaultColor;
        return fromString(cssColor).toRgbaArray();
    });
    const focusRectCssColor = focusCssColor (icons);

    let buffer = new Uint8ClampedArray(size*size*4);
    for (let x = 0; x < size; x++)
        for (let y = 0; y < size; y++) {
            const pos = (y*size + x) * 4;
            const xyCell = cell[xy2index(x,y,size)];
            const typeIndex = typeof(xyCell) === 'number' ? xyCell : xyCell[0];
            const rgba = typeRgbaArray[typeIndex];
            buffer[pos] = rgba[0];
            buffer[pos+1] = rgba[1];
            buffer[pos+2] = rgba[2];
            buffer[pos+3] = rgba[3]*255;
        }

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        let idata = context.createImageData(size, size);
        idata.data.set(buffer);
        context.putImageData(idata, 0, 0);
        if (focusRect) {
            context.strokeStyle = focusRectCssColor;
            for (let x = -size; x < 2*size; x += size)
                for (let y = -size; y < 2*size; y += size)
                    context.strokeRect (focusRect.left + x, focusRect.top + y, focusRect.width - 1, focusRect.height - 1);
        }
    }, [size, cell, types, icons]);
    
    const onMouseMove = (evt) => {
        const rect = evt.target.getBoundingClientRect();
        const x = Math.floor((evt.clientX - rect.left) / pixelsPerCell);
        const y = Math.floor((evt.clientY - rect.top) / pixelsPerCell);
        onMouseEnterCell(x,y);
    }

    pixelsPerCell = pixelsPerCell || 1;
    return (<div className="PixelMap"><canvas ref={canvasRef} width={size} height={size} style={{width:size*pixelsPerCell,height:size*pixelsPerCell}} {...otherProps} onMouseDown={onMouseDown()} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove}/></div>);
}