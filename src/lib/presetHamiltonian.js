/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {String} hamCode 
 * @param {Boolean} custom 
 * @param {Boolean} control 
 * @param {Array} controlMaxes 
 * @param {Int} controlShape 
 * @param {Boolean} disturbance 
 * @param {Array} disturbanceMaxes 
 * @param {Int} disturbanceShape 
 * @param {Boolean} wrap 
 */
export default function presetHamiltonian(auto=true,
                                        control=false, controlMaxes=[1., 1.], controlShape=1, controlReach=true,
                                        disturbance=false, disturbanceMaxes=[1., 1.], disturbanceShape=1, disturbanceReach=true,
                                        wrap=true,
) {

  // WAS TODO: could support any lb/ub for control/disturbance instead of maxs (non-zero centered)

  // var hamCode = `  float ham = -dot(costate, get_vel(state));`;
  var startCode = `// Given any state, we decide the momentum (hamiltonian),
// defining how the value evolves.

float get_ham(vec2 state, vec2 costate, float time) {

`;
  var endCode = `  return -dot(costate, get_vel(state));
}
`;

  if (!wrap) {
    startCode = `float get_ham(vec2 state, vec2 costate, float time) {

`;
    endCode = `  return -dot(costate, get_vel(state));
}
  
`;
  } // CLEAN ME

  var controlCode = ``;
  var disturbanceCode = ``;

  if (auto) {
    return startCode + endCode;
  }
  
  if (control) {

    if (!controlReach) {
      var controlGameCode = `-`;
    } else {
      var controlGameCode = ``;
    }

    if (controlShape == 1) { // Box
      controlCode = `  // Control
  float hamC = ${controlGameCode}dot(abs(vec2(${controlMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate), vec2(1.));

`;
    } else if (controlShape == 2) { // Ball
      controlCode = `  // Control
  float hamC = ${controlGameCode}sqrt(dot(0.5 * vec2(${controlMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate, 0.5 * vec2(${controlMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate));

`;
    } else {
      controlCode = `// NOT IMPLEMENTED`;
    }
    var endCode = `  return -dot(costate, get_vel(state)) + hamC;
}

`;
  }

  if (disturbance) {

    if (!disturbanceReach) {
      var disturbanceGameCode = `-`;
    } else {
      var disturbanceGameCode = ``;
    }

    if (disturbanceShape == 1) { // Box
      disturbanceCode = `  // Disturbance
  float hamD = ${disturbanceGameCode}dot(abs(vec2(${disturbanceMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate), vec2(1.));

`;
    } else if (disturbanceShape == 2) { // Ball
      disturbanceCode = `  // Disturbance
  float hamD = ${disturbanceGameCode}sqrt(dot(vec2(0.5 * ${disturbanceMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate, 0.5 * vec2(${disturbanceMaxes.map(num => Number.isInteger(num) ? num.toFixed(1) : num).join(', ')}) * costate));

`;
    } else {
      disturbanceCode = `// NOT IMPLEMENTED`;
    }
    var endCode = `  return -dot(costate, get_vel(state)) + hamD;
}

`;
  }

  if (control && disturbance) {
    var endCode = `  return -dot(costate, get_vel(state)) + hamC + hamD;
}

`;
  }

  return startCode + controlCode + disturbanceCode + endCode;
}

// float ham = -dot(p, get_vel(s));

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