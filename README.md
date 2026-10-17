# 🚗 Autonomous Self-Driving Car & Interactive World Editor

An immersive, full-screen browser simulation and procedural world editor built with **HTML5 Canvas** and **Vanilla JavaScript**. Features multi-agent autonomous vehicle AI, ray-casting sensor systems, real-time traffic signal regulation, dead-end convoy solvers, and vehicle fleet randomization.

---

## 🌟 Key Highlights

- **Full-Screen "Just the World" View**: Clean edge-to-edge canvas with outer dark frames removed; features floating glassmorphic telemetry HUD and bottom control dock.
- **Dynamic Fleet Randomization**: Cars automatically spawn as either the **Porsche 911** or **Mercedes-Benz G-Wagon** with customized high-resolution vehicle sprites.
- **Precision Traffic Light Regulation**:
  - **RED $\to$ YELLOW** in **4.0 seconds** (240 frames).
  - **YELLOW $\to$ GREEN** in **2.0 seconds** (120 frames).
  - Live digital countdown timer rendered on the signal post and top HUD.
  - Safe queue spacing enforcing a visible $\ge 18\text{px}$ air gap between bumpers (vehicles never touch).
- **Dead-End & Multi-Car Convoy Solver**:
  - Zero-radius in-place U-turn at dead-end road caps.
  - Trailing cars reverse direction in advance, leading the convoy smoothly out of dead ends.
  - Automatic deadlock breaker resets stalled cars within 0.5s.
  - Active border repulsion prevents edge collisions.
- **Integrated World Editor**: Full suite for building custom road networks, intersections, stop signs, traffic lights, and pedestrian crossings with `.world` export/import.

---

## 🏗️ System Architecture

```
selfDrivingCar/
├── index.html                       # Full-screen canvas, floating HUD pill & control dock
├── style.css                        # Modern CSS tokens, glassmorphism, responsive controls
├── simulation_demo.webp             # Live recorded demonstration video
├── js/
│   ├── world.js                     # Procedural world generator (roads, buildings, trees)
│   ├── viewport.js                  # Pan, smooth zoom (0.4x - 4.0x), coordinate transforms
│   ├── simulation.js                # Fleet manager, car lifecycle, telemetry calculations
│   ├── car.js                       # Physics kinematics, sensors, queueing & deadlock AI
│   ├── sensor.js                    # Ray-casting sensor beams with border detection
│   ├── network.js                   # Neural network layers, weights, and activations
│   ├── controls.js                  # Keyboard controls (WASD / Arrow keys)
│   ├── car.png                      # Baby-blue Porsche 911 vehicle sprite
│   ├── gwagonCar.png                # Mercedes G-Wagon vehicle sprite
│   ├── math/
│   │   ├── utils.js                 # Linear algebra, intersections, polygon math
│   │   └── graph.js                 # Graph data structure (points & segments)
│   ├── primitives/
│   │   ├── point.js                 # 2D Point coordinate system
│   │   ├── segment.js               # Road centerlines and lane bounds
│   │   ├── polygon.js               # Building footprint, car hitbox, road envelopes
│   │   └── envelope.js              # Road width expansion & Minkowski sums
│   ├── items/
│   │   ├── building.js              # 3D rooftop & base building geometries
│   │   └── tree.js                  # Foliage generation with collision exclusion
│   ├── markings/
│   │   ├── marking.js               # Base marking class (serialization & loading)
│   │   ├── stop.js                  # Stop sign yield zone
│   │   ├── crossing.js              # Pedestrian zebra crossing (caution speed)
│   │   ├── start.js                 # Car spawn decal
│   │   └── trafficLight.js          # Animated 4-phase signal with digital countdown
│   └── editors/
│       ├── markingEditor.js         # Base snapping & marking interaction handler
│       ├── graphEditor.js           # Road network node/edge editor
│       ├── stopEditor.js            # Stop sign placement tool
│       ├── crossingEditor.js        # Pedestrian crossing placement tool
│       └── trafficLightEditor.js    # Traffic light lane snapping tool
```

---

## 🚦 Traffic Light & Road Markings

The simulation includes an intelligent marking compliance engine:

| Marking | Visual Indicator | Autonomous Vehicle Rule | Timing |
| :--- | :--- | :--- | :--- |
| **🚦 Traffic Light (RED)** | Red light illuminated, digital countdown | Stop before stop line; trailing cars queue in single file with $\ge 18\text{px}$ bumper gap | **4.0s** countdown |
| **🚦 Traffic Light (YELLOW)** | Amber light illuminated, digital countdown | Prepare to stop (if approaching) or "Get Ready" (if stopped) | **2.0s** countdown |
| **🚦 Traffic Light (GREEN)** | Green light illuminated | Full speed cruising; queued cars accelerate sequentially | **4.0s** cruise |
| **🛑 Stop Sign** | White STOP stencil & octagonal sign | Full stop for 2.0s yield period before proceeding | 2.0s yield |
| **🚶 Crossing** | Zebra stripes across roadway | Automatic speed reduction to caution speed ($0.8\times$) | Continuous |

---

## 🕹️ Controls & Toolbar Guide

### Simulation & Fleet Controls
| Control | Action | Shortcut / Description |
| :--- | :--- | :--- |
| **▶️ Start / ⏸️ Pause Cars** | Toggle global simulation | Cars only move when started; state saved on pause |
| **➕ Add Car** | Spawn random car | Adds either a Porsche 911 or Mercedes G-Wagon at random road segment |
| **❌ Remove Cars** | Remove fleet | Clears all active cars from track |
| **⏮️ Reset Cars** | Reset positions | Resets fleet to initial spawn location |
| **🎮 Manual Drive** | Drive lead car | Control lead car using **WASD** or **Arrow Keys** |
| **🎥 Cam: ON / OFF** | Smooth tracking camera | Locks viewport on lead car with soft-lerp interpolation |

### World Editor Tools
| Tool | Action | Mouse Interaction |
| :--- | :--- | :--- |
| **🌐 Roads** | Create road network | **Left-Click**: Add / connect node<br>**Right-Click**: Delete node |
| **🚦 Traffic Light** | Place traffic signal | **Left-Click** on any road lane guide |
| **🛑 Stop Sign** | Place stop line | **Left-Click** on any road lane guide |
| **🚶 Crossing** | Place zebra crossing | **Left-Click** across road segment |
| **📍 Spawn Point** | Set vehicle spawn | **Left-Click** to choose spawn point |
| **💾 Save / 📁 Load** | Persist world | Export / import `.world` JSON files |
| **🗑️ Clear World** | Clean wipe | Wipes canvas, graph, markings, and cars with zero visual glitches |

### Viewport Navigation
- **Pan**: Hold **Middle Mouse Button** (mouse wheel click) and drag.
- **Zoom**: Scroll **Mouse Wheel** to zoom between `0.4x` (overview) and `4.0x` (close-up).

---

## ⚡ Getting Started

1. **Clone or Navigate to the Repository**:
   ```bash
   cd /Users/fahdrashdan/Documents/Projects/selfDrivingCar
   ```

2. **Launch a Local Web Server**:
   ```bash
   # Using Python 3:
   python3 -m http.server 8080

   # Or using Node http-server:
   npx http-server -p 8080
   ```

3. **Open the Application**:
   Navigate to [http://localhost:8080/index.html](http://localhost:8080/index.html) in your browser.

---

## 🎥 Working Simulation Demo

Below is the demonstration video showcasing the autonomous self-driving car simulation, multi-car fleet driving, traffic light phase transitions (4s Red $\to$ 2s Yellow $\to$ Green), safe non-touching queue spacing, and interactive world editor:

<video src="Demo%20Video.mov" controls="controls" width="100%" playsinline>
  <source src="demo.mp4" type="video/mp4">
  <source src="Demo%20Video.mov" type="video/quicktime">
  Your browser does not support the video tag.
</video>

> 🎬 **Direct Links**:
> - [▶️ Demo Video (.mov)](Demo%20Video.mov)
> - [▶️ Demo Video (.mp4)](demo.mp4)

---

*Developed with HTML5 Canvas, Vanilla JavaScript, and Advanced Agentic Coding.*
