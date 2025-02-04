/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {String} hamCode 
 * @param {Boolean} custom 
 * @param {Boolean} ctrl 
 * @param {Array} ctrl_Ubds 
 * @param {Array} ctrl_Lbds 
 * @param {Int} ctrl_shape 
 * @param {Boolean} dist 
 * @param {Array} dist_Ubds 
 * @param {Array} dist_Lbds 
 * @param {Int} dist_shape 
 */
export default function wrapHamiltonian(hamCode, custom=true, 
                                                  ctrl=false, ctrl_Ubds=[1., 1.], ctrl_Lbds=[1., 1.], ctrl_shape=1, 
                                                  dist=false, dist_Ubds=[1., 1.], dist_Lbds=[1., 1.], dist_shape=1, 
) {

  var startCode = `// Given any point, we decide the momentum (hamiltonian),
// defining how the value evolves.

float get_hamiltonian(vec2 state, vec2 costate, float time) {

`;
  var endCode = `
  
  return ham;
}`; 
  var ctrlCode = ``;
  var ctrlOptCode = ``;
  var distCode = ``;
  var distOptCode = ``;

  if (custom) {
    return startCode + hamCode + endCode;
  }
  
  if (ctrl) {
    //do the comp
    if (ctrl_shape == 1) { // Box
      ctrlOptCode = `// NOT IMPLEMENTED`;
    } else if (ctrl_shape == 2) { // Ball
      ctrlOptCode = `// NOT IMPLEMENTED`;
    } else {
      ctrlOptCode = `// NOT IMPLEMENTED`;
    }
    ctrlCode = `// Control
Qc = [${ctrl_Ubds}];
${ctrlOptCode}

`;}

  if (dist) {
    //do the comp
    if (dist_shape == 1) { // Box
      distOptCode = `// NOT IMPLEMENTED`;
    } else if (dist_shape == 2) { // Ball
      distOptCode = `// NOT IMPLEMENTED`;
    } else {
      distOptCode = `// NOT IMPLEMENTED`;
    }
    distCode = `// Disturbance
Qd = [${ctrl_Ubds}];
${distOptCode}
`;}

  return startCode + ctrlCode + distCode + hamCode + endCode;
}

// float ham = -dot(p, get_velocity(s));

// function convertCursor2bcParams() {
//   var cursor = ctx.cursor;

//   // Corner Drawing Method
//   var w = Math.abs(cursor.clickX - cursor.hoverX);
//   var h = Math.abs(cursor.clickY - cursor.hoverY); 
//   ctx.bc.cx = Math.min(cursor.clickX, cursor.hoverX) + 0.5 * w;
//   ctx.bc.cy = Math.min(cursor.clickY, cursor.hoverY) + 0.5 * h;

//   // Radial Drawing Method
//   // ctx.bc.cx = cursor.clickX
//   // ctx.bc.cy = cursor.clickY
//   // var w = 2 * Math.abs(ctx.bc.cx - cursor.hoverX);
//   // var h = 2 * Math.abs(ctx.bc.cy - cursor.hoverY);
//   var maxw = Math.abs(ctx.bbox.maxX - ctx.bbox.minX);
//   var maxh = Math.abs(ctx.bbox.maxY - ctx.bbox.minY);
//   var minmax = Math.min(maxw, maxh); // to prevent screen cover before moving

//   if (ctx.bc.shape == 1) { // square
//     ctx.bc.qx = Math.max(0.5 * w, 0.005 * minmax);
//     ctx.bc.qy = Math.max(0.5 * h, 0.005 * minmax);
//     // console.log("ctx.bc.qx",ctx.bc.qx)
//   } else if (ctx.bc.shape == 2) { // circle
//     ctx.bc.qx = Math.max(2 * Math.pow(0.5 * w, 2), 0.0005 * minmax);
//     ctx.bc.qy = Math.max(2 * Math.pow(0.5 * h, 2), 0.0005 * minmax); // 2x for better Ux
//   } else {
//     console.log("Drawing mode ", ctx.bc.shape, " not possible yet!")
//   }
// }