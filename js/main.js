'use strict';

import * as twgl from 'twgl.js';
import parseSTL from 'parse-stl';
import parseOBJ from 'parse-wavefront-obj';
import JSZip from 'jszip';
import dialogPolyfill from 'dialog-polyfill';
import { saveAs } from 'file-saver/FileSaver';

// local imports
import './plugins.js';
import * as renderer from './renderer.js';
import * as settings from './settings.js';
import * as models from './models.js';
import * as slicer from './slicer.js';
import * as lines from './lines.js';
import { degToRad, colorToString, stringToColor } from './helpers.js';


// global variables - html canvas objects
const renderCanvas = document.getElementById('render_canvas');
const sliceCanvas  = document.getElementById('slice_canvas');

// global variables - frames per second counting
let loopCount = 0;
let startTime = 0;

// global variables - whether we need to re-render the slice
let rerenderSlice = true;


function main() {
    // set input field default values
    // line to 3d settings
    document.getElementById('width_top').value = settings.lineWidthTop;
    document.getElementById('width_bottom').value = settings.lineWidthBottom;

    // printer dimension settings
    document.getElementById('printer_pixels_x').value = settings.printerPixelsX;
    document.getElementById('printer_pixels_y').value = settings.printerPixelsY;
    document.getElementById('printer_size_x').value   = settings.printerSizeX;
    document.getElementById('printer_size_y').value   = settings.printerSizeY;

    // slicing settings
    document.getElementById('slice_plane_angle').value           = '0';
    document.getElementById('printer_slice_thickness').value     = settings.printerSliceThickness;
    document.getElementById('printer_slice_multisampling').value = settings.offscreenMultisampling;
    document.getElementById('printer_slice_subsampling').value   = settings.printerSliceSubsampling;

    // render color settings
    document.getElementById('slice_color').value = colorToString(settings.sliceColor);

    // bind callbacks
    initCallbacks();

    // initialize and run
    renderer.init(renderCanvas, sliceCanvas);
    requestAnimationFrame(loop);
}


// this is run every frame
function loop() {
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


// bind callbacks to UI elements
function initCallbacks() {
    // file upload
    document.getElementById('file_type_select').onchange = fileTypeCallback;
    document.getElementById('file_upload').onchange = fileUploadCallback;

    // line to 3d settings
    document.getElementById('line_settings_button').onclick = lineSettingsCallback;
    fileTypeCallback(); // set hidden/shown state

    // model manipulation buttons
    document.getElementById('rotate_x_button').onclick = function() { models.rotateModel('x'); };
    document.getElementById('rotate_y_button').onclick = function() { models.rotateModel('y'); };
    document.getElementById('rotate_z_button').onclick = function() { models.rotateModel('z'); };
    document.getElementById('center_button').onclick   = centerModelCallback;

    // the big "update" button
    document.getElementById('printer_settings_button').onclick = updateSettingsCallback;

    // slice position slider
    document.getElementById('slice_slider').oninput  = slicePositionCallback;

    // the big "slice" button
    document.getElementById('slice_button').onclick = sliceCallback;
}




// handle a file upload
function fileUploadCallback() {
    const filetype = document.getElementById('file_type_select').value;
    const file = this.files[0];

    const reader = new FileReader();
    reader.onload = function() {
        if(filetype === 'stl') {
            const mesh = parseSTL(new Buffer(reader.result));
            models.loadParsedSTL(mesh);
        }

        if(filetype === 'obj') {
            const mesh = parseOBJ(new Buffer(reader.result));
            models.loadParsedSTL(mesh); // STL loader also works for OBJ after parsing
        }

        if(filetype === 'line') {
            lines.parseArrayBuffer(reader.result);
            lines.make3dModel();
        }

        renderer.update();
        rerenderSlice = true;
    };
    reader.readAsArrayBuffer(file);
}


// when the 'slice' button pressed
let slicing = false;
function sliceCallback() {
    // already slicing, we want to cancel
    if(slicing) {
        slicing = false;
    }

    // begin slicing
    else {
        slicing = true;
        asyncRender().then(zipfile => {
            // make popup
            if(zipfile) {
                downloadMenu(zipfile);
            }

            // reset
            slicing = false;
            document.getElementById('slice_button').innerText = 'Slice';
            slicePositionCallback();
            rerenderSlice = true;
        });
    }
}

// render slices and return promise of a zip file
async function asyncRender() {
    const zip = new JSZip();

    // render slices
    document.getElementById('slice_button').innerText = 'Rendering...';
    slicer.setSlicePosition(0);
    slicer.update();

    let sliceNumber = 0;
    do {
        document.getElementById('slice_button').innerText = `Rendering ${sliceNumber} (click to cancel)`;

        // render a slice to an offscreen canvas
        const canvas = renderer.renderOffscreen();

        // convert canvas to png blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve);
        });
        const filename = `slices/${sliceNumber}.png`;

        zip.file(filename, blob);
        sliceNumber += 1;
    } while(slicing && slicer.loadNextSlice());

    // if slicing wasn't cancelled, save zip file
    if(slicing) {
        document.getElementById('slice_button').innerText = 'Saving...';
        const zipfile = await zip.generateAsync({ type: 'blob' });
        return zipfile;
    }
}

// make a download/upload zip popup
function downloadMenu(zipBlob) {
    const popup = document.getElementById('download_popup');
    dialogPolyfill.registerDialog(popup);

    document.getElementById('close_button').onclick    = function() { popup.close(); };
    document.getElementById('download_button').onclick = function() { saveAs(zipBlob); };
    document.getElementById('upload_button').onclick   = function() { uploadToRemoteServer(zipBlob); };
    document.getElementById('upload_button').innerText = 'POST to remote address:';
    popup.showModal();
}

// upload zip blob to a remote address
function uploadToRemoteServer(zipBlob) {
    const url = document.getElementById('post_address').value;
    if(!url) {
        document.getElementById('upload_button').innerText = 'Please fill out URL below';
        return;
    }

    document.getElementById('upload_button').innerText = 'Uploading...';

    const formData = new FormData();
    formData.append('file', zipBlob);

    fetch(url, {
        method: 'POST',
        cache: 'no-store',
        mode: 'no-cors',
        body: formData,
    }).then(response => {
        if(response.ok) {
            document.getElementById('upload_button').innerText = 'Upload successful';
        } else {
            document.getElementById('upload_button').innerText = `${response.status} ${response.statusText}`;
        }
    }).catch(error => {
        document.getElementById('upload_button').innerText = 'Error! (see browser console)';
        console.log(error);
    });
}





// misc. ui event handlers
function fileTypeCallback() {
    const type = document.getElementById('file_type_select').value;
    if(type === 'line') {
        document.getElementById('line_settings').style.display = 'block';
    } else {
        document.getElementById('line_settings').style.display = 'none';
    }
}

function lineSettingsCallback() {
    settings.lineWidthTop    = Number(document.getElementById('width_top').value);
    settings.lineWidthBottom = Number(document.getElementById('width_bottom').value);
    lines.make3dModel();
    rerenderSlice = true;
}

function centerModelCallback() {
    models.centerModel();
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
    settings.offscreenMultisampling  = Number(document.getElementById('printer_slice_multisampling').value);

    const angle = degToRad(Number(document.getElementById('slice_plane_angle').value));
    slicer.setPlaneAngle(angle);

    settings.sliceColor = stringToColor(document.getElementById('slice_color').value);

    renderer.update();
    slicer.update();

    rerenderSlice = true;
}


// start
main();


