import BaseShaderNode from './BaseShaderNode';

export default class ValueIntegrator extends BaseShaderNode {
  constructor () {
    super();
  }

  getDefines() {
    return `
uniform float time_step;
uniform float u_h;
uniform float spacing_x;
uniform float spacing_y;
uniform float spacing_std;
`
  }

  getFunctions() {
    return `

// Ty @ian-mitchell's toolboxLS and @schmrlng's hj_reachability

// SPATIAL BOUNDARY CONDITION

// float spatial_bc_linear(sampler2D tex, vec2 tex_pos, ) {
  //   vec2 tex_pos_c = clamp(tex_pos, vec2(0.), vec2(1.));
  //   float val_c = decodeFloatRGBA(texture2D(tex, tex_pos_c));
  //   if (tex_pos_c == tex_pos) { return val_c }
  //   extrap_dir = tex_pos - tex_pos_c;
  //   tex_pos_i = tex_pos_c - extrap_dir;
  //   val_i = decodeFloatRGBA(texture2D(tex, tex_pos_i));
  //   return (val_c - val_i) + val_c;
// }

vec2 get_LRpos_inbound(float L_pos, float LRstep, float periodic) {
  // given an L texture position and the L-R step size, this fn returns the bc-corrected L and R texture positions

  float R_pos = L_pos + LRstep; // in [0,1]

  if (periodic == 1.) { // periodic extrap
    L_pos = floor(L_pos + 1.);
    R_pos = floor(R_pos + 1.);
    
  } else { // linear extrap, diff is boundary diff
    if (L_pos < 0.) {
      L_pos = 0.;
      R_pos = LRstep;
    } else if (R_pos > 1.) {
      L_pos = 1. - LRstep;
      R_pos = 1.;
    }
  }
  return vec2(L_pos, R_pos);
}
  
vec2 get_diff(sampler2D values, vec2 L_tex_pos) {
  // given an L texture position, this fn returns the finite differences in x & y to the R counterpart in the grid

  float x_periodic = 0.; // TODO WAS: make global
  float y_periodic = 0.; // TODO WAS: make global

  vec2 LR_tex_pos_x = get_LRpos_inbound(L_tex_pos.x, spacing_std, x_periodic);
  float LR_tex_pos_x_L = LR_tex_pos_x.x;
  float LR_tex_pos_x_R = LR_tex_pos_x.y;
  
  vec2 LR_tex_pos_y = get_LRpos_inbound(L_tex_pos.y, spacing_std, y_periodic);
  float LR_tex_pos_y_L = LR_tex_pos_y.x;
  float LR_tex_pos_y_R = LR_tex_pos_y.y;

  float diff_x = (decodeFloatRGBA(texture2D(values, vec2(LR_tex_pos_x_R, L_tex_pos.y))) - decodeFloatRGBA(texture2D(values, vec2(LR_tex_pos_x_L, L_tex_pos.y)))) / spacing_x;
  float diff_y = (decodeFloatRGBA(texture2D(values, vec2(L_tex_pos.x, LR_tex_pos_y_R))) - decodeFloatRGBA(texture2D(values, vec2(L_tex_pos.x, LR_tex_pos_y_L)))) / spacing_y;

  return vec2(diff_x, diff_y);
}

// UPWIND

vec2 weno_comp(vec2 v0, vec2 v1, vec2 v2, vec2 v3, vec2 v4) {
  
  // Substencil Approximations

  vec2 phi0 =  (v0 / 3.) - (7. * v1 / 6.) + (11. * v2 / 6.);
  vec2 phi1 = -(v1 / 6.) + (5. * v2 / 6.) + ( 1. * v3 / 3.);
  vec2 phi2 =  (v2 / 3.) + (5. * v3 / 6.) - ( 1. * v4 / 6.);
  
  // Smoothness Indicators 

  vec2 s0 = (13. / 12.) * (v0 - 2. * v1 + v2) * (v0 - 2. * v1 + v2) + 0.25 * (v0 - 4. * v1 + 3. * v2) * (v0 - 4. * v1 + 3. * v2);
  vec2 s1 = (13. / 12.) * (v1 - 2. * v2 + v3) * (v1 - 2. * v2 + v3) + 0.25 * (v1 - v3) * (v1 - v3);
  vec2 s2 = (13. / 12.) * (v2 - 2. * v3 + v4) * (v2 - 2. * v3 + v4) + 0.25 * (3. * v2 - 4. * v3 + v4) * (3. * v2 - 4. * v3 + v4);
  
  // Weights

  vec2 a0 = 0.1 / ((s0 + 1.0e-6) * (s0 + 1.0e-6));
  vec2 a1 = 0.6 / ((s1 + 1.0e-6) * (s1 + 1.0e-6));
  vec2 a2 = 0.3 / ((s2 + 1.0e-6) * (s2 + 1.0e-6));
  vec2 w0 = a0 / (a0 + a1 + a2);
  vec2 w1 = a1 / (a0 + a1 + a2);
  vec2 w2 = a2 / (a0 + a1 + a2);
  
  return phi0 * w0 + phi1 * w1 + phi2 * w2;
}

mat2 WENO5(sampler2D values) {

  // vec2 v_tex_pos_f = v_tex_pos; // loc in the texture (flipped en/decoding, prior to WAS)
  // float value = decodeFloatRGBA(texture2D(values, 1.-v_tex_pos));
  vec2 v_tex_pos_f = 1.-v_tex_pos; // loc in the texture (flipped en/decoding, prior to WAS)
  float value = decodeFloatRGBA(texture2D(values, v_tex_pos_f));
  
  // Compute Differences

  vec2 diff_m3 = get_diff(values, v_tex_pos_f - 3. * spacing_std);
  vec2 diff_m2 = get_diff(values, v_tex_pos_f - 2. * spacing_std);
  vec2 diff_m1 = get_diff(values, v_tex_pos_f - 1. * spacing_std);
  vec2 diff_m0 = get_diff(values, v_tex_pos_f - 0. * spacing_std);
  vec2 diff_p1 = get_diff(values, v_tex_pos_f + 1. * spacing_std);
  vec2 diff_p2 = get_diff(values, v_tex_pos_f + 2. * spacing_std);

  // Compute Weighting

  vec2 costate_L = weno_comp(diff_m3, diff_m2, diff_m1, diff_m0, diff_p1);
  vec2 costate_R = weno_comp(diff_m2, diff_m1, diff_m0, diff_p1, diff_p2);
  mat2 costate_LR = mat2(costate_L, costate_R);
  
  return costate_LR;
}

mat2 FO(sampler2D values) {

  // vec2 v_tex_pos_f = v_tex_pos; // loc in the texture (flipped en/decoding, prior to WAS)
  // float value = decodeFloatRGBA(texture2D(values, 1.-v_tex_pos));
  vec2 v_tex_pos_f = 1.-v_tex_pos; // loc in the texture (flipped en/decoding, prior to WAS)
  float value = decodeFloatRGBA(texture2D(values, v_tex_pos_f));
  
  // Compute Differences

  vec2 costate_L = get_diff(values, v_tex_pos_f - 1. * spacing_std); // diff_m1
  vec2 costate_R = get_diff(values, v_tex_pos_f - 0. * spacing_std); // diff_m0
  mat2 costate_LR = mat2(costate_L, costate_R);

  return costate_LR;
}

// mat2 ENO3(vec2 state, float time, float value) {
//   // TODO!
//   return costate_L_costate_R;
// }

// DISSIPATION

vec2 locallocalLF(vec2 state, vec2 costate_L, vec2 costate_R, float time, float value) {
  // TODO: for globalLF/localLF will need to compute max range
  return max_partial_hamiltonian_costate(state, costate_L, costate_R, time, value);
}

float dissipated_hamiltonian(vec2 state, vec2 costate_L, vec2 costate_R, float time, float value) {
  vec2 alpha = locallocalLF(state, costate_L, costate_R, time, value);
  return get_hamiltonian(state, 0.5 * (costate_L + costate_R), time, value) - dot(alpha, 0.5 * (costate_R - costate_L)); // or abs?
}

// STEP FUNCTION

vec2 euler_step(vec2 state, float time, float value, float time_step, float fixed_or_max) {

  // fixed_or_max determines if the time step is a fixed step (==0.) or the max allowed (==1.)

  // Compute the Upwind Gradients
  // vec2 costate_L = state;
  // vec2 costate_R = state;
  mat2 costate_LR = FO(u_particles_x);
  // mat2 costate_LR = WENO5(u_particles_x);
  vec2 costate_L = costate_LR[0];
  vec2 costate_R = costate_LR[1];
  
  // Compute the Artificial Dissipation
  // float dvdt = 0.2 * cos(time); // debugging
  float dvdt = dissipated_hamiltonian(state, costate_L, costate_R, time, value);

  // Compute or Pass the Time-step
  float t_step_c;
  if (fixed_or_max == 0.) {
    t_step_c = time_step;
  } else {
    t_step_c = time_step; 
    // FIXME FIXME FIXME: compute step based on spacing and LF
  };
   
  vec2 tv_next = vec2(time + t_step_c, value + t_step_c * dvdt);
  return tv_next;
}

// RUNGE KUTTA

vec2 tvd_rk_3o(vec2 state, float time, float value, float target_time_step, float ts_fxd_or_adp) {
  
  // ts_fxd_or_adp determines if the target time step is a fixed step (==0.) or the max allowed (==1.)

  vec2 tv_1 = euler_step(state, time, value, target_time_step, ts_fxd_or_adp); // vec2(next time, next value)
  float time_1 = tv_1.x;
  float value_1 = tv_1.y;
  
  float actual_time_step;
  if (ts_fxd_or_adp == 0.) {
    actual_time_step = target_time_step; 
  } else {
    actual_time_step = tv_1.x - time; 
  };

  vec2 tv_2 = euler_step(state, time_1, value_1, actual_time_step, 0.);
  float value_2 = tv_2.y;

  float time_0_5 = time + actual_time_step/2.;
  float value_0_5 = 0.75 * value + 0.25 * value_2;

  vec2 tv_1_5 = euler_step(state, time_0_5, value_0_5, actual_time_step, 0.);
  float value_1_5 = tv_1_5.y;
  float val_out = (1. / 3.) * value + (2. / 3.) * value_1_5;
  
  vec2 tv_out = vec2(time_1, val_out);
  return tv_out;
}

vec2 rk4(const vec2 state) {

  vec2 k1 = get_velocity( state );
  vec2 k2 = get_velocity( state + k1 * time_step * 0.5);
  vec2 k3 = get_velocity( state + k2 * time_step * 0.5);
  vec2 k4 = get_velocity( state + k3 * time_step);

  return k1 * time_step / 6. + k2 * time_step/3. + k3 * time_step/3. + k4 * time_step/6.;
}

`
  }

  getMainBody() {
    return `

  // vec2 velocity = rk4(state);
  // float valVelocity = -0.;
  // float valVelocity = -0.002;

  vec2 costate = state;
  float time = frame * time_step;
  float valVelocity = get_hamiltonian(state, costate, time, value);
  
  float ts_fxd_or_adp = 0.; // fixed time-step for now (will need to split frame from time...)
  float target_time_step = time_step;
  vec2 next_tv = tvd_rk_3o(state, time, value, target_time_step, ts_fxd_or_adp);
`
  }
}