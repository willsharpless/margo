export default [
  {
    "name": "Secret door",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -0.15344999999999986,
    "cy": -0.1291,
    "w": 7.4611,
    "h": 7.4611,
    "code": `// s.x and s.y are current coordinates
  // v.x and v.y is a velocity at point s
  vec2 get_velocity(vec2 s) {
    vec2 v = vec2(0., 0.);

    // change this to get a new vector field
    v.x = s.y*s.y ;
    v.y = -s.x*s.x *.05;

    return v;
  }`
  },
  {
    "name": "Miserables graph with edges",
    "timeStep": -0.001,
    "fadeOut": 0.998,
    "dropProbability": 0.008,
    "colorMode": 2,
    "cx": 0.467,
    "cy": 1.5294,
    "w": 0.9368,
    "h": 0.9368,
    "showBindings": 1,
    "i0": "https://gist.githubusercontent.com/anvaka/ebc18e3ffe05b0709a7ae933261fa2e9/raw/bafb63d01e0ab37c1f9b51522a5ec4fbc19bc4f1/edges.png",
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  vec4 c = texture2D(input0, vec2(mod(s.x,1.), 1. - mod(s.y, 1.)));
  v.x = (c.r + c.g/255.) - 0.5;
  v.y = 0.5 - (c.b + c.a/255.);

  if (length(v) < 0.1) v = vec2(0.);
  return (v);
}`,
    "particleCount": 40000
  },
  {
    "name": "Roads",
    "timeStep": 0.001,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 2,
    "cx": 0.478,
    "cy": 0.2636,
    "w": 0.9922,
    "h": 0.9922,
    "showBindings": 0,
    "i0": "https://gist.githubusercontent.com/anvaka/ebc18e3ffe05b0709a7ae933261fa2e9/raw/cd7d82c5a235f50f5655ac94aa9077709731adde/binary_tree.png",
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  vec4 c = texture2D(input0, vec2(mod(s.x,1.), 1. - mod(s.y, 1.)));
  v.x = (c.r + c.g/255.) - 0.5;
  v.y = 0.5 - (c.b + c.a/255.);

  return (v);
}`,
    "particleCount": 40000
  },
  {
    "name": "Four counterclockwise cogs pushing particles clockwise :)",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0.7887499999999994,
    "cy": -0.5769500000000001,
    "w": 16.3759,
    "h": 16.3759,
    "code": `vec2 field(vec2 s) {
  float d = length(s);
  return vec2(-s.y, s.x) * exp(-d*d*0.1);
}
// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v = field(s + vec2(-5., 0.)) +
    field(s + vec2(-2.5, 2.5)) +
    field(s + vec2(0., 0.)) +
    field(s + vec2(-2.5, -2.5));
  return v;
}`
  },
  {
    "name": "Waveshaping [interactive]",
    "cx": 0,
    "cy": -0.060899999999999954,
    "w": 12,
    "h": 12,
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 2,
    "code": `float f(float x) {
  bool supportsHover = length(cursor.zw) > 0.01;
  vec2 c = supportsHover ? cursor.zw : cursor.xy;
  float f1 = sin(x);
  float f2 = sin(2.*x);
  float f3 = sin(3.*x);
  float f4 = sin(4.*x);
  float f5 = sin(5.*x);
  return f1 +
    f2*c.x/4. +
    f3*c.y/6. +
    f4*c.x/8. +
    f5*c.y/10.;
}

float df(float x) {
  float h = 0.001;
  return (f(x+h)-f(x-h))/(2.*h);
}

vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  float fx = f(s.x);
  float d = abs(s.y-fx);
  float dfx = df(s.x);
  vec2 toOrigin = -s/(20.*length(s));
  vec2 toF = 0.1*vec2(0.,fx-s.y);
  v = d < 0.1 ? vec2(1.,dfx) : toF;
  return v;
}`,
    "particleCount": 50000
  },
  {
    "name": "Hex plane [interactive]",
    "timeStep": 0.01,
    "fadeOut": 0.99,
    "dropProbability": 0.99,
    "colorMode": 3,
    "cx": 0,
    "cy": 0,
    "w": 8.5398,
    "h": 8.5398,
    "code": `vec2 nearest(vec2 s) {
// Charles Chambers black hex magic
float temp = floor(s.x + sqrt(3.) * s.y + 1.);
float q = floor((floor(2.*s.x+1.) + temp) / 3.);
float r = floor((temp + floor(-s.x + sqrt(3.) * s.y + 1.))/3.);
return vec2(q-s.y/2.,r-s.y/8.);
}

// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);
  float f = frame/1000.;
  float z = (3.-s.y)/(6.+cursor.zw.y*2.);
  float a = cursor.zw.x;
  vec2 r = vec2(cos(a)*s.x - sin(a)*s.y,sin(a)*s.x+cos(a)*s.y);
  vec2 t = vec2(r.x / z, r.y / z);
  vec2 n = nearest(t);
  v.x = t.x-n.x;
  v.y = t.y-n.y;
  return v;
}`,
    "particleCount": 500000
  },
  {
    "name": "Rain",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0,
    "cy": 0,
    "w": 8.5398,
    "h": 8.5398,
    "code": `bool isUnshadowed(vec2 s) {
  bool upper = length(s) > 1.0 && s.y > 0.0;
  bool lower = length(s) > 1.0 && s.y < 0.0 && abs(s.x) > 1.0;
  return upper || lower;
}

vec2 unshadowedV(vec2 s) {
  return vec2(0.0,-3.0+s.y);
}

bool isSpray(vec2 s) {
  return length(s) > 1.0 && abs(s.x) < 1.0;
}

vec2 sprayV(vec2 s) {
  float vy = -1.0+s.y;
  float vx = s.x > 0.0 ? (1.0-s.x)/vy : (-1.0-s.x)/vy;
  return vec2(vx,vy);
}

bool isCircle(vec2 s) {
  return length(s) > 1.0 && length(s) < 1.05;
}

vec2 circleV(vec2 s) {
  vec2 v = vec2(0., 0.);
  v.x = sign(s.x)* s.y;
  v.y = -abs(s.x);
  return v;
}

// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  v = isCircle(s) ? circleV(s) :
      isUnshadowed(s) ? unshadowedV(s) :
      isSpray(s) ? sprayV(s) : vec2(1.0/0.0,1.0/0.0);

  return v;
}`,
    "particleCount": 10000
  },
  {
    "name": "Mouse-driven Julia Set",
    "timeStep": 0.01,
    "fadeOut": 0.9,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": -0.27144999999999997,
    "cy": 0.14175000000000004,
    "w": 6.120699999999999,
    "h": 6.120699999999999,
    "particleCount": 1000000,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float a = cursor.zw.x;
float b = cursor.zw.y;
float sx = s.x/2.0;
float sy = s.y/2.0;
float i1x = sx*sx - sy*sy+a;
float i1y = -2.0*sx*sy+b;
float i2x = i1x*i1x - i1y*i1y+a;
float i2y = -2.0*i1x*i1y+b;
float i3x = i2x*i2x - i2y*i2y+a;
float i3y = -2.0*i2x*i2y+b;
float i4x = i3x*i3x - i3y*i3y+a;
float i4y = -2.0*i3x*i3y+b;
float i5x = i4x*i4x - i4y*i4y+a;
float i5y = -2.0*i4x*i4y+b;
float i6x = i5x*i5x - i5y*i5y+a;
float i6y = -2.0*i5x*i5y+b;
float i7x = i6x*i6x - i6y*i6y+a;
float i7y = -2.0*i6x*i6y+b;
float i8x = i7x*i7x - i7y*i7y+a;
float i8y = -2.0*i7x*i7y+b;
float i9x = i8x*i8x - i8y*i8y+a;
float i9y = -2.0*i8x*i8y+b;

  float n = sqrt(i9x*i9x+i9y*i9y);

v.x = n > 2.0 ? -s.x/10.0 : s.x/10.0;
v.y = n > 2.0 ? -s.y/10.0 : s.y/10.0;

  return v;
}`
  },
  {
    "name": "Hyperjump",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 2,
    "cx": 0.523299999999999,
    "cy": 1.2703999999999995,
    "w": 48.3842,
    "h": 48.3842,
    "code": `vec2 circle(vec2 s, vec2 c) {
  vec2 c0 = s - c;
  vec2 p0 = vec2(-c0.y, c0.x);
  float l = length(p0);
  return p0 * exp(-l*sin(frame*0.01));
}
// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = circle(s, vec2(0., 0.));

  float r = 7.;
  for (int i = 0; i < 2; ++i) {
    float a = 0.01 * frame + float(i) * 2.*PI/7.;
    v += circle(s, vec2(r * cos(a) , r * sin(a)));
  }
  return v;
}`,
    "particleCount": 30000
  },
  {
    "name": "Particle Grinder",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0.028149999999999675,
    "cy": 0.08830000000000005,
    "w": 9.045300000000001,
    "h": 9.045300000000001,
    "code": `vec2 tensor(vec2 s, vec2 c0, vec4 abcd, float N) {
  vec2 p0 = s - c0;
  float theta = atan(p0.y, p0.x);
  float c = cos(N * theta);
  float ss = sin(N * theta);
  return length(p0) * vec2(abcd[2] * c + abcd[3] * ss,
              abcd[0] * c + abcd[1] * ss);
}

vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);
  v = tensor(s, vec2(0., 0.), vec4(-2., 0., 0., 1.), 2.);
  return v;
}`
  },
  {
    "name": "Hyperbolic flux [interactive]",
    "timeStep": 0.001,
    "fadeOut": 0.999,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": -0.11990000000000034,
    "cy": 0.018899999999999917,
    "w": 8.5442,
    "h": 8.5442,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  float ax = (cursor.zw.x - s.x);
  float ay = (cursor.zw.y - s.y);
  float al = sqrt(ax*ax+ay*ay);

  float rx = (s.x-cursor.xy.x);
  float ry = (s.y-cursor.xy.y);
  float rl = sqrt(rx*rx+ry*ry);

  // change this to get a new vector field
  v.x = (ax*ax*ry + ay*rx*rx)/(al*rl);
  v.y = (ay*ay*rx + ax*ry*ry)/(al*rl);

  return v;
}`,
    "particleCount": 1000000
  },
  {
    "name": "Swim against the current",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": 3.0524500000000003,
    "cy": -1.3792,
    "w": 8.5397,
    "h": 8.5397,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float dx1 = cursor.zw.x - s.x;
float dy1 = cursor.zw.y - s.y;
float dl1 = sqrt(dx1*dx1+dy1*dy1);
dx1 = dx1/dl1;
dy1 = dy1/dl1;

float dx2 = cursor.xy.x - s.x;
float dy2 = cursor.xy.y - s.y;
float dl2 = sqrt(dx2*dx2+dy2*dy2);
dx2 = dx2/dl2;
dy2 = dy2/dl2;

float fx = cursor.xy.x - cursor.zw.x;
float fy = cursor.xy.y -
cursor.zw.y;
float fl = sqrt(fx*fx+fy*fy);
fx = -fx/fl;
fy = -fy/fl;

float d1 = (dx1*fx + dy1*fy)/(dl1*fl);
float d2 = 1.-d1;
v.x = d1*fx+d2*dx2;
v.y = d1*fy+d2*dy2;

  return v;
}`,
    "particleCount": 100900
  },
  {
    "name": "Eye of Sauron (interactive)",
    "timeStep": 0.01,
    "fadeOut": 0.988,
    "dropProbability": 0.008,
    "colorMode": 2,
    "cx": 0.3991000000000007,
    "cy": -0.11315000000000008,
    "w": 37.0984,
    "h": 37.0984,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  // calculate distortion map (reverse solver)
// the distortion map is based on a sphere, but smoothed to the ends: sqrt(1-(x^8/(x^8-1))^(1/4))

float dist_radius = 7.8;
vec2 distortion = cursor.zw;
if (length(distortion) > 4.5) {
    distortion = normalize(distortion) *4.5;
}

// iterative reverse algo. after all, we knew the result position already, we're trying to reason back to what the original position was
vec2 d = s;
for (int i = 0; i < 10; i++) {
    // calculate distortion effect magnitude
    float d_scale = pow(length(d) / dist_radius, 8.);
    // pseudo sphere map
    d_scale = pow(1. - pow(d_scale / (d_scale + 1.), .25), .5);
    d = s - distortion * d_scale;
}

// calculate differentials, working backwards (i.e. what change in s would result from a change in d)
vec2 d_dx  = d + vec2(0.1, 0.0);
float d_dx_scale = pow(length(d_dx) / dist_radius, 8.);
d_dx_scale = pow(1. - pow(d_dx_scale / (d_dx_scale + 1.), .25), .5);
vec2 dx = (d_dx + distortion * d_dx_scale - s) / 0.1;

vec2 d_dy  = d + vec2(0.0, 0.1);
float d_dy_scale = pow(length(d_dy) / dist_radius, 8.);
d_dy_scale = pow(1. - pow(d_dy_scale / (d_dy_scale + 1.), .25), .5);
vec2 dy = (d_dy + distortion * d_dy_scale - s) / 0.1;

// center parts
float pupilrange = length(vec2(d.y, d.x + 6.*sign(d.x)));
vec2 pupilborder = 2.6*vec2(-d.y, (d.x + 6.*sign(d.x)) );
v += pupilborder * smoothstep(6.6, 6.8, pupilrange) * (1. - smoothstep(6.9, 7.1, pupilrange));

float range = length(d);
vec2 iris = 7.*d/sqrt(range);
v += iris * smoothstep(7.0, 7.5, pupilrange) * (1. - smoothstep(3.8, 4.0, range));

vec2 pupil = 1.*vec2(d.x+1.*sign(d.x), d.y);
v += pupil * (1. - smoothstep(6.6, 6.8, pupilrange));

// absolute parts
vec2 psign = sign(d);
vec2 a = abs(d);
vec2 vabs = vec2(0.0, 0.0);

float borderrange = length(vec2(d.x, d.y + 7.*sign(d.y)));
vec2 border = -1.5*vec2(a.y + 7.*sign(a.y) - 3./(a.y + 1.), -a.x + 3./(a.x + 1.));
vabs += border * smoothstep(10.8, 11.25, borderrange) * (1. - smoothstep(11.25, 11.7, borderrange)) * smoothstep(3.8, 4.1, range) * (a.y / (a.y + 1.));

vec2 irisborder = 5.*vec2(a.y, -a.x) * (a.y / (a.y + 3.))+ .2 * a;
vabs += irisborder * smoothstep(3.8, 4.25, range) * (1. - smoothstep(4.25, 4.7, range));

vec2 white = 12.*vec2(1.0, -0.2 * (a.y));
vabs += white * smoothstep(4.3, 4.5, range) * (1. - smoothstep(11., 11.3, borderrange));

v += vabs * psign;

// outside part
vec2 outside = d / pow(borderrange - 10., 2.);
v -= outside * smoothstep(11.3, 11.5, borderrange);

// velocity distortion mapping
v = v.x * dx + v.y * dy;

// color mapping
if (length(v) > 0.01) {
    v = normalize(v) * 10.;
}
v = v / (1. + 0.1 * (borderrange - 10.) * smoothstep(11.5, 12.5, borderrange));



  return v;
}`,
    "particleCount": 30000
  },
  {
    "name": "Combination of two fields. One follows cursor",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0,
    "cy": 0,
    "w": 8.5398,
    "h": 8.5398,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  vec2 p1 = s - vec2(-2., 0.);
vec2 p2 = s - cursor.zw;

float l1 = length(p1), l2 = length(p2);

v = vec2(-p1.y, p1.x)/(l1 * l1) + vec2(-p2.y, p2.x)/(l2 * l2);

  return v;
}`
  },
  {
    "name": "[Randomized] nice symmetry",
    "timeStep": 0.01,
    "fadeOut": 0.988,
    "dropProbability": 0.008,
    "colorMode": 2,
    "cx": -2.6390499999999992,
    "cy": -1.1419499999999996,
    "w": 46.508700000000005,
    "h": 46.508700000000005,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = s.y/cos(length(s));
  v.y = max((log(s.y)+s.x),s.x);

  return v;
}`,
    "particleCount": 20000
  },
  {
    "name": "A city block from a parallel Universe (by @MananG_8)",
    "timeStep": 0.01,
    "fadeOut": 0.988,
    "dropProbability": 0.008,
    "colorMode": 1,
    "cx": 0.6165500000000002,
    "cy": -1.87745,
    "w": 9.0455,
    "h": 9.0455,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = sin(tan(s.x))*cos(tan(s.y));
  v.y = sin(tan(s.y))*cos(tan(s.x));

  return v;
}
`,
    "particleCount": 20000
  },
  {
    "name": "♥ by @SAKrisT",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 2,
    "cx": -1.4246499999999997,
    "cy": 0.92285,
    "w": 8.5397,
    "h": 8.5397,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float size = 1.0;
  vec2 o = (s)/(1.6* size);
  float a = o.x*o.x+o.y*o.y-0.3;
  v = vec2(step(a*a*a, o.x*o.x*o.y*o.y*o.y));

  return v;
}
`
  },
  {
    "name": "Dynamic vector field by Evgeniy Andreev. Not defined by physical system, but beautiful.",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": -1.6564499999999995,
    "cy": -0.36424999999999974,
    "w": 24.7317,
    "h": 24.7317,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float dt = 0.01;
  float t = frame*dt;
  float w = 2.*PI/5.;
  float A = 2.;

  float d = sqrt(s.x*s.x + s.y*s.y);
  v.x = A*cos(w*t/d);
  v.y = A*sin(w*t/d);

  return v;
}`,
    "particleCount": 3000
  },
  {
    "name": "Behold (by /u/censored_username)",
    "timeStep": 0.01,
    "fadeOut": 0.988,
    "dropProbability": 0.008,
    "colorMode": 2,
    "cx": 0.12704999999999966,
    "cy": 0.1923499999999998,
    "w": 22.5709,
    "h": 22.5709,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float x = abs(s.x) - 5.;
  float side = sign(s.x);
  float range = length(vec2(x, s.y));
  float irisrange = length(vec2(x, s.y + 2.*sign(s.y)));

  vec2 border = 1.*vec2(s.y + 2.2*sign(s.y) * (s.y*s.y / (s.y*s.y + 0.01)), -x);

  vec2 outside = vec2(x / (1.+10./abs(s.x*s.x)), s.y);

  vec2 spiral = vec2(s.y, -x);

  vec2 iris = sin(-range * 10.) * spiral + 0.05*vec2(x, s.y);

  v += outside * (smoothstep(4.0, 4.5, irisrange)/range*5. - 5.*smoothstep(0.9, 0.7, range)/range);
  v += border * smoothstep(3.5, 4., irisrange) * smoothstep(4.5, 4., irisrange);
  v += iris * smoothstep(2.0, 1.5, range) * smoothstep(0.8, 1., range);
  v -= 10.0*spiral * smoothstep(1.0, 0.8, range) * smoothstep(0.7, 0.9, range);

  v.x *= side;
  v *= -1.;

  return v;
}`,
    "particleCount": 30000
  },
  {
    "name": "README 1",
    "timeStep": 0.007,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -1.275949999999999,
    "cy": -1.6277,
    "w": 30.2937,
    "h": 30.2937,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = length(s)*min(sin(s.y),cos(s.x));
v.y = cos((s.y+s.y));


  return v;
}`
  },
  {
    "name": "README 2",
    "timeStep": 0.007,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -1.275949999999999,
    "cy": -1.62765,
    "w": 30.2937,
    "h": 30.2937,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = cos(s.y);
v.y = cos(s.x);


  return v;
}`
  },
  {
    "name": "README 3",
    "timeStep": 0.02,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0.21419999999999995,
    "cy": -0.7710999999999997,
    "w": 55.970200000000006,
    "h": 55.970200000000006,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = min(sin(exp(s.x)),sin(length(s)));
v.y = sin(s.x);


  return v;
}`
  },
  {
    "name": "README 4",
    "timeStep": 0.02,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 2.43185,
    "cy": -1.1695,
    "w": 11.4385,
    "h": 11.4385,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = (s.y+cos(s.y));
v.y = sin(min(length(s),log((s.y+s.x))*s.x));


  return v;
}`
  },
  {
    "name": "True Dipole",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0,
    "cy": 0,
    "w": 8.5398,
    "h": 8.5398,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float x = s.x;
float y = s.y;

// true dipole
v.x = 2.0*x*y;
v.y = y*y - x*x;

  return v;
}`
  },
  {
    "name": "Flow profile of a sphere",
    "timeStep": 0.011,
    "fadeOut": 0.99999,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -0.7177000000000002,
    "cy": -0.11769999999999992,
    "w": 11.434999999999999,
    "h": 11.434999999999999,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float x = s.x;
float y = s.y;
float r = sqrt(x*x+y*y);
float sinth = y/r;
float costh = x/r;
float R = 1.;
float Uinf = 1.;
// radial flow
float ur = Uinf*(1.-1.5*R/r+0.5*R*R*R/(r*r*r))*costh;
// theta flow
float uth = Uinf*(-1.+0.75*R/r+0.25*R*R*R/(r*r*r))*sinth;
// to ux uy
v.x = costh*ur-sinth*uth;
v.y = sinth*ur+costh*uth;

  return v;
}`,
    "particleCount": 7000
  },
  {
    "name": "Best vortex",
    "colorMode": 2,
    "cx": -6.158449999999998,
    "cy": -0.9834499999999995,
    "w": 96.8415,
    "h": 96.8415,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float r = length(s);
float theta = atan(s.y, s.x);
v = vec2(s.y, -s.x) / r;
float t = sqrt(r * 10.) + theta + frame * .02;
v *= sin(t);
v *= length(v) * 10.;
v += s * .2;

  return v;
}`,
    "timeStep": 0.01,
    "fadeOut": 0.9,
    "dropProbability": 0.009,
    "particleCount": 100000
  },
  {
    "name": "Black hole",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -0.47934999999999994,
    "cy": 0.3591500000000001,
    "w": 8.5397,
    "h": 8.5397,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float a = .1;
float r2 = s.x * s.x + s.y * s.y;
v = vec2(s.y, -s.x) / r2 - a * s;

  return v;
}`
  },
  {
    "name": "Julia set",
    "timeStep": 0.004,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": -0.40235,
    "cy": -0.01795000000000002,
    "w": 5.0845,
    "h": 5.0845,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  vec2 c = s;
vec2 z = vec2(.4, .5);
for (int i = 0; i < 8; i++) {
   c = vec2(c.x * c.x - c.y * c.y, c.y * c.x + c.x * c.y);
   c += z;
}
v = c;


  return v;
}`,
    "particleCount": 10000
  },
  {
    "name": "Mandelbrot set",
    "timeStep": 0.004,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": -0.5678,
    "cy": -0.07015000000000005,
    "w": 4.9902,
    "h": 4.9902,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  vec2 z = s;
for(int k=0; k<50; k++) {
z = vec2(z.x * z.x - z.y * z.y, 2. * z.x * z.y) + s;
}

float mask = step(length(z), 2.);
v.x = -s.y/length(s) * (0.5 - mask);
v.y = s.x/length(s) * (0.5 - mask);




  return v;
}`,
    "particleCount": 30000
  },
  {
    "name": "Reflecting pool",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0,
    "cy": 0,
    "w": 8.5398,
    "h": 8.5398,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  v.x = sin(5.0*s.y + s.x);
v.y = cos(5.0*s.x - s.y);

  return v;
}`
  },
  {
    "name": "Shear zone",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 1,
    "cx": 0,
    "cy": 0,
    "w": 8.539734222673566,
    "h": 8.539734222673566,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float r = length(s) - 1.5;
float c = 1.0/(1.0+exp(-5.0*r));
float vx1 = -s.y,  // circle
      vy1 = s.x;
float vx2 = 0.2*s.x+s.y, // spiral
      vy2 = 0.2*s.y-s.x;
v.x = c*vx1 + (1.0-c)*vx2;
v.y = c*vy1 + (1.0-c)*vy2;


  return v;
}`
  },
  {
    "name": "Beautiful field",
    "timeStep": 0.01,
    "fadeOut": 0.998,
    "dropProbability": 0.009,
    "colorMode": 3,
    "cx": -1.6564499999999995,
    "cy": -0.36424999999999974,
    "w": 24.7317,
    "h": 24.7317,
    "code": `// s.x and s.y are current coordinates
// v.x and v.y is a velocity at point s
vec2 get_velocity(vec2 s) {
  vec2 v = vec2(0., 0.);

  // change this to get a new vector field
  float dt = 0.01;
float t = frame*dt;
float w = 2.*PI/5.;
float A = 2.;

float d = sqrt(s.x*s.x + s.y*s.y);
v.x = A*cos(w*t/d);
v.y = A*sin(w*t/d);

  return v;
}`,
    "particleCount": 3000
  }
];
