// This file implements the weighted variation system from fractal_example.js
// to be used with the WebGPU implementation in main.js

class FractalFunctions {
  constructor() {
    // Only include variations that are supported in main.js
    this.varisNames = [
      'Linear', 'Sinusoidal', 'Spherical', 'Swirl', 'Horseshoe', 'Polar',
      'Handkerchief', 'Heart', 'Disc', 'Spiral', 'Hyperbolic', 'Diamond', 'Ex',
      'Julia', 'Bent', 'Fisheye', 'Exponential', 'Power', 'Cosine',
      'Eyefish', 'Bubble', 'Cylinder', 'Noise', 'Blur', 'Gaussian', 'Arch',
      'Tangent', 'Square', 'Rays', 'Blade', 'Secant', 'Twintrian', 'Cross'
    ];
    
    // Maps our variation names to the variation IDs in main.js
    this.varisToVariationId = {
      'Linear': 0,
      'Sinusoidal': 1,
      'Spherical': 2,
      'Swirl': 3,
      'Horseshoe': 4,
      'Polar': 5,
      'Handkerchief': 6,
      'Heart': 7,
      'Disc': 8,
      'Spiral': 9,
      'Hyperbolic': 10,
      'Diamond': 11,
      'Ex': 12,
      'Julia': 13,
      'Bent': 14,
      'Fisheye': 16,
      'Exponential': 18,
      'Power': 19,
      'Cosine': 20,
      'Eyefish': 27,
      'Bubble': 28,
      'Cylinder': 29,
      'Noise': 31,
      'Blur': 34,
      'Gaussian': 35,
      'Arch': 41,
      'Tangent': 42,
      'Square': 43,
      'Rays': 44,
      'Blade': 45,
      'Secant': 46,
      'Twintrian': 47,
      'Cross': 48
    };
    
    this.funcs = [];
    this.weights = [];
    this.final = -1;
    this.cfinal = -1;
    this.zoom = 1;
    this.rot = 1;
    this.mirrorX = false;
    this.mirrorY = false;
  }

  // Set functions with custom parameters or randomize
  setFuncs(funcsJSON) {
    this.funcs = [];
    this.weights = [];
    
    if (funcsJSON && funcsJSON[0] && funcsJSON[0] == 'custom') {
      funcsJSON.shift(); //remove first element
      for (let i = 0; i < funcsJSON.length; i++) {
        for (let j = 0; j < funcsJSON[i].v.length; j++) {
          for (let k = 0; k < this.varisNames.length; k++) {
            if (this.varisNames[k] == funcsJSON[i].v[j]) {
              funcsJSON[i].v[j] = k;
            }
          }
        }
        this.weights.push(funcsJSON[i].weight);
      }
      this.funcs = funcsJSON;
    } else { //Randomize
      if (funcsJSON) funcsJSON.shift(); //remove first element

      //3 to 6 functions
      const numOfFuncs = Math.floor(Math.random() * 4) + 3; // Random number between 3 and 6

      for (let i = 0; i < numOfFuncs; i++) {
        const v = []; //array of ascending varis indices
        const w = []; //array of non-negative nums summing to 1 with same length as v
        const col = []; //rgb triplet each 0 to 1
        const c = []; //array of 6 coefficients
        const r = Math.random(); //Some random 0 to 1 var for possible use in variations
        
        //v - Pick random variations
        const maxNumOfVarisPerFunc = Math.round(Math.random() * 4) + 3;
        for (let j = 0; j < maxNumOfVarisPerFunc; j++) {
          const varisName = this.varisNames[Math.floor(Math.random() * this.varisNames.length)];
          const idx = this.varisNames.indexOf(varisName);
          if (idx !== -1 && v.indexOf(idx) === -1) {
            v.push(idx);
          }
        }

        //w - Set weights
        let totalSum = 0;
        const weightInc = 0.05;
        for (let j = 0; j < v.length; j++) {
          w.push(0);
        }
        //Keep randomly incrementing weights until their sum is 1
        while (totalSum < 1) {
          w[Math.floor(Math.random() * v.length)] += weightInc;
          totalSum += weightInc;
        }

        //col - Random color
        col.push(Math.random(), Math.random(), Math.random());

        //c - Coefficients
        const cofMult = 3;
        const cofSub = 1.5;
        for (let j = 0; j < 6; j++) {
          const cof = Math.random() * cofMult - cofSub;
          c.push(cof);
        }

        //Add the new func parameters
        this.funcs.push({ v, w, col, c, r });
      }

      //Random weights for each function
      let totalSum = 0;
      let weightInc = 0.5;
      for (let i = 0; i < this.funcs.length; i++) {
        this.weights.push(0);
      }
      //Keep randomly incrementing weights until their sum is 1
      while (totalSum < 0.99) {
        this.weights[Math.floor(Math.random() * this.funcs.length)] += weightInc;
        totalSum += weightInc;
        weightInc /= 2;
      }
      //match weights with funcs
      for (let i = 0; i < this.funcs.length; i++) {
        this.funcs[i].weight = this.weights[i];
      }
    }
    
    // Set defaults for other parameters
    this.final = Math.floor(Math.random() * (this.funcs.length + 1)) - 1;
    this.cfinal = Math.floor(Math.random() * (this.funcs.length + 1)) - 1;
    this.zoom = 1;
    
    // Weighted rotation: favor lower values, occasionally go higher
    // Use a power function to bias towards lower values
    const randomValue = Math.random();
    // Apply cubic root to bias heavily towards lower values
    const biasedValue = Math.pow(randomValue, 3);
    this.rot = Math.floor(biasedValue * 20) + 1;
    
    this.mirrorX = false;
    this.mirrorY = false;
    
    return this.funcs;
  }

  getFuncs() {
    return this.funcs;
  }

  // Convert our functions to WebGPU XForms
  toXForms(fractal) {
    // Clear existing XForms
    while (fractal.length > 0) {
      fractal.remove(0);
    }
    
    // Add each function as an XForm
    for (let i = 0; i < this.funcs.length; i++) {
      const func = this.funcs[i];
      
      // Calculate a representative color - average of all the color components
      const colorValue = (func.col[0] + func.col[1] + func.col[2]) / 3;
      
      // For each function, use the first variation as the main one
      // We'll handle multiple variations in the shader code later
      const firstVariationIdx = func.v[0];
      const variationName = this.varisNames[firstVariationIdx];
      const variationId = this.varisToVariationId[variationName] || 0; // Default to Linear if not found
      
      // Calculate affine transform parameters from coefficients
      // Randomly set animation flags
      // Ensure at least one transform is animated, but not too many (max 2-3)
      const currentAnimatedCount = fractal.length > 0 ? 
        Array.from({length: i}, (_, idx) => fractal[idx])
          .filter(xf => xf.animateX || xf.animateY).length : 0;
      
      // Force animation on the first transform if none are animated yet
      const isLastTransform = i === this.funcs.length - 1;
      const needsAnimation = isLastTransform && currentAnimatedCount === 0;
      
      let shouldAnimateX = false;
      let shouldAnimateY = false;
      
      if (needsAnimation) {
        // Ensure at least one animation on the last transform if none exist
        if (Math.random() < 0.5) {
          shouldAnimateX = true;
          shouldAnimateY = Math.random() < 0.3; // 30% chance for both
        } else {
          shouldAnimateY = true;
          shouldAnimateX = Math.random() < 0.3; // 30% chance for both
        }
      } else if (currentAnimatedCount < 2) {
        // Random chance for animation if we haven't hit the limit
        shouldAnimateX = Math.random() < 0.25; // 25% chance
        shouldAnimateY = Math.random() < 0.25; // 25% chance
      }
      
      fractal.add({
        variation: variationName,
        color: colorValue,
        a: func.c[0], // x scale
        b: func.c[1], // y shear
        c: func.c[2], // x translate
        d: func.c[3], // x shear
        e: func.c[4], // y scale
        f: func.c[5], // y translate
        animateX: shouldAnimateX,
        animateY: shouldAnimateY
      });
    }
    
    // Return the parameters needed for WebGPU processing
    return {
      xforms: fractal,
      final: this.final,
      cfinal: this.cfinal,
      zoom: this.zoom,
      rot: this.rot,
      mirrorX: this.mirrorX,
      mirrorY: this.mirrorY
    };
  }

  // Generate random functions and return WebGPU compatible XForms
  randomize(fractal) {
    this.setFuncs();
    return this.toXForms(fractal);
  }

  // Set parameters
  setParams(params) {
    if (params.final !== undefined) this.final = params.final;
    if (params.cfinal !== undefined) this.cfinal = params.cfinal;
    if (params.zoom !== undefined) this.zoom = params.zoom;
    if (params.rot !== undefined) this.rot = params.rot;
    if (params.mirrorX !== undefined) this.mirrorX = params.mirrorX;
    if (params.mirrorY !== undefined) this.mirrorY = params.mirrorY;
    
    return {
      final: this.final,
      cfinal: this.cfinal,
      zoom: this.zoom,
      rot: this.rot,
      mirrorX: this.mirrorX,
      mirrorY: this.mirrorY
    };
  }
}

export default FractalFunctions;