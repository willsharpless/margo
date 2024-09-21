/**
 * A wrapper over collection of textures. Can be used to represent
 * individual textures for every dimension.
 */
import glUtil from '../gl-utils';

export default function textureCollection_WAS(gl, dimensions, particleStateResolution) {
  var textures = dimensions.map((d, index) => {
    var textureInfo = {
      texture: glUtil.createTexture(gl, gl.NEAREST, d.particleState, particleStateResolution, particleStateResolution),
      index: index,
      name: d.name
    }

    return textureInfo;
  })

  return {
    dispose,
    bindTextures,
    assignProgramUniforms,
    length: dimensions.length,
    textures,
    get(i) { return textures[i]; }
  }

  function assignProgramUniforms(program) {
    textures.forEach(tInfo => {
      gl.uniform1i(program['u_particles_' + tInfo.name], tInfo.index);
    });
  }

  function dispose() {
    textures.forEach(tInfo => gl.deleteTexture(tInfo.texture));
  }

  function bindTextures(gl, program, extra_tag='', unit_offset=0) {
    textures.forEach((tInfo) => {
      glUtil.bindTexture(gl, tInfo.texture, tInfo.index + unit_offset);
      gl.uniform1i(program['u_particles_' + tInfo.name + extra_tag], tInfo.index + unit_offset);
    })
  }
}