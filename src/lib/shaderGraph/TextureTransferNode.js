import BaseShaderNode from './BaseShaderNode';
import encodeFloatRGBA from './parts/encodeFloatRGBA';
import decodeFloatRGBA from './parts/decodeFloatRGBA';

/**
 * Reads/writes particle coordinates from/to a texture;
 */
export default class TextureTransfer extends BaseShaderNode {
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
    if (this.isDecode) { // WAS: where defd when encode
      // TODO: How to avoid duplication and silly checks?
    return `
precision highp float;

uniform sampler2D u_bc;
uniform sampler2D u_value;
uniform int minmaxix; // min=1, max=2

// Which coordinate needs to be printed onto the texture // WAS: old
// uniform int u_out_coordinate;

varying vec2 v_tex_pos; // index
`;
    }
  }

  getMainBody() {
//   if (this.isDecode) {
//     return `
//    vec2 pos = vec2(
//      decodeFloatRGBA(texture2D(u_particles_x, v_tex_pos)),
//      decodeFloatRGBA(texture2D(u_particles_y, v_tex_pos))
//    );
// `
//     }
    return `
    // if (u_out_coordinate == 0) gl_FragColor = encodeFloatRGBA(newPos.x);
    // else if (u_out_coordinate == 1) gl_FragColor = encodeFloatRGBA(newPos.y);
    // else if (u_out_coordinate == 6) gl_FragColor = encodeFloatRGBA(get_velocity(pos).x);
    // else if (u_out_coordinate == 7) gl_FragColor = encodeFloatRGBA(get_velocity(pos).y);

    if (minmaxix == 1) {
      gl_FragColor = encodeFloatRGBA(Math.min(decodeFloatRGBA(texture2D(u_bc, v_tex_pos), decodeFloatRGBA(texture2D(u_value, v_tex_pos)));
    } else if (minmaxix == 2) {
      gl_FragColor = encodeFloatRGBA(Math.max(decodeFloatRGBA(texture2D(u_bc, v_tex_pos), decodeFloatRGBA(texture2D(u_value, v_tex_pos))); 
    }
`;
  }
}