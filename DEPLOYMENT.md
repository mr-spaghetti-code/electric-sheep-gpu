# Deployment Instructions for Electric Sheep GPU

This guide explains how to deploy the Electric Sheep GPU WebGPU application to Vercel.

## Prerequisites

- A Vercel account (sign up at https://vercel.com)
- Git repository with your project
- Vercel CLI (optional, for command-line deployment)

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. Push your code to a GitHub repository
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Vercel will automatically detect the `vercel.json` configuration
5. Click "Deploy"

### Method 2: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Run in your project directory:
   ```bash
   vercel
   ```

3. Follow the prompts to link/create a project

### Method 3: Manual Upload

1. Go to https://vercel.com/new
2. Click "Upload Folder"
3. Select your project directory containing all files

## Configuration Details

The `vercel.json` file includes:

- **No build command**: Since this is a static site with no build process
- **Output directory**: Set to root (`.`) to serve all files
- **Headers**: 
  - Proper MIME types for JavaScript modules
  - COOP/COEP headers required for WebGPU SharedArrayBuffer support
- **Rewrites**: Ensures proper routing for all files

## Important Notes

### WebGPU Browser Support

Ensure users know they need a WebGPU-compatible browser:
- Chrome 113+ (WebGPU enabled by default)
- Edge 113+ (WebGPU enabled by default)
- Firefox Nightly (with WebGPU flag enabled)
- Safari Technology Preview (macOS 11.3+)

### HTTPS Requirement

WebGPU requires HTTPS. Vercel automatically provides HTTPS for all deployments.

### Files Included

The deployment will include:
- `index.html` - Main application page
- `main.js` - Core WebGPU rendering engine
- `fractal_functions.js` - Fractal transformation functions
- `colourmaps.js` - Color palette data
- `gen-colourmaps.js` - Color map generation utility
- `vercel.json` - Deployment configuration

## Environment Variables

This application doesn't require any environment variables.

## Custom Domain

To add a custom domain:
1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Troubleshooting

### WebGPU Not Available
If users see "WebGPU not available":
- Ensure they're using a compatible browser
- Check if hardware acceleration is enabled
- Try a different browser or update to latest version

### MIME Type Issues
The `vercel.json` configuration ensures proper MIME types. If issues persist:
- Clear browser cache
- Check browser console for specific errors

### Performance
For optimal performance:
- Use a device with dedicated GPU
- Close other GPU-intensive applications
- Ensure browser hardware acceleration is enabled