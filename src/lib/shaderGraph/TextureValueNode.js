import BaseShaderNode from './BaseShaderNode';
import encodeFloatRGBA from './parts/encodeFloatRGBA';
import decodeFloatRGBA from './parts/decodeFloatRGBA';

/**
 * Reads/writes particle coordinates from/to a texture;
 */
export default class TextureValue extends BaseShaderNode {
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

uniform sampler2D u_particles_x;     // stores evolving value
uniform sampler2D u_particles_y;     // unneeded
uniform sampler2D u_particles_x_bc;  // reach bc
uniform sampler2D u_particles_y_bc;  // avoid bc

// Which coordinate needs to be printed onto the texture
uniform int u_out_coordinate;

varying vec2 v_tex_pos;
`;
    }
  }

  getMainBody() {
  if (this.isDecode) {
    return `
  float reach_val = decodeFloatRGBA(texture2D(u_particles_x_bc, 1.-v_tex_pos)); // works when flipped, interesting
  float avoid_val = decodeFloatRGBA(texture2D(u_particles_y_bc, 1.-v_tex_pos));
  float old_val = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos));
  
  vec2 state = abs(u_max - u_min) * (0.5 - v_tex_pos);
  
  float val;

  // this will probably move to body
  if (value_transfer > 0.) {
    val = reach_val;
    // val = min(reach_val, avoid_val);
  } else {
    val = old_val;
  }
`
    }
    return `
    if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newVal); // write to x only
`
  }
}