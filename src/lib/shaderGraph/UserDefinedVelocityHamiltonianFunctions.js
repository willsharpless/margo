import BaseShaderNode from './BaseShaderNode';
import snoise from './parts/simplex-noise';
import {getInputUniforms} from './customInput';

export default class UserDefinedVelocityHamiltonianFunctions extends BaseShaderNode {
  constructor(updateCode, updateHamiltonianCode) {
    super();
    this.updateCode = updateCode || '';
    this.updateHamiltonianCode = updateHamiltonianCode || '';
  }

  setNewUpdateCode(newUpdateCode) {
    this.updateCode = newUpdateCode;
  }

  setNewUpdateHamiltonianCode(newUpdateHamiltonianCode) {
    this.updateHamiltonianCode = newUpdateHamiltonianCode;
  }

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

${this.updateCode ? this.updateCode : 'vec2 get_velocity(vec2 p) { return vec2(0.003); }'}

${this.updateHamiltonianCode ? this.updateHamiltonianCode : `
  float get_hamiltonian(vec2 x, vec2 p, float t) { 
    vec2 f = get_velocity(x);
    // return - 0.01 * (f.x + f.y);
    return 0.01 * cos(t);
  }`}

  `
  }
}
