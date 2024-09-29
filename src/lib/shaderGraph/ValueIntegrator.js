import BaseShaderNode from './BaseShaderNode';

export default class ValueIntegrator extends BaseShaderNode {
  constructor () {
    super();
  }

  getDefines() {
    return `
uniform float time_step;
uniform float u_h;
`
  }

  getFunctions() {
    return `
vec2 rk4(const vec2 state) {

  vec2 k1 = get_velocity( state );
  vec2 k2 = get_velocity( state + k1 * time_step * 0.5);
  vec2 k3 = get_velocity( state + k2 * time_step * 0.5);
  vec2 k4 = get_velocity( state + k3 * time_step);

  return k1 * time_step / 6. + k2 * time_step/3. + k3 * time_step/3. + k4 * time_step/6.;
}
  
vec2 euler_step(vec2 state, float time, float value, float time_step, float fixed_or_max) {

  // fixed_or_max determines if the time step is a fixed step (==0.) or the max allowed (==1.)

  // Compute the Upwind Gradients
  // vec2 LR_value_grads = upwind_ENO3(value) // TODO WAS: make WENO5 + others
  
  // Compute the Artificial Dissipation
  // vec2 dvdt = lax_friedrichs_global(state, value, time)
  float dvdt = 0.2 * cos(time); // debugging

  // Compute or Pass the Time-step
  float t_step_c;
  if (fixed_or_max == 0.) {
    t_step_c = time_step;
  } else {
    t_step_c = 2. * time_step; // TODO: compute step based on spacing and LF
  };
   
  vec2 tv_next = vec2(time + t_step_c, value + t_step_c * dvdt);
  return tv_next;
}

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

`
  }

  getMainBody() {
    return `

  // vec2 velocity = rk4(state);
  // float valVelocity = -0.;
  // float valVelocity = -0.002;

  vec2 costate = state;
  float time = frame * time_step;
  float valVelocity = get_hamiltonian(state, costate, time);
  
  float ts_fxd_or_adp = 0.; // fixed time-step for now (will need to split frame from time...)
  float target_time_step = time_step;
  vec2 next_tv = tvd_rk_3o(state, time, value, target_time_step, ts_fxd_or_adp);
`
  }
}