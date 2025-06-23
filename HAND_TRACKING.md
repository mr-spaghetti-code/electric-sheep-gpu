# Hand Tracking Control for Electric Sheep

This feature allows you to control two randomly selected xforms (transforms) using your hands via MediaPipe hand tracking.

## How to Use

1. **Enter Full Screen Mode**: Navigate to the full screen viewer
2. **Enable Hand Control**: In the controls panel, toggle "Hand Control On"
3. **Allow Camera Access**: When prompted, allow camera access for hand tracking
4. **Control Xforms**: Move your hands to control the selected transforms

## Hand Controls

- **Left Hand**: Controls one randomly selected xform
- **Right Hand**: Controls another randomly selected xform
- **Hand Position**: Maps to transform translation (x, y movement)
- **Hand Rotation**: Calculated from wrist to middle finger, controls transform rotation

## Features

- Automatically selects 2 random xforms when enabled
- Real-time hand tracking with MediaPipe
- Position and rotation control for each hand
- Preserves original transform parameters when disabled
- Visual feedback showing which xforms are being controlled

## Controls Panel

- Shows which xforms are assigned to each hand
- Displays current status of hand tracking
- Instructions for interaction

## Technical Details

- Uses MediaPipe Hands for hand detection
- Tracks up to 2 hands simultaneously  
- Maps hand landmarks to transform matrix parameters:
  - Hand center (wrist) position → translation (c, f parameters)
  - Wrist to middle finger vector → rotation applied to transform matrix
- Preserves original transform state for restoration when disabled

## Requirements

- Modern browser with camera support
- Well-lit environment for optimal hand tracking
- `@mediapipe/hands` package (already installed)

## Keyboard Shortcuts

- **SPACE**: Toggle controls panel visibility
- **ESC**: Exit full screen mode

The hand tracking feature integrates seamlessly with other fractal controls like auto-randomization, GUI overlays, and animation controls. 