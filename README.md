# NEON TRENCH // RUN

A cyberpunk trench runner built entirely in a single HTML file using Three.js. No build tools, no frameworks, no asset files. Pure procedural meshes, synthesized audio, and diegetic HUD.

## Play

Open `neon_trench_1.0.html` (or `index.html`) in any modern browser. No install required.

## Features

- High-speed trench flight with full 6DOF movement
- Dual camera modes (First-person cockpit + Third-person chase)
- Multiple weapon systems (chain gun, missiles, torpedo)
- Enemy variety: fighters, bombers, wall turrets
- Arena Mode (survival) + Campaign trench run
- Procedural adaptive music that reacts to combat intensity
- Diegetic HUD with ADI, throttle, boost gauge, proximity warnings
- Engine trails, hit markers, screen shake, and damage smoke
- Roll gates, crossbeams, and environmental hazards

## Controls

| Key       | Action                          |
|-----------|---------------------------------|
| **WASD**  | Move / Pitch & Yaw              |
| **Mouse** | Look / Aim                      |
| **LMB**   | Fire chain gun                  |
| **RMB**   | Lock missile / Zoom             |
| **Space** | Boost                           |
| **Shift** | Afterburner                     |
| **F**     | Fire torpedo (when locked)      |
| **C**     | Switch camera (FP / TP)         |
| **M**     | Toggle music                    |
| **P**     | Cycle graphics quality          |

## Tech

- Three.js (r160) via CDN importmap
- Web Audio API for all synthesized sound
- Single self-contained HTML file
- Built with assistance from Claude and Grok

## License

Copyright (c) 2026 dololegacy. All rights reserved.

See [LICENSE](LICENSE) for details.