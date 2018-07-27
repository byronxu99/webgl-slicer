'use strict';

import { v3 } from 'twgl.js';

import * as settings from './settings.js';
import * as models from './models.js';
import * as slicer from './slicer.js';
import * as renderer from './renderer.js';


// global variables - line segment model
// of the form [
//     [[1,0,0], [1,0,1]],
//     [[2,0,0], [2,0,1]],
//     [[3,0,0], [3,0,1]],
// ]
let lineData = null;


// load line segment data from an OBJ file (read into an ArrayBuffer)
function parseArrayBuffer(arraybuffer) {
    const string = new TextDecoder().decode(arraybuffer);
    const lines  = string.split(/[\r\n]+/);

    const vertices = [];
    const indices  = [];

    // read the OBJ and extract vertex and line segment information
    lines.forEach(line => {
        const words = line.split(/\s+/);

        // vertex data:
        // v 0.123 0.234 0.345
        if(words[0] === 'v') {
            const v1 = Number(words[1])
            const v2 = Number(words[2])
            const v3 = Number(words[3])
            vertices.push([v1, v2, v3]);
        }

        // polyline data (numbers are vertex indices):
        // l 5 8 1 2 4 9
        if(words[0] === 'l') {
            // break polyline into individual line segments
            for(let i = 1; i < words.length - 1; i++) {
                const l1 = Number(words[i]);
                const l2 = Number(words[i+1]);
                indices.push([l1, l2]);
            }
        }

        // bspline curve representation of one line segment:
        // curv 30 40 1 2
        if(words[0] === 'curv') {
            const l1 = Number(words[3]);
            const l2 = Number(words[4]);
            indices.push([l1, l2]);
        }
    });

    // de-index the line segments and put in lineData
    // OBJ vertex indices start at 1, not 0
    // so subtract 1 to match array indices
    lineData = [];
    indices.forEach(index => {
        const v0 = vertices[index[0]-1];
        const v1 = vertices[index[1]-1];
        lineData.push([v0, v1]);
    });
}


// generate a 3d solid from line segments
// for each line segment, we construct a frustum of a square pyramid
// (basically a long rectangular prism when w0 equals w1)
function make3dModel() {
    // widths at first point and second point, respectively
    const w0 = settings.lineWidthBottom / 2;
    const w1 = settings.lineWidthTop / 2;

    // 6 faces per line segment * 2 triangles per face
    const numTriangles = lineData.length * 12;
    // 3 vertices per triangle, 3 floats for x,y,z coordinates of each vertex
    const numVertices = 3 * numTriangles;
    const model = {
        a_position: { numComponents: 3, data: new Float32Array(3 * numVertices) },
        a_normal:   { numComponents: 3, data: new Float32Array(3 * numVertices) },
    };


    // put data for triangle with vertices a,b,c and normal n into the model
    let ptr = 0;
    function writeTriangle(a, b, c, n) {
        model.a_position.data[ptr+0] = a[0];
        model.a_position.data[ptr+1] = a[1];
        model.a_position.data[ptr+2] = a[2];
        model.a_position.data[ptr+3] = b[0];
        model.a_position.data[ptr+4] = b[1];
        model.a_position.data[ptr+5] = b[2];
        model.a_position.data[ptr+6] = c[0];
        model.a_position.data[ptr+7] = c[1];
        model.a_position.data[ptr+8] = c[2];
        model.a_normal.data[ptr+0]   = n[0];
        model.a_normal.data[ptr+1]   = n[1];
        model.a_normal.data[ptr+2]   = n[2];
        model.a_normal.data[ptr+3]   = n[0];
        model.a_normal.data[ptr+4]   = n[1];
        model.a_normal.data[ptr+5]   = n[2];
        model.a_normal.data[ptr+6]   = n[0];
        model.a_normal.data[ptr+7]   = n[1];
        model.a_normal.data[ptr+8]   = n[2];
        ptr += 9;
    }


    lineData.forEach(([a, b], index) => {
        // vector from a to b
        const v = v3.subtract(b, a);

        // normal in direction of v and -v
        const nv = v3.normalize(v);
        const neg_nv = v3.mulScalar(nv, -1.0);

        // test if v is parallel to [1,0,0]
        // same as nv is equal to [+/-1,0,0]
        const parallel = v3.distanceSq(nv, [1,0,0]) < 0.00001 || v3.distanceSq(nv, [-1,0,0]) < 0.00001;

        // get a vector not parallel to v
        const np = parallel? [0,1,0] : [1,0,0];

        // compute two normal vectors orthogonal to v and to each other
        const n1 = v3.normalize(v3.cross(np, v));
        const n2 = v3.normalize(v3.cross(v, n1));

        // opposite directions
        const n3 = v3.mulScalar(n1, -1.0);
        const n4 = v3.mulScalar(n2, -1.0);

        // compute positions of rectangluar prism corners
        // positions designated such that 1,2,3; 3,4,1; 5,6,7; 7,8,5
        // are outward-facing triangles (counterclockwise vertex order)
        const p1 = v3.add(a, v3.mulScalar(v3.add(n1, n2), w0));
        const p2 = v3.add(a, v3.mulScalar(v3.add(n1, n4), w0));
        const p3 = v3.add(a, v3.mulScalar(v3.add(n3, n4), w0));
        const p4 = v3.add(a, v3.mulScalar(v3.add(n3, n2), w0));
        const p5 = v3.add(b, v3.mulScalar(v3.add(n1, n2), w1));
        const p6 = v3.add(b, v3.mulScalar(v3.add(n3, n2), w1));
        const p7 = v3.add(b, v3.mulScalar(v3.add(n3, n4), w1));
        const p8 = v3.add(b, v3.mulScalar(v3.add(n1, n4), w1));

        // bottom face
        writeTriangle(p1, p2, p3, neg_nv);
        writeTriangle(p3, p4, p1, neg_nv);

        // top face
        writeTriangle(p5, p6, p7, nv);
        writeTriangle(p7, p8, p5, nv);

        // face in direction of n1
        writeTriangle(p1, p5, p8, n1);
        writeTriangle(p8, p2, p1, n1);

        // face in direction of n2
        writeTriangle(p4, p6, p5, n2);
        writeTriangle(p5, p1, p4, n2);

        // face in direction of n3
        writeTriangle(p3, p7, p6, n3);
        writeTriangle(p6, p4, p3, n3);

        // face in direction of n4
        writeTriangle(p2, p8, p7, n4);
        writeTriangle(p7, p3, p2, n4);
    });

    models.loadModel(model);
    renderer.loadModels();
    slicer.update();
}


export { parseArrayBuffer, make3dModel };

