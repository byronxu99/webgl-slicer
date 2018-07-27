'use strict';

import { m4 } from 'twgl.js';

import * as settings from './settings.js';
import * as models from './models.js';
import { degToRad, composeTransformations } from './helpers.js';


// global variables - slice plane angle
let planeAngle = 0;

// global variables - slicing parameters
let slicePosition  = 0.5;   // the current slicing position normalized as a fraction from 0..1
let sliceIncrement = 0;     // 0..1 fraction increment between slices
let sliceZMin = 0;          // most negative z-translation for the model to be sliced
let sliceZMax = 0;          // most positive z-translation for the model to be sliced



// a matrix that rotates the plane model (defined as xy plane, z=0)
// to its desired orientation in world-space
function getPlaneMatrix() {
    const rotation = m4.rotationX(-1 * planeAngle);

    // WebGL renders to textures with inverted y-axis
    // so we invert it here to make it the right way
    return m4.scale(rotation, [1, -1, 1]);
}

// computes a vector normal to the plane surface
function getPlaneNormalVector() {
    return [0, Math.sin(planeAngle), Math.cos(planeAngle)];
}

// set the x-axis rotation angle
function setPlaneAngle(angle) {
    planeAngle = angle;
}

// suppose we had a camera looking at the plane
// this matrix positions the world in front of this camera
// (the inverse of positioning the plane/camera in the world)
function getViewMatrix() {
    return m4.inverse(getPlaneMatrix());
}

// a matrix that positions the model for a given slice position and sub-slice increment
function getSliceMatrix(subslice = 0) {
    // 0..1 interval including subslice
    const a = slicePosition - subslice * (sliceIncrement / settings.printerSliceSubsampling);

    // z-axis translation
    const z = (1-a)*sliceZMax + a*sliceZMin;
    return m4.translation([0, 0, z]);
}

// set the current slice position as a percentage from 0..1
function setSlicePosition(percentage) {
    slicePosition = percentage;
}

// increment to the next slice, return whether there are more slices
function loadNextSlice() {
    slicePosition += sliceIncrement;
    if(slicePosition > 1) slicePosition = 1;
    return slicePosition < 1;
}

// update slice parameters
function update() {
    const m = models.getModelMatrix();
    const bounds = models.getModelBounds();

    // transform boundary points by model matrix
    const points = [
        [bounds.x_min, bounds.y_min, bounds.z_min],
        [bounds.x_min, bounds.y_min, bounds.z_max],
        [bounds.x_min, bounds.y_max, bounds.z_min],
        [bounds.x_min, bounds.y_max, bounds.z_max],
        [bounds.x_max, bounds.y_min, bounds.z_min],
        [bounds.x_max, bounds.y_min, bounds.z_max],
        [bounds.x_max, bounds.y_max, bounds.z_min],
        [bounds.x_max, bounds.y_max, bounds.z_max],
    ].map(v => m4.transformPoint(m, v));

    // get extrema
    const y_min = Math.min(...points.map(v => v[1]));
    const y_max = Math.max(...points.map(v => v[1]));
    const z_min = Math.min(...points.map(v => v[2]));
    const z_max = Math.max(...points.map(v => v[2]));

    // most negative and most positive z-translations needed
    // for the boundary of the model to touch the slice plane
    sliceZMin = -1 * (z_max + y_max*Math.tan(planeAngle));
    sliceZMax = -1 * (z_min + y_min*Math.tan(planeAngle));

    // 0..1 percentage increment between slices
    sliceIncrement = settings.printerSliceThickness / (sliceZMax - sliceZMin) / Math.cos(planeAngle);

    const numSlices = Math.floor(1 / sliceIncrement);
    document.getElementById('slice_number').innerText = `Slice ${Math.floor(slicePosition * numSlices)}`;
    document.getElementById('slice_info').innerText   = `${numSlices} slices total`;
}

// data for a rectangular plane representing the print surface
// indexed as two triangles - vertices 0, 1, 2 and 2, 3, 0
// this must be transformed first by the planeAngle rotation matrix
function getPlaneData() {
    const x = 0.5 * settings.printerSizeX;
    const y = 0.5 * settings.printerSizeY;

    const plane = {
        a_position: { numComponents: 3, data: new Float32Array([
             x,  y, 0,
            -x,  y, 0,
            -x, -y, 0,
             x, -y, 0,
        ])},
        a_normal: { numComponents: 3, data: new Float32Array([
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
        ])},
        indices: { numComponents: 3, data: [0, 1, 2, 2, 3, 0] },
    };

    return plane;
}


export { getPlaneMatrix, getPlaneNormalVector, setPlaneAngle, getPlaneData, getViewMatrix, getSliceMatrix, setSlicePosition, loadNextSlice, update };

