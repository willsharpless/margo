import BaseShaderNode from './BaseShaderNode';
import snoise from './parts/simplex-noise';
import {getInputUniforms} from './customInput';

export default class UserDefinedVelocityHamiltonianFunctions extends BaseShaderNode {
  constructor(updateCode, updateHamiltonianCode, updateInputCode) {
    super();
    this.updateCode = updateCode || '';
    // this.updateHamiltonianCode = updateHamiltonianCode || '';
    // this.updateInputCode = updateInputCode || '';
  }

  setNewUpdateCode(newUpdateCode) {
    this.updateCode = newUpdateCode;
  }

  // setNewUpdateHamiltonianCode(newUpdateHamiltonianCode) {
  //   this.updateHamiltonianCode = newUpdateHamiltonianCode;
  // }

  // setNewUpdateInputCode(newUpdateInputCode) {
  //   this.updateInputCode = newUpdateInputCode;
  // }

  getDefines() {
    return `
uniform float frame;
uniform vec4 cursor;
// TODO: use inputN instead.
uniform sampler2D u_audio;

#define PI 3.1415926535897932384626433832795

${getInputUniforms()}
`
  }

  getFunctions() {
  // TODO: Do I need to worry about "glsl injection" (i.e. is there potential for security attack?)
  // TODO: Do I need to inject snoise only when it's used?
    return `
    // pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

${snoise}

vec2 rotate(vec2 p,float a) {
	return cos(a)*p+sin(a)*vec2(p.y,-p.x);
}

// TODO: This will change. Don't use it.
float audio(float index) {
  float rgbI = floor(index/4.);
  vec2 txPos = vec2(fract(rgbI / 5.), floor(rgbI / 5.) / 5.);
  vec4 rgba = texture2D(u_audio, txPos);
  
  float offset = mod(index, 4.);
  if (offset == 0.) return rgba[0];
  if (offset == 1.) return rgba[1];
  if (offset == 2.) return rgba[2];
  return rgba[3];
}

// Input Parameters (Linear By Default)

float game = 0.; // 0. for reach, 1. for avoid

mat2 control_matrix = mat2(1., 0., 0., 1.); // TODO relax to jacobian fn
vec2 control_max_mag = vec2(1., 0.5);
float control_bound_shape = 0.; // 0. for box, 1. for ball

mat2 disturbance_matrix = mat2(1., 0., 0., 1.);
vec2 disturbance_max_mag = vec2(0.5, 0.25);
float disturbance_bound_shape = 0.; // 0. for box, 1. for ball

// Input Laws

// FIXME autonomous for now (will test after upwind)

vec2 get_control(vec2 x, vec2 p, float t) { 
  vec2 optimal_control = vec2(0.); //FIXME
  return control_matrix * optimal_control;
}

vec2 get_disturbance(vec2 x, vec2 p, float t) { 
  vec2 optimal_disturbance = vec2(0.); //FIXME
  return disturbance_matrix * optimal_disturbance;
}

// Input Jacobians (ignorable)

mat2 control_jacobian(vec2 x, float time) {
  return control_matrix;
}

mat2 disturbance_jacobian(vec2 x, float time) {
  return disturbance_matrix;
}

${this.updateCode ? this.updateCode : `

vec2 get_vel(vec2 x) { return vec2(0.1); }

// // WAS FIXME: user-defined in advanced cases
// vec2 max_partial_hamiltonian_costate(vec2 state, vec2 costate_L, vec2 costate_R, float time, float value) {
//   vec2 vel = get_vel(state); // WAS FIXME: works for auto systems only!
//   return vec2(abs(vel.x), abs(vel.y));
// }

// // WAS FIXME: only auto for now
float get_ham(vec2 state, vec2 costate, float time) {
  vec2 vel = get_vel(state); // WAS FIXME: works for auto systems only!
  return -dot(costate, vel); // WAS FIXME: minus for backwards reach, could be user-defined
}

// Momentum ie Hamiltonian

// float get_ham(vec2 x, vec2 p, float t) { 
//   // float h = 0.1 * cos(t); // debugging
//   float h = dot(p, get_vel(x) + get_control(x, p, t) + get_disturbance(x, p, t));
//   return h;
// }

// if your hamiltonian is NOT solely defined wrt a flow,
// you must define max_partial_hamiltonian_costate or use a fixed LF parameter

// Evolve Value // TODO: for post-processor def

// vec2 evolve_value(vec2 state, vec2) {
//   return newValue
// }

`}

// Max Hamiltonian Derivative (// FIXME, should be user-defined)

vec2 max_partial_hamiltonian_costate(vec2 x, vec2 p_L, vec2 p_R, float t, float val) {
  mat2 control_jac = control_jacobian(x, t);
  mat2 disturbance_jac = disturbance_jacobian(x, t);
  // return abs(get_vel(x)) + mat2(abs(control_jac[0]), abs(control_jac[1])) * control_max_mag + mat2(abs(disturbance_jac[0]), abs(disturbance_jac[1])) * disturbance_max_mag;
  return abs(get_vel(x));
}

`
  }
}
