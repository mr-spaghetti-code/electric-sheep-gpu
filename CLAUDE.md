# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electric Sheep GPU is a WebGPU implementation of Fractal Flame rendering. The application generates visually striking fractal artwork in real-time using GPU acceleration. It implements the "chaos game" algorithm and provides an interactive interface for manipulating fractal parameters.

## Architecture

The project consists of the following key components:

- **Core Rendering Engine**: Implemented in `main.js`, uses WebGPU for GPU-accelerated fractal computation
- **Fractal Functions**: Defined in `fractal_functions.js`, provides various mathematical transformations for the fractals
- **Color System**: Uses color maps defined in `colourmaps.js` which can be generated using `gen-colourmaps.js`
- **UI Components**: HTML/CSS components for user interaction, including transform editors and controls

## Key Technologies

- WebGPU for GPU-accelerated rendering and computation
- WGSL (WebGPU Shading Language) for custom shader programs
- JavaScript for UI and control logic
- HTML5 Canvas for display

## Running the Application

Since this is a WebGPU application:

1. Open `index.html` in a WebGPU-compatible browser (Chrome with WebGPU flag enabled, or other browsers with WebGPU support)
2. Use the interface to modify fractal parameters, change color maps, and export results

## Project Specific Notes

- The application implements multiple fractal variations like Linear, Sinusoidal, Spherical, etc.
- Users can create complex fractal patterns by combining multiple transformations
- Advanced controls allow for fine-tuning parameters like rotation, mirroring, gamma, and color shifts
- Rendering is performed in real-time using WebGPU compute shaders

## File Structure

- `index.html`: Main entry point with UI elements and WebGPU canvas
- `main.js`: Core WebGPU implementation and rendering pipeline
- `fractal_functions.js`: Implements the weighted variation system for fractal generation
- `colourmaps.js`: Contains color palettes for rendering
- `gen-colourmaps.js`: Script to generate new color maps from input files