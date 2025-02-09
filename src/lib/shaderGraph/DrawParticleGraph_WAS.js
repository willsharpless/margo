import decodeFloatRGBA from './parts/decodeFloatRGBA';
import shaderBasedColor_WAS from './shaderBasedColor_WAS';

// TODO: this duplicates code from texture position.
export default class DrawParticleGraph_WAS {
  constructor(ctx, texture_type) {
    if (texture_type != 2) {
      this.colorMode = ctx.colorMode;
    } else {
      this.colorMode = 3;
    }
    console.log("PROGRAM", texture_type, "colorMode", this.colorMode)
    this.colorFunction = ctx.colorFunction || '';
    this.texture_type = texture_type;
  }

  getFragmentShader() {
    return `precision highp float;
varying vec4 v_particle_color;
varying float filler;
void main() {
  if (filler == 1.) {
    // gl_FragColor = v_particle_color * vec4(1., 1., 1., 0.1);  
    // gl_FragColor = vec4(1., 1., 1., 0.05);  // intended gray
    // color = [154/255, 103/255, 103/255, 0.9];  // intended gray-red (no red)
    // color = [223/255, 28/255, 28/255, 0.05];  // intended gray-red v2 (no red)
    gl_FragColor = vec4(154/255, 103/255, 103/255, 0.9); // weird, its always just gray to black?
  } else {
    gl_FragColor = v_particle_color;  
  }
}`
  }

  getVertexShader(vfCode, color, color2) {
    let decodePositions = textureBasedPosition();
    let colorParts = shaderBasedColor_WAS(this.colorMode, vfCode, this.colorFunction, color, color2, this.texture_type);
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
uniform vec2 u_min_enc;
uniform vec2 u_max_enc;

uniform int texture_type;
uniform float thresh;
uniform float time_step;

uniform float bc_cx;
uniform float bc_cy;
uniform float bc_qx;
uniform float bc_qy;
uniform int bc_shape;
uniform float drawing_click_sum; // for debugging
uniform bool bc_drawing_mode;
uniform bool no_bc_encoded;
uniform bool no_reach_bc_encoded;
uniform bool no_avoid_bc_encoded;
uniform bool reach_mode;
uniform bool flip_mode;
uniform float sign;
uniform bool draw_fill;
uniform bool draw_levels;
uniform float level_step;
varying float filler;

${decodePositions.getVariables() || ''}
${colorParts.getVariables()}

${decodeFloatRGBA}

${methods.join('\n')}

void main() {
  vec2 du = (u_max - u_min);
  vec2 du_enc = (u_max_enc - u_min_enc);

  vec2 v_particle_pos_c;
  vec2 vals;
  float val;
  vec2 state_mag;
  float time = frame * time_step;
  
  vec2 state = vec2( // same as txPos externally
        abs(u_max.x - u_min.x) * fract(a_index / u_particles_res) + u_min.x,
        abs(u_max.y - u_min.y) * (floor(a_index / u_particles_res) / u_particles_res) + u_max.y); // max bcuz col major
  // WAS: note, this dynamically fluctuates w/ the box but the value is defined for a fixed box!

  state_mag = vec2( // unit coding - fixed w/o respect to bbox!
    fract(a_index / u_particles_res),
    (floor(a_index / u_particles_res) / u_particles_res)
  );
  // state_mag = (state - vec2(-4.1, -2.45)) / vec2(8., 5.); // dynamic wrt default bbox
  // state_mag = (state - (u_min_enc * vec2(1., -1.))) / (du_enc * vec2(1., -1.)) ; // dynamic wrt bbox based on bc encoding loc (small bug in yloc still smh)

  if (texture_type == 0) { // Field Texture

    v_particle_pos_c = vec2( // @mourner's method: RGBA texture data is position
          decodeFloatRGBA(texture2D(u_particles_x, state)),
          decodeFloatRGBA(texture2D(u_particles_y, state))
    );
    gl_PointSize = 1.0;

  } else if (texture_type == 1) { // Boundary Condition Texture

    v_particle_pos_c = state; // Texture RGBA data is only for transfer
    gl_PointSize = 2.0;
    
  } else if (texture_type == 2) {

    // v_particle_pos_c = vec2( // @mourner's method: RGBA texture data is position
    //       decodeFloatRGBA(texture2D(u_particles_x, state)),
    //       decodeFloatRGBA(texture2D(u_particles_y, state))
    // );
    
    v_particle_pos_c = state;
    gl_PointSize = 2.0;

  }

${main.join('\n')}

  // vec2 du = (u_max - u_min);
  v_particle_pos = (v_particle_pos - u_min)/du;

  if (texture_type == 1) { // Boundary Condition Texture

    if (bc_drawing_mode) {

      if (bc_shape == 1) { // square
        val = sign * 0.5 * (max(abs(state.x - bc_cx)/bc_qx, abs(state.y - bc_cy)/bc_qy) - 1.);

      } else if (bc_shape == 2) { // circle
        val = sign * 0.5 * ((state.x - bc_cx)*(state.x - bc_cx)/bc_qx + (state.y - bc_cy)*(state.y - bc_cy)/bc_qy - 1.);

      } else { // free draw?
        // TODO WAS: not implemented yet
        val = 0.;
      }

      v_particle_color = 1.5 * v_particle_color;

    } else { // bc from code box definition
     
      val = get_bc(state, sign, time);
    }
    
    // for testing/observing bc encoding
    // if (mod(drawing_click_sum, 3.) == 2.) {
    //   if (reach_mode) {
    //     val = decodeFloatRGBA(texture2D(u_particles_x, state_mag));
    //   } else {
    //     val = decodeFloatRGBA(texture2D(u_particles_y, state_mag));
    //   }
    // }

    // if (!no_bc_encoded) {
    //   float valDecoded;
    //   if (reach_mode) {
    //     valDecoded = decodeFloatRGBA(texture2D(u_particles_x, state_mag));
    //   } else {
    //     valDecoded = decodeFloatRGBA(texture2D(u_particles_y, state_mag));
    //   }
    //   val = min(val, valDecoded);

    //   // WAS TODO: make this better (diff colors for new level vs encoded)
    //   // if (val == valDecoded) {
    //   //   // encoded level keep color
    //   // } else {
    //   //   v_particle_color = 1.5 * v_particle_color; // new level 
    //   // }
    // }

    float valDecoded = val;
    if (reach_mode && !no_reach_bc_encoded) {
      valDecoded = decodeFloatRGBA(texture2D(u_particles_x, state_mag));
    } else if (!reach_mode && !no_avoid_bc_encoded) {
      valDecoded = decodeFloatRGBA(texture2D(u_particles_y, state_mag));
    }
    val = min(val, valDecoded);

    // WAS TODO: make this better (diff colors for new level vs encoded)
    // if (val == valDecoded) {
    //   // encoded level keep color
    // } else {
    //   v_particle_color = 1.5 * v_particle_color; // new level 
    // }

    // // display bc simultaneously to drawing (after init)
    // bool avoid_mode = false;
    // bool valueReachEncoded = true;
    // bool valueAvoidEncoded = true;
    // if (reach_mode && valueReachEncoded) {
    //   val = min(val, decodeFloatRGBA(texture2D(u_particles_x, state_mag)));
    // } else if (avoid_mode && valueAvoidEncoded) {
    //   val = min(val, decodeFloatRGBA(texture2D(u_particles_y, state_mag)));
    // }

  } else if (texture_type == 2) { // Value Texture

    val = decodeFloatRGBA(texture2D(u_particles_x, state_mag));

  }
  
  // TODO WAS: color mode for Vf, changes over timef

  // float thresh_mag = 1.;
  // if (bc_shape == 2) {
  //   thresh_mag = 1.; // doesn't work right bc doubles existing squares... TODO std grad
  // }

  bool draw_level_cond;
  if (draw_levels) {
    draw_level_cond = (val/level_step - floor(val/level_step) > thresh/level_step) && (val > thresh);
    // float(draw_fill) * floor(val/level_step) // colors border color rather than black
  } else {
    draw_level_cond = val > thresh;
  }

  // Draw
  if (draw_level_cond && texture_type != 0) {

    // draw nothing
  
  } else if (val < - thresh && texture_type != 0) { // Interior

    if (draw_fill) {
      filler = 1.;
      gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, (1. - 2. * (v_particle_pos.y)),  0., 1.);    
    }

    // draw nothing
 
  } else { // Boundary
   
    filler = 0.;
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
  vec2 v_particle_pos = v_particle_pos_c;
`
  }
}