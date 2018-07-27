'use strict';

import { m4 } from 'twgl.js';

// convert degrees to radians
function degToRad(d) {
    return d * Math.PI / 180;
}

// multiply a series of matrix transformations
// composeTransformations(model, view, projection) = projection * view * model
function composeTransformations(){
    let matrix = m4.identity();
    for(let i = arguments.length-1; i >= 0; i--) {
        matrix = m4.multiply(matrix, arguments[i]);
    }
    return matrix;
}

// convert a [r, g, b] color to string
function colorToString([r, g, b]) {
    function pad(str) {
        return str.length < 2? '0'+str : str;
    }
    const rStr = pad(r.toString(16));
    const gStr = pad(g.toString(16));
    const bStr = pad(b.toString(16));
    return rStr + gStr + bStr;
}

// convert a "ffffff" color string to [r, g, b]
function stringToColor(str) {
    const r = parseInt(str.substring(0, 2), 16);
    const g = parseInt(str.substring(2, 4), 16);
    const b = parseInt(str.substring(4, 6), 16);
    return [r, g, b];
}


export { degToRad, composeTransformations, colorToString, stringToColor };

