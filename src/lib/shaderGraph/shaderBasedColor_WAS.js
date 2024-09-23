import UserDefinedVelocityFunction from './UserDefinedVelocityFunction';
import RungeKuttaIntegrator from './RungeKuttaIntegrator';
import ColorModes from '../programs/colorModes';

export default function shaderBasedColor_WAS(colorMode, vfCode, colorCode, color, color2) {
  var udf = new UserDefinedVelocityFunction(vfCode);
  var integrate = new RungeKuttaIntegrator();
  const [r, g, b, a] = color;
  const [r2, g2, b2, a2] = color2;

  return {
    getVariables,
    getMain,
    getMethods
  }

  function getVariables() {
    return `
uniform vec2 u_velocity_range;
varying vec4 v_particle_color;

${udf.getDefines()}
${integrate.getDefines()}
`
  }

  function getMethods() {
    return `
// https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

${udf.getFunctions()}
${integrate.getFunctions()}
${getColorFunctionBody()}
`
  }

  function getColorFunctionBody() {
    if (colorMode === ColorModes.UNIFORM) {
      return `
vec4 get_color(vec2 p) {
  return vec4(${r}, ${g}, ${b}, ${a});
}
`
    }
    if (colorMode === ColorModes.DUAL) {
      return `
vec4 get_color(vec2 p) {
  float rand = fract(sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453);
  if (rand < 0.5) {
    return vec4(${r}, ${g}, ${b}, ${a});
  } else {
    return vec4(${r2}, ${g2}, ${b2}, ${a2});
  }
}
`
    }
//     if (colorMode === ColorModes.REACHAVOID) {
//       return `
// vec4 get_color(vec2 p) {
//   // TODO WAS: different color for active drawing than R or A 
//   // would need draw_click_sum, might be easier to separate drawing/bc textures
//   return vec4(${r}, ${g}, ${b}, ${a}); 
// }
// `
//     }

    if (colorMode === ColorModes.VELOCITY) {
      return `
vec4 get_color(vec2 p) {
  vec2 velocity = get_velocity(p);
  float speed = (length(velocity) - u_velocity_range[0])/(u_velocity_range[1] - u_velocity_range[0]);
  return vec4(hsv2rgb(vec3(0.05 + (1. - speed) * 0.5, 0.9, 1.)), 1.0);
}
`
    } 

    if (colorMode === ColorModes.CUSTOM) {
      if (!colorCode) throw new Error('color mode is set to custom, but no color function is specified');

      return colorCode;
    }

    return ` 
vec4 get_color(vec2 p) {
  vec2 velocity = get_velocity(p);
  float speed = (atan(velocity.y, velocity.x) + PI)/(2.0 * PI);
  return vec4(hsv2rgb(vec3(speed, 0.9, 1.)), 1.0);
}
`;
  }

  function getMain() {
    return `  v_particle_color = get_color(v_particle_pos);`
  }
}
