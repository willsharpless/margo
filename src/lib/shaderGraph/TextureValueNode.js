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

uniform float spacing_x;
uniform float spacing_y;
uniform float spacing_std;

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
  
  float reach_value = decodeFloatRGBA(texture2D(u_particles_x_bc, 1.-v_tex_pos)); // works when flipped, interesting
  float avoid_value = decodeFloatRGBA(texture2D(u_particles_y_bc, 1.-v_tex_pos));
  float last_value = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos));
  float last_value_ = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos));
  // WTF, last_value != last_value_? 
  // but they are if you try this with reach_value or avoid_value??
  // hmm seems like a texture binding/target issue
  // should go make sure the bc textures have unique units (and what happens if I turn them off and run this without)
  // should also go check if this behavior is true in og field play...
  
  vec2 state = abs(u_max - u_min) * (0.5 - v_tex_pos);

  // this will move to main body?
  float value;
  float value_;
  if (value_transfer > 0.) {
    value = reach_value;
    value_ = reach_value;
    // value = min(reach_value, avoid_value); // (applied after, was for testing)
  } else {
    value = last_value;
    value_ = last_value_;
  }
  
  // debugging
  
  // float newValue = value;
  // float newValue = value_;
  // float newValue = last_value_;
  // wait, the initial transfer values are messing things up
  
  vec2 v_tex_pos_f = 1.-v_tex_pos;
  vec2 L_tex_pos = v_tex_pos_f - 1. * spacing_std;
  
  // vec2 LR_tex_pos_x = get_LRpos_inbound(L_tex_pos.x, spacing_std, 0.);
  
  vec2 LR_tex_pos_x;
  if (v_tex_pos_f.x <= 0.) {
    // LR_tex_pos_x = v_tex_pos_f;
    LR_tex_pos_x = vec2(v_tex_pos_f.x, v_tex_pos_f.x + spacing_std);
  } else {
    // LR_tex_pos_x = L_tex_pos;
    LR_tex_pos_x = vec2(L_tex_pos.x, v_tex_pos_f.x);
  }

  float LR_tex_pos_x_L = LR_tex_pos_x.x;
  float LR_tex_pos_x_R = LR_tex_pos_x.y;
  
  // vec2 LR_tex_pos_y = get_LRpos_inbound(L_tex_pos.y, spacing_std, 0.);

  vec2 LR_tex_pos_y;
  if (v_tex_pos_f.y <= 0.) {
    // LR_tex_pos_y = v_tex_pos_f;
    LR_tex_pos_y = vec2(v_tex_pos_f.y, v_tex_pos_f.y + spacing_std);
  } else {
    // LR_tex_pos_y = L_tex_pos;
    LR_tex_pos_y = vec2(L_tex_pos.y, v_tex_pos_f.y);
  }

  float LR_tex_pos_y_L = LR_tex_pos_y.x;
  float LR_tex_pos_y_R = LR_tex_pos_y.y;

  // float diff_x_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R, L_tex_pos.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, L_tex_pos.y)))) / spacing_x;
  // float diff_y_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(L_tex_pos.x, LR_tex_pos_y_R))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(L_tex_pos.x, LR_tex_pos_y_L)))) / spacing_y;
  float diff_x_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R, v_tex_pos_f.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, v_tex_pos_f.y)))) / spacing_x;
  float diff_y_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_R))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_L)))) / spacing_y;
  
  // float time_step = 0.001;
  // float time = frame * time_step;
  // float ts_fxd_or_adp = 0.; // fixed time-step for now (will need to split frame from time...)
  // float target_time_step = time_step;

  float newValue;
  if (value_transfer > 0.) {
    newValue = value;
  } else {
    // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, L_tex_pos.y)));
    // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, v_tex_pos_f.y)));
    // newValue = spacing_x * diff_x_dec;
    // newValue = spacing_y * diff_y_dec;
    // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(L_tex_pos.x, LR_tex_pos_y_R)));
    newValue = value + 0.01 * time_step * diff_x_dec;
    // newValue = value + time_step * 10.;
    // newValue = value + 0.1 * time_step * sqrt(diff_x_dec*diff_x_dec + diff_x_dec*diff_x_dec);

    // if (v_tex_pos_f.x <= 0.) {
    //   newValue = value;
    // } else {
    //   newValue = value + 0.01 * time_step * diff_x_dec; 
    //   // newValue = value + 0.1 * time_step * sqrt(diff_x_dec*diff_x_dec + diff_x_dec*diff_x_dec);
    // }

    // vec2 next_tv = tvd_rk_3o(state, time, last_value, target_time_step, ts_fxd_or_adp);
    // newValue = next_tv.y;
    // newValue = value;
  }
  // float newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R, L_tex_pos.y)));
  // float newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(L_tex_pos.x, L_tex_pos.y)));
  // float newValue = decodeFloatRGBA(texture2D(u_particles_x, 1. - v_tex_pos_f));
  // float newValue = decodeFloatRGBA(texture2D(u_particles_x, 1. - v_tex_pos));
`
    }
    return `
    if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newValue); // write to x only
`
  }
}