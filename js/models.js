'use strict';

import { m4 } from 'twgl.js';

import * as settings from './settings.js';
import * as data from './data.js';
import { degToRad, composeTransformations } from './helpers.js';

// global variables - data array object of the model
let modelData   = null;
let modelBounds = null;

// global variables - transformation matrix to position the model in world-space
let modelMatrix = m4.identity();


// load a parsed STL object
function loadParsedSTL(stl) {
    // parse-stl returns an object with positions, cells (basically indices), and faceNormals
    // we want a_position and a_normal vertex attributes

    // in a proper STL numVertices should equal 3*numTriangles
    const numVertices = stl.positions.length;
    const numTriangles = stl.cells.length;

    const model = {
        a_position: { numComponents: 3, data: new Float32Array(3 * numVertices) },
        a_normal:   { numComponents: 3, data: new Float32Array(3 * numVertices) },
        a_color:    { numComponents: 4, data: new Uint8Array(4 * numVertices).fill(255) },
    };

    // if normals exist for each vertex
    if(stl.vertexNormals) {
        // loop over triangles
        for(let i = 0; i < numTriangles; i++) {
            // loop over the 3 vertices of each triangle
            for(let v = 0; v < 3; v++) {
                const [x, y, z] = stl.positions[stl.cells[i][v]];
                const [nx, ny, nz] = stl.vertexNormals[stl.cells[i][v]];

                // write data to Float32Array's
                model.a_position.data[9*i + 3*v + 0] = x;
                model.a_position.data[9*i + 3*v + 1] = y;
                model.a_position.data[9*i + 3*v + 2] = z;
                model.a_normal.data[9*i + 3*v + 0] = nx;
                model.a_normal.data[9*i + 3*v + 1] = ny;
                model.a_normal.data[9*i + 3*v + 2] = nz;
            }
        }
    }
    // no vertex normals, copy face normal for each vertex
    else {
        // loop over triangles
        for(let i = 0; i < numTriangles; i++) {
            // each normal is shared by 3 vertices
            const [nx, ny, nz] = stl.faceNormals[i];
            // loop over the 3 vertices of each triangle
            for(let v = 0; v < 3; v++) {
                const [x, y, z] = stl.positions[stl.cells[i][v]];

                // write data to Float32Array's
                model.a_position.data[9*i + 3*v + 0] = x;
                model.a_position.data[9*i + 3*v + 1] = y;
                model.a_position.data[9*i + 3*v + 2] = z;
                model.a_normal.data[9*i + 3*v + 0] = nx;
                model.a_normal.data[9*i + 3*v + 1] = ny;
                model.a_normal.data[9*i + 3*v + 2] = nz;
            }
        }
    }

    loadModel(model);
}


// loads a given model
function loadModel(model) {
    const positionAttribute = model.a_position;
    const vertices = positionAttribute.data;

    // set global data
    modelData = model;
    modelMatrix = m4.identity();

    // find bounds
    let bounds = {
        x_min: Number.MAX_VALUE,
        x_max: Number.MIN_VALUE,
        y_min: Number.MAX_VALUE,
        y_max: Number.MIN_VALUE,
        z_min: Number.MAX_VALUE,
        z_max: Number.MIN_VALUE,
    };
    for(let i = 0; i < vertices.length; i += 3) {
        bounds.x_min = Math.min(bounds.x_min, vertices[i+0]);
        bounds.x_max = Math.max(bounds.x_max, vertices[i+0]);
        bounds.y_min = Math.min(bounds.y_min, vertices[i+1]);
        bounds.y_max = Math.max(bounds.y_max, vertices[i+1]);
        bounds.z_min = Math.min(bounds.z_min, vertices[i+2]);
        bounds.z_max = Math.max(bounds.z_max, vertices[i+2]);
    }

    modelBounds = bounds;
}

// return vertex data for the model
function getModelData() {
    if(!modelData) {
        loadModel(data.F);
        rotateModel('x');
        rotateModel('x');
        centerModel();
    }

    return modelData;
}

function getModelBounds() {
    return modelBounds;
}

// a matrix that positions the model in world-space
function getModelMatrix(time) {
    return modelMatrix;
}


function rotateModel(axis) {
    const functions = {
        'x': m4.rotateX,
        'y': m4.rotateY,
        'z': m4.rotateZ,
    };

    // retrieve the desired function and rotate by 90 degrees (pi/2 radians)
    modelMatrix = functions[axis](modelMatrix, Math.PI/2);
}

function centerModel() {
    // find translation to center the un-rotated model
    const x = -1 * (modelBounds.x_min + modelBounds.x_max) / 2
    const y = -1 * (modelBounds.y_min + modelBounds.y_max) / 2
    const z = -1 * (modelBounds.z_min + modelBounds.z_max) / 2
    const translation = m4.translation([x, y, z]);

    // get rotation portion of the current transformation matrix
    const rotation = m4.setTranslation(modelMatrix, [0, 0, 0]);

    modelMatrix = composeTransformations(translation, rotation);
}

export { loadParsedSTL, loadModel, getModelData, getModelBounds, getModelMatrix, rotateModel, centerModel };

