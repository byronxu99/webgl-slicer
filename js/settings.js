// global settings

// print area size in pixels
export let printerPixelsX = 1920;
export let printerPixelsY = 1080;

// print area size in physical units (e.g. millimeters)
export let printerSizeX = 96;
export let printerSizeY = 54;

// distance between slices
export let printerSliceThickness = 0.050;

// if this is greater than 1, we render this many sub-slices
// between each slice and stack them together for the final image
export let printerSliceSubsampling = 1;

// color to render the slice
export let sliceColor = [255, 255, 255];

// line segment to 3d solid settings
export let lineWidthTop    = 1;
export let lineWidthBottom = 1;

// WebGL offscreen rendering multisampling (antialiasing)
// this is a rendering setting, not a slicing setting
// it is independent of printerSliceSubsampling
export let offscreenMultisampling = 8;

