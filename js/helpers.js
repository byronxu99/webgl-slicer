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

export { degToRad, composeTransformations };

