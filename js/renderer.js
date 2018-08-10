'use strict';

import * as twgl from 'twgl.js';
const m4 = twgl.m4;

// local imports
import * as settings from './settings.js';
import * as shaders from './shaders.js';
import * as ui from './ui.js';
import * as models from './models.js';
import * as slicer from './slicer.js';
import { degToRad, composeTransformations } from './helpers.js';
import { Camera } from './camera.js';


// global variables - the rendering context
let renderCanvas = null;
let sliceCanvas = null;
let gl = null;              // WebGL 3d context for rendering
let ctx = null;             // 2d context for displaying slice

// global variables - GLSL programs (encapsulated in twgl objects)
let render3dProgram = null;
let renderSliceProgram = null;

// global variables - twgl attribute buffers
let modelAttributeBuffer = null;
let planeAttributeBuffer = null;

// global variables - offscreen render framebuffer and copy framebuffer
let offscreen = {
    framebuffer: null,
    colorbuffer: null,
    depthstencil: null,
};
let offscreenCopy = {
    framebuffer: null,
    colorbuffer: null,
};

// global variables - clip plane settings for 3d preview
const zNear = 1;
const zFar = 3000;

// global variables - 3d view camera
// exported to allow access in other files
export const camera = new Camera();


// initialize the rendering functionality
function init(htmlRenderCanvas, htmlSliceCanvas) {
    renderCanvas = htmlRenderCanvas;
    sliceCanvas  = htmlSliceCanvas;

    // create webgl context
    gl = renderCanvas.getContext('webgl2');
    if(!gl) {
        alert('Error: WebGL 2 not supported by your browser!');
    }
    document.getElementById('webgl_version').innerText = gl.getParameter(gl.VERSION);

    // create slice 2d context
    ctx = sliceCanvas.getContext('2d');

    // create gpu programs
    render3dProgram     = twgl.createProgramInfo(gl, [shaders.vs3d, shaders.fs3d]);
    renderSliceProgram  = twgl.createProgramInfo(gl, [shaders.vsSlice, shaders.fsSlice]);

    // create offscreen rendering buffers
    offscreen.framebuffer     = gl.createFramebuffer();
    offscreenCopy.framebuffer = gl.createFramebuffer();

    // register callbacks
    renderCanvas.onmousedown      = ui.mousedownCallback;
    renderCanvas.onmouseup        = ui.mouseupCallback;
    renderCanvas.onmousemove      = ui.mousemoveCallback;
    renderCanvas.onmouseleave     = ui.mouseleaveCallback;
    renderCanvas.onwheel          = ui.wheelCallback;
    renderCanvas.oncontextmenu    = ui.contextmenuCallback;
    sliceCanvas.oncontextmenu     = ui.contextmenuCallback;

    update();
    slicer.update();
}


// update renderer state upon a change (e.g. in printer settings)
function update() {
    // set the camera distance from the origin
    // to 1.5x the plane diagonal length
    const r = Math.hypot(settings.printerSizeX, settings.printerSizeY);
    camera.setRadius(1.5*r);

    // bind and set size of the offscreen rendering framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreen.framebuffer);
    offscreen.framebuffer.width  = settings.printerPixelsX;
    offscreen.framebuffer.height = settings.printerPixelsY;

    // create and attach a multisampled color buffer
    if(offscreen.colorbuffer) gl.deleteRenderbuffer(offscreen.colorbuffer);
    offscreen.colorbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, offscreen.colorbuffer);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, settings.offscreenMultisampling, gl.RGBA4, settings.printerPixelsX, settings.printerPixelsY);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, offscreen.colorbuffer);

    // create and attach a multisampled depth-stencil buffer
    if(offscreen.depthstencil) gl.deleteRenderbuffer(offscreen.depthstencil);
    offscreen.depthstencil = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, offscreen.depthstencil);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, settings.offscreenMultisampling, gl.DEPTH24_STENCIL8, settings.printerPixelsX, settings.printerPixelsY);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, offscreen.depthstencil);

    // bind and set size of the offscreen copy framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenCopy.framebuffer);
    offscreenCopy.framebuffer.width  = settings.printerPixelsX;
    offscreenCopy.framebuffer.height = settings.printerPixelsY;

    // create and attach a single-sampled color buffer
    if(offscreenCopy.colorbuffer) gl.deleteRenderbuffer(offscreenCopy.colorbuffer);
    offscreenCopy.colorbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, offscreenCopy.colorbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, settings.printerPixelsX, settings.printerPixelsY);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, offscreenCopy.colorbuffer);

    // reset to null (on-screen) framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // load model attributes
    loadModels();
}


// create GL attribute buffers from model data
function loadModels() {
    modelAttributeBuffer = twgl.createBufferInfoFromArrays(gl, models.getModelData());
    planeAttributeBuffer = twgl.createBufferInfoFromArrays(gl, slicer.getPlaneData());
}


// render the 3d view of the model and slice plane
function render3d(time) {
    // render to screen (null framebuffer) and set viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    // load gpu program
    gl.useProgram(render3dProgram.program);

    // clear screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // settings
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // set attributes
    twgl.setBuffersAndAttributes(gl, render3dProgram, modelAttributeBuffer);

    // set uniforms
    const model = models.getModelMatrix(time);
    const slice = slicer.getSliceMatrix();
    const view = camera.viewMatrix();
    const projection = m4.perspective(degToRad(45), aspect, zNear, zFar);
    twgl.setUniforms(render3dProgram, {
        u_modelViewProjection: composeTransformations(model, slice, view, projection),
        u_modelInverseTranspose: m4.transpose(m4.inverse(model)),
        u_light: twgl.v3.normalize(camera.vector()),
        u_alpha: 1.0,
    });

    // render
    twgl.drawBufferInfo(gl, modelAttributeBuffer);

    // load data for rendering plane
    gl.disable(gl.CULL_FACE);
    twgl.setBuffersAndAttributes(gl, render3dProgram, planeAttributeBuffer);

    // plane model matrix - matrix that rotates plane about origin
    const planeModel = slicer.getPlaneMatrix();
    twgl.setUniforms(render3dProgram, {
        u_modelViewProjection: composeTransformations(planeModel, view, projection),
        u_modelInverseTranspose: m4.transpose(m4.inverse(planeModel)),
        u_light: slicer.getPlaneNormalVector(),
        u_alpha: 0.5,
    });

    // draw plane
    twgl.drawBufferInfo(gl, planeAttributeBuffer);
}


// render the slice to an offscreen canvas buffer
// this is a multi-step process:
//     1. render to stencil buffer of multisampled framebuffer (find model-plane intersection)
//     2. render to color buffer of multisampled framebuffer (fill in pixels of model-plane intersection)
//     3. copy from multisampled framebuffer to regular framebuffer
//     4. read pixels off the copy framebuffer
//     5. create a canvas containing the pixel data
function renderOffscreen(time) {
    // bind framebuffer and set viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreen.framebuffer);
    gl.viewport(0, 0, offscreen.framebuffer.width, offscreen.framebuffer.height);

    // load gpu program
    gl.useProgram(renderSliceProgram.program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // add colors

    // clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // set attributes
    twgl.setBuffersAndAttributes(gl, renderSliceProgram, modelAttributeBuffer);

    // compute transformation matrices
    const model = models.getModelMatrix(time);
    const view  = slicer.getViewMatrix();

    const x = 0.5 * settings.printerSizeX;
    const y = 0.5 * settings.printerSizeY;
    const projection = m4.ortho(-1*x, x, -1*y, y, 0, 1e6);

    // set render color as (1/subsamples) so that when a pixel
    // is contained in all subsamples it is rendered 100% white
    twgl.setUniforms(renderSliceProgram, {
        u_r: settings.sliceColor[0] / 255 / settings.printerSliceSubsampling,
        u_g: settings.sliceColor[1] / 255 / settings.printerSliceSubsampling,
        u_b: settings.sliceColor[2] / 255 / settings.printerSliceSubsampling,
    });

    // render for each sub-slice
    for(let i = 0; i < settings.printerSliceSubsampling; i++) {
        // set uniforms
        const slice = slicer.getSliceMatrix(2*i); // smooth between 2 slices
        twgl.setUniforms(renderSliceProgram, {
            u_modelViewProjection: composeTransformations(model, slice, view, projection),
        });

        // clear stencil buffer
        gl.clear(gl.STENCIL_BUFFER_BIT);

        // render pass 1 - don't draw colors
        // increment stencil on front-facing triangles, decrement on back
        gl.colorMask(false, false, false, false);
        gl.enable(gl.STENCIL_TEST);
        gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
        gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
        gl.stencilOpSeparate(gl.BACK,  gl.KEEP, gl.KEEP, gl.DECR_WRAP);
        twgl.drawBufferInfo(gl, modelAttributeBuffer);

        // render pass 2 - fill with color if stencil != 0
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.NOTEQUAL, 0, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        twgl.drawBufferInfo(gl, modelAttributeBuffer);
    }

    // copy from multisampled render framebuffer to non-multisampled copy framebuffer
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, offscreen.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, offscreenCopy.framebuffer);
    gl.blitFramebuffer(0, 0, offscreen.framebuffer.width, offscreen.framebuffer.height,
                       0, 0, offscreenCopy.framebuffer.width, offscreenCopy.framebuffer.height,
                       gl.COLOR_BUFFER_BIT, gl.NEAREST);

    // create offscreen canvas as a data buffer
    const canvas  = document.createElement('canvas');
    canvas.width  = settings.printerPixelsX;
    canvas.height = settings.printerPixelsY;
    const context = canvas.getContext('2d');

    // create image data array and load pixels
    const imgData = context.createImageData(settings.printerPixelsX, settings.printerPixelsY);
    const array   = new Uint8Array(imgData.data.buffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenCopy.framebuffer);
    gl.readPixels(0, 0, offscreen.framebuffer.width, offscreen.framebuffer.height, gl.RGBA, gl.UNSIGNED_BYTE, array);

    // add to canvas
    context.putImageData(imgData, 0, 0);
    return canvas;
}


// draw the offscreen rendered buffer to the 2d canvas
function drawOffscreenRender(canvas) {
    // determine scale for displaying offscreen image
    const scaleX = sliceCanvas.width  / settings.printerPixelsX;
    const scaleY = sliceCanvas.height / settings.printerPixelsY;
    //const scale  = Math.min(1, Math.min(scaleX, scaleY));
    const scale  = Math.min(scaleX, scaleY);
    const imgX   = Math.floor(scale * settings.printerPixelsX);
    const imgY   = Math.floor(scale * settings.printerPixelsY);

    // create an image out of the buffer canvas
    const img = new Image();
    img.onload = function() {
        // draw the image to the slice display canvas
        ctx.imageSmoothingEnabled = false;
        //ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        // draw border
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, imgX, imgY);
    };

    // load buffer canvas data to image
    canvas.toBlob(blob => {
        img.src = URL.createObjectURL(blob);
    });
}

export { init, update, loadModels, render3d, renderOffscreen, drawOffscreenRender };

