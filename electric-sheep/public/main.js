/// <reference types='@webgpu/types' />
///
/// Stages:
///   1. Generate random points
///   2. Play the chaos game for some time
///   3. Gather the maximum value
///   4. Plot on the log-density display

// Import colourmaps generated from: https://github.com/tritoke/libcmap
const cmaps = window.cmaps || await import('./colourmaps.js').then(m => m.default);
const FractalFunctions = window.FractalFunctions || await import('./fractal_functions.js').then(m => m.default);

class Config {
  // Extended buffer size to accommodate new parameters
  // Must be a multiple of 16 bytes for WebGPU alignment requirements
  buffer = new ArrayBuffer(84)  // Increased from 80 to 84 bytes

  _origin = new Float32Array(this.buffer, 0, 2)
  get x()      { return this._origin[0] }
  set x(value) { this._origin[0] = value }
  get y()      { return this._origin[1] }
  set y(value) { this._origin[1] = value }

  _dimensions = new Uint32Array(this.buffer, 8, 2)
  get width()       { return this._dimensions[0] }
  set width(value)  { this._dimensions[0] = value }
  get height()      { return this._dimensions[1] }
  set height(value) { this._dimensions[1] = value }

  _frame = new Uint32Array(this.buffer, 16, 1)
  get frame()      { return this._frame[0] }
  set frame(value) { this._frame[0] = value }

  _zoom = new Float32Array(this.buffer, 20, 1)
  get zoom()      { return this._zoom[0] }
  set zoom(value) { this._zoom[0] = value }
  
  // Added parameters from fractal_example.js
  _final_xform = new Int32Array(this.buffer, 24, 1)
  get final()      { return this._final_xform[0] }
  set final(value) { this._final_xform[0] = value }
  
  _cfinal_xform = new Int32Array(this.buffer, 28, 1)
  get cfinal()      { return this._cfinal_xform[0] }
  set cfinal(value) { this._cfinal_xform[0] = value }
  
  _rotation = new Float32Array(this.buffer, 32, 1)
  get rotation()      { return this._rotation[0] }
  set rotation(value) { this._rotation[0] = value }
  
  _mirrors = new Uint32Array(this.buffer, 36, 2)
  get mirrorX()       { return this._mirrors[0] !== 0 }
  set mirrorX(value)  { this._mirrors[0] = value ? 1 : 0 }
  get mirrorY()       { return this._mirrors[1] !== 0 }
  set mirrorY(value)  { this._mirrors[1] = value ? 1 : 0 }
  
  _postProcess = new Float32Array(this.buffer, 44, 4)
  get gamma()         { return this._postProcess[0] }
  set gamma(value)    { this._postProcess[0] = value }
  get hueShift()      { return this._postProcess[1] }
  set hueShift(value) { this._postProcess[1] = value }
  get satShift()      { return this._postProcess[2] }
  set satShift(value) { this._postProcess[2] = value }
  get lightShift()    { return this._postProcess[3] }
  set lightShift(value) { this._postProcess[3] = value }
  
  // Animation speed control
  _animationSpeed = new Float32Array(this.buffer, 60, 1)
  get animationSpeed()      { return this._animationSpeed[0] }
  set animationSpeed(value) { this._animationSpeed[0] = value }
  
  // Number of points to generate
  _numPoints = new Uint32Array(this.buffer, 64, 1)
  get numPoints()      { return this._numPoints[0] }
  set numPoints(value) { this._numPoints[0] = value }
}

class StructWithFlexibleArrayElement {
  static get SIZE() { return this.BASE_SIZE + this.Element.SIZE * this.MAX_ELEMENTS }
  buffer = new ArrayBuffer(this.constructor.BASE_SIZE + this.constructor.Element.SIZE * this.constructor.MAX_ELEMENTS)
  constructor() {
    const proto = Object.getPrototypeOf(this)
    if (!proto.hasOwnProperty('length'))
      this.length = 0
  }

  add(props) {
    if (this.length === this.constructor.MAX_ELEMENTS)
      throw new Error(`${this.constructor.Element.name} limit exceeded!`)
    const view = new DataView(this.buffer, this.constructor.BASE_SIZE + this.constructor.Element.SIZE * this.length, this.constructor.Element.SIZE)
    const element = this[this.length] = new this.constructor.Element(view)
    Object.assign(element, props)
    this.length++
    return element
  }

  findIndex(obj) {
    for (let i = 0; i < this.length; i++)
      if (this[i] === obj)
        return i
  }

  remove(from, to) {
    if (typeof from === 'object')
      from = this.findIndex(from)
    if (typeof to === 'object')
      to = this.findIndex(to) + 1
    else if (to === undefined)
      to = from + 1

    if (from === undefined || to === undefined)
      throw new Error('Start and/or end objects were not found')

    const byte_view = new Uint8Array(this.buffer)
    byte_view.copyWithin(
      this.constructor.BASE_SIZE + this.constructor.Element.SIZE * from,
      this.constructor.BASE_SIZE + this.constructor.Element.SIZE * to,
      this.constructor.BASE_SIZE + this.constructor.Element.SIZE * this.length
    )
    Array.prototype.splice.call(this, from, to - from)
    for (let i = from; i < this.length; i++)
      this[i].view = new DataView(this.buffer, this.constructor.BASE_SIZE + this.constructor.Element.SIZE * i)
  }
}

const VARIATION_ID_TO_STR_ENTRIES = [
  [ 0, 'Linear'],
  [ 1, 'Sinusoidal'],
  [ 2, 'Spherical'],
  [ 3, 'Swirl'],
  [ 4, 'Horseshoe'],
  [ 5, 'Polar'],
  [ 6, 'Handkerchief'],
  [ 7, 'Heart'],
  [ 8, 'Disc'],
  [ 9, 'Spiral'],
  [10, 'Hyperbolic'],
  [11, 'Diamond'],
  [12, 'Ex'],
  [13, 'Julia'],
  [14, 'Bent'],
  [16, 'Fisheye'],
  [18, 'Exponential'],
  [19, 'Power'],
  [20, 'Cosine'],
  [27, 'Eyefish'],
  [28, 'Bubble'],
  [29, 'Cylinder'],
  [31, 'Noise'],
  [34, 'Blur'],
  [35, 'Gaussian'],
  [41, 'Arch'],
  [42, 'Tangent'],
  [43, 'Square'],
  [44, 'Rays'],
  [45, 'Blade'],
  [46, 'Secant'],
  [47, 'Twintrian'],
  [48, 'Cross'],
];
const VARIATION_ID_TO_STR = new Map(VARIATION_ID_TO_STR_ENTRIES)
const STR_TO_VARIATION_ID = new Map(VARIATION_ID_TO_STR_ENTRIES.map(([a, b]) => [b, a]))
class XForm {
  static SIZE = 40  // Increased from 32 to accommodate animation data
  constructor(view) { this.view = view }

  get variation() {
    const id = this.view.getUint32(0, true)
    const result = VARIATION_ID_TO_STR.get(id)
    if (result === undefined) throw new Error(`Unknown variation id ${id}`)
    return result
  }

  set variation(value) {
    const id = STR_TO_VARIATION_ID.get(value)
    if (id === undefined) throw new Error(`Unknown id for variation string '${value}'`)
    this.view.setUint32(0, id, true)
  }

  get color() { return this.view.getFloat32(4, true) }
  set color(value) { return this.view.setFloat32(4, value, true) }

  get a()      { return this.view.getFloat32( 8, true) }
  get b()      { return this.view.getFloat32(12, true) }
  get c()      { return this.view.getFloat32(16, true) }
  get d()      { return this.view.getFloat32(20, true) }
  get e()      { return this.view.getFloat32(24, true) }
  get f()      { return this.view.getFloat32(28, true) }
  set a(value) { this.view.setFloat32( 8, value, true) }
  set b(value) { this.view.setFloat32(12, value, true) }
  set c(value) { this.view.setFloat32(16, value, true) }
  set d(value) { this.view.setFloat32(20, value, true) }
  set e(value) { this.view.setFloat32(24, value, true) }
  set f(value) { this.view.setFloat32(28, value, true) }
  
  // Animation properties
  get animateX() { return this.view.getUint32(32, true) !== 0 }
  set animateX(value) { this.view.setUint32(32, value ? 1 : 0, true) }
  
  get animateY() { return this.view.getUint32(36, true) !== 0 }
  set animateY(value) { this.view.setUint32(36, value ? 1 : 0, true) }
}

class Fractal extends StructWithFlexibleArrayElement {
  static BASE_SIZE = 4
  static MAX_ELEMENTS = 128
  static Element = XForm

  _length = new Uint32Array(this.buffer, 0, 1)
  get length()      { return this._length[0] }
  set length(value) { return this._length[0] = value }
}

function in_circle(point, x, y, r, zoom) {
  const distance_sq = (x - point.x) ** 2 + (y - point.y) ** 2;
  const radius_sq = (r / zoom) ** 2;
  return distance_sq < radius_sq;
}

function squared_distance_to_line(point, from_x, from_y, to_x, to_y) {
  const pa_x = point.x   - from_x
  const pa_y = point.y   - from_y
  const ba_x = to_x - from_x
  const ba_y = to_y - from_y
  const unclamped_h = (pa_x * ba_x + pa_y * ba_y)
                    / (ba_x **2 + ba_y ** 2)
  const h = clamp(unclamped_h, 0, 1)
  return (pa_x - ba_x * h) ** 2 + (pa_y - ba_y * h) ** 2
}

function in_line(point, from_x, from_y, to_x, to_y, width, zoom) {
  return squared_distance_to_line(point, from_x, from_y, to_x, to_y) < (width * 4 / zoom) ** 2
}

class CMap extends StructWithFlexibleArrayElement {
  static BASE_SIZE = 4
  static MAX_ELEMENTS = 1024
  static Element = class Color {
    static SIZE = 4
    constructor(view) { this._view = view }

    get view() { return this._view }
    set view(value) {
      this._view = value
    }

    get r() { return this.view.getUint8(0, true) }
    get g() { return this.view.getUint8(1, true) }
    get b() { return this.view.getUint8(2, true) }
    set r(value) { this.view.setUint8(0, value, true) }
    set g(value) { this.view.setUint8(1, value, true) }
    set b(value) { this.view.setUint8(2, value, true) }
  }

  copyFrom(cmapUint8Array) {
    if ((cmapUint8Array.length & 0x3) !== 0)
      throw new Error('Length should be multiple of four')
    const newLength = cmapUint8Array.length / 4
    if (this.length > newLength)
      this.length = newLength
    while (this.length < newLength) this.add()
    const srcArray = new Uint32Array(cmapUint8Array.buffer)
    const dstArray = new Uint32Array(this.buffer, this.constructor.BASE_SIZE);
    srcArray.forEach((v, i) => dstArray[i] = v)
  }

  _length = new Float32Array(this.buffer, 0, 1)
  get length()      { return this._length[0] }
  set length(value) { this._length[0] = value }
}

const common_code = `
struct Stage1Histogram {
  max: atomic<u32>,
  padding1: u32, padding2: u32, padding3: u32,
  data: array<atomic<u32>>,
};

struct Stage2Histogram {
  max: atomic<u32>,
  data: array<vec4<u32>>,
};

struct FragmentHistogram {
  max: u32,
  data: array<vec4<u32>>,
};

struct CanvasConfiguration {
  origin: vec2<f32>,
  dimensions: vec2<u32>,
  frame: u32,
  zoom: f32,
  final_xform: i32,
  cfinal_xform: i32,
  rotation: f32,
  mirrorX: u32,
  mirrorY: u32,
  gamma: f32,
  hueShift: f32,
  satShift: f32,
  lightShift: f32,
  animationSpeed: f32,
};

// FIXME: Use a mat3x3
struct AffineTransform {
  a: f32,
  b: f32,
  c: f32,
  d: f32,
  e: f32,
  f: f32,
};

struct CMap {
  len: f32,
  colors: array<u32>,
};

struct XForm {
  variation_id: u32,
  color: f32,
  transform: AffineTransform,
  animateX: u32,
  animateY: u32,
};

struct Fractal {
  size: u32,
  xforms: array<XForm>,
};

@group(0) @binding(0) var<storage, read_write> stage1_histogram: Stage1Histogram;
@group(0) @binding(0) var<storage, read_write> stage2_histogram: Stage2Histogram;
// FIXME: This should be read-only
@group(0) @binding(0) var<storage, read_write> fragment_histogram: FragmentHistogram;
// FIXME: This should be read-only
@group(0) @binding(1) var<storage, read_write> fractal: Fractal;
@group(0) @binding(2) var<uniform> config: CanvasConfiguration;
@group(0) @binding(3) var<storage, read> cmap: CMap;

// Adapted from: https://drafts.csswg.org/css-color-4/#color-conversion-code
fn gam_sRGB(RGB: vec3<f32>) -> vec3<f32> {
  // convert an array of linear-light sRGB values in the range 0.0-1.0
  // to gamma corrected form
  // https://en.wikipedia.org/wiki/SRGB
  // Extended transfer function:
  // For negative values, linear portion extends on reflection
  // of axis, then uses reflected pow below that
  let sign_per_channel = sign(RGB);
  let abs_RGB = abs(RGB);
  let non_linear_mask = abs_RGB > vec3<f32>(0.0031308);
  let non_linear_RGB = sign_per_channel * (1.055 * pow(RGB, vec3<f32>(1./2.4)) - 0.055);
  let linear_RGB = 12.92 * RGB;
  return select(linear_RGB, non_linear_RGB, non_linear_mask);
}

// From: https://nullprogram.com/blog/2018/07/31/
fn hash(v: u32) -> u32 {
    var x: u32 = v;
    x = x ^ (x >> 17u);
    x = x * 0xED5AD4BBu;
    x = x ^ (x >> 11u);
    x = x * 0xAC4C1B51u;
    x = x ^ (x >> 1u);
    x = x * 0x31848BABu;
    x = x ^ (x >> 14u);
    return x;
}

var<private> random_state: u32;

fn seed(v: u32) { random_state = v; }

fn random() -> u32 {
  random_state = hash(random_state);
  return random_state;
}

fn frandom() -> f32 { return f32(random()) / 0xFFFFFFFF.0; }

fn read_from_cmap(i: u32) -> vec3<u32> {
  let color = cmap.colors[i];
  let r = (color >>  0u) & 0xFFu;
  let g = (color >>  8u) & 0xFFu;
  let b = (color >> 16u) & 0xFFu;
  return vec3<u32>(r, g, b);
}

fn sample_from_cmap(c: f32) -> vec3<f32> {
  let float_index = c * (cmap.len - 1.0);
  let index_down = u32(floor(float_index));
  let index_up   = u32( ceil(float_index));
  let bias = fract(float_index);
  let color_down = vec3<f32>(read_from_cmap(index_down));
  let color_up   = vec3<f32>(read_from_cmap(index_up));
  return (color_down * (1.0 - bias) + color_up * bias) / 255.0;
}

fn apply_transform(p: vec2<f32>, transform: AffineTransform) -> vec2<f32> {
  return vec2<f32>(
    transform.a * p.x + transform.b * p.y + transform.c,
    transform.d * p.x + transform.e * p.y + transform.f
  );
}

const PI = 3.1415926535897932384626433;

fn linear(p: vec2<f32>) -> vec2<f32> {
  return p;
}

fn sinusoidal(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(sin(p.x), sin(p.y));
}

fn spherical(p: vec2<f32>) -> vec2<f32> {
  return p / dot(p, p);
}

fn swirl(p: vec2<f32>) -> vec2<f32> {
  let r2 = dot(p, p);
  let a = vec2<f32>(sin(r2), cos(r2));
  let b = vec2<f32>(-cos(r2), sin(r2));
  return p.x * a + p.y * b;
}

fn horseshoe(p: vec2<f32>) -> vec2<f32> {
  let r = length(p);
  return vec2<f32>(
    (p.x - p.y) * (p.x + p.y),
    2.0 * p.x * p.y
  ) / r;
}

fn polar(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(atan2(p.x, p.y) / PI, length(p) - 1.0);
}

fn handkerchief(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return r * vec2<f32>(sin(theta + r), cos(theta - r));
}

fn heart(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return r * vec2<f32>(sin(theta * r), -cos(theta * r));
}

fn disc(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  let pi_r = PI * r;
  return theta / PI * vec2<f32>(sin(pi_r), cos(pi_r));
}

fn spiral(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return vec2<f32>(
    cos(theta) + sin(r),
    sin(theta) - cos(r)
  ) / r;
}

fn hyperbolic(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return vec2<f32>(sin(theta) / r, r * cos(theta));
}

fn diamond(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return vec2<f32>(
    sin(theta) * cos(r),
    cos(theta) * sin(r)
  );
}

fn ex(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  let p0 = sin(theta + r);
  let p1 = cos(theta - r);
  let p0_3 = p0 * p0 * p0;
  let p1_3 = p1 * p1 * p1;
  return r * vec2<f32>(p0_3 + p1_3, p0_3 - p1_3);
}

fn julia(p: vec2<f32>) -> vec2<f32> {
  let phi_over_two = atan2(p.x, p.y) / 2.0;
  let omega = f32((random() & 1u) == 0u) * PI;

  return sqrt(length(p)) * vec2<f32>(
    cos(phi_over_two + omega),
    sin(phi_over_two + omega)
  );
}

fn bent(p: vec2<f32>) -> vec2<f32> {
  if (p.x >= 0.0) {
    if (p.y >= 0.0) {
      return p;
    }
    return vec2<f32>(p.x, 0.5 * p.y);
  }
  if (p.y >= 0.0) {
    return vec2<f32>(2.0 * p.x, p.y);
  }
  return vec2<f32>(2.0 * p.x, 0.5 * p.y);
}

fn fisheye(p: vec2<f32>) -> vec2<f32> {
  return 2.0 / (length(p) + 1.0) * p.yx;
}

fn exponential(p: vec2<f32>) -> vec2<f32> {
  return exp(p.x - 1.0) * vec2<f32>(cos(PI * p.y), sin(PI * p.y));
}

fn power(p: vec2<f32>) -> vec2<f32> {
  let theta = atan2(p.x, p.y);
  let r = length(p);
  return pow(r, sin(theta)) * vec2<f32>(cos(theta), sin(theta));
}

fn cosine(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
     cos(PI * p.x) * cosh(p.y),
    -sin(PI * p.x) * sinh(p.y)
  );
}

fn eyefish(p: vec2<f32>) -> vec2<f32> {
  return 2.0 / (length(p) + 1.0) * p;
}

fn bubble(p: vec2<f32>) -> vec2<f32> {
  return 4.0 / (dot(p, p) + 4.0) * p;
}

fn cylinder(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(sin(p.x), p.y);
}

fn noise(p: vec2<f32>) -> vec2<f32> {
  let phi_1 = frandom();
  let phi_2 = 2.0 * PI * frandom();
  return phi_1 * p * vec2<f32>(cos(phi_2), sin(phi_2));
}

fn blur(p: vec2<f32>) -> vec2<f32> {
  let phi_1 = frandom();
  let phi_2 = 2.0 * PI * frandom();
  return phi_1 * vec2<f32>(cos(phi_2), sin(phi_2));
}

fn gaussian(p: vec2<f32>) -> vec2<f32> {
  // Summing 4 random numbers and subtracting 2 is an attempt at approximating a Gaussian distribution.
  let phi_sum = frandom() + frandom() + frandom() + frandom() - 2.0;
  let phi_5 = 2.0 * PI * frandom();
  return phi_sum * vec2<f32>(cos(phi_5), sin(phi_5));
}

fn arch(p: vec2<f32>) -> vec2<f32> {
  let phi = PI * frandom();
  let sin_phi = sin(phi);
  return vec2<f32>(sin_phi, sin_phi * sin_phi / cos(phi));
}

fn tangent(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(sin(p.x) / cos(p.y), tan(p.y));
}

fn square(p: vec2<f32>) -> vec2<f32> {
  let phi_1 = frandom();
  let phi_2 = frandom();
  return vec2<f32>(phi_1 - 0.5, phi_2 - 0.5);
}

fn rays(p: vec2<f32>) -> vec2<f32> {
  return tan(frandom() * PI) / dot(p, p) * vec2<f32>(cos(p.x), sin(p.y));
}

fn blade(p: vec2<f32>) -> vec2<f32> {
  let phi = length(p) * frandom();
  let cos_phi = cos(phi);
  let sin_phi = sin(phi);
  return p.x * vec2<f32>(cos_phi + sin_phi, cos_phi - sin_phi);
}

fn secant(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(p.x, 1.0 / cos(length(p)));
}

fn twintrian(p: vec2<f32>) -> vec2<f32> {
  let phi_r = frandom() * length(p);
  let sin_phi_r = sin(phi_r);
  let t = log(sin_phi_r * sin_phi_r) / log(10.0) + cos(phi_r);
  return p.x * vec2<f32>(t, t - PI * sin_phi_r);
}

fn _cross(p: vec2<f32>) -> vec2<f32> {
  let v = p.x * p.x - p.y * p.y;
  return sqrt(1.0 / v / v) * p;
}

fn apply_fn(variation_id: u32, p: vec2<f32>) -> vec2<f32> {
  switch (variation_id) {
    case  0u: { return linear(p);       }
    case  1u: { return sinusoidal(p);   }
    case  2u: { return spherical(p);    }
    case  3u: { return swirl(p);        }
    case  4u: { return horseshoe(p);    }
    case  5u: { return polar(p);        }
    case  6u: { return handkerchief(p); }
    case  7u: { return heart(p);        }
    case  8u: { return disc(p);         }
    case  9u: { return spiral(p);       }
    case 10u: { return hyperbolic(p);   }
    case 11u: { return diamond(p);      }
    case 12u: { return ex(p);           }
    case 13u: { return julia(p);        }
    case 14u: { return bent(p);         }
    case 16u: { return fisheye(p);      }
    case 18u: { return exponential(p);  }
    case 19u: { return power(p);        }
    case 20u: { return cosine(p);       }
    case 27u: { return eyefish(p);      }
    case 28u: { return bubble(p);       }
    case 29u: { return cylinder(p);     }
    case 31u: { return noise(p);        }
    case 34u: { return blur(p);         }
    case 35u: { return gaussian(p);     }
    case 41u: { return arch(p);         }
    case 42u: { return tangent(p);      }
    case 43u: { return square(p);       }
    case 44u: { return rays(p);         }
    case 45u: { return blade(p);        }
    case 46u: { return secant(p);       }
    case 47u: { return twintrian(p);    }
    case 48u: { return _cross(p);        }
    default: {}
  }
  // Dumb and unreachable
  return vec2<f32>(0.0, 0.0);
}

fn apply_xform(xform: XForm, p: vec2<f32>) -> vec2<f32> {
  return apply_fn(xform.variation_id, apply_transform(p, xform.transform));
}

fn next(p: vec3<f32>) -> vec3<f32> {
  let i = random() % fractal.size;
  let xform = fractal.xforms[i];
  let next_p = apply_xform(xform, p.xy);
  let next_c = (p.z + xform.color) / 2.0;
  return vec3<f32>(next_p, next_c);
}

fn plot(v: vec3<f32>) {
  let p = (v.xy - config.origin) * config.zoom;
  if (-1. <= p.x && p.x < 1. && -1. <= p.y && p.y < 1.) {
    let ipoint = vec2<u32>(
      u32((p.x + 1.) / 2. * f32(config.dimensions.x)),
      u32((p.y + 1.) / 2. * f32(config.dimensions.y))
    );
    let offset = 4u * (ipoint.y * config.dimensions.x + ipoint.x);

    let color = sample_from_cmap(v.z);
    let color_u32 = vec3<u32>(color * 255.0);
    atomicAdd(&stage1_histogram.data[offset + 0u], color_u32.r);
    atomicAdd(&stage1_histogram.data[offset + 1u], color_u32.g);
    atomicAdd(&stage1_histogram.data[offset + 2u], color_u32.b);
    atomicAdd(&stage1_histogram.data[offset + 3u], 1u);
  }
}
`

const histogram_max_wgsl = `
${common_code}
@compute @workgroup_size(1)
fn histogram_max(
  @builtin(global_invocation_id) invocation: vec3<u32>,
  @builtin(num_workgroups) invocation_size: vec3<u32>
) {
  // We are only using 1D invocations for now so...
  let CANVAS_SIZE = config.dimensions.x * config.dimensions.y;
  let BLOCK_SIZE = (CANVAS_SIZE + invocation_size.x - 1u) / invocation_size.x;
  let ITERATION_SIZE = min(BLOCK_SIZE * invocation.x + 1u, CANVAS_SIZE);
  var invocation_max: u32 = 0x0u;

  for (var i = BLOCK_SIZE * invocation.x; i < ITERATION_SIZE; i = i + 1u) {
    invocation_max = max(invocation_max, stage2_histogram.data[i].a);
  }

  atomicMax(&stage2_histogram.max, invocation_max);
}
`

const add_points_wgsl = `
${common_code}
// Rotate a point around center
fn rotate_point(p: vec2<f32>, angle: f32, cx: f32, cy: f32) -> vec2<f32> {
  let p_translated = vec2<f32>(p.x - cx, p.y - cy);
  
  let cos_angle = cos(angle);
  let sin_angle = sin(angle);
  
  let xnew = p_translated.x * cos_angle - p_translated.y * sin_angle;
  let ynew = p_translated.x * sin_angle + p_translated.y * cos_angle;
  
  return vec2<f32>(xnew + cx, ynew + cy);
}

// FIXME: Tune the workgroup size
@compute @workgroup_size(1)
fn add_points(
  @builtin(global_invocation_id) invocation: vec3<u32>
) {
  seed(hash(config.frame) ^ hash(invocation.x));
  var point = vec3<f32>(
    frandom() * 2. - 1.,
    frandom() * 2. - 1.,
    frandom()
  );

  // Initial iterations to stabilize
  for (var i = 0; i < 20; i = i + 1) { 
    point = next(point); 
  }
  
  // Main iterations with plotting
  for (var i = 0; i < 100; i = i + 1) {
    point = next(point);
    
    // Make a copy for transformations
    var transformed_point = vec3<f32>(point.xy, point.z);
    
    // Apply final transform if configured
    if (config.final_xform >= 0 && config.final_xform < i32(fractal.size)) {
      let xform = fractal.xforms[config.final_xform];
      transformed_point = vec3<f32>(apply_xform(xform, transformed_point.xy), transformed_point.z);
    }
    
    // Apply final color if configured
    if (config.cfinal_xform >= 0 && config.cfinal_xform < i32(fractal.size)) {
      let xform = fractal.xforms[config.cfinal_xform];
      transformed_point.z = (transformed_point.z + xform.color) / 2.0;
    }
    
    // Apply mirroring
    if (config.mirrorX != 0u && config.mirrorY == 0u) {
      if (i % 2 == 0) {
        transformed_point.y *= -1.0;
      }
    } else if (config.mirrorY != 0u && config.mirrorX == 0u) {
      if (i % 2 == 0) {
        transformed_point.x *= -1.0;
      }
    } else if (config.mirrorX != 0u && config.mirrorY != 0u) {
      let mod_value = i % 4;
      if (mod_value == 0) {
        transformed_point.x *= -1.0;
      } else if (mod_value == 1) {
        transformed_point.x *= -1.0;
        transformed_point.y *= -1.0;
      } else if (mod_value == 2) {
        transformed_point.y *= -1.0;
      }
    }
    
    // Apply rotation
    if (config.rotation > 1.0) {
      let current_rot = f32(i) * (2.0 * 3.14159265359 / config.rotation);
      transformed_point = vec3<f32>(
        rotate_point(transformed_point.xy, current_rot, 0.0, 0.0),
        transformed_point.z
      );
    }
    
    plot(transformed_point);
  }
}
`

const vertex_wgsl =`
@vertex
fn vertex_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 4>(  
    // Upper Triangle
    vec2<f32>( 1.,  1.),
    vec2<f32>(-1.,  1.),
    vec2<f32>( 1., -1.),
    vec2<f32>(-1., -1.)
  );

  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
`

const histogram_fragment_wgsl = `
${common_code}

// Convert RGB to HSL
fn rgb2hsl(rgb: vec3<f32>) -> vec3<f32> {
  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;
  
  let max_val = max(max(r, g), b);
  let min_val = min(min(r, g), b);
  let diff = max_val - min_val;
  
  // Calculate lightness
  let l = (max_val + min_val) / 2.0;
  
  // Calculate saturation
  var s = 0.0;
  if (l > 0.0 && l < 1.0) {
    s = diff / (1.0 - abs(2.0 * l - 1.0));
  }
  
  // Calculate hue
  var h = 0.0;
  if (diff > 0.0) {
    if (max_val == r) {
      if (g < b) {
        h = (g - b) / diff + 6.0;
      } else {
        h = (g - b) / diff;
      }
    } else if (max_val == g) {
      h = (b - r) / diff + 2.0;
    } else { // max_val == b
      h = (r - g) / diff + 4.0;
    }
    h = h / 6.0;
  }
  
  return vec3<f32>(h, s, l);
}

// Convert HSL to RGB
fn hsl2rgb(hsl: vec3<f32>) -> vec3<f32> {
  let h = hsl.x;
  let s = hsl.y;
  let l = hsl.z;
  
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  
  // Calculate x without using fract()
  let h_times_6 = h * 6.0;
  let h_segment = floor(h_times_6);
  let h_remainder = h_times_6 - h_segment;
  let x = c * (1.0 - abs(2.0 * h_remainder - 1.0));
  
  let m = l - c / 2.0;
  
  var rgb: vec3<f32>;
  
  // Use the h_segment (0-5) to determine which section of the color wheel we're in
  let h_section = i32(h_segment) % 6;
  
  if (h_section == 0) {
    rgb = vec3<f32>(c, x, 0.0);
  } else if (h_section == 1) {
    rgb = vec3<f32>(x, c, 0.0);
  } else if (h_section == 2) {
    rgb = vec3<f32>(0.0, c, x);
  } else if (h_section == 3) {
    rgb = vec3<f32>(0.0, x, c);
  } else if (h_section == 4) {
    rgb = vec3<f32>(x, 0.0, c);
  } else {
    rgb = vec3<f32>(c, 0.0, x);
  }
  
  return rgb + m;
}

// Apply HSL adjustments
fn apply_hsl_adjustments(color: vec3<f32>, hue_shift: f32, sat_shift: f32, light_shift: f32) -> vec3<f32> {
  let hsl = rgb2hsl(color);
  
  // Apply hue shift (wrapping around 0-1)
  var new_hue = hsl.x + hue_shift;
  
  // Ensure new_hue is between 0 and 1 (wrap around)
  new_hue = new_hue - floor(new_hue);
  if (new_hue < 0.0) {
    new_hue = new_hue + 1.0;
  }
  
  // Apply saturation shift (clamping to 0-1)
  let new_sat = clamp(hsl.y + sat_shift, 0.0, 1.0);
  
  // Apply lightness shift (clamping to 0-1)
  let new_light = clamp(hsl.z + light_shift, 0.0, 1.0);
  
  return hsl2rgb(vec3<f32>(new_hue, new_sat, new_light));
}

@fragment
fn fragment_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let point = vec2<u32>(
    u32(pos.x),
    u32(pos.y)
  );
  let i = point.y * config.dimensions.y + point.x;
  let values = vec4<f32>(fragment_histogram.data[i]);
  let log_max_a = log(f32(fragment_histogram.max));
  let color = values.rgb / 255.0 / values.a;
  
  // Apply custom gamma
  let gamma = max(config.gamma, 0.1); // Avoid division by zero
  let alpha = pow(log(values.a) / log_max_a, 1.0/gamma);
  
  // Apply HSL adjustments
  let adjusted_color = apply_hsl_adjustments(
    color.rgb, 
    config.hueShift, 
    config.satShift, 
    config.lightShift
  );
  
  return vec4<f32>(gam_sRGB(adjusted_color) * alpha, 1.0);
}
`

const gui_fragment_wgsl = `
${common_code}

fn in_line(p: vec2<f32>, _from: vec2<f32>, to: vec2<f32>, width: f32) -> bool {
  // src: https://iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
  let pa = p - _from;
  let ba = to - _from;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  let dist = length(pa - ba * h);
  return dist < width / config.zoom / 2.0;
}

fn in_circle(p: vec2<f32>, center: vec2<f32>, radius: f32) -> bool {
  return length(p - center) < radius / config.zoom;
}

@fragment
fn fragment_main(@builtin(position) screen_pos: vec4<f32>) -> @location(0) vec4<f32> {
  let dimensions = vec2<f32>(config.dimensions);
  let p = (screen_pos.xy / dimensions * 2.0 - vec2<f32>(1.0)) / config.zoom + config.origin;

  for (var i = 0u; i < fractal.size; i = i + 1u) {
    let color = fractal.xforms[i].color;
    let xform = fractal.xforms[i].transform;
    let p00 = vec2<f32>(xform.c, xform.f);
    let p01 = vec2<f32>(xform.b, xform.e) + p00;
    let p10 = vec2<f32>(xform.a, xform.d) + p00;
    if (in_circle(p, p01, 0.03) || in_circle(p, p10, 0.03)) {
      return vec4<f32>(0.0); // Black (Transparent)
    }
    if (in_circle(p, p00, 0.05)) {
      return vec4<f32>(sample_from_cmap(color), 0.3); // XForm color (Translucent)
    }
    if (in_circle(p, p00, 0.06) || in_circle(p, p01, 0.04) || in_circle(p, p10, 0.04) || in_line(p, p00, p01, 0.01) || in_line(p, p00, p10, 0.01) || in_line(p, p10, p01, 0.01)) {
      return vec4<f32>(sample_from_cmap(color), 1.0); // XForm color
    }
  }
  return vec4<f32>(0.0); // Black (Transparent)
}
`

function project(line, point) {
  const delta_x = line.from_x - line.to_x
  const delta_y = line.from_y - line.to_y
  const squared_length = (delta_x**2 + delta_y**2)
  const k = ((point.x - line.to_x) * delta_x + (point.y - line.to_y) * delta_y) / squared_length
  return {
    x: delta_x * k + line.to_x,
    y: delta_y * k + line.to_y
  }
}

function intersect(l1, l_2) {
  const l1_delta_x = l1.from_x - l1.to_x
  const l1_delta_y = l1.from_y - l1.to_y
  const l2_delta_x = l_2.from_x - l_2.to_x
  const l2_delta_y = l_2.from_y - l_2.to_y
  const l1_k = l1.from_x * l1.to_y - l1.from_y * l1.to_x
  const l2_k = l_2.from_x * l_2.to_y - l_2.from_y * l_2.to_x
  const d = l1_delta_x * l2_delta_y - l1_delta_y * l2_delta_x
  return  {
    x: (l1_k * l2_delta_x - l2_k * l1_delta_x) / d,
    y: (l1_k * l2_delta_y - l2_k * l1_delta_y) / d
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

const init = async (canvas, starts_running = true) => {
  if (navigator.gpu === undefined) {
    console.error('WebGPU is not supported (or not enabled)')
    document.getElementById('webgpu-not-supported-error').style = ''
    return
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  const adapter = await navigator.gpu.requestAdapter()
  if (adapter === null) {
    console.error('No WebGPU device is available')
    document.getElementById('webgpu-no-device-error').style = ''
  }
  const device = await adapter.requestDevice()

  const context = canvas.getContext('webgpu')

  context.configure({
    device,
    format: format,
    alphaMode: "premultiplied"
  })

  const add_points_module = device.createShaderModule({
      label: 'FLAM3 > Module > Add Points',
      code: add_points_wgsl
  })
  const histogram_max_module = device.createShaderModule({
      label: 'FLAM3 > Module > Hisogram Max',
      code: histogram_max_wgsl
  })
  const vertex_module = device.createShaderModule({
      label: 'FLAM3 > Module > Vertex',
      code: vertex_wgsl
  })
  const histogram_fragment_module = device.createShaderModule({
      label: 'FLAM3 > Module > Histogram Fragment',
      code: histogram_fragment_wgsl
  })
  const gui_fragment_module = device.createShaderModule({
      label: 'FLAM3 > Module > Histogram Fragment',
      code: gui_fragment_wgsl
  })

  const fractalBindGroupLayout = device.createBindGroupLayout({
      label: 'FLAM3 > Bind Group Layout > Fractal',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' }
        }
      ]
  })

  const guiBindGroupLayout = device.createBindGroupLayout({
      label: 'FLAM3 > Bind Group Layout > GUI',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        }
      ]
  })

  const fractalPipelineLayout = device.createPipelineLayout({
    label: 'FLAM3 > Pipeline Layout > Fractal',
    bindGroupLayouts: [fractalBindGroupLayout]
  })
  const guiPipelineLayout = device.createPipelineLayout({
    label: 'FLAM3 > Pipeline Layout > GUI',
    bindGroupLayouts: [fractalBindGroupLayout, guiBindGroupLayout]
  })

  const HISTOGRAM_BUFFER_SIZE = 4 + 3 * 4 + 4 * 4 * 900 * 900
  const histogramBuffer = device.createBuffer({
    label: 'FLAM3 > Buffer > Histogram',
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  })
  const cleanHistogramBuffer = device.createBuffer({
    label: 'FLAM3 > Buffer > Clean Histogram',
    size: HISTOGRAM_BUFFER_SIZE,
    usage: GPUBufferUsage.COPY_SRC
  })
  const fractalBuffer = device.createBuffer({
    label: 'FLAM3 > Buffer > Fractal',
    size: Fractal.SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  })
  const configBuffer = device.createBuffer({
    label: 'FLAM3 > Buffer > Configuration',
    size: 84, // Must be a multiple of 16 bytes for WebGPU alignment requirements
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  const cmapBuffer = device.createBuffer({
    label: 'FLAM3 > Buffer > CMap',
    size: CMap.SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  })

  const fractalBindGroup = device.createBindGroup({
    label: 'FLAM3 > Group Binding > Fractal',
    layout: fractalBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          label: 'FLAM3 > Group Binding > Fractal > Histogram',
          buffer: histogramBuffer
        }
      },
      {
        binding: 1,
        resource: {
          label: 'FLAM3 > Group Binding > Fractal > Fractal',
          buffer: fractalBuffer
        }
      },
      {
        binding: 2,
        resource: {
          label: 'FLAM3 > Group Binding > Fractal > Configuration',
          buffer: configBuffer
        }
      },
      {
        binding: 3,
        resource: {
          label: 'FLAM3 > Group Binding > Fractal > CMap',
          buffer: cmapBuffer
        }
      }
    ]
  })

  const addPointsPipeline = await device.createComputePipelineAsync({
      label: 'FLAM3 > Pipeline > Add points',
      layout: fractalPipelineLayout,
      compute: {
          module: add_points_module,
          entryPoint: 'add_points'
      },
  })

  const histogramMaxPipeline = await device.createComputePipelineAsync({
      label: 'FLAM3 > Pipeline > Histogram Max',
      layout: fractalPipelineLayout,
      compute: {
          module: histogram_max_module,
          entryPoint: 'histogram_max'
      },
  })

  const renderPipeline = await device.createRenderPipelineAsync({
    label: 'FLAM3 > Pipeline > Render',
    layout: fractalPipelineLayout,
    vertex: {
      layout: fractalPipelineLayout,
      module: vertex_module,
      entryPoint: 'vertex_main',
    },
    fragment: {
      layout: fractalPipelineLayout,
      module: histogram_fragment_module,
      entryPoint: 'fragment_main',
      targets: [{ format }]
    },
    primitive: {
      topology: 'triangle-strip',
      stripIndexFormat: 'uint32'
    }
  })

  const guiPipeline = await device.createRenderPipelineAsync({
    label: 'FLAM3 > Pipeline > GUI',
    layout: fractalPipelineLayout,
    vertex: {
      layout: fractalPipelineLayout,
      module: vertex_module,
      entryPoint: 'vertex_main',
    },
    fragment: {
      layout: fractalPipelineLayout,
      module: gui_fragment_module,
      entryPoint: 'fragment_main',
      targets: [{
        format,
        blend: {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha'
          }
        }
      }]
    },
    primitive: {
      topology: 'triangle-strip',
      stripIndexFormat: 'uint32'
    }
  })

  const config = window.config = new Config
  config.width = canvas.width
  config.height = canvas.height
  config.zoom = 0.7  // Default zoom out a bit
  config.gamma = 2.2
  config.final = -1
  config.cfinal = -1
  config.rotation = 1
  config.mirrorX = false
  config.mirrorY = false
  config.hueShift = 0
  config.satShift = 0
  config.lightShift = 0
  config.animationSpeed = 0.1  // 10% speed by default
  config.numPoints = 30000  // Default number of points

  const fractal = new Fractal
  //fractal.add({ variation: 'Sinusoidal', color: 0, a: 0.5, b:  0.0, c:  0.5, d:  0.0, e: 0.5, f:  0.5 })
  //fractal.add({ variation: 'Sinusoidal', color: 0, a: 0.5, b:  0.0, c: -0.5, d:  0.0, e: 0.5, f:  0.5 })
  //fractal.add({ variation: 'Sinusoidal', color: 0, a: 0.5, b:  0.0, c:  0.0, d:  0.0, e: 0.5, f: -0.5 })
  //fractal.add({ variation: 'Linear',     color: 0, a: 0.0, b:  0.8, c:  0.0, d:  0.6, e: 0.0, f:  0.0 })
  //fractal.add({ variation: 'Linear',     color: 0, a: 0.0, b: -0.8, c:  0.0, d: -0.6, e: 0.0, f:  0.0 })

  //fractal.add({ variation: 'Eyefish', color: 0, a:  0.321636, b: -0.204179, c: -0.633718, d:  0.204179, e:  0.321637, f:  1.140693 })
  //fractal.add({ variation: 'Eyefish', color: 0, a:  0.715673, b: -0.418864, c:  0.576108, d:  0.418864, e:  0.715673, f:  0.455125 })
  //fractal.add({ variation: 'Eyefish', color: 1, a: -0.212317, b:  0.536045, c:  0.53578,  d: -0.536045, e: -0.212317, f: -0.743179 })
  //fractal.add({ variation: 'Linear',  color: 1, a:  0.7,      b:  0.0,      c:  0.0,      d:  0.0,      e:  0.7,      f:  0.0      })
  fractal.add({ variation: 'Linear', color: 0, a:  0.5, b: 0, c:    0, d: 0, e:  0.5, f: -0.5, animateX: false, animateY: false })
  fractal.add({ variation: 'Linear', color: 0, a:  0.5, b: 0, c: -0.5, d: 0, e:  0.5, f:  0.5, animateX: false, animateY: false })
  fractal.add({ variation: 'Sinusoidal', color: 1, a:  0.5, b: 0, c:  0.5, d: 0, e:  0.5, f:  0.5, animateX: false, animateY: false })
  fractal.add({ variation: 'Linear', color: 0, a: -2,   b: 0, c:    0, d: 0, e: -2,   f:    0, animateX: false, animateY: false })

  const cmap = new CMap

  class XFormEditor {
    constructor(xform, xform_list) {
      this.xform = xform
      this.current_drag_data = undefined
      this.currently_dragging = undefined
      this.editor = null
      
      // Store original positions for animation
      this.original_a = xform.a
      this.original_b = xform.b
      this.original_d = xform.d
      this.original_e = xform.e

      // Try to create DOM element if possible
      try {
        const elem = document.createElement('xform-editor')
        elem.setAttribute('variation', xform.variation)
        elem.setAttribute('a', xform.a.toFixed(2))
        elem.setAttribute('b', xform.b.toFixed(2))
        elem.setAttribute('c', xform.c.toFixed(2))
        elem.setAttribute('d', xform.d.toFixed(2))
        elem.setAttribute('e', xform.e.toFixed(2))
        elem.setAttribute('f', xform.f.toFixed(2))
        elem.setAttribute('color', xform.color)
        elem.setAttribute('animateX', xform.animateX)
        elem.setAttribute('animateY', xform.animateY)
        
        // Only set up DOM handlers if shadowRoot exists
        if (elem.shadowRoot) {
          const selectElem = elem.shadowRoot.querySelector('select')
          if (selectElem) {
            selectElem.onchange = ev => {
              this.xform.variation = ev.currentTarget.value
              flam3.clear()
            }
          }
          
          const colorInput = elem.shadowRoot.querySelector('input[name="color"]')
          if (colorInput) {
            colorInput.oninput = ev => {
              this.xform.color = Number.parseFloat(ev.currentTarget.value)
              flam3.clear()
            }
          }
          
          const animateXInput = elem.shadowRoot.querySelector('input[name="animateX"]')
          if (animateXInput) {
            animateXInput.onchange = ev => {
              this.xform.animateX = ev.currentTarget.checked
              
              // Store original values when animation is enabled
              if (ev.currentTarget.checked) {
                this.original_a = this.xform.a
                this.original_d = this.xform.d
              }
              
              flam3.clear()
            }
            animateXInput.checked = xform.animateX
          }
          
          const animateYInput = elem.shadowRoot.querySelector('input[name="animateY"]')
          if (animateYInput) {
            animateYInput.onchange = ev => {
              this.xform.animateY = ev.currentTarget.checked
              
              // Store original values when animation is enabled
              if (ev.currentTarget.checked) {
                this.original_b = this.xform.b
                this.original_e = this.xform.e
              }
              
              flam3.clear()
            }
            animateYInput.checked = xform.animateY
          }
          
          const removeButton = elem.shadowRoot.querySelector('button')
          if (removeButton) {
            removeButton.onclick = _ => {
              this.remove(fractal)
            }
          }
        }
        
        if (xform_list) {
          xform_list.appendChild(elem)
        }
        this.editor = elem
      } catch (error) {
        // If DOM creation fails, continue without DOM element but with canvas interaction
        console.log('XFormEditor DOM creation failed, continuing with canvas interaction only:', error)
      }
    }

    pointer_down(point) {
      const p00_x = this.xform.c
      const p00_y = this.xform.f
      const p01_x = this.xform.b + p00_x
      const p01_y = this.xform.e + p00_y
      const p10_x = this.xform.a + p00_x
      const p10_y = this.xform.d + p00_y
      
           if (in_circle(point, p00_x, p00_y, 0.15, config.zoom)) { 
             this.currently_dragging = 'ring00';
           }
      else if (in_circle(point, p01_x, p01_y, 0.12, config.zoom)) { 
             this.currently_dragging = 'ring01';
           }
      else if (in_circle(point, p10_x, p10_y, 0.12, config.zoom)) { 
             this.currently_dragging = 'ring10';
           }
      else if (in_line(point, p10_x, p10_y, p01_x, p01_y, 0.01, config.zoom)) { this.currently_dragging = 'line_10_01' }
      else if (in_line(point, p00_x, p00_y, p01_x, p01_y, 0.01, config.zoom)) { this.currently_dragging = 'line_00_01' }
      else if (in_line(point, p00_x, p00_y, p10_x, p10_y, 0.01, config.zoom)) { this.currently_dragging = 'line_00_10' }
      
      if (this.currently_dragging === 'line_10_01') {
        this.current_drag_data = {
          // Cache the triangle shape so we can avoid divide-by-zero issues :)
          line_00_01: { from_x: p00_x, from_y: p00_y, to_x: p01_x, to_y: p01_y },
          line_00_10: { from_x: p00_x, from_y: p00_y, to_x: p10_x, to_y: p10_y },
          line_10_01: { from_x: p10_x, from_y: p10_y, to_x: p01_x, to_y: p01_y },
        }
      }
      
      return this.currently_dragging !== undefined;
    }
    pointer_up() {
      this.currently_dragging = undefined
      this.current_drag_data = undefined
    }
    pointer_move(point) {
      if (this.currently_dragging === undefined) return false
      const p00_x = this.xform.c
      const p00_y = this.xform.f
      const p01_x = this.xform.b + p00_x
      const p01_y = this.xform.e + p00_y
      const p10_x = this.xform.a + p00_x
      const p10_y = this.xform.d + p00_y
      // Translate the whole thing
      if (this.currently_dragging === 'ring00') {
        this.c = point.x
        this.f = point.y
      }
      // Translate the (0, 1) point
      if (this.currently_dragging === 'ring01') {
        this.b = point.x - this.xform.c
        this.e = point.y - this.xform.f
      }
      // Translate the (1, 0) point
      if (this.currently_dragging === 'ring10') {
        this.a = point.x - this.xform.c
        this.d = point.y - this.xform.f
      }
      // Scale the triangle
      if (this.currently_dragging === 'line_10_01') {
        //
        // 10'----A------------P-01'
        //  \     ^            ^ /
        //   \    |            |/
        //    \   |            |
        //     \  |           /|
        //      \ |          / |
        //       \|         /  |
        //       10--------01--P'
        //         \      /
        //          \    /
        //           \  /
        //            00
        const P_prime = project(this.current_drag_data.line_10_01, point)
        const P_to_P_prime = {
          x: point.x - P_prime.x,
          y: point.y - P_prime.y
        }
        const A_to_P = {
          from_x: this.current_drag_data.line_10_01.from_x + P_to_P_prime.x,
          from_y: this.current_drag_data.line_10_01.from_y + P_to_P_prime.y,
          to_x:   point.x,
          to_y:   point.y
        }
        const p10_prime = intersect(this.current_drag_data.line_00_10, A_to_P)
        const p01_prime = intersect(this.current_drag_data.line_00_01, A_to_P)

        if (isFinite(p10_prime.x) && isFinite(p10_prime.y) && isFinite(p01_prime.x) && isFinite(p01_prime.y)) {
          this.a = p10_prime.x - this.xform.c
          this.b = p01_prime.x - this.xform.c
          this.d = p10_prime.y - this.xform.f
          this.e = p01_prime.y - this.xform.f
        }
      }
      if (this.currently_dragging === 'line_00_01') {
        const p00_A_x  = point.x - p00_x
        const p00_A_y  = point.y - p00_y
        const p00_01_x = p00_x - p01_x
        const p00_01_y = p00_y - p01_y
        const p00_10_x = p00_x - p10_x
        const p00_10_y = p00_y - p10_y
        const squared_length_p00_A  = p00_A_x  ** 2 + p00_A_y  ** 2
        const squared_length_p00_01 = p00_01_x ** 2 + p00_01_y ** 2
        const dot_product = p00_A_x * p00_01_x + p00_A_y * p00_01_y
        const cos_alpha = clamp(dot_product / Math.sqrt(squared_length_p00_A * squared_length_p00_01), -1, 1)
        const sign = Math.sign(p00_01_x * p00_A_y - p00_A_x * p00_01_y)
        const alpha = Math.acos(cos_alpha)
        const sin_alpha = Math.sin(alpha) * sign
        this.a = cos_alpha * p00_10_x - sin_alpha * p00_10_y
        this.b = cos_alpha * p00_01_x - sin_alpha * p00_01_y
        this.d = sin_alpha * p00_10_x + cos_alpha * p00_10_y
        this.e = sin_alpha * p00_01_x + cos_alpha * p00_01_y
      }
      if (this.currently_dragging === 'line_00_10') {
        const p00_A_x  = point.x - p00_x
        const p00_A_y  = point.y - p00_y
        const p00_01_x = p00_x - p01_x
        const p00_01_y = p00_y - p01_y
        const p00_10_x = p00_x - p10_x
        const p00_10_y = p00_y - p10_y
        const squared_length_p00_A  = p00_A_x  ** 2 + p00_A_y  ** 2
        const squared_length_p00_10 = p00_10_x ** 2 + p00_10_y ** 2
        const dot_product = p00_A_x * p00_10_x + p00_A_y * p00_10_y
        const cos_alpha = clamp(dot_product / Math.sqrt(squared_length_p00_A * squared_length_p00_10), -1, 1)
        const sign = Math.sign(p00_10_x * p00_A_y - p00_A_x * p00_10_y)
        const alpha = Math.acos(cos_alpha)
        const sin_alpha = Math.sin(alpha) * sign
        this.a = cos_alpha * p00_10_x - sin_alpha * p00_10_y
        this.b = cos_alpha * p00_01_x - sin_alpha * p00_01_y
        this.d = sin_alpha * p00_10_x + cos_alpha * p00_10_y
        this.e = sin_alpha * p00_01_x + cos_alpha * p00_01_y
      }
      flam3.clear()
      return true
    }

    set variation(value) {
      this.xform.variation = value
      this.editor.setAttribute('variation', value)
    }
    set a(value) {
      this.xform.a = value
      this.editor.setAttribute('a', value.toFixed(2))
    }
    set b(value) {
      this.xform.b = value
      this.editor.setAttribute('b', value.toFixed(2))
    }
    set c(value) {
      this.xform.c = value
      this.editor.setAttribute('c', value.toFixed(2))
    }
    set d(value) {
      this.xform.d = value
      this.editor.setAttribute('d', value.toFixed(2))
    }
    set e(value) {
      this.xform.e = value
      this.editor.setAttribute('e', value.toFixed(2))
    }
    set f(value) {
      this.xform.f = value
      this.editor.setAttribute('f', value.toFixed(2))
    }

    remove(fractal) {
      fractal.remove(this.xform)
      this.editor.remove()
      gui.splice(gui.findIndex(v => v === this), 1)
      flam3.clear()
    }

    // Animation update method
    updateAnimation(frame) {
      const baseAnimationSpeed = 0.02 // Base speed of rotation
      const time = frame * baseAnimationSpeed * config.animationSpeed
      
      if (this.xform.animateX) {
        // Rotate X vector around origin - use smooth animation with requestAnimationFrame timing
        const radius = Math.sqrt(this.original_a * this.original_a + this.original_d * this.original_d)
        const originalAngle = Math.atan2(this.original_d, this.original_a)
        const angle = originalAngle + time
        
        // Use precise trigonometric calculations to avoid cumulative errors
        this.a = Number((radius * Math.cos(angle)).toFixed(6))
        this.d = Number((radius * Math.sin(angle)).toFixed(6))
      }
      
      if (this.xform.animateY) {
        // Rotate Y vector around origin - use smooth animation with requestAnimationFrame timing
        const radius = Math.sqrt(this.original_b * this.original_b + this.original_e * this.original_e)
        const originalAngle = Math.atan2(this.original_e, this.original_b)
        const angle = originalAngle + time
        
        // Use precise trigonometric calculations to avoid cumulative errors
        this.b = Number((radius * Math.cos(angle)).toFixed(6))
        this.e = Number((radius * Math.sin(angle)).toFixed(6))
      }
    }

    set animateX(value) {
      this.xform.animateX = value
      this.editor.setAttribute('animateX', value)
    }

    set animateY(value) {
      this.xform.animateY = value
      this.editor.setAttribute('animateY', value)
    }
  }

  const gui = []
  
  // Initialize XFormEditors after DOM is ready
  const initializeXFormEditors = () => {
    const xform_list = document.getElementById('xforms')
    
    // Clear existing XForm editors (keep default_controls which should be last)
    while (gui.length > 1) {
      const editor = gui.shift()
      if (editor.editor) {
        editor.editor.remove()
      }
    }
    
    // Create editors for existing transforms and insert them at the beginning
    // Always create the editors for canvas interaction, regardless of DOM visibility
    for (let i = fractal.length - 1; i >= 0; i--) {
      gui.unshift(new XFormEditor(fractal[i], xform_list))
    }
    
    // Set up add button if it exists
    const addButton = document.getElementById('add-xform')
    if (addButton) {
      addButton.onclick = () => {
        const xform = fractal.add({ 
          variation: 'Linear', 
          color: 0, 
          a: 1, b: 0, c: 0, d: 0, e: 1, f: 0,
          animateX: false,
          animateY: false
        })
        // Insert new XForm editor at the beginning (before default_controls at the end)
        gui.unshift(new XFormEditor(xform, xform_list))
        flam3.clear()
      }
    }
  }
  
  // Initialize editors immediately for canvas interaction
  initializeXFormEditors()

  let running = starts_running
  let lastFrameTime = 0; // Track last frame time for smoother animation
  
  function frame(timestamp) {
    // Calculate delta time for smoother animation
    const deltaTime = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0.016; // Default to ~60fps
    lastFrameTime = timestamp;
    
    const commandBuffers = []
    let num_passes = 0
    function with_encoder(action) {
      const commandEncoder = device.createCommandEncoder()
      action(commandEncoder)
      num_passes++
      commandBuffers.push(commandEncoder.finish())
    }

    if (should_clear_histogram) {
      with_encoder(commandEncoder => {
        commandEncoder.copyBufferToBuffer(cleanHistogramBuffer, 0, histogramBuffer, 0, HISTOGRAM_BUFFER_SIZE)
      })
      should_clear_histogram = false
    }
    ++config.frame
    
    // Update animations for all XForm editors
    let hasAnimatedTransforms = false;
    for (let i = 0; i < gui.length; i++) {
      const editor = gui[i]
      if (editor.updateAnimation) {
        if (editor.xform.animateX || editor.xform.animateY) {
          hasAnimatedTransforms = true;
          editor.updateAnimation(config.frame)
        }
      }
    }
    
    // Fallback animation system for when no GUI editors exist
    if (gui.length === 0 || !hasAnimatedTransforms) {
      for (let i = 0; i < fractal.length; i++) {
        const xform = fractal[i];
        if (xform.animateX || xform.animateY) {
          hasAnimatedTransforms = true;
          
          // Create animation state if it doesn't exist
          if (!xform._animationState) {
            xform._animationState = {
              originalA: xform.a,
              originalB: xform.b,
              originalD: xform.d,
              originalE: xform.e
            };
          }
          
          const baseAnimationSpeed = 0.02;
          const time = config.frame * baseAnimationSpeed * config.animationSpeed;
          
          if (xform.animateX) {
            const radius = Math.sqrt(xform._animationState.originalA * xform._animationState.originalA + 
                                   xform._animationState.originalD * xform._animationState.originalD);
            const originalAngle = Math.atan2(xform._animationState.originalD, xform._animationState.originalA);
            const angle = originalAngle + time;
            
            xform.a = Number((radius * Math.cos(angle)).toFixed(6));
            xform.d = Number((radius * Math.sin(angle)).toFixed(6));
          }
          
          if (xform.animateY) {
            const radius = Math.sqrt(xform._animationState.originalB * xform._animationState.originalB + 
                                   xform._animationState.originalE * xform._animationState.originalE);
            const originalAngle = Math.atan2(xform._animationState.originalE, xform._animationState.originalB);
            const angle = originalAngle + time;
            
            xform.b = Number((radius * Math.cos(angle)).toFixed(6));
            xform.e = Number((radius * Math.sin(angle)).toFixed(6));
          }
        } else {
          // Clear animation state when not animating
          if (xform._animationState) {
            delete xform._animationState;
          }
        }
      }
    }
    
    // Clear histogram on each frame if there are animated transforms to prevent blur
    if (hasAnimatedTransforms) {
      should_clear_histogram = true;
    }
    
    device.queue.writeBuffer(configBuffer,  0, config.buffer,  0)
    device.queue.writeBuffer(fractalBuffer, 0, fractal.buffer, 0)

    // Add some points to the histogram
    with_encoder(commandEncoder => {
      const passEncoder = commandEncoder.beginComputePass({
        label: 'FLAM3 > Pass > Add points'
      })
      passEncoder.setBindGroup(0, fractalBindGroup)
      passEncoder.setPipeline(addPointsPipeline)
      passEncoder.dispatchWorkgroups(config.numPoints)
      passEncoder.end()
    })

    // Find the max of the histogram
    with_encoder(commandEncoder => {
      const passEncoder = commandEncoder.beginComputePass({
        label: 'FLAM3 > Pass > Histogram Max'
      })
      passEncoder.setBindGroup(0, fractalBindGroup)
      passEncoder.setPipeline(histogramMaxPipeline)
      passEncoder.dispatchWorkgroups(1000)
      passEncoder.end()
    })

    // Render the histogram
    with_encoder(commandEncoder => {
      const passEncoder = commandEncoder.beginRenderPass({
        label: 'FLAM3 > Pass > Render',
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      })
      passEncoder.setBindGroup(0, fractalBindGroup)
      passEncoder.setPipeline(renderPipeline)
      passEncoder.draw(4)
      passEncoder.end()
    })


    if (flam3.gui) {
      // Render the GUI
      with_encoder(commandEncoder => {
        const passEncoder = commandEncoder.beginRenderPass({
          label: 'FLAM3 > Pass > GUI',
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'load',
            storeOp: 'store'
          }]
        })
        passEncoder.setBindGroup(0, fractalBindGroup)
        passEncoder.setPipeline(guiPipeline)
        passEncoder.draw(4)
        passEncoder.end()
      })
    }

    device.queue.submit(commandBuffers)
    if (running) requestAnimationFrame(frame)
  }

  if (running) requestAnimationFrame(frame)

  let should_clear_histogram = false
  
  // Create a FractalFunctions instance to handle the fractal_example.js functionality
  const fractalFunctions = new FractalFunctions();
  
  const flam3 = {
    gui: true,
    fractal,
    config,
    fractalFunctions,
    get isRunning() { return running },
    set cmap(value) {
      cmap.copyFrom(cmaps[value])
      device.queue.writeBuffer(cmapBuffer, 0, cmap.buffer)
      flam3.clear()
    },
    stop()  { running = false },
    start() { 
      running = true; 
      lastFrameTime = 0; // Reset animation timing
      requestAnimationFrame(frame);
    },
    step()  { frame(performance.now()) },
    clear() {
      // FIXME: Clear the canvas
      should_clear_histogram = true
    },
    toggleAnimations(enable) {
      // If enable is undefined, determine based on current state
      if (enable === undefined) {
        // Check if any animations are currently active
        let hasActiveAnimations = false;
        for (let i = 0; i < fractal.length; i++) {
          if (fractal[i].animateX || fractal[i].animateY) {
            hasActiveAnimations = true;
            break;
          }
        }
        enable = !hasActiveAnimations;
      }
      
      if (enable) {
        // Restore saved animation states or use defaults
        for (let i = 0; i < fractal.length; i++) {
          if (fractal[i].savedAnimateX !== undefined) {
            fractal[i].animateX = fractal[i].savedAnimateX;
          }
          if (fractal[i].savedAnimateY !== undefined) {
            fractal[i].animateY = fractal[i].savedAnimateY;
          }
        }
      } else {
        // Save current animation states before clearing
        for (let i = 0; i < fractal.length; i++) {
          fractal[i].savedAnimateX = fractal[i].animateX;
          fractal[i].savedAnimateY = fractal[i].animateY;
          fractal[i].animateX = false;
          fractal[i].animateY = false;
        }
      }
      
      // Update all XFormEditor checkboxes
      for (let i = 0; i < gui.length; i++) {
        const editor = gui[i];
        if (editor.editor && editor.editor.shadowRoot) {
          const animateXCheckbox = editor.editor.shadowRoot.querySelector('input[name="animateX"]');
          const animateYCheckbox = editor.editor.shadowRoot.querySelector('input[name="animateY"]');
          if (animateXCheckbox) animateXCheckbox.checked = fractal[i] ? fractal[i].animateX : false;
          if (animateYCheckbox) animateYCheckbox.checked = fractal[i] ? fractal[i].animateY : false;
        }
      }
      
      // Update GPU buffers and clear
      device.queue.writeBuffer(fractalBuffer, 0, fractal.buffer, 0);
      flam3.clear();
      
      return enable; // Return the new state
    },
    
    // Helper function to check if animations are currently enabled
    hasActiveAnimations() {
      for (let i = 0; i < fractal.length; i++) {
        if (fractal[i].animateX || fractal[i].animateY) {
          return true;
        }
      }
      return false;
    },
    randomize() {
      try {
        console.log("Randomizing fractal...");
        
        // Generate random functions using fractal_example.js approach
        const params = fractalFunctions.randomize(fractal);
        
        // Apply parameters to config
        config.final = params.final;
        config.cfinal = params.cfinal;
        config.zoom = params.zoom;
        config.rotation = params.rot;
        config.mirrorX = params.mirrorX;
        config.mirrorY = params.mirrorY;
        
        // Select a random colormap
        const cmapNames = Object.keys(cmaps);
        const randomCmap = cmapNames[Math.floor(Math.random() * cmapNames.length)];
        flam3.cmap = randomCmap;
        
        // Update the colormap dropdown
        const cmapSelect = document.getElementById('flam3-cmap');
        if (cmapSelect) {
          cmapSelect.value = randomCmap;
        }
        
        // Write parameters to GPU buffer
        device.queue.writeBuffer(configBuffer, 0, config.buffer, 0);
        device.queue.writeBuffer(fractalBuffer, 0, fractal.buffer, 0);
        
        // Update UI controls
        updateUIControls();
        
        // Clear the canvas and redraw
        flam3.clear();
        
        // Refresh the XForm editors list
        refreshXFormEditorsList();
        
        console.log("Randomization complete");
      } catch (error) {
        console.error("Error in randomize function:", error);
      }
    },
    updateParams() {
      // Update parameters based on UI controls
      device.queue.writeBuffer(configBuffer, 0, config.buffer, 0);
      device.queue.writeBuffer(fractalBuffer, 0, fractal.buffer, 0);
      flam3.clear();
    },
    exportPNG() {
      // Create a temporary canvas to capture the WebGPU content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      
      // Get the current WebGPU texture and draw it to the temp canvas
      try {
        // For WebGPU canvas, we need to use getImageData approach
        // First, temporarily disable GUI if it's enabled
        const wasGuiEnabled = flam3.gui;
        flam3.gui = false;
        
        // Render one frame without GUI
        flam3.step();
        
        // Use the canvas directly since WebGPU canvas supports toBlob
        canvas.toBlob((blob) => {
          // Restore GUI state
          flam3.gui = wasGuiEnabled;
          
          if (blob) {
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fractal-flame-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } else {
            console.error('Failed to create blob from canvas');
            alert('Export failed. Please try again.');
          }
        }, 'image/png');
      } catch (error) {
        console.error('Export error:', error);
        alert('Export failed. Your browser may not support this feature.');
      }
    },
    
    async exportGIF(progressCallback) {
      try {
        // Load gif.js if not already loaded
        if (typeof GIF === 'undefined') {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/gif.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        // Stop current animation and store state
        const wasRunning = running;
        const wasGuiEnabled = flam3.gui;
        running = false;
        flam3.gui = false;

        // GIF settings for smaller file size
        const gifWidth = 512;  // Smaller than canvas for file size
        const gifHeight = 512;
        const fps = 12;
        const duration = 4; // seconds
        const totalFrames = fps * duration; // 48 frames

        // Create GIF instance
        const gif = new GIF({
          workers: 2,
          quality: 10, // Lower quality for smaller file size
          width: gifWidth,
          height: gifHeight,
          workerScript: '/gif.worker.js'
        });

        // Create temporary canvas for resizing frames
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = gifWidth;
        tempCanvas.height = gifHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Store original animation state
        const originalAnimationSpeed = config.animationSpeed;
        
        // Set animation speed for smooth GIF (we'll render faster than real-time)
        config.animationSpeed = 1.0;

        progressCallback && progressCallback(0, totalFrames);

        // Render frames
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          // Update progress
          progressCallback && progressCallback(frameIndex, totalFrames);

          // Render several computation frames to get smooth animation
          for (let i = 0; i < 3; i++) {
            frame(performance.now());
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          // Capture frame
          await new Promise((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) {
                const img = new Image();
                img.onload = () => {
                  // Clear temp canvas and draw resized image
                  tempCtx.clearRect(0, 0, gifWidth, gifHeight);
                  tempCtx.drawImage(img, 0, 0, gifWidth, gifHeight);
                  
                  // Add frame to GIF
                  gif.addFrame(tempCanvas, {
                    delay: 1000 / fps,
                    copy: true
                  });
                  
                  URL.revokeObjectURL(img.src);
                  resolve();
                };
                img.src = URL.createObjectURL(blob);
              } else {
                resolve();
              }
            }, 'image/png');
          });
        }

        progressCallback && progressCallback(totalFrames, totalFrames, 'Encoding GIF...');

        // Render GIF
        gif.on('finished', (blob) => {
          // Restore states
          config.animationSpeed = originalAnimationSpeed;
          flam3.gui = wasGuiEnabled;
          if (wasRunning) {
            running = true;
            requestAnimationFrame(frame);
          }

          // Download GIF
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `fractal-flame-animated-${Date.now()}.gif`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          progressCallback && progressCallback(totalFrames, totalFrames, 'Complete!');
        });

        gif.on('progress', (progress) => {
          progressCallback && progressCallback(totalFrames, totalFrames, `Encoding: ${Math.round(progress * 100)}%`);
        });

        gif.render();

      } catch (error) {
        console.error('GIF export error:', error);
        
        // Restore states on error
        flam3.gui = wasGuiEnabled;
        if (wasRunning) {
          running = true;
          requestAnimationFrame(frame);
        }
        
        alert('GIF export failed. Please try again.');
        progressCallback && progressCallback(0, 0, 'Failed');
      }
    }
  }
  
  // Function to update all UI controls to match the current configuration
  function updateUIControls() {
    try {
      // Update rendering bar
      const renderingBar = document.getElementById('renderingbar');
      if (renderingBar) {
        renderingBar.textContent = "WebGPU Fractal Flame - Ready";
      }
      
      // Update all UI elements to match the current state
      const finalSelect = document.getElementById('final-xform');
      const cfinalSelect = document.getElementById('cfinal-xform');
      
      if (finalSelect && cfinalSelect) {
        // Clear existing options except "None"
        while (finalSelect.options.length > 1) finalSelect.remove(1);
        while (cfinalSelect.options.length > 1) cfinalSelect.remove(1);
        
        // Add options for each XForm
        for (let i = 0; i < fractal.length; i++) {
          const option1 = document.createElement('option');
          const option2 = document.createElement('option');
          option1.value = option2.value = i;
          option1.textContent = option2.textContent = `XForm ${i+1} (${fractal[i].variation})`;
          finalSelect.appendChild(option1);
          cfinalSelect.appendChild(option2);
        }
        
        // Set values based on config
        finalSelect.value = config.final;
        cfinalSelect.value = config.cfinal;
      }
    } catch (error) {
      console.log("Error updating UI controls:", error);
    }
    try {
      // Update range sliders and number inputs
      const rotationRange = document.getElementById('rotation-range');
      const rotationValue = document.getElementById('rotation-value');
      if (rotationRange && rotationValue) {
        rotationRange.value = config.rotation;
        rotationValue.value = config.rotation;
      }
      
      const mirrorX = document.getElementById('mirror-x');
      const mirrorY = document.getElementById('mirror-y');
      if (mirrorX && mirrorY) {
        mirrorX.checked = config.mirrorX;
        mirrorY.checked = config.mirrorY;
      }
      
      const gammaRange = document.getElementById('gamma-range');
      const gammaValue = document.getElementById('gamma-value');
      if (gammaRange && gammaValue) {
        gammaRange.value = config.gamma;
        gammaValue.value = config.gamma;
      }
      
      const hueShiftRange = document.getElementById('hue-shift-range');
      const hueShiftValue = document.getElementById('hue-shift-value');
      if (hueShiftRange && hueShiftValue) {
        hueShiftRange.value = config.hueShift;
        hueShiftValue.value = config.hueShift;
      }
      
      const satShiftRange = document.getElementById('sat-shift-range');
      const satShiftValue = document.getElementById('sat-shift-value');
      if (satShiftRange && satShiftValue) {
        satShiftRange.value = config.satShift;
        satShiftValue.value = config.satShift;
      }
      
      const lightShiftRange = document.getElementById('light-shift-range');
      const lightShiftValue = document.getElementById('light-shift-value');
      if (lightShiftRange && lightShiftValue) {
        lightShiftRange.value = config.lightShift;
        lightShiftValue.value = config.lightShift;
      }
      
      // Update animation speed dropdown
      const animationSpeedSelect = document.getElementById('flam3-animation-speed');
      if (animationSpeedSelect) {
        animationSpeedSelect.value = config.animationSpeed.toFixed(2);
      }
    } catch (error) {
      console.log("Error updating UI control values:", error);
    }
  }
  
  // Function to refresh the XForm editors list
  function refreshXFormEditorsList() {
    try {
      const xform_list = document.getElementById('xforms');
      
      // Clear existing XForm editors (but keep default_controls which should be the last element)
      while (gui.length > 1) {
        const editor = gui.shift()
        if (editor.editor) {
          editor.editor.remove()
        }
      }
      
      // Clear DOM elements if container exists
      if (xform_list) {
        while (xform_list.children.length > 0) {
          xform_list.removeChild(xform_list.children[0]);
        }
      }
      
      // Recreate XForm editors and insert them at the beginning (before default_controls)
      // Always create editors for canvas interaction, DOM container is optional
      for (let i = fractal.length - 1; i >= 0; i--) {
        gui.unshift(new XFormEditor(fractal[i], xform_list));
      }
    } catch (error) {
      console.log("Error refreshing XForm editors list:", error);
    }
  }
  
  // Set default cmap
  flam3.cmap = 'gnuplot'
  
  // Initialize default parameters
  config.gamma = 2.2;
  config.hueShift = 0;
  config.satShift = 0;
  config.lightShift = 0;
  config.final = -1;
  config.cfinal = -1;
  config.rotation = 1;
  config.mirrorX = false;
  config.mirrorY = false;
  config.animationSpeed = 1.0;
  config.numPoints = 30000;
  
  // When initialized, clear the histogram to ensure crisp rendering
  should_clear_histogram = true;

  // BEGIN UI
  canvas.onwheel = ev => {
    ev.preventDefault()
    flam3.config.zoom *= ev.deltaY < 0 ? 1.1 : 0.9
    flam3.clear()
  }
  const default_controls = {
    pointer_down() { return true },
    pointer_up() { return true },
    pointer_move(_point, ev) {
      const cursor_delta_x = -ev.movementX / canvas.clientWidth  * 2
      const cursor_delta_y = -ev.movementY / canvas.clientHeight * 2
      flam3.config.x += cursor_delta_x / config.zoom
      flam3.config.y += cursor_delta_y / config.zoom
      flam3.clear()
      return true
    }
  }
  gui.push(default_controls)
  function to_normalized_point(ev) {
    return {
      x: (ev.offsetX / canvas.clientWidth  * 2 - 1) / config.zoom + flam3.config.x,
      y: (ev.offsetY / canvas.clientHeight * 2 - 1) / config.zoom + flam3.config.y
    };
  }
  canvas.onpointerdown = ev => {
    const normalized_point = to_normalized_point(ev)
    if (!flam3.gui)
      default_controls.pointer_down(normalized_point, ev)
    else {
      // Test XForm editors first (all elements except the last one which is default_controls)
      let handled = false;
      for (let i = 0; i < gui.length - 1; i++) {
        const element = gui[i];
        if (element.pointer_down && element.pointer_down(normalized_point, ev)) {
          handled = true;
          break;
        }
      }
      
      // If no XForm editor handled it, use default_controls (which is always the last element)
      if (!handled && gui.length > 0) {
        const defaultControls = gui[gui.length - 1];
        if (defaultControls.pointer_down) {
          defaultControls.pointer_down(normalized_point, ev);
        }
      }
    }

    canvas.onpointermove = ev => {
      const normalized_point = to_normalized_point(ev)
      if (!flam3.gui)
        default_controls.pointer_move(normalized_point, ev)
      else
        gui.find(gui_element => gui_element.pointer_move(normalized_point, ev))
    }
    canvas.setPointerCapture(ev.pointerId)
  }
  canvas.onpointerup = ev => {
    const normalized_point = to_normalized_point(ev)
    if (!flam3.gui)
      default_controls.pointer_up(normalized_point, ev)
    else
      gui.find(gui_element => gui_element.pointer_up(normalized_point, ev))
    canvas.onpointermove = null
    canvas.releasePointerCapture(ev.pointerId)
  }

  // Add updateUIControls to flam3 for external access
  flam3.updateUIControls = updateUIControls;
  
  // Make refreshXFormEditorsList available globally for React component
  window.refreshXFormEditorsList = refreshXFormEditorsList;
  
  return flam3
};

// Function to populate variation options in the template
const populateVariationOptions = () => {
  const template = document.getElementById('xform-editor-template')
  if (template && template.content) {
    const variation_selector = template.content.querySelector('select[name="variation-selector"]')
    if (variation_selector) {
      for (const variation of STR_TO_VARIATION_ID.keys()) {
        const option = document.createElement('option')
        option.textContent = variation
        variation_selector.appendChild(option)
      }
    }
  }
}

// Only run onload if not in module mode
if (typeof window !== 'undefined' && !window.fractalModuleLoaded) {
  window.document.body.onload = async () => {
    populateVariationOptions()

  window.flam3 = await init(document.getElementById('output'))

  const cmap_selection = document.getElementById('flam3-cmap')
  for (const cmap_name of Object.keys(cmaps)) {
    const option = document.createElement('option')
    option.textContent = cmap_name
    cmap_selection.appendChild(option)
  }
  cmap_selection.value = 'gnuplot'
  cmap_selection.onchange = ev => {
    window.flam3.cmap = ev.currentTarget.value
  }
  
  // Animation speed control
  const animationSpeedSelect = document.getElementById('flam3-animation-speed');
  if (animationSpeedSelect) {
    animationSpeedSelect.onchange = ev => {
      const speed = parseFloat(ev.currentTarget.value);
      window.flam3.config.animationSpeed = speed;
      
      // Clear histogram when changing animation speed for crisp rendering
      window.flam3.clear();
      
      window.flam3.updateParams();
    };
  }
  
  // Zoom level control
  const zoomLevelSelect = document.getElementById('flam3-zoom-level');
  if (zoomLevelSelect) {
    zoomLevelSelect.onchange = ev => {
      const zoom = parseFloat(ev.currentTarget.value);
      window.flam3.config.zoom = zoom;
      window.flam3.clear();
      window.flam3.updateParams();
    };
  }
  
  // Set up event handlers for the new UI controls
  
  // Final XForm and Color Final XForm selectors
  const finalXform = document.getElementById('final-xform');
  const cfinalXform = document.getElementById('cfinal-xform');
  
  if (finalXform) {
    finalXform.onchange = ev => {
      window.flam3.config.final = parseInt(ev.currentTarget.value, 10);
      window.flam3.updateParams();
    };
  }
  
  if (cfinalXform) {
    cfinalXform.onchange = ev => {
      window.flam3.config.cfinal = parseInt(ev.currentTarget.value, 10);
      window.flam3.updateParams();
    };
  }
  
  // Rotation control
  const rotationRange = document.getElementById('rotation-range');
  const rotationValue = document.getElementById('rotation-value');
  
  if (rotationRange && rotationValue) {
    rotationRange.oninput = ev => {
      const value = parseFloat(ev.currentTarget.value);
      rotationValue.value = value;
      window.flam3.config.rotation = value;
      window.flam3.updateParams();
    };
    
    rotationValue.onchange = ev => {
      const value = parseFloat(ev.currentTarget.value);
      rotationRange.value = value;
      window.flam3.config.rotation = value;
      window.flam3.updateParams();
    };
  }
  
  // Mirror controls
  const mirrorX = document.getElementById('mirror-x');
  const mirrorY = document.getElementById('mirror-y');
  
  if (mirrorX) {
    mirrorX.onchange = ev => {
      window.flam3.config.mirrorX = ev.currentTarget.checked;
      window.flam3.updateParams();
    };
  }
  
  if (mirrorY) {
    mirrorY.onchange = ev => {
      window.flam3.config.mirrorY = ev.currentTarget.checked;
      window.flam3.updateParams();
    };
  }
  
  // Gamma control
  const gammaRange = document.getElementById('gamma-range');
  const gammaValue = document.getElementById('gamma-value');
  
  if (gammaRange && gammaValue) {
    gammaRange.oninput = ev => {
      const value = parseFloat(ev.currentTarget.value);
      gammaValue.value = value;
      window.flam3.config.gamma = value;
      window.flam3.updateParams();
    };
    
    gammaValue.onchange = ev => {
      const value = parseFloat(ev.currentTarget.value);
      gammaRange.value = value;
      window.flam3.config.gamma = value;
      window.flam3.updateParams();
    };
  }
  
  // Hue shift control
  const hueShiftRange = document.getElementById('hue-shift-range');
  const hueShiftValue = document.getElementById('hue-shift-value');
  
  if (hueShiftRange && hueShiftValue) {
    hueShiftRange.oninput = ev => {
      const value = parseFloat(ev.currentTarget.value);
      hueShiftValue.value = value;
      window.flam3.config.hueShift = value;
      window.flam3.updateParams();
    };
    
    hueShiftValue.onchange = ev => {
      const value = parseFloat(ev.currentTarget.value);
      hueShiftRange.value = value;
      window.flam3.config.hueShift = value;
      window.flam3.updateParams();
    };
  }
  
  // Saturation shift control
  const satShiftRange = document.getElementById('sat-shift-range');
  const satShiftValue = document.getElementById('sat-shift-value');
  
  if (satShiftRange && satShiftValue) {
    satShiftRange.oninput = ev => {
      const value = parseFloat(ev.currentTarget.value);
      satShiftValue.value = value;
      window.flam3.config.satShift = value;
      window.flam3.updateParams();
    };
    
    satShiftValue.onchange = ev => {
      const value = parseFloat(ev.currentTarget.value);
      satShiftRange.value = value;
      window.flam3.config.satShift = value;
      window.flam3.updateParams();
    };
  }
  
  // Lightness shift control
  const lightShiftRange = document.getElementById('light-shift-range');
  const lightShiftValue = document.getElementById('light-shift-value');
  
  if (lightShiftRange && lightShiftValue) {
    lightShiftRange.oninput = ev => {
      const value = parseFloat(ev.currentTarget.value);
      lightShiftValue.value = value;
      window.flam3.config.lightShift = value;
      window.flam3.updateParams();
    };
    
    lightShiftValue.onchange = ev => {
      const value = parseFloat(ev.currentTarget.value);
      lightShiftRange.value = value;
      window.flam3.config.lightShift = value;
      window.flam3.updateParams();
    };
  }
  
  // We'll handle this in the setTimeout function below
  
  // Initialize the UI controls to match the current config
  window.setTimeout(() => {
    try {
      console.log("Setting up UI controls...");
      
      if (window.flam3 && typeof window.flam3.updateUIControls === 'function') {
        console.log("Updating UI controls...");
        window.flam3.updateUIControls();
      }
      
      // Check if randomize button exists and add handler
      const randomButton = document.getElementById('flam3-random');
      console.log("Random button:", randomButton);
      
      if (randomButton) {
        console.log("Adding click handler to randomize button");
        randomButton.addEventListener('click', () => {
          console.log("Randomize button clicked");
          if (window.flam3 && typeof window.flam3.randomize === 'function') {
            window.flam3.randomize();
          } else {
            console.error("flam3.randomize is not available");
          }
        });
      } else {
        console.warn("Randomize button not found");
      }
      
      // Add handler for Toggle Animations button
      const toggleAnimationsButton = document.getElementById('flam3-toggle-animations');
      if (toggleAnimationsButton) {
        toggleAnimationsButton.addEventListener('click', () => {
          if (window.flam3 && typeof window.flam3.toggleAnimations === 'function') {
            window.flam3.toggleAnimations();
          }
        });
      }
      
      console.log("UI controls setup complete");
    } catch (error) {
      console.log("Error initializing UI controls:", error);
    }
  }, 500);
  }
}

// Export functions for module usage
window.init = init;
window.populateVariationOptions = populateVariationOptions;
export { init, populateVariationOptions };
