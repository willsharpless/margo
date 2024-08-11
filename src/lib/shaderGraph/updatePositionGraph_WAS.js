import BaseShaderNode from './BaseShaderNode';
import TexturePositionNode_WAS from './TexturePositionNode_WAS';
import renderNodes from './renderNodes';
import UserDefinedVelocityFunction from './UserDefinedVelocityFunction';
import PanzoomTransform from './PanzoomTransform';
import RungeKuttaIntegrator from './RungeKuttaIntegrator';

export default class UpdatePositionGraph_WAS {
  constructor(options) {
    this.readStoredPosition = new TexturePositionNode_WAS(/* isDecode = */ true);
    this.udfVelocity = new UserDefinedVelocityFunction();
    this.integratePositions = new RungeKuttaIntegrator();
    this.dropParticles = new RandomParticleDropper();
    this.writeComputedPosition = new TexturePositionNode_WAS(/* isDecode = */ false);
    this.panZoomDecode = new PanzoomTransform({decode: true});
    this.panZoomEncode = new PanzoomTransform({decode: false});

    this.colorMode = options && options.colorMode;
  }

  setCustomVectorField(velocityCode) {
    this.udfVelocity.setNewUpdateCode(velocityCode);
  }

  getVertexShader () {
    return `precision highp float;

attribute vec2 a_pos;
varying vec2 v_tex_pos;
uniform vec2 u_min;
uniform vec2 u_max;

void main() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}`
  }

  getFragmentShader() {
    var nodes = [
      this.readStoredPosition,
      this.dropParticles,
      this.udfVelocity,
      this.integratePositions, {
        getMainBody() {
          return `
  vec2 newPos = pos + velocity;
  `
        }
      },
      this.writeComputedPosition
    ];
    return renderNodes(nodes);
  }
}

class RandomParticleDropper extends BaseShaderNode {
  getDefines() {
    return `
uniform float u_drop_rate;
uniform float u_rand_seed;
uniform vec2 u_min;
uniform vec2 u_max;
`
  }

  getFunctions() {
    // TODO: Ideally this node should probably depend on
    // random number generator node, so that we don't duplicate code
    return `
`
  }

  getMainBody() {
    return `
  // a random seed to use for the particle drop
  vec2 seed = (pos + v_tex_pos) * u_rand_seed;
  // drop rate is a chance a particle will restart at random position, to avoid degeneration
  float drop = step(1.0 - u_drop_rate, rand(seed));

  // TODO: This can be customized to produce various emitters
  // random_pos is in range from 0..1, we move it to the bounding box:
  vec2 random_pos = vec2(rand(seed + 1.9), rand(seed + 8.4)) * (u_max - u_min) + u_min;
  pos = mix(pos, random_pos, drop);
`;
  }

}