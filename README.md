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
