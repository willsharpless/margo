/**
 * Wraps a simple vector field string into our default shader code.
 * @param {String} field 
 */
export default function wrapVectorField(field) {
  return `// Given any state (x, y),
// we define how it moves (in (x, y)),
// determining how space flows.

vec2 get_velocity(vec2 s) {

  vec2 v = vec2(0., 0.);

  ${field}

  return v;
}`
}