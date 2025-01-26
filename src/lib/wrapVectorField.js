/**
 * Wraps a simple vector field string into our default shader code.
 * @param {String} field 
 */
export default function wrapVectorField(field) {
  return `// Given any point (state), we decide how it moves (velocity),
// defining how space flows.

vec2 get_velocity(vec2 s) {

  vec2 v = vec2(0., 0.);

  ${field}

  return v;
}`
}