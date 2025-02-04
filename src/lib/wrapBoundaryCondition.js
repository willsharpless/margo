/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {String} bcCode 
 */
export default function wrapBoundaryCondition(bcCode) {
  return `// Given any point, we decide the value at time zero,
// defining a shape (where the value is zero).

float get_boundary_condition(vec2 s, float sign, float time) {

  ${bcCode}

  return sign * bc_val;
}

// or, to draw it,
// [click screen, 'd', click around, 'enter']`
}