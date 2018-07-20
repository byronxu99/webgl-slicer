'use strict';

import { m4 } from 'twgl.js';
import { degToRad } from './helpers.js';

// the Camera orbits the origin in world-space and always looks at the origin
// its position is expressed in spherical coordinates (radius, theta, phi)
// and the "up" direction from the camera's perspective is given as a vector
export class Camera {
    constructor(r = undefined, t = 0, p = Math.PI/2, u = [0,1,0]) {
        this.theta  = t;
        this.phi    = p;
        this.radius = r;
        this.up     = u;
    }

    // returns a [x,y,z] coordinate vector of the camera's location
    vector() {
        const y = this.radius * Math.cos(this.phi);
        const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
        const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

        return [x,y,z];
    }

    // returns a matrix that positions the camera in world-space
    cameraMatrix() {
        const [x,y,z] = this.vector();
        return m4.lookAt([x,y,z], [0,0,0], this.up);
    }

    // returns a matrix that moves the world around the camera (inverse of cameraMatrix)
    viewMatrix() {
        return m4.inverse(this.cameraMatrix());
    }

    rotateTheta(degrees) {
        this.theta += degToRad(degrees);
    }

    rotatePhi(degrees) {
        this.phi += degToRad(degrees);
        if(this.phi < 0.01) this.phi = 0.01;
        if(this.phi > 3.14) this.phi = 3.14;
    }

    changeRadius(amount) {
        this.radius += amount;
        if(this.radius < 1)    this.radius = 1;
        if(this.radius > 2000)  this.radius = 2000;
    }

    setRadius(r) {
        this.radius = r;
        if(this.radius < 1)    this.radius = 1;
        if(this.radius > 2000)  this.radius = 2000;
    }
};

