/**
 * Wraps a simple vector field string into our default shader code.
 * @param {String} field 
 */
export default function wrapVectorField(field) {
  return `// Given any state (p.x, p.y),
// we define how it moves (v.x, v.y),
// determining how space flows.

vec2 get_velocity(vec2 p) {

  vec2 v = vec2(0., 0.);

  ${field}

  return v;
}`
}