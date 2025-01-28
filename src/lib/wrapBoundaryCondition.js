/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {String} bcCode 
 */
export default function wrapBoundaryCondition(bcCode) {
  return `// Given any point, we decide it's value at time zero,
// defining a shape (where the value is zero).

float boundary_condition(vec2 s) {

  ${bcCode}

  return bc_val;
}

// or, draw it,
// [click screen, 'w', click around, 'return']
`
}