import BaseShaderNode from './BaseShaderNode';
import encodeFloatRGBA from './parts/encodeFloatRGBA';
import decodeFloatRGBA from './parts/decodeFloatRGBA';

/**
 * Reads/writes particle coordinates from/to a texture;
 */
export default class TextureBoundary extends BaseShaderNode {
  constructor(isDecode) {
    super();

    // When it's decoding, it must read from the texture.
    // Otherwise it must write to the texture;
    this.isDecode = isDecode;
  }

  getFunctions() {
    if (this.isDecode) {
      return `
    ${encodeFloatRGBA}
    ${decodeFloatRGBA}
`
    }
  }

  getDefines() {
    if (this.isDecode) {
      // TODO: How to avoid duplication and silly checks?
    return `
precision highp float;

uniform vec2 u_min;
uniform vec2 u_max;
uniform float value_transfer;
uniform float diff_mag;

uniform float spacing_x;
uniform float spacing_y;
uniform float spacing_std;
uniform float pSR;

uniform sampler2D u_particles_x;     // stores evolving value
uniform sampler2D u_particles_y;     // unneeded

// Which coordinate needs to be printed onto the texture
uniform int u_out_coordinate;

varying vec2 v_tex_pos;
varying float v_tex_index;
uniform float u_particles_res;

`;
    }
  }

  getMainBody() {
  if (this.isDecode) {
    return `
  
  float lastReachValue = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos)); // works when flipped, interesting
  float lastAvoidValue = decodeFloatRGBA(texture2D(u_particles_y, 1.-v_tex_pos));
  
  vec2 aligned_tex_pos = ((1. - v_tex_pos) - vec2(0.5 / u_particles_res)) / (1. - 1./pSR); // WAS FIXME: if pSR varies for x/y -> vec2(pSRx, pSRy)?
  vec2 state = vec2(
      roundToPrecision(abs(u_max.x - u_min.x) * aligned_tex_pos.x + u_min.x, 1e-6),
      roundToPrecision(abs(u_max.y - u_min.y) * aligned_tex_pos.y + u_max.y, 1e-6));

  float lastValue;
  if (first_pass > 0.) {
    lastValue = 3.4028234663852886e+38;
  } else {
    // lastValue = lastReachValue;
    if (u_out_coordinate == 0) lastValue = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos)); // decode reach
    else if (u_out_coordinate == 1) lastValue = decodeFloatRGBA(texture2D(u_particles_y, 1.-v_tex_pos)); // decode avoid
  }
  
`
    }
    return `
    // if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newValue); // write to x only
    // else if (u_out_coordinate == 1) gl_FragColor = encodeFloatRGBA(newValue);
    gl_FragColor = encodeFloatRGBA(newValue);
`
  }
}