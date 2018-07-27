// slice rendering shaders

export const vsSlice = `#version 300 es
// attributes
in vec4 a_position;

// uniforms
uniform mat4 u_modelViewProjection;

void main() {
    // compute vertex position
    gl_Position = u_modelViewProjection * a_position;
}`;

export const fsSlice = `#version 300 es
precision mediump float;

// uniforms
uniform float u_color;

// output
out vec4 outColor;

void main() {
    outColor = vec4(u_color, u_color, u_color, 1);
}`;






// 3d rendering shaders

export const vs3d = `#version 300 es
// attributes
in vec4 a_position;
in vec3 a_normal;

// uniforms
uniform mat4 u_modelViewProjection;
uniform mat4 u_modelInverseTranspose;

// varyings
out vec3 v_normal;

void main() {
    // compute vertex position
    gl_Position = u_modelViewProjection * a_position;

    // transform normals with inverse-transpose of model matrix
    // https://webgl2fundamentals.org/webgl/lessons/webgl-3d-lighting-directional.html
    v_normal = mat3(u_modelInverseTranspose) * a_normal;
}`;

export const fs3d = `#version 300 es
precision mediump float;

// inputs from vertex shader
in vec3 v_normal;

// uniforms
uniform vec3 u_light; // vector from origin to light
uniform float u_alpha;

// output
out vec4 outColor;

void main() {
    // compute light intensity
    vec3 normal = normalize(v_normal);
    float light = abs(dot(normal, -1.0*u_light));

    // compute shade of gray
    vec3 color = vec3(1.0) * clamp(light, 0.1, 1.0);

    // output color of fragment
    outColor = vec4(color, u_alpha);
}`;
