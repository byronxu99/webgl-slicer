'use strict';

import { camera } from './renderer.js';

let mouseDown = false;

function mousedownCallback(event) {
    // left click
    if(event.button === 0) {
        mouseDown = true;
    }

    // middle click
    if(event.button === 1) {
        // reset view
        camera.constructor();
    }
}

function mouseupCallback(event) {
    // left click
    if(event.button === 0) {
        mouseDown = false;
    }
}

function mouseleaveCallback(event) {
    mouseDown = false;
}

function mousemoveCallback(event) {
    if(mouseDown) {
        // arbitrary value for sensitivity of rotation
        const sensitivity = 0.333;

        camera.rotateTheta(-1 * event.movementX * sensitivity);
        camera.rotatePhi(-1 * event.movementY * sensitivity);
    }
}

function wheelCallback(event) {
    // scroll up = negative deltaY = zoom in = smaller radius
    // scroll down = positive deltaY = zoom out = larger radius
    // deltaMode is whether deltaY is in units of lines or pixels
    const amount = event.deltaMode? event.deltaY * 8 : event.deltaY / 5;
    camera.changeRadius(amount);
    return false;
}

function contextmenuCallback() {
    // no right click menu
    return false;
}


export { mousedownCallback, mouseupCallback, mouseleaveCallback, mousemoveCallback, wheelCallback, contextmenuCallback };


