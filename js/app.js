class App {
    constructor() {
        this.control_results = [];
        this.intention_results = [];
        this.control_curves = [];
        this.intention_curves = [];
        this.isRunning = false;
        this.controlComplete = false;
        this.intentionComplete = false;

        this.simCanvas = new Visualizer('sim-canvas');
        this.curveCanvas = new Visualizer('healing-curve');

        this.btnControl = document.getElementById('btn-control');
        this.btnIntention = document.getElementById('btn-intention');
        this.btnAnalyze = document.getElementById('btn-analyze');
        this.btnReset = document.getElementById('btn-reset');
        this.status = document.getElementById('status');
        this.runCounter = document.getElementById('run-counter');
        this.timer = document.getElementById('timer');

        this.numRunsInput = document.getElementById('num-runs');
        this.intentionDurationInput = document.getElementById('intention-duration');
        this.maxStepsInput = document.getElementById('max-steps');

        this.btnControl.addEventListener('click', () => this.runControlPhase());
        this.btnIntention.addEventListener('click', () => this.runIntentionPhase());
        this.btnAnalyze.addEventListener('click', () => this.runAnalysis());
        this.btnReset.addEventListener('click', () => this.reset());

        this.drawInitialGrid();
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
        if (this.isRunning) return;
        this.isRunning = true;

        const num_runs = parseInt(this.numRunsInput.value);
        const max_steps = parseInt(this.maxStepsInput.value);

        this.btnControl.disabled = true;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        this.control_results = [];
        this.control_curves = [];

        this.setStatus('Control Phase Running...');

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = Math.floor(Math.random() * 2147483647);
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
        if (this.isRunning) return;
        this.isRunning = true;

        const num_runs = parseInt(this.numRunsInput.value);
        const intention_duration = parseInt(this.intentionDurationInput.value);
        const max_steps = parseInt(this.maxStepsInput.value);

        this.btnControl.disabled = true;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        this.intention_results = [];
        this.intention_curves = [];

        this.setStatus('Intention Phase Running...');

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = Math.floor(Math.random() * 2147483647);
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
                if (time_to_100 === null && wound_pct >= 99.5) time_to_100 = step;

                sim.step();
                step++;
                elapsed = performance.now() - start_time;

                const remaining = Math.max(0, intention_duration - Math.floor(elapsed / 1000));
                this.showTimer(`${remaining}s remaining | Step ${step} | ${wound_pct.toFixed(1)}% closed`);

                this.simCanvas.renderGrid(sim.grid, sim.grid_size, `Run ${run_idx + 1}`);

                this.curveCanvas.drawLineChart('healing-curve', [
                    { data: healing_curve, color: '#4a90d9', lineWidth: 2 }
                ], {
                    title: 'Healing Curve',
                    xLabel: 'Step',
                    yLabel: 'Wound Closure (%)',
                    maxY: 105,
                    minY: 0,
                    showLines: [
                        { value: 50, color: 'rgba(100,100,100,0.5)' },
                        { value: 90, color: 'rgba(100,100,100,0.5)' },
                    ]
                });

                await this.sleep(50);
            }

            while (step < max_steps) {
                const wound_pct = sim.get_wound_percentage();
                healing_curve.push(wound_pct);

                if (time_to_50 === null && wound_pct >= 50) time_to_50 = step;
                if (time_to_90 === null && wound_pct >= 90) time_to_90 = step;
                if (time_to_100 === null && wound_pct >= 99.5) time_to_100 = step;

                if (wound_pct >= 99.5) {
                    total_steps = step + 1;
                    break;
                }
                sim.step();
                step++;
            }

            if (time_to_100 === null && sim.get_wound_percentage() >= 99.5) {
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
        const max_len = Math.max(
            ...this.intention_curves.map(c => c.length),
            ...this.control_curves.map(c => c.length)
        );

        const intention_padded = this.intention_curves.map(c => {
            const padded = [...c];
            while (padded.length < max_len) padded.push(padded[padded.length - 1]);
            return padded;
        });

        const control_padded = this.control_curves.map(c => {
            const padded = [...c];
            while (padded.length < max_len) padded.push(padded[padded.length - 1]);
            return padded;
        });

        const intention_mean = [];
        const intention_sem = [];
        const control_mean = [];
        const control_sem = [];

        for (let i = 0; i < max_len; i++) {
            const int_vals = intention_padded.map(c => c[i]);
            const ctl_vals = control_padded.map(c => c[i]);

            intention_mean.push(int_vals.reduce((a, b) => a + b, 0) / int_vals.length);
            control_mean.push(ctl_vals.reduce((a, b) => a + b, 0) / ctl_vals.length);

            const int_std = Math.sqrt(int_vals.reduce((sum, v) => sum + (v - intention_mean[i]) ** 2, 0) / int_vals.length);
            const ctl_std = Math.sqrt(ctl_vals.reduce((sum, v) => sum + (v - control_mean[i]) ** 2, 0) / ctl_vals.length);

            intention_sem.push(int_std / Math.sqrt(int_vals.length));
            control_sem.push(ctl_std / Math.sqrt(ctl_vals.length));
        }

        this.curveCanvas.drawLineChart('mean-curves', [
            { data: intention_mean, color: '#4a90d9', lineWidth: 2, fillColor: 'rgba(74, 144, 217, 0.1)' },
            { data: control_mean, color: '#e74c3c', lineWidth: 2, fillColor: 'rgba(231, 76, 60, 0.1)' },
        ], {
            title: 'Mean Healing Curves with SEM',
            xLabel: 'Time Step',
            yLabel: 'Wound Closure (%)',
            maxY: 105,
            minY: 0,
            showLines: [
                { value: 50, color: 'rgba(100,100,100,0.5)' },
                { value: 90, color: 'rgba(100,100,100,0.5)' },
            ],
            legend: [
                { label: `Intention (n=${this.intention_results.length})`, color: '#4a90d9' },
                { label: `Control (n=${this.control_results.length})`, color: '#e74c3c' },
            ]
        });

        const time_to_50_int = this.intention_results.filter(r => r.time_to_50 !== null).map(r => r.time_to_50);
        const time_to_50_ctl = this.control_results.filter(r => r.time_to_50 !== null).map(r => r.time_to_50);

        this.curveCanvas.drawCDF('cdf-50', time_to_50_int, time_to_50_ctl, 'CDF: Time to 50% Closure');
        this.curveCanvas.drawBoxPlot('boxplot-50', time_to_50_int, time_to_50_ctl, 'Time to 50% Closure');

        const time_to_90_int = this.intention_results.filter(r => r.time_to_90 !== null).map(r => r.time_to_90);
        const time_to_90_ctl = this.control_results.filter(r => r.time_to_90 !== null).map(r => r.time_to_90);

        this.curveCanvas.drawBoxPlot('boxplot-90', time_to_90_int, time_to_90_ctl, 'Time to 90% Closure');
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

        content.innerHTML = html;
    }

    reset() {
        if (this.isRunning) return;

        this.control_results = [];
        this.intention_results = [];
        this.control_curves = [];
        this.intention_curves = [];
        this.controlComplete = false;
        this.intentionComplete = false;

        this.btnControl.disabled = false;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        this.setStatus('Ready to begin');
        this.setRunCounter(0, 0);
        this.hideTimer();

        document.getElementById('stats-table').classList.add('hidden');
        document.getElementById('interpretation').classList.add('hidden');

        this.drawInitialGrid();

        const ctx = document.getElementById('healing-curve').getContext('2d');
        ctx.clearRect(0, 0, 400, 200);

        for (const id of ['mean-curves', 'cdf-50', 'boxplot-50', 'boxplot-90']) {
            const c = document.getElementById(id);
            if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
