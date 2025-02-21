/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {Integer} boundaryKey 
 * @param {Boolean} reach 
 * @param {Boolean} avoid 
 * @param {Boolean} reachavoid 
 * @param {Array} center 
 * @param {Float} radius 
 * @param {Boolean} flip 
 * @param {Boolean} wrap 
 */
export default function presetBoundaryCondition(boundaryKey=1, reach=false, avoid=false, reachavoid=false, 
                                                center=[0, 0], radius=0.5, flip=false,
                                                wrap=true) {
                                                
  var startCode = `// Given any state, we decide the initial value (boundary condition),
// defining a shape where the value is zero.

float get_bc(vec2 state, float sign, float time) {

`;

  var flipCode = ``;
  if (flip) flipCode = `-`;
  
  var endCode = `  return ${flipCode}val;
}

// to see it,
// [click screen, 'w']`;
// [click screen, 'd', click around, 'enter']`;

  if (!wrap) {
    startCode = `float get_bc(vec2 state, float sign, float time) {

`;
    endCode = `  return ${flipCode}val;
}
  
`;
  }

  if (reach) {
    startCode = `float get_bc_reach(vec2 state, float sign, float time) {

`;
  } else if (avoid) {
    startCode = `float get_bc_avoid(vec2 state, float sign, float time) {

`;
  }

  if (reachavoid) { // reach-avoid

    return startCode + `  float valR = get_bc_reach(state, sign, time);
  float valA = get_bc_avoid(state, sign, time);
  float val = max(valR, -valA);
    
` + endCode;
  }

  if (boundaryKey==0) { // custom

    return startCode + `  float val = 1.; // change me!
    
` + endCode;


  } else if (boundaryKey==1) { // box

    if (center[0] === 0 && center[1] === 0) {

      return startCode + `  float val = max(abs(state.x), abs(state.y)) - ${Number.isInteger(radius) ? radius.toFixed(1) : radius}; // box
    
` + endCode;  

    } else {

      return startCode + `  float val = max(abs(state.x - ${center.map(num => Number.isInteger(num) ? num.toFixed(1) : num)[0]}), abs(state.y - ${center.map(num => Number.isInteger(num) ? num.toFixed(1) : num)[1]})) - ${Number.isInteger(radius) ? radius.toFixed(1) : radius}; // box
    
` + endCode;
    }    

  } else if (boundaryKey==2) { // ball

    if (center[0] === 0 && center[1] === 0) {

      return startCode + `  float val = length(state) - ${Number.isInteger(radius) ? radius.toFixed(1) : radius}; // ball
    
` + endCode;  

    } else {

      return startCode + `  float val = length(state - vec2(${center.map(num => Number.isInteger(num) ? num.toFixed(1) : num)[0]}, ${center.map(num => Number.isInteger(num) ? num.toFixed(1) : num)[1]})) - ${Number.isInteger(radius) ? radius.toFixed(1) : radius}; // ball
    
` + endCode;
    }

  } else if (boundaryKey==3) { // figure eight

  return startCode + `  float x2 = state.x * state.x;
  float y2 = state.y * state.y;
  float val = (x2 + y2) * (x2 + y2) - 2. * (x2 - y2); // fig8
` + endCode;

  }
}
