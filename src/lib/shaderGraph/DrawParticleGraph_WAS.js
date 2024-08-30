import decodeFloatRGBA from './parts/decodeFloatRGBA';
import shaderBasedColor_WAS from './shaderBasedColor_WAS';

// TODO: this duplicates code from texture position.
export default class DrawParticleGraph_WAS {
  constructor(ctx) {
    this.colorMode = ctx.colorMode;
    this.colorFunction = ctx.colorFunction || '';
  }

  getFragmentShader() {
    return `precision highp float;
varying vec4 v_particle_color;
void main() {
  gl_FragColor = v_particle_color;
}`
  }

  getVertexShader(vfCode, color) {
    let decodePositions = textureBasedPosition();
    let colorParts = shaderBasedColor_WAS(this.colorMode, vfCode, this.colorFunction, color);
    let methods = []
    addMethods(decodePositions, methods);
    addMethods(colorParts, methods);
    let main = [];
    addMain(decodePositions, main);
    addMain(colorParts, main);

    return `precision highp float;
attribute float a_index;
uniform float u_particles_res;
uniform vec2 u_min;
uniform vec2 u_max;

uniform int texture_type;
uniform float thresh;

uniform float bc_cx;
uniform float bc_cy;
uniform float bc_qx;
uniform float bc_qy;
uniform int bc_shape;

${decodePositions.getVariables() || ''}
${colorParts.getVariables()}

${decodeFloatRGBA}

${methods.join('\n')}

void main() {
  vec2 du = (u_max - u_min);

  vec2 Y;
  
  vec2 state = vec2( // same as txPos externally
        abs(u_max.x - u_min.x) * fract(a_index / u_particles_res) + u_min.x,
        abs(u_max.y - u_min.y) * (floor(a_index / u_particles_res) / u_particles_res) + u_max.y);

  if (texture_type == 0) { // Field Texture

    Y = vec2( // @mourner's method: RGBA texture data is position
          decodeFloatRGBA(texture2D(u_particles_x, state)),
          decodeFloatRGBA(texture2D(u_particles_y, state))
    );
    gl_PointSize = 1.0;

  } else if (texture_type == 1) { // Boundary Condition Texture

    Y = state; // RGBA texture data irrelevant, position implicitly defined 
    gl_PointSize = 2.0;

  } else if (texture_type == 2) {

    Y = state; // TODO: RGBA texture data is value!
    gl_PointSize = 2.0;

  }

${main.join('\n')}

  // vec2 du = (u_max - u_min);
  v_particle_pos = (v_particle_pos - u_min)/du;

  float val;

  if (texture_type == 1) { // Boundary Condition Texture

    if (bc_shape == 1) { // square
      val = 0.5 * (max(abs(state.x - bc_cx)/bc_qx, abs(state.y - bc_cy)/bc_qy) - 1.);

    } else if (bc_shape == 2) { // circle
      val = 0.5 * ((state.x - bc_cx)*(state.x - bc_cx)/bc_qx + (state.y - bc_cy)*(state.y - bc_cy)/bc_qy - 1.);

    } else { // free draw?
      // TODO WAS: not implemented yet
    }

  } else if (texture_type == 2) { // Value Texture

    // TODO WAS: val enc/de coded!

  }
  
  // TODO WAS: draw more than zero-level? with different colors?
  // distinguishing reach and avoid might call for drawing, epsilon above and below with diff colors 

  if (abs(val) > thresh && texture_type != 0) { 
    // nothing
  } else {
    gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, (1. - 2. * (v_particle_pos.y)),  0., 1.);
  }
    
}`
  }
}

function addMethods(producer, array) {
  if (producer.getMethods) {
    array.push(producer.getMethods());
  }
}

function addMain(producer, array) {
  if (producer.getMain) {
    array.push(producer.getMain());
  }
}

function textureBasedPosition() {
  return {
    getVariables,
    getMain
  }

  function getVariables() {
    return `
uniform sampler2D u_particles_x;
uniform sampler2D u_particles_y;
    `
  }

  function getMain() {
    return `
  // vec2 v_particle_pos = vec2(
  //   decodeFloatRGBA(texture2D(u_particles_x, state)),
  //   decodeFloatRGBA(texture2D(u_particles_y, state))
  // );
  vec2 v_particle_pos = Y;
`
  }
}