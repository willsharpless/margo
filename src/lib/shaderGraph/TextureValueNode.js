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
  
  // WTF, last_value != last_value_? 
  // but they are if you try this with reach_value or avoid_value??
  // hmm seems like a texture binding/target issue
  // should go make sure the bc textures have unique units (and what happens if I turn them off and run this without)
  // should also go check if this behavior is true in og field play...
  // I (think I) eventually figured this is caused by erroneously writing on the first evolution step, when transfer occurs

  // vec2 state = abs(u_max - u_min) * (0.5 - v_tex_pos);
  // vec2 state = abs(u_max - u_min) * (1. - v_tex_pos);
  // vec2 state = abs(u_max - u_min) * 0.5 * (1. - v_tex_pos);
  // vec2 state = vec2( // unit coding - fixed w/ respect to window not bbox (grid loc)
  //       fract(a_index / u_particles_res),
  //       (floor(a_index / u_particles_res) / u_particles_res)
  //     );
  // vec2 state = vec2( // unit coding - fixed w/ respect to window not bbox (grid loc)
  //     fract(v_tex_index / u_particles_res),
  //     (floor(v_tex_index / u_particles_res) / u_particles_res)
  //   );
  // vec2 state = vec2(v_tex_index);
  // vec2 state = v_tex_pos;
  // vec2 state = 1. - v_tex_pos;
  
  vec2 aligned_tex_pos = (1. - v_tex_pos) - vec2(0.5 / u_particles_res);
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
  
  vec2 v_tex_pos_f = 1.-v_tex_pos;
  vec2 L_tex_pos = v_tex_pos_f - 1. * spacing_std; // Lower pos for costate_L
  vec2 L_tex_pos_2 = v_tex_pos_f - 0. * spacing_std; // Lower pos for costate_R
  
  vec2 LR_tex_pos_x = get_LRpos_inbound(L_tex_pos.x, spacing_std, 0.);
  vec2 LR_tex_pos_y = get_LRpos_inbound(L_tex_pos.y, spacing_std, 0.);
  
  vec2 LR_tex_pos_x_2 = get_LRpos_inbound(L_tex_pos_2.x, spacing_std, 0.);
  vec2 LR_tex_pos_y_2 = get_LRpos_inbound(L_tex_pos_2.y, spacing_std, 0.);

  float LR_tex_pos_x_L = LR_tex_pos_x.x;
  float LR_tex_pos_x_R = LR_tex_pos_x.y;
  float LR_tex_pos_y_L = LR_tex_pos_y.x;
  float LR_tex_pos_y_R = LR_tex_pos_y.y;

  float LR_tex_pos_x_L_2 = LR_tex_pos_x_2.x;
  float LR_tex_pos_x_R_2 = LR_tex_pos_x_2.y;
  float LR_tex_pos_y_L_2 = LR_tex_pos_y_2.x;
  float LR_tex_pos_y_R_2 = LR_tex_pos_y_2.y;

  // for costate L
  float diff_x_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R, v_tex_pos_f.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, v_tex_pos_f.y)))) / spacing_x;
  float diff_y_dec = (decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_R))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_L)))) / spacing_y;
  
  // for costate R
  float diff_x_dec2 = (decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_R_2, v_tex_pos_f.y))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L_2, v_tex_pos_f.y)))) / spacing_x;
  float diff_y_dec2 = (decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_R_2))) - decodeFloatRGBA(texture2D(u_particles_x, vec2(v_tex_pos_f.x, LR_tex_pos_y_L_2)))) / spacing_y;
  
  // vec2 diff_L = get_diff(u_particles_x, v_tex_pos_f, v_tex_pos_f - 1. * spacing_std);
  // vec2 diff_R = get_diff(u_particles_x, v_tex_pos_f, v_tex_pos_f - 0. * spacing_std);

  // float diff_x_dec = diff_L.x;
  // float diff_y_dec = diff_L.y;
  // float diff_x_dec2 = diff_R.x;
  // float diff_y_dec2 = diff_R.y;
  
  // // vec2 costate_L_FO = vec2(diff_x_dec, diff_y_dec);
  // // vec2 costate_R_FO = vec2(diff_x_dec2, diff_y_dec2);
  vec2 costate_L = vec2(diff_x_dec, diff_y_dec);
  vec2 costate_R = vec2(diff_x_dec2, diff_y_dec2);
  
  // mat2 costate_LR_FO = FO(u_particles_x);
  // vec2 costate_L_FO = costate_LR_FO[0];
  // vec2 costate_R_FO = costate_LR_FO[1];

  // vec2 costate_L = 1. * costate_L_FO;
  // vec2 costate_R = 1. * costate_R_FO;

  // mat2 costate_LR_WEN05 = WENO5(u_particles_x);
  // vec2 costate_L_WEN05 = costate_LR_WEN05[0];
  // vec2 costate_R_WEN05 = costate_LR_WEN05[1];
  
  // vec2 costate_L = 1. * costate_L_WEN05;
  // vec2 costate_R = 1. * costate_R_WEN05;

  // float diff_x_dec = costate_L.x;
  // float diff_y_dec = costate_L.y;
  // float diff_x_dec2 = costate_R.x;
  // float diff_y_dec2 = costate_R.y;

  // float time_step = 0.001;
  // float time = frame * time_step;
  // float ts_fxd_or_adp = 0.; // fixed time-step for now (will need to split frame from time...)
  // float target_time_step = time_step;

  float newValue;
  if (value_transfer > 0.) {
    newValue = value;
  } else {
    // // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, L_tex_pos.y)));
    // // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(LR_tex_pos_x_L, v_tex_pos_f.y)));
    // // newValue = spacing_x * diff_x_dec;
    // // newValue = spacing_y * diff_y_dec;
    // // newValue = decodeFloatRGBA(texture2D(u_particles_x, vec2(L_tex_pos.x, LR_tex_pos_y_R)));
    // // newValue = value + 0.01 * time_step * diff_x_dec;
    // // newValue = value + 0.01 * time_step * (diff_x_dec + diff_x_dec2)/2.;
    // // newValue = value + 0.01 * time_step * ((diff_x_dec + diff_x_dec2)/2. + (diff_y_dec + diff_y_dec2)/2.);
    // // newValue = value + 0.01 * time_step * (diff_x_dec + diff_y_dec);
    // // newValue = value + time_step * 10.;
    // // newValue = value + 0.1 * time_step * sqrt(diff_x_dec*diff_x_dec + diff_x_dec*diff_x_dec);

    // // float diffusion = 0.;
    // // float diffusion = dot(vec2(0.001), abs(costate_R_FO - costate_L_FO));
    // // float diffusion = dot(vec2(0.0001), abs(costate_R_FO - costate_L_FO));
    // // float diffusion = dot(vec2(1.), abs(costate_R_FO - costate_L_FO));
    // // float diffusion = dot(vec2(0.001 * abs(diff_x_dec)), (costate_R_FO - costate_L_FO)); // workish
    // // float diffusion = dot(vec2(0.001 * abs(diff_x_dec)+abs(diff_y_dec)), abs(costate_R_FO - costate_L_FO)); //doesnt work

    // // float ham = abs(diff_x_dec + diff_x_dec2)/2. + abs(diff_y_dec + diff_y_dec2)/2.;
    // // float ham = (diff_x_dec + diff_x_dec2)/2.;

    // // last debugging state for horizontal ham
    
    // // float diffusion = dot(vec2(0.0001 * 0.5 * abs(diff_x_dec + diff_x_dec2)), 0.5 * abs(costate_R_FO - costate_L_FO)); // works-ish
    // float diffusion = dot(vec2(0.0001), 0.5 * abs(costate_R_FO - costate_L_FO)); // works-ish // WAS LAST WORKING LINE 01/14/25
    // // float diffusion = dot(vec2(0.01), 0.5 * (abs(costate_R_FO) + abs(costate_L_FO))); // no diff
    
    // float ham = -abs(diff_x_dec + diff_x_dec2)/2.; // WAS LAST WORKING LINE 01/14/25
    // // float ham = abs(diff_x_dec + diff_x_dec2)/2. + abs(diff_y_dec + diff_y_dec2)/2.;
    // // newValue = value + 0.1 * time_step * (ham - diffusion);
    // newValue = value + time_step * (ham - diffusion); // WAS LAST WORKING LINE 01/14/25

    // // vec2 next_tv = tvd_rk_3o(state, time, last_value, target_time_step, ts_fxd_or_adp);
    // // newValue = next_tv.y;
    // // newValue = value;

    // // vec2 costate = state;
    // // float valVelocity = get_hamiltonian(state, costate, time, value);
    
    // // float time = frame * time_step;
    // // float ts_fxd_or_adp = 0.; // FIXME fixed time-step for now (will need to split frame from time...)
    // // float target_time_step = time_step;

    // // vec2 next_tv = tvd_rk_3o(state, time, value, target_time_step, ts_fxd_or_adp);
    // // newValue = next_tv.y;

    // BEST "WORKING" STATE as of 1/14/25
    // float diffusion = dot(vec2(0.0001), 0.5 * abs(costate_R - costate_L));
    // float diffusion = 0.;

     // NEW - 011525
    float diff_coeff_x = abs(sign(state.x)); // TODO: REPLACE WITH partialMaxMag fn based on system
    float diff_coeff_y = 0.; // TODO: REPLACE WITH partialMaxMag fn based on system
    // float diff_coeff_y = abs(sign(state.y)); // TODO: REPLACE WITH partialMaxMag fn based on system

    vec2 diff_coeffs = vec2(diff_coeff_x, diff_coeff_y);
    float diffusion = dot(diff_mag * diff_coeffs, 0.5 * (costate_R - costate_L)); // CORRECT STATE 1/19/25

    float ham = -abs(costate_L.x + costate_R.x)/2.;
    // float ham = abs(costate_L.x + costate_R.x)/2.;
    // float ham = abs(costate_L.x + costate_R.x)/2. + abs(costate_L.y + costate_R.y)/2.;

    float frameoi = 10000.;
    if (frame < frameoi) {
      
      newValue = value - time_step * (ham - diffusion);

    } else if (frame < 2. + frameoi) {

      // States
      newValue = state.x;
      // newValue = state.y;

      // L, R grads
      // newValue = costate_L.x; // left grad  - x component
      // newValue = costate_R.x; // right grad - x component
      // newValue = costate_L.y; // left grad  - y component
      // newValue = costate_R.y; // right grad - y component
      // newValue = 0.5 * (costate_L.x + costate_R.x); // LR avg grad (fed to ham)

      // Diss, Ham, Diss Ham
      // newValue = diff_coeffs.x;
      // newValue = diff_coeffs.y;
      // newValue = diffusion;
      // newValue = ham;
      // newValue = ham - diffusion; // dissipated hamiltonian

    } else {
      newValue = value;
    }

    // Next Value
    // newValue = value + time_step * (ham - diffusion);;
    // newValue = value;
  }
`
    }
    return `
    if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newValue); // write to x only
`
  }
}