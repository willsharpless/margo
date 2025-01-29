import BaseShaderNode from './BaseShaderNode';

export default class BoundaryConditionUpdater extends BaseShaderNode {
  constructor () {
    super();
  }

  getDefines() {
    return `
uniform float u_h;
uniform float drawing;
uniform int bc_shape;
uniform float bc_cx;
uniform float bc_cy;
uniform float bc_qx;
uniform float bc_qy;
uniform float sign;
`
  }

  getFunctions() {
    return `

float roundToPrecision(float value, float prec) {
  return floor(value / prec + 0.5) * prec;
}

// Box Function
float box_bc(vec2 state, float bc_cx, float bc_cy, float bc_qx, float bc_qy, float sign) {
  return sign * 0.5 * (max(abs(state.x - bc_cx)/bc_qx, abs(state.y - bc_cy)/bc_qy) - 1.);
}

// Ball Function
float ball_bc(vec2 state, float bc_cx, float bc_cy, float bc_qx, float bc_qy, float sign) {
  return sign * 0.5 * ((state.x - bc_cx)*(state.x - bc_cx)/bc_qx + (state.y - bc_cy)*(state.y - bc_cy)/bc_qy - 1.);
}

// Cursor to BC params Function? or leave it in draw outside?

`
  }

  getMainBody() {
    return `
  float updateValue;
  if (drawing > 0.) {
    if (bc_shape == 1) { // square
      updateValue = box_bc(state, bc_cx, bc_cy, bc_qx, bc_qy, sign);
    } else if (bc_shape == 2) { // circle
      updateValue = ball_bc(state, bc_cx, bc_cy, bc_qx, bc_qy, sign);
    } else { // free draw?
      updateValue = 0.; // TODO WAS: not implemented yet
    }
  } else { // read from code
    updateValue = get_boundary_condition(state, sign, time);
  }
`
  }
}