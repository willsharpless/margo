import BaseShaderNode from './BaseShaderNode';
import TexturePositionNode from './TexturePositionNode';
import renderNodes from './renderNodes';
import UserDefinedVelocityFunction from './UserDefinedVelocityFunction';
import PanzoomTransform from './PanzoomTransform';
import RungeKuttaIntegrator from './RungeKuttaIntegrator';

import TextureTransferNode from './TextureTransferNode';
import TextureValueNode from './TextureValueNode';

export default class UpdatePositionGraph_WAS {
  constructor(options) {
    // Field Texture (old)
    this.readStoredPosition = new TexturePositionNode(/* isDecode = */ true);
    this.udfVelocity = new UserDefinedVelocityFunction();
    this.integratePositions = new RungeKuttaIntegrator();
    this.dropParticles = new RandomParticleDropper();
    this.writeComputedPosition = new TexturePositionNode(/* isDecode = */ false);
    this.panZoomDecode = new PanzoomTransform({decode: true});
    this.panZoomEncode = new PanzoomTransform({decode: false});
    this.colorMode = options && options.colorMode;

    // BC Texture
    // this.transferValue = new TextureTransferNode(/* isDecode = */ false);

    // Value Texture
    this.readStoredValue = new TextureValueNode(/* isDecode = */ true); // TextureValueNode
    // this.udfVelocity = new UserDefinedVelocityFunction(); // user defined Hamiltonian!
    // this.integratePositions = new RungeKuttaIntegrator(); // WENO + TVD-RK #fun
    this.writeComputedValue = new TextureValueNode(/* isDecode = */ false); // TextureValueNode
    // this.colorMode = options && options.colorMode;
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
// uniform int texture_type;

void main() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}`
  }

  getFragmentShader(texture_type) {

    if (texture_type == 0) { // Field
      var nodes = [
        this.readStoredPosition,
        this.dropParticles,
        this.udfVelocity,
        this.integratePositions, 
        {
          getMainBody() {
            return `
            vec2 newPos = pos + velocity;
            `
          }
        },
        this.writeComputedPosition
      ];
      
    } else if (texture_type == 1) { // Boundary Condition
      // var nodes = [
      //   this.TextureValueNode,
      //   // this.readStoredPosition,
      //   // this.dropParticles,
      //   // this.udfVelocity,
      //   // this.integratePositions, {
      //   //   getMainBody() {
      //   //     return `
      //   //     vec2 newPos = pos;
      //   //     `
      //   //   }
      //   // },
      //   // this.writeComputedPosition
      // ];
      var nodes = [
        // this.readStoredPosition,
        // this.dropParticles,
        // this.udfVelocity,
        // this.integratePositions, 
        // {
        //   getMainBody() {
        //     return `
        //     vec2 newPos = pos;
        //     `
        //   }
        // },
        // this.writeComputedPosition
      ];
    } else if (texture_type == 2) { // Value
      var nodes = [
        this.readStoredValue,
        this.udfVelocity, // TODO WAS: udfHamiltonian 
        // this.integratePositions, // TODO WAS: integrateValues (WENO/TVD RK5)
        {
          getMainBody() {
            return `
            // vec2 newPos = 1.01 * pos; //
            vec2 newPos = 0.01 + pos; //
            // TO BE: vec2 newVal = val; // + valvelocity (to be computed);
            `
          }
        },
        this.writeComputedValue
      ];
    }
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