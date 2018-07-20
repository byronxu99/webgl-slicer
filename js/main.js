'use strict';

import * as twgl from 'twgl.js';
const m4 = twgl.m4;
import parseSTL from 'parse-stl';
import JSZip from 'jszip';
import { saveAs } from 'file-saver/FileSaver';

// local imports
import './plugins.js';
import * as renderer from './renderer.js';
import * as settings from './settings.js';
import * as models from './models.js';
import * as slicer from './slicer.js';


// global variables - html canvas objects
const renderCanvas = document.getElementById('render_canvas');
const sliceCanvas  = document.getElementById('slice_canvas');

// global variables - frames per second counting
let loopCount = 0;
let startTime = 0;

// global variables - whether we need to re-render the slice
let rerenderSlice = true;


function main() {
    console.log('a');
    // file upload
    document.getElementById('file_upload').onchange = fileUploadCallback;

    // model manipulation buttons
    document.getElementById('rotate_x_button').onclick = function() { models.rotateModel('x'); };
    document.getElementById('rotate_y_button').onclick = function() { models.rotateModel('y'); };
    document.getElementById('rotate_z_button').onclick = function() { models.rotateModel('z'); };
    document.getElementById('center_button').onclick   = centerModelCallback;

    // printer dimension settings
    document.getElementById('printer_pixels_x').value = settings.printerPixelsX;
    document.getElementById('printer_pixels_y').value = settings.printerPixelsY;
    document.getElementById('printer_size_x').value   = settings.printerSizeX;
    document.getElementById('printer_size_y').value   = settings.printerSizeY;

    // slicing settings
    document.getElementById('slice_plane_angle').oninput         = sliceAngleCallback;
    document.getElementById('printer_slice_thickness').value     = settings.printerSliceThickness;
    document.getElementById('printer_slice_subsampling').value   = settings.printerSliceSubsampling;

    // the big "update" button
    document.getElementById('printer_settings_button').onclick = updateSettingsCallback;

    // slice position slider
    document.getElementById('slice_slider').oninput  = slicePositionCallback;

    // the big "download" button
    document.getElementById('download_button').onclick = downloadCallback;

    // initialize and run
    renderer.init(renderCanvas, sliceCanvas);
    requestAnimationFrame(loop);
}

function loop(time) {
    // count fps
    loopCount += 1;
    if(loopCount > 10) {
        const time = Date.now();
        const fps = loopCount / ((time - startTime) / 1000);
        startTime = time;
        loopCount = 0;
        document.getElementById('webgl_fps').innerText = `[${fps} fps]`;
    }

    // set canvas size
    twgl.resizeCanvasToDisplaySize(renderCanvas);
    twgl.resizeCanvasToDisplaySize(sliceCanvas);

    // render
    renderer.render3d();

    // render slice
    if(rerenderSlice) {
        const canvas = renderer.renderOffscreen();
        renderer.drawOffscreenRender(canvas);
        rerenderSlice = false;
    }

    // run again next frame
    requestAnimationFrame(loop);
}




function centerModelCallback() {
    models.centerModel();
    slicer.update();
    rerenderSlice = true;
};

function sliceAngleCallback() {
    slicer.setPlaneAngle(document.getElementById('slice_plane_angle').value);
    slicer.update();
    rerenderSlice = true;
}

function slicePositionCallback() {
    const position = Number(document.getElementById('slice_slider').value);
    slicer.setSlicePosition(position);
    slicer.update();
    rerenderSlice = true;
}

function updateSettingsCallback() {
    settings.printerPixelsX = Number(document.getElementById('printer_pixels_x').value);
    settings.printerPixelsY = Number(document.getElementById('printer_pixels_y').value);
    settings.printerSizeX   = Number(document.getElementById('printer_size_x').value);
    settings.printerSizeY   = Number(document.getElementById('printer_size_y').value);

    settings.printerSliceThickness   = Number(document.getElementById('printer_slice_thickness').value);
    settings.printerSliceSubsampling = Number(document.getElementById('printer_slice_subsampling').value);

    renderer.update();
    slicer.update();

    rerenderSlice = true;
};

function fileUploadCallback() {
    const file = this.files[0];

    const reader = new FileReader();
    reader.onload = function() {
        const mesh = parseSTL(new Buffer(reader.result));
        models.loadParsedSTL(mesh);
        renderer.update();
    };
    reader.readAsArrayBuffer(file);
}

function downloadCallback() {
    asyncRenderAndDownload().then(() => {
        // reset
        document.getElementById('download_button').innerText = 'Download';
        slicePositionCallback();
        rerenderSlice = true;
    });
}

async function asyncRenderAndDownload() {
    const file = document.getElementById('file_upload').files[0];
    const zipname = file? file.name+'.zip' : 'slices.zip';
    const zip = new JSZip();

    // render slices
    document.getElementById('download_button').innerText = 'Rendering...';
    slicer.setSlicePosition(0);
    slicer.update();

    let sliceNumber = 0;
    do {
        document.getElementById('download_button').innerText = `Rendering (${sliceNumber})`;

        // render a slice to an offscreen canvas
        const canvas = renderer.renderOffscreen();

        // convert canvas to png blob
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(resolve);
        });
        const filename = `slices/${sliceNumber}.png`; 

        zip.file(filename, blob);
        sliceNumber += 1;
    } while(slicer.loadNextSlice());

    // save zip file
    document.getElementById('download_button').innerText = 'Saving...';
    const zipfile = await zip.generateAsync({ type: 'blob' });
    saveAs(zipfile, zipname);
}

// start
main();


