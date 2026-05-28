# Wound Healing Simulation

A static web app implementing an energy healing wound healing simulation experiment.

**[Live Demo](https://wound-healing.pages.dev/)**

## Overview

This project is a browser-based version of the cellular automaton wound healing simulation. It allows users to run controlled experiments testing whether focused intention can influence wound healing outcomes.

## Features

- **Live simulation visualization**: Watch cells migrate, proliferate, and heal wounds in real-time
- **Control vs Intention phases**: Run both phases and compare results
- **Statistical analysis**: Mann-Whitney U test, Cohen's d, bootstrap confidence intervals
- **Interactive charts**: CDFs and box plots for 90% and 100% closure milestones
- **Quantum random seeds**: Fetched from ANU QRNG on page load

## Cell Types

| Cell Type | Color | Behavior |
|-----------|-------|----------|
| Empty (wound) | Dark | Target for migration/proliferation |
| Epithelial | Blue | Migrates into wound, proliferates |
| Fibroblast | Green | Migrates, deposits ECM, accelerates closure |
| Immune (macrophage) | Red | Appears at wound edge, resolves after ~20 steps |
| Healed tissue | Gray | Remodeled, stable |

## Cell Interactions

The simulation includes complex emergent behaviors:

- **Fibroblast chemotaxis**: Fibroblasts migrate faster near immune cells (inflammatory signaling)
- **Epithelial-fibroblast cooperation**: Epithelial cells adjacent to fibroblasts have 1.5x migration rate (ECM scaffolding)
- **Immune signaling**: Immune cells within 2-cell radius boost epithelial proliferation by 20%
- **Contact inhibition**: Epithelial cells with ≥6 non-empty neighbors have 70% reduced activity
- **Healed tissue barrier**: Adjacent healed cells reduce fibroblast migration by 30% (scar density)
- **Wound bed resistance**: Empty wound cells start with 80% resistance, decaying on failed attempts

## Usage

1. Open `index.html` in a modern web browser
2. Wait for quantum seeds to load (fetched automatically from ANU QRNG on page load)
3. Configure the number of runs, intention duration, and max steps
4. Click "Start Control Phase" to run control simulations
5. Click "Start Intention Phase" and apply energy healing during each run
6. Click "Run Analysis" to compare results

## Quantum Random Number Generation

Seeds are fetched from the **ANU Quantum Random Number Generator (QRNG)** on page load. The API provides up to 1024 random numbers in a single call, which are stored and used for all runs in the session. This avoids rate limiting (1 minute wait between calls).

- API: `https://qrng.anu.edu.au/API/jsonI.php?length=1024&type=uint16`
- If the API is unavailable, falls back to `crypto.getRandomValues()` (OS entropy)
- The seed source (`ANU_QRNG` or `OS_ENTROPY`) is displayed in the status bar and analysis results
- Clicking "Reset" fetches a fresh batch of quantum seeds

## Simulation Parameters

| Parameter | Value |
|-----------|-------|
| Grid size | 80×80 |
| Wound radius | 15 |
| Wound irregularity | 0.5 |
| Epithelial migration | 0.15 |
| Epithelial proliferation | 0.08 |
| Fibroblast migration | 0.12 |
| Inflammation duration | 20 steps |
| Immune perimeter | radius + 1 |
| Immune cell density | 25% of perimeter |
| Fibroblast density | 5% of wound |
| Tissue island chance | 5% |
| Wound bed resistance | 0.8 (initial) |
| Early termination | 98% closure |

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
