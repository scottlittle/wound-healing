# Wound Healing Simulation

A static web app implementing an energy healing wound healing simulation experiment.

## Overview

This project is a browser-based version of the cellular automaton wound healing simulation. It allows users to run controlled experiments testing whether focused intention can influence wound healing outcomes.

## Features

- **Live simulation visualization**: Watch cells migrate, proliferate, and heal wounds in real-time
- **Control vs Intention phases**: Run both phases and compare results
- **Statistical analysis**: Mann-Whitney U test, Cohen's d, bootstrap confidence intervals
- **Interactive charts**: Healing curves, CDFs, and box plots

## Cell Types

| Cell Type | Color | Behavior |
|-----------|-------|----------|
| Empty (wound) | Dark | Target for migration/proliferation |
| Epithelial | Blue | Migrates into wound, proliferates |
| Fibroblast | Green | Migrates, deposits ECM, accelerates closure |
| Immune (macrophage) | Red | Appears at wound edge, resolves after ~10 steps |
| Healed tissue | Gray | Remodeled, stable |

## Usage

1. Open `index.html` in a modern web browser
2. Configure the number of runs, intention duration, and max steps
3. Click "Start Control Phase" to run control simulations
4. Click "Start Intention Phase" and apply energy healing during each run
5. Click "Run Analysis" to compare results

## Project Structure

```
wound-healing/
├── index.html          # Main page
├── css/
│   └── style.css       # Styles
├── js/
│   ├── simulation.js   # Cellular automaton model
│   ├── visualizer.js   # Canvas rendering and charts
│   ├── analysis.js     # Statistical analysis
│   └── app.js          # Main application logic
├── README.md
└── .gitignore
```

## License

MIT
