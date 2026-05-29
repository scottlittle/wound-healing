# Wound Healing Simulation

A static web app implementing an energy healing wound healing simulation experiment.

**[Live Demo](https://wound-healing.pages.dev/)**

## Overview

This project is a browser-based version of the cellular automaton wound healing simulation. It allows users to run controlled experiments testing whether focused intention can influence wound healing outcomes.

## Features

- **Live simulation visualization**: Watch cells migrate, proliferate, and heal wounds in real-time
- **Control vs Intention phases**: Run both phases and compare results
- **Statistical analysis**: Log-transformed t-test, Cohen's d, bootstrap confidence intervals, percent faster
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
2. Wait for random seeds to load (fetched automatically on page load)
3. Configure the number of runs per phase
4. Click "Start Intention Phase" and apply energy healing during each run
5. Click "Run Analysis" to automatically run the control phase and compare results

## Random Seeds

Random seeds are fetched from the **ANU Quantum Random Number Generator (QRNG)** on page load. The API provides up to 1024 random numbers in a single call, which are stored and used for all runs in the session. This avoids rate limiting (1 minute wait between calls).

- API: `https://qrng.anu.edu.au/API/jsonI.php?length=1024&type=uint16`
- If the API is unavailable, falls back to `crypto.getRandomValues()` (system random)
- The seed source (`QUANTUM` or `SYSTEM`) is displayed in the status bar and analysis results

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

## Statistical Analysis

The analysis compares the Intention phase (with energy healing) against the Control phase (no healing) using several statistical methods:

### Methods

- **Log-Transformed T-Test**: Time-to-closure data is log-transformed before applying a two-sample t-test (Welch's). This handles the right-skewed distribution typical of time-to-event data and tests for multiplicative effects (e.g., "X% faster"). The log transform improves normality and statistical power.
- **Cohen's d**: Measures effect size on the log scale. Interpretation: < 0.2 = negligible, 0.2-0.5 = small, 0.5-0.8 = medium, > 0.8 = large.
- **Bootstrap Confidence Intervals**: 10,000 bootstrap resamples on log-transformed data to estimate 95% CI for the ratio of geometric means. Back-transformed to ratio scale for interpretation.

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| Time to 50% | Steps until wound is 50% closed |
| Time to 90% | Steps until wound is 90% closed |
| Time to 100% | Steps until wound reaches 98% closure (early termination) |

### Interpretation

- **Significant result (p < 0.05)**: The intention and control groups show a statistically detectable difference. Check the "% Faster" column to see the magnitude — e.g., "18% faster" means intention took 82% of the control time.
- **Non-significant result**: No statistical evidence of a difference was detected. This does not prove the groups are identical; it may indicate insufficient sample size or a very small effect.
- **Confidence intervals**: The 95% CI is expressed as a ratio. If the interval does not include 1.0, this supports a meaningful difference. For example, [0.75, 0.92] means intention was likely 8-25% faster.

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
