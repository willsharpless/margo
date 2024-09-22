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
  //  vec2 pos = vec2(
  //    decodeFloatRGBA(texture2D(u_particles_x, v_tex_pos)),
  //    decodeFloatRGBA(texture2D(u_particles_y, v_tex_pos))
  //  );

  float reach_val = decodeFloatRGBA(texture2D(u_particles_x_bc, 1.-v_tex_pos));
  float avoid_val = decodeFloatRGBA(texture2D(u_particles_y_bc, 1.-v_tex_pos));
  // working!! but flipped??

  // float val = min(reach_val, avoid_val)
  float val = reach_val;

  vec2 pos = vec2(
    val,       // decoded value,
    0.         // u_particles_y texture will be all 0.
  );

`
    }
    return `
    // if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newPos.x);
    // else if (u_out_coordinate == 1) gl_FragColor = encodeFloatRGBA(newPos.y);
    // else if (u_out_coordinate == 6) gl_FragColor = encodeFloatRGBA(get_velocity(pos).x);
    // else if (u_out_coordinate == 7) gl_FragColor = encodeFloatRGBA(get_velocity(pos).y);
    // WAS: why store the pos from get_velocity? 

    if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newPos.x);
    else if (u_out_coordinate == 1) gl_FragColor = encodeFloatRGBA(newPos.y);
    // gl_FragColor = encodeFloatRGBA(newPos.x); // dont forget its a vec2
    
    // gl_FragColor = encodeFloatRGBA(newVal); 
    // TODO WAS: for now, just writing value to all textures (to prevent breaking TextureCollection)
`
  }
}