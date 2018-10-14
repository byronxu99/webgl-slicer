# webgl-slicer
WebGL Slicer was created to process 3D models for a new 3D printer built at the [MIT Media Lab](https://www.media.mit.edu/projects/cilllia-3d-printed-micro-pillar-structures-for-surface-texture-actuation-and-sensing/overview/). The printer is designed to produce continuous sheets of densely textured material through a DLP resin-curing process. In order to print a continuous sheet, a flexible print bed is advanced through a resin tank at an angle relative to the projection plane (the liquid resin surface), while a DLP projector above cures the resin at the surface. As a result, the 3D model must also be sliced at an angle to match the physical printing process.

Another level of complexity is introduced by the dense textures (e.g. hair, fur, and lattice structures) desired to be printed. This slicer uses hardware-accelerated WebGL rendering to offload most of the graphics processing to the GPU, using a technique inspired by that of the [Formlabs Hackathon Slicer](https://github.com/formlabs/hackathon-slicer). To efficiently store 3D model data, the slicer can generate 3D straight and tapered beams from line segments, allowing each individual hair or lattice segment to be defined with just two points.

<p align="center">
<img src="https://i.imgur.com/XUUeYwK.png" width="400">
&nbsp;
<img src="https://i.imgur.com/BzhubBQ.png" width="400">
</p>
<p align="center">
Slicing of a lattice structure at a 45 degree angle
</p>

## Online usage
WebGL Slicer is a fully client-side program that runs in your browser. Visit https://byronxu99.github.io/webgl-slicer/ to use it online!

## Settings
**Printer X/Y pixels:** Resolution of the DLP projector.</br>
**Printer X/Y physical size:** Dimensions (in millimeters) of the print area. 3D model units are assumed to be in millimeters.</br>
**Slice plane angle:** Offset angle of the slice plane relative to the direction the model is advanced. Zero degrees means perpendicular (like a traditional slicer).</br>
**Slice rendering color:** HTML color code that the slice is rendered with.</br>
**Printer slice thickness:** Distance (in millimeters) between slices.</br>
**Printer slice multisampling:** WebGL multisampling antialiasing. Larger values will smooth out jagged lines more. Set to 1 to disable.</br>
**Printer slice subsampling:** When subsampling is greater than one, the slice is rendered as the given number of "sub-slices". Each sub-slice has the model incremented forwards by a fractional amount. Larger values smooth out changes between slices, but have a noticeably higher impact on performance.</br>

## Production build
* `npm install`
* `npm run build`

## Development
* `npm install`
* `npm start` (runs `webpack-serve` to auto-update upon changes)
* open browser to `localhost:8080`
