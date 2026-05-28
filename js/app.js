class App {
    constructor() {
        this.control_results = [];
        this.intention_results = [];
        this.control_curves = [];
        this.intention_curves = [];
        this.all_seeds = [];
        this.control_seeds = [];
        this.intention_seeds = [];
        this.seed_source = '';
        this.seedsReady = false;
        this.isRunning = false;
        this.controlComplete = false;
        this.intentionComplete = false;

        this.simCanvas = new Visualizer('sim-canvas');
        this.resultsCanvas = new Visualizer('cdf-100');

        this.btnControl = document.getElementById('btn-control');
        this.btnIntention = document.getElementById('btn-intention');
        this.btnAnalyze = document.getElementById('btn-analyze');
        this.status = document.getElementById('status');
        this.runCounter = document.getElementById('run-counter');
        this.timer = document.getElementById('timer');

        this.numRunsInput = document.getElementById('num-runs');

        this.btnControl.addEventListener('click', () => this.runControlPhase());
        this.btnIntention.addEventListener('click', () => this.runIntentionPhase());
        this.btnAnalyze.addEventListener('click', () => this.runAnalysis());

        document.getElementById('info-btn').addEventListener('click', () => {
            document.getElementById('info-modal').classList.remove('hidden');
        });
        document.getElementById('info-close').addEventListener('click', () => {
            document.getElementById('info-modal').classList.add('hidden');
        });

        this.drawInitialGrid();
        this.initSeeds();
    }

    async initSeeds() {
        this.setStatus('Fetching quantum random seeds from ANU QRNG...');
        this.all_seeds = await this.fetchQuantumSeeds(1024);
        this.seedsReady = true;
        this.btnControl.disabled = false;
        this.setStatus(`Ready — ${this.all_seeds.length} quantum seeds loaded (source: ${this.seed_source}). Proceed to control phase.`);
    }

    async fetchQuantumSeeds(n) {
        const url = `https://qrng.anu.edu.au/API/jsonI.php?length=${n}&type=uint16`;
        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'wound-healing-web/1.0' }
            });
            const data = await resp.json();
            if (data.success && data.data) {
                this.seed_source = 'ANU_QRNG';
                return data.data;
            }
        } catch (e) {
            console.log('ANU QRNG unavailable:', e);
        }

        this.seed_source = 'OS_ENTROPY';
        const seeds = [];
        for (let i = 0; i < n; i++) {
            seeds.push(crypto.getRandomValues(new Uint16Array(1))[0]);
        }
        return seeds;
    }

    drawInitialGrid() {
        const sim = new WoundSimulation({ seed: 42 });
        this.simCanvas.renderGrid(sim.grid, sim.grid_size, 'Wound Healing Simulation');
    }

    setStatus(text) {
        this.status.textContent = text;
    }

    setRunCounter(current, total) {
        this.runCounter.textContent = `Run: ${current} / ${total}`;
    }

    showTimer(text) {
        this.timer.textContent = text;
        this.timer.classList.remove('hidden');
    }

    hideTimer() {
        this.timer.classList.add('hidden');
    }

    async runControlPhase() {
        if (this.isRunning || !this.seedsReady) return;
        this.isRunning = true;

        const num_runs = parseInt(this.numRunsInput.value);
        const max_steps = 100;

        const total_needed = num_runs * 2;
        if (total_needed > this.all_seeds.length) {
            this.setStatus(`Not enough seeds. Need ${total_needed}, have ${this.all_seeds.length}. Reduce runs or refresh.`);
            this.isRunning = false;
            return;
        }

        this.btnControl.disabled = true;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        this.control_results = [];
        this.control_curves = [];

        this.control_seeds = this.all_seeds.slice(0, num_runs);
        this.intention_seeds = this.all_seeds.slice(num_runs, total_needed);

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = this.control_seeds[run_idx];
            this.setRunCounter(run_idx + 1, num_runs);

            const sim = new WoundSimulation({ seed });
            sim.run(max_steps);

            const result = {
                run_id: run_idx + 1,
                seed: seed,
                time_to_50: sim.metrics.time_to_50,
                time_to_90: sim.metrics.time_to_90,
                time_to_100: sim.metrics.time_to_100,
                total_steps: sim.metrics.total_steps,
                healing_curve: sim.metrics.healing_curve,
            };

            this.control_results.push(result);
            this.control_curves.push(sim.metrics.healing_curve);

            this.setStatus(`Control run ${run_idx + 1}/${num_runs} complete`);

            await this.sleep(10);
        }

        this.controlComplete = true;
        this.btnIntention.disabled = false;
        this.btnAnalyze.disabled = false;
        this.isRunning = false;
        this.setStatus('Control Phase Complete! Proceed to intention phase.');
    }

    async runIntentionPhase() {
        if (this.isRunning || !this.seedsReady) return;
        this.isRunning = true;

        const num_runs = parseInt(this.numRunsInput.value);
        const intention_duration = 10;
        const max_steps = 100;

        this.btnControl.disabled = true;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        this.intention_results = [];
        this.intention_curves = [];

        this.setStatus('Intention Phase Running...');

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = this.intention_seeds[run_idx];
            this.setRunCounter(run_idx + 1, num_runs);

            this.setStatus(`Run ${run_idx + 1}/${num_runs} - Apply energy healing now!`);

            const sim = new WoundSimulation({ seed });

            const healing_curve = [];
            let time_to_50 = null;
            let time_to_90 = null;
            let time_to_100 = null;
            let total_steps = 0;

            const start_time = performance.now();
            let step = 0;
            let elapsed = 0;

            while (elapsed < intention_duration * 1000 && step < max_steps) {
                const wound_pct = sim.get_wound_percentage();
                healing_curve.push(wound_pct);

                if (time_to_50 === null && wound_pct >= 50) time_to_50 = step;
                if (time_to_90 === null && wound_pct >= 90) time_to_90 = step;
                if (time_to_100 === null && wound_pct >= 98.0) time_to_100 = step;

                if (wound_pct >= 98.0) {
                    total_steps = step + 1;
                    break;
                }

                sim.step();
                step++;
                elapsed = performance.now() - start_time;

                const remaining = Math.max(0, intention_duration - Math.floor(elapsed / 1000));
                this.showTimer(`${remaining}s remaining | Step ${step} | ${wound_pct.toFixed(1)}% closed`);

                this.simCanvas.renderGrid(sim.grid, sim.grid_size, `Run ${run_idx + 1}`);

                await this.sleep(100);
            }

            while (step < max_steps) {
                const wound_pct = sim.get_wound_percentage();
                healing_curve.push(wound_pct);

                if (time_to_50 === null && wound_pct >= 50) time_to_50 = step;
                if (time_to_90 === null && wound_pct >= 90) time_to_90 = step;
                if (time_to_100 === null && wound_pct >= 98.0) time_to_100 = step;

                if (wound_pct >= 98.0) {
                    total_steps = step + 1;
                    break;
                }
                sim.step();
                step++;
            }

            if (time_to_100 === null && sim.get_wound_percentage() >= 98.0) {
                time_to_100 = total_steps;
            }

            const result = {
                run_id: run_idx + 1,
                seed: seed,
                time_to_50,
                time_to_90,
                time_to_100,
                total_steps,
                healing_curve,
            };

            this.intention_results.push(result);
            this.intention_curves.push(healing_curve);

            this.setStatus(`Run ${run_idx + 1} complete | 50%: ${time_to_50 ?? '-'} | 90%: ${time_to_90 ?? '-'} | 100%: ${time_to_100 ?? '-'}`);
            this.hideTimer();

            await this.sleep(500);
        }

        this.intentionComplete = true;
        this.btnAnalyze.disabled = false;
        this.isRunning = false;
        this.setStatus('Intention Phase Complete! Run analysis to compare results.');
    }

    runAnalysis() {
        if (this.intention_results.length === 0 || this.control_results.length === 0) {
            this.setStatus('ERROR: Both phases must be completed before analysis.');
            return;
        }

        this.setStatus('Running statistical analysis...');

        const results = Analysis.statisticalAnalysis(this.intention_results, this.control_results, 10000);

        if (results.length === 0) {
            this.setStatus('No metrics had enough valid data for statistical testing.');
            return;
        }

        this.displayStatsTable(results);
        this.displayCharts();
        this.displayInterpretation(results);

        this.setStatus('Analysis complete!');
    }

    displayStatsTable(results) {
        const table = document.getElementById('stats-table');
        const tbody = document.getElementById('stats-body');

        table.classList.remove('hidden');
        tbody.innerHTML = '';

        for (const r of results) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${r.metric_name.replace('_', ' ')}</td>
                <td>${r.intention_mean.toFixed(2)}</td>
                <td>${r.control_mean.toFixed(2)}</td>
                <td>${r.p_mann_whitney.toFixed(4)}</td>
                <td>${r.cohens_d.toFixed(3)}</td>
                <td>${r.significant_at_005 ? 'YES' : 'No'}</td>
                <td>[${r.bootstrap_ci_low.toFixed(2)}, ${r.bootstrap_ci_high.toFixed(2)}]</td>
            `;
            tbody.appendChild(row);
        }
    }

    displayCharts() {
        const time_to_100_int = this.intention_results.filter(r => r.time_to_100 !== null).map(r => r.time_to_100);
        const time_to_100_ctl = this.control_results.filter(r => r.time_to_100 !== null).map(r => r.time_to_100);

        this.resultsCanvas.drawCDF('cdf-100', time_to_100_int, time_to_100_ctl, 'CDF: Time to 100% Closure');
        this.resultsCanvas.drawBoxPlot('boxplot-100', time_to_100_int, time_to_100_ctl, 'Time to 100% Closure');
    }

    displayInterpretation(results) {
        const container = document.getElementById('interpretation');
        const content = document.getElementById('interpretation-content');

        container.classList.remove('hidden');

        let html = '<ul>';
        for (const r of results) {
            const sig = r.significant_at_005 ? (r.significant_at_001 ? 'highly significant' : 'significant') : 'not significant';
            const direction = r.intention_mean < r.control_mean ? 'faster' : 'slower';
            const effect_size = Math.abs(r.cohens_d) < 0.2 ? 'negligible' : Math.abs(r.cohens_d) < 0.5 ? 'small' : Math.abs(r.cohens_d) < 0.8 ? 'medium' : 'large';

            html += `<li><strong>${r.metric_name.replace('_', ' ')}:</strong> ${sig} (p=${r.p_mann_whitney.toFixed(4)}). Intention group was ${direction} (Cohen's d=${r.cohens_d.toFixed(3)}, ${effect_size} effect). 95% CI: [${r.bootstrap_ci_low.toFixed(2)}, ${r.bootstrap_ci_high.toFixed(2)}]</li>`;
        }
        html += '</ul>';

        const any_significant = results.some(r => r.significant_at_005);
        if (any_significant) {
            html += '<p class="positive">A statistically significant difference was detected between intention and control groups.</p>';
        } else {
            html += '<p class="neutral">No statistically significant difference was detected between intention and control groups.</p>';
        }

        html += `<p class="seed-info">Seed source: <strong>${this.seed_source}</strong></p>`;

        content.innerHTML = html;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
