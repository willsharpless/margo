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

// attribute float a_index;

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
uniform sampler2D u_particles_x_bc;  // reach bc
uniform sampler2D u_particles_y_bc;  // avoid bc

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
  
  float reach_value = decodeFloatRGBA(texture2D(u_particles_x_bc, 1.-v_tex_pos)); // works when flipped, interesting
  float avoid_value = decodeFloatRGBA(texture2D(u_particles_y_bc, 1.-v_tex_pos));
  float last_value = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos));
  float last_value_ = decodeFloatRGBA(texture2D(u_particles_x, 1.-v_tex_pos));
  
  vec2 aligned_tex_pos = ((1. - v_tex_pos) - vec2(0.5 / u_particles_res)) / (1. - 1./pSR); // WAS FIXME: if pSR varies for x/y -> vec2(pSRx, pSRy)?
  vec2 state = vec2(
      roundToPrecision(abs(u_max.x - u_min.x) * aligned_tex_pos.x + u_min.x, 1e-6),
      roundToPrecision(abs(u_max.y - u_min.y) * aligned_tex_pos.y + u_max.y, 1e-6));

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
  
  // vec2 v_tex_pos_f = 1.-v_tex_pos;
  // vec2 L_tex_pos = v_tex_pos_f - 1. * spacing_std; // Lower pos for costate_L
  // vec2 L_tex_pos_2 = v_tex_pos_f - 0. * spacing_std; // Lower pos for costate_R
  
  // vec2 LR_tex_pos_x = get_LRpos_inbound(L_tex_pos.x, spacing_std, 0.);
  // vec2 LR_tex_pos_y = get_LRpos_inbound(L_tex_pos.y, spacing_std, 0.);
  
  // vec2 LR_tex_pos_x_2 = get_LRpos_inbound(L_tex_pos_2.x, spacing_std, 0.);
  // vec2 LR_tex_pos_y_2 = get_LRpos_inbound(L_tex_pos_2.y, spacing_std, 0.);

  // float LR_tex_pos_x_L = LR_tex_pos_x.x;
  // float LR_tex_pos_x_R = LR_tex_pos_x.y;
  // float LR_tex_pos_y_L = LR_tex_pos_y.x;
  // float LR_tex_pos_y_R = LR_tex_pos_y.y;

  // float LR_tex_pos_x_L_2 = LR_tex_pos_x_2.x;
  // float LR_tex_pos_x_R_2 = LR_tex_pos_x_2.y;
  // float LR_tex_pos_y_L_2 = LR_tex_pos_y_2.x;
  // float LR_tex_pos_y_R_2 = LR_tex_pos_y_2.y;

  // for costate L
  // float diff_x_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R, v_tex_pos_f.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, v_tex_pos_f.y)))) / spacing_x;
  // float diff_y_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_R))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_L)))) / spacing_y;
  
  // for costate R
  // float diff_x_dec2 = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R_2, v_tex_pos_f.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L_2, v_tex_pos_f.y)))) / spacing_x;
  // float diff_y_dec2 = (decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_R_2))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_L_2)))) / spacing_y;
  
  // vec2 diff_L = get_diff(u_particles_x, v_tex_pos_f, v_tex_pos_f - 1. * spacing_std);
  // vec2 diff_R = get_diff(u_particles_x, v_tex_pos_f, v_tex_pos_f - 0. * spacing_std);
  // vec2 costate_L = diff_L;
  // vec2 costate_R = diff_R;
  
  // still debugging
  // TODO: put this in fn so we can save/export all of it for comp (for unit tests)

  mat2 costate_LR_FO = FO(u_particles_x, state);
  vec2 costate_L_FO = costate_LR_FO[0];
  vec2 costate_R_FO = costate_LR_FO[1];

  // mat2 costate_LR_WEN05 = WENO5(u_particles_x);
  // vec2 costate_L_WEN05 = costate_LR_WEN05[0];
  // vec2 costate_R_WEN05 = costate_LR_WEN05[1];

  vec2 costate_L = 1. * costate_L_FO;
  vec2 costate_R = 1. * costate_R_FO;
  // vec2 costate_L = 1. * costate_L_WEN05;
  // vec2 costate_R = 1. * costate_R_WEN05;

  float time = frame * time_step;
  // float ts_fxd_or_adp = 0.; // fixed time-step for now (will need to split frame from time...)
  // float target_time_step = time_step;

  // vec2 diff_coeffs = locallocalLF(state, costate_L, costate_R, time, value);
  // float diss = dot(diff_mag * diff_coeffs, 0.5 * (costate_R - costate_L)); // CORRECT STATE 1/19/25
  // float ham = get_hamiltonian(state, (costate_L + costate_R)/2., time, value);
  // float diss_ham = ham - diss;

  float diss_ham = dissipated_hamiltonian(state, costate_L, costate_R, time, value);

  float newValue;
  if (value_transfer > 0.) {
    newValue = value;
  } else {

    // TODO:
    // vec2 next_tv = tvd_rk_3o(state, time, value, time_step, ts_fxd_or_adp); // gives new time and val
    // newValue = next_tv.y;
    newValue = value - time_step * diss_ham;
    newValue = value_alteration(newValue, value, reach_value, avoid_value);

    // // float frameoi = 3.;
    // float frameoi = 100000.;
    // if (frame < frameoi) {
      
    //   newValue = nextValue;

    // } else if (frame < 2. + frameoi) {

    //   // States
    //   // newValue = state.x;
    //   // newValue = state.y;

    //   // Velocity
    //   // vec2 vel = get_velocity(state);
    //   // newValue = vel.x;
    //   // newValue = vel.y;

    //   // Texture Poses for Upwinds
    //   // newValue = LR_tex_pos_x_L;
    //   // newValue = LR_tex_pos_x_R;
    //   // newValue = LR_tex_pos_x_L_2;
    //   // newValue = LR_tex_pos_x_R_2;
    //   // newValue = LR_tex_pos_y_L;
    //   // newValue = LR_tex_pos_y_R;

    //   // L, R grads
    //   // newValue = costate_L.x; // left grad  - x component
    //   newValue = costate_R.x; // right grad - x component
    //   // newValue = costate_L.y; // left grad  - y component
    //   // newValue = costate_R.y; // right grad - y component
    //   // newValue = 0.5 * (costate_L.x + costate_R.x); // LR avg grad (fed to ham)

    //   // Diss, Ham, Diss Ham
    //   // newValue = ham;
    //   // newValue = diff_coeffs.x;
    //   // newValue = diff_coeffs.y;
    //   // newValue = diss;
    //   // newValue = diss_ham;

    //   // Next Value
    //   // newValue = value;
    //   // newValue = nextValue;

    // } else {
    //   newValue = value;
    // }
  }
`
    }
    return `
    if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newValue); // write to x only
`
  }
}