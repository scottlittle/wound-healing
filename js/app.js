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
        this.resultsCanvas = new Visualizer('cdf-99');

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
        this.setStatus('Fetching random seeds...');
        this.all_seeds = await this.fetchQuantumSeeds(1024);
        this.seedsReady = true;
        this.btnIntention.disabled = false;
        this.setStatus(`Ready — random seeds loaded (source: ${this.seed_source}). Proceed to intention phase.`);
    }

    async fetchQuantumSeeds(n) {
        const url = `https://qrng.anu.edu.au/API/jsonI.php?length=${n}&type=uint16`;
        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'wound-healing-web/1.0' }
            });
            const data = await resp.json();
            if (data.success && data.data) {
                this.seed_source = 'QUANTUM';
                const seeds32 = [];
                for (let i = 0; i < data.data.length - 1; i += 2) {
                    seeds32.push((data.data[i] << 16) | data.data[i + 1]);
                }
                return seeds32;
            }
        } catch (e) {
            console.log('ANU QRNG unavailable:', e);
        }

        this.seed_source = 'SYSTEM';
        const seeds = [];
        for (let i = 0; i < n / 2; i++) {
            seeds.push(crypto.getRandomValues(new Uint32Array(1))[0]);
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
                time_to_99: sim.metrics.time_to_99,
                time_to_100: sim.metrics.time_to_100,
                total_time: sim.metrics.total_time,
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

        this.intention_results = [];
        this.intention_curves = [];

        this.intention_seeds = this.all_seeds.slice(0, num_runs);

        this.setStatus('Intention Phase Running...');

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = this.intention_seeds[run_idx];
            this.setRunCounter(run_idx + 1, num_runs);

            const companion = this.generateCompanion();
            this.setStatus(`Run ${run_idx + 1}/${num_runs} - Apply energy healing!`);

            const sim = new WoundSimulation({ seed });

            const healing_curve = [];
            let time_to_50 = null;
            let time_to_90 = null;
            let time_to_99 = null;
            let time_to_100 = null;
            let total_time = 0;

            let step = 0;

            while (step < max_steps) {
                const wound_pct = sim.get_wound_percentage();
                healing_curve.push(wound_pct);

                if (time_to_50 === null && wound_pct >= 50) time_to_50 = step;
                if (time_to_90 === null && wound_pct >= 90) time_to_90 = step;
                if (time_to_99 === null && wound_pct >= 99.0) time_to_99 = step;
                if (time_to_100 === null && wound_pct >= 99.9) time_to_100 = step;

                if (wound_pct >= 99.9) {
                    total_time = step + 1;
                    break;
                }

                sim.step();
                step++;

                this.showTimer(`Step ${step} | ${wound_pct.toFixed(1)}% closed`);
                this.simCanvas.renderGrid(sim.grid, sim.grid_size, `Run ${run_idx + 1} - ${companion.name}`);

                if (wound_pct < 98.0) {
                    await this.sleep(100);
                }
            }

            if (total_time === 0) {
                total_time = max_steps;
            }

            if (time_to_99 === null && sim.get_wound_percentage() >= 99.0) {
                time_to_99 = total_time;
            }
            if (time_to_100 === null && sim.get_wound_percentage() >= 99.9) {
                time_to_100 = total_time;
            }

            const result = {
                run_id: run_idx + 1,
                seed: seed,
                time_to_50,
                time_to_90,
                time_to_99,
                time_to_100,
                total_time,
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
        this.setStatus('Intention Phase Complete! Click "Run Analysis" to run control phase and compare results.');
    }

    async runAnalysis() {
        if (this.intention_results.length === 0) {
            this.setStatus('ERROR: Intention phase must be completed first.');
            return;
        }

        this.btnControl.disabled = true;
        this.btnIntention.disabled = true;
        this.btnAnalyze.disabled = true;

        const num_runs = this.intention_results.length;
        const max_steps = 100;

        const total_needed = num_runs * 2;
        if (total_needed > this.all_seeds.length) {
            this.setStatus(`Not enough seeds. Need ${total_needed}, have ${this.all_seeds.length}. Reduce runs or refresh.`);
            this.isRunning = false;
            return;
        }

        this.control_results = [];
        this.control_curves = [];

        const offset = num_runs;
        const control_seeds = this.all_seeds.slice(offset, offset + num_runs);

        for (let run_idx = 0; run_idx < num_runs; run_idx++) {
            const seed = control_seeds[run_idx];
            this.setRunCounter(run_idx + 1, num_runs);

            const sim = new WoundSimulation({ seed });
            sim.run(max_steps);

            const result = {
                run_id: run_idx + 1,
                seed: seed,
                time_to_50: sim.metrics.time_to_50,
                time_to_90: sim.metrics.time_to_90,
                time_to_99: sim.metrics.time_to_99,
                time_to_100: sim.metrics.time_to_100,
                total_time: sim.metrics.total_time,
                healing_curve: sim.metrics.healing_curve,
            };

            this.control_results.push(result);
            this.control_curves.push(sim.metrics.healing_curve);

            this.setStatus(`Control run ${run_idx + 1}/${num_runs} complete`);

            await this.sleep(10);
        }

        this.controlComplete = true;
        this.setStatus('Running statistical analysis...');

        const results = Analysis.statisticalAnalysis(this.intention_results, this.control_results, 10000);

        if (results.length === 0) {
            this.setStatus('No metrics had enough valid data for statistical testing.');
            return;
        }

        this.displayStatsTable(results);
        this.displayCharts();
        this.displayInterpretation(results);
        this.showDownloadButton(results);

        this.setStatus('Analysis complete! Scroll down to see results.');
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
                <td>${r.p_value.toFixed(4)}</td>
                <td>${r.cohens_d.toFixed(3)}</td>
                <td>${r.percent_faster.toFixed(2)}%</td>
                <td>${r.significant_at_005 ? 'YES' : 'No'}</td>
                <td>[${r.bootstrap_ci_low.toFixed(3)}, ${r.bootstrap_ci_high.toFixed(3)}]</td>
            `;
            tbody.appendChild(row);
        }
    }

    displayCharts() {
        const time_to_99_int = this.intention_results.filter(r => r.time_to_99 !== null).map(r => r.time_to_99);
        const time_to_99_ctl = this.control_results.filter(r => r.time_to_99 !== null).map(r => r.time_to_99);

        this.resultsCanvas.drawCDF('cdf-99', time_to_99_int, time_to_99_ctl, 'CDF: Time to 99% Closure');
        this.resultsCanvas.drawBoxPlot('boxplot-99', time_to_99_int, time_to_99_ctl, 'Time to 99% Closure');
    }

    displayInterpretation(results) {
        const container = document.getElementById('interpretation');
        const content = document.getElementById('interpretation-content');

        container.classList.remove('hidden');

        let html = '<ul>';
        for (const r of results) {
            const sig = r.significant_at_005 ? (r.significant_at_001 ? 'highly significant' : 'significant') : 'not significant';
            const direction = r.percent_faster > 0 ? `${r.percent_faster.toFixed(2)}% faster` : `${Math.abs(r.percent_faster).toFixed(2)}% slower`;
            const effect_size = Math.abs(r.cohens_d) < 0.2 ? 'negligible' : Math.abs(r.cohens_d) < 0.5 ? 'small' : Math.abs(r.cohens_d) < 0.8 ? 'medium' : 'large';

            html += `<li><strong>${r.metric_name.replace('_', ' ')}:</strong> ${sig} (p=${r.p_value.toFixed(4)}). Intention group was ${direction} (Cohen's d=${r.cohens_d.toFixed(3)}, ${effect_size} effect). 95% CI: [${r.bootstrap_ci_low.toFixed(3)}, ${r.bootstrap_ci_high.toFixed(3)}]</li>`;
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

    showDownloadButton(stats) {
        const btn = document.getElementById('btn-download');
        btn.style.display = 'inline-block';
        btn.onclick = () => this.downloadResults(stats);
    }

    async downloadResults(stats) {
        const zip = new JSZip();

        const intentionCSV = this.resultsToCSV(this.intention_results, 'intention');
        const controlCSV = this.resultsToCSV(this.control_results, 'control');
        const statsCSV = this.statsToCSV(stats);

        zip.file('intention_results.csv', intentionCSV);
        zip.file('control_results.csv', controlCSV);
        zip.file('statistical_analysis.csv', statsCSV);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wound-healing-results-${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }

    resultsToCSV(results, phase) {
        const headers = ['run_id', 'seed', 'time_to_50', 'time_to_90', 'time_to_99', 'time_to_100', 'total_time'];
        let csv = headers.join(',') + '\n';
        for (const r of results) {
            csv += `${r.run_id},${r.seed},${r.time_to_50 ?? ''},${r.time_to_90 ?? ''},${r.time_to_99 ?? ''},${r.time_to_100 ?? ''},${r.total_time}\n`;
        }
        return csv;
    }

    statsToCSV(stats) {
        const headers = ['metric', 'intention_mean', 'control_mean', 'p_value', 'cohens_d', 'percent_faster', 'significant', 'ci_low', 'ci_high'];
        let csv = headers.join(',') + '\n';
        for (const r of stats) {
            csv += `${r.metric_name},${r.intention_mean.toFixed(4)},${r.control_mean.toFixed(4)},${r.p_value.toFixed(6)},${r.cohens_d.toFixed(4)},${r.percent_faster.toFixed(4)},${r.significant_at_005},${r.bootstrap_ci_low.toFixed(4)},${r.bootstrap_ci_high.toFixed(4)}\n`;
        }
        return csv;
    }

    generateCompanion() {
        const catNames = [
            'Whiskers', 'Mittens', 'Shadow', 'Luna', 'Felix', 'Cleo', 'Nimbus',
            'Patches', 'Ginger', 'Smokey', 'Jasper', 'Willow', 'Binx', 'Mochi',
            'Pepper', 'Olive', 'Salem', 'Jinx', 'Tofu', 'Miso', 'Noodle',
            'Bean', 'Pip', 'Ziggy', 'Cosmo', 'Maple', 'Hazel', 'Ivy',
            'Ash', 'Storm', 'Misty', 'Dusty', 'Cocoa', 'Rusty', 'Amber',
            'Pearl', 'Jade', 'Ruby', 'Onyx', 'Snow', 'Frost', 'Ember',
            'Bella', 'Simba', 'Nala', 'Tiger', 'Oreo', 'Kitty', 'Lucy',
            'Charlie', 'Milo', 'Oliver', 'Leo', 'Loki', 'Stella', 'Chloe',
            'Zoe', 'Lily', 'Ellie', 'Kitten', 'Angel', 'Baby', 'Sam',
            'Tigger', 'Calico', 'Siamese', 'Persian', 'Tabby', 'Maine',
            'Ragdoll', 'Sphynx', 'Bengal', 'Abyssinian', 'Birman', 'Burmese',
            'Chartreux', 'Cornish', 'Devon', 'Egyptian', 'Exotic', 'Havana',
            'Japanese', 'Korat', 'LaPerm', 'Manx', 'Norwegian', 'Ocicat',
            'Oriental', 'Pixiebob', 'Ragamuffin', 'Russian', 'Savannah', 'Scottish',
            'Selkirk', 'Singapura', 'Snowshoe', 'Somali', 'Tonkinese', 'Turkish',
            'Balinese', 'Bobtail', 'Chausie', 'Cheetoh', 'Cymric', 'Donskoy',
            'Elf', 'German', 'Highlander', 'Khao', 'Kurilian', 'Lambkin',
            'Lykoi', 'Minskin', 'Napoleon', 'Nebelung', 'Peterbald', 'Serengeti',
            'Sokoke', 'Toyger', 'Ukrainian', 'York', 'Paws', 'Claws',
            'Furball', 'Purrfect', 'Meow', 'Hiss', 'Pounce', 'Sneak',
            'Creep', 'Stalk', 'Leap', 'Bound', 'Spring', 'Jump',
            'Hop', 'Skip', 'Dash', 'Run', 'Sprint', 'Race', 'Zoom',
            'Swoop', 'Dive', 'Swoosh', 'Flutter', 'Glide', 'Soar',
            'Float', 'Drift', 'Sail', 'Cruise', 'Coast', 'Slide',
            'Slip', 'Skid', 'Skate', 'Roll', 'Spin', 'Twirl',
            'Whirl', 'Swirl', 'Circle', 'Loop', 'Arc', 'Curve',
            'Bend', 'Turn', 'Twist', 'Flip', 'Flop', 'Tumble',
            'Cartwheel', 'Somersault', 'Backflip', 'Frontflip', 'Handspring',
            'Vault', 'Hurdle', 'Leapfrog', 'Skipjack', 'Jumping', 'Bouncing',
            'Hopping', 'Skipping', 'Dancing', 'Prancing', 'Strutting', 'Striding',
            'Walking', 'Strolling', 'Wandering', 'Roaming', 'Roving', 'Exploring',
            'Discovering', 'Finding', 'Seeking', 'Searching', 'Hunting', 'Tracking',
            'Tracing', 'Following', 'Chasing', 'Pursuing', 'Stalking', 'Shadowing',
            'Watching', 'Observing', 'Peering', 'Staring', 'Gazing', 'Glancing',
            'Looking', 'Seeing', 'Viewing', 'Spotting', 'Noticing', 'Detecting',
            'Sensing', 'Feeling', 'Touching', 'Petting', 'Rubbing', 'Nuzzling',
            'Snuggling', 'Cuddling', 'Nesting', 'Resting', 'Sleeping', 'Dreaming',
            'Napping', 'Dozing', 'Slumbering', 'Snoozing', 'Drowsing', 'Nodding',
            'Yawning', 'Stretching', 'Purring', 'Chirping', 'Trilling', 'Chattering',
            'Caterwauling', 'Howling', 'Yowling', 'Screaming', 'Shrieking',
            'Screeching', 'Squeaking', 'Squealing', 'Whimpering', 'Whining', 'Crying',
            'Weeping', 'Sobbing', 'Bawling', 'Wailing', 'Keening', 'Lamenting',
            'Mourning', 'Grieving', 'Sorrowing', 'Pining', 'Longing', 'Yearning',
            'Wishing', 'Hoping', 'Imagining', 'Fantasizing', 'Wondering',
            'Thinking', 'Pondering', 'Musing', 'Reflecting', 'Contemplating',
            'Meditating', 'Praying', 'Blessing', 'Thanking', 'Praising', 'Worshipping',
            'Adoring', 'Loving', 'Caring', 'Nurturing', 'Protecting', 'Guarding',
            'Keeping', 'Holding', 'Embracing', 'Hugging', 'Squeezing', 'Kissing',
            'Licking', 'Grooming', 'Cleaning', 'Washing', 'Bathing', 'Splashing',
            'Playing', 'Frolicking', 'Romping', 'Rambuncting', 'Roughhousing',
            'Wrestling', 'Fighting', 'Battling', 'Clashing', 'Striking', 'Hitting',
            'Punching', 'Kicking', 'Scratching', 'Clawing', 'Biting', 'Nibbling',
            'Chewing', 'Gnawing', 'Munching', 'Crunching', 'Snacking', 'Eating',
            'Feasting', 'Dining', 'Savoring', 'Tasting', 'Sampling', 'Devouring',
            'Gobbling', 'Wolfing', 'Inhaling', 'Swallowing', 'Gulping', 'Drinking',
            'Sipping', 'Slurping', 'Lapping', 'Paddling', 'Swimming', 'Floating',
            'Bobbing', 'Diving', 'Plunging', 'Sinking', 'Dipping', 'Dunking',
            'Soaking', 'Wetting', 'Drenching', 'Dampening', 'Moistening', 'Humidifying',
            'Misting', 'Spraying', 'Spritzing', 'Squirting', 'Shooting', 'Blasting',
            'Bursting', 'Exploding', 'Popping', 'Cracking', 'Snapping', 'Breaking',
            'Shattering', 'Smashing', 'Crushing', 'Squashing', 'Squeezing', 'Pressing',
            'Pushing', 'Shoving', 'Thrusting', 'Driving', 'Forcing', 'Compelling',
            'Urging', 'Encouraging', 'Motivating', 'Inspiring', 'Stimulating',
            'Exciting', 'Thrilling', 'Electrifying', 'Invigorating', 'Energizing',
            'Revitalizing', 'Rejuvenating', 'Refreshing', 'Renewing', 'Restoring',
            'Healing', 'Curing', 'Mending', 'Fixing', 'Repairing', 'Patching',
            'Darning', 'Sewing', 'Stitching', 'Knitting', 'Weaving', 'Spinning',
            'Twisting', 'Turning', 'Rotating', 'Revolving', 'Orbiting', 'Circling',
            'Looping', 'Coiling', 'Winding', 'Wrapping', 'Binding', 'Tying',
            'Knotting', 'Lacing', 'Stringing', 'Threading', 'Braiding', 'Plaiting',
            'Tangling', 'Snarling', 'Messing', 'Cluttering', 'Jumbling', 'Mixing',
            'Blending', 'Merging', 'Combining', 'Uniting', 'Joining', 'Connecting',
            'Linking', 'Attaching', 'Fastening', 'Securing', 'Locking', 'Bolting',
            'Latching', 'Clasping', 'Gripping', 'Grasping', 'Clutching', 'Seizing',
            'Grabbing', 'Snatching', 'Capturing', 'Catching', 'Trapping', 'Ensnaring',
            'Entangling', 'Enmeshing', 'Embroiling', 'Involving', 'Engaging',
            'Participating', 'Competing', 'Contesting', 'Vying', 'Striving',
            'Struggling', 'Warring', 'Combating', 'Conflicting', 'Colliding',
            'Crashing', 'Bumping', 'Pounding', 'Hammering', 'Beating', 'Pulsing',
            'Throbbing', 'Vibrating', 'Shaking', 'Trembling', 'Quivering', 'Shivering',
            'Shuddering', 'Quaking', 'Tremoring', 'Rumbling', 'Roaring', 'Bellowing',
            'Barking', 'Yapping', 'Yipping', 'Baying', 'Wailing', 'Sobbing',
            'Whimpering', 'Moaning', 'Groaning', 'Sighing', 'Breathing', 'Gasping',
            'Panting', 'Wheezing', 'Coughing', 'Sneezing', 'Sniffing', 'Snorting',
            'Blowing', 'Puffing', 'Huffing', 'Exhaling', 'Inhaling', 'Living',
            'Existing', 'Being', 'Becoming', 'Growing', 'Developing', 'Maturing',
            'Aging', 'Ripening', 'Blossoming', 'Flowering', 'Blooming', 'Sprouting',
            'Germinating', 'Seeding', 'Planting', 'Sowing', 'Harvesting', 'Reaping',
            'Gathering', 'Collecting', 'Accumulating', 'Amassing', 'Stockpiling',
            'Hoarding', 'Saving', 'Storing', 'Preserving', 'Conserving', 'Shielding',
            'Sheltering', 'Harboring', 'Housing', 'Accommodating', 'Hosting',
            'Entertaining', 'Amusing', 'Delighting', 'Pleasing', 'Satisfying',
            'Gratifying', 'Fulfilling', 'Completing', 'Finishing', 'Ending',
            'Concluding', 'Terminating', 'Stopping', 'Halting', 'Pausing', 'Resting',
            'Waiting', 'Lingering', 'Loitering', 'Dawdling', 'Dallying', 'Delaying',
            'Postponing', 'Deferring', 'Procrastinating', 'Stalling', 'Hesitating',
            'Wavering', 'Vacillating', 'Oscillating', 'Fluctuating', 'Varying',
            'Changing', 'Shifting', 'Altering', 'Modifying', 'Adjusting', 'Adapting',
            'Transforming', 'Converting', 'Transmuting', 'Metamorphosing', 'Evolving',
        ];

        const dogNames = [
            'Barkley', 'Spot', 'Rex', 'Buddy', 'Max', 'Daisy', 'Cooper',
            'Bailey', 'Sadie', 'Molly', 'Rocky', 'Bear', 'Duke', 'Tucker',
            'Charlie', 'Milo', 'Oscar', 'Toby', 'Jack', 'Scout', 'Rosie',
            'Lola', 'Zoe', 'Penny', 'Ginger', 'Piper', 'Winnie', 'Lily',
            'Rusty', 'Buster', 'Ranger', 'Dash', 'Blaze', 'Bolt', 'Chase',
            'Hunter', 'Wolf', 'Fang', 'Bruno', 'Zeus', 'Thor', 'Apollo',
            'Hercules', 'Titan', 'Atlas', 'Odin', 'Loki', 'Fenrir', 'Gunner',
            'Tracker', 'Stalker', 'Phantom', 'Ghost', 'Spirit', 'Mystic',
            'Magic', 'Wizard', 'Sorcerer', 'Warlock', 'Mage', 'Druid',
            'Shaman', 'Sage', 'Oracle', 'Prophet', 'Seer', 'Vision',
            'Dream', 'Nightmare', 'Terror', 'Horror', 'Fear', 'Dread',
            'Panic', 'Fright', 'Scare', 'Shock', 'Surprise', 'Amaze',
            'Astonish', 'Astound', 'Stun', 'Daze', 'Confuse', 'Baffle',
            'Perplex', 'Puzzle', 'Mystery', 'Enigma', 'Riddle', 'Question',
            'Answer', 'Solution', 'Result', 'Outcome', 'Effect', 'Consequence',
            'Impact', 'Influence', 'Power', 'Force', 'Strength', 'Might',
            'Energy', 'Vigor', 'Vitality', 'Life', 'Spirit', 'Soul',
            'Heart', 'Mind', 'Brain', 'Thought', 'Idea', 'Concept',
            'Notion', 'Theory', 'Hypothesis', 'Premise', 'Assumption', 'Belief',
            'Faith', 'Trust', 'Hope', 'Wish', 'Goal', 'Target',
            'Aim', 'Purpose', 'Mission', 'Quest', 'Journey', 'Voyage',
            'Trip', 'Travel', 'Adventure', 'Expedition', 'Exploration', 'Discovery',
            'Finding', 'Treasure', 'Prize', 'Reward', 'Gift', 'Present',
            'Offering', 'Sacrifice', 'Tribute', 'Honor', 'Glory', 'Fame',
            'Renown', 'Prestige', 'Status', 'Rank', 'Position', 'Title',
            'Name', 'Label', 'Tag', 'Mark', 'Sign', 'Symbol',
            'Token', 'Badge', 'Emblem', 'Crest', 'Shield', 'Armor',
            'Helmet', 'Crown', 'Tiara', 'Ring', 'Necklace', 'Bracelet',
            'Anklet', 'Earring', 'Pendant', 'Charm', 'Amulet', 'Talisman',
            'Relic', 'Artifact', 'Antique', 'Vintage', 'Classic', 'Retro',
            'Old', 'Ancient', 'Primeval', 'Prehistoric', 'Fossil', 'Bone',
            'Skeleton', 'Skull', 'Head', 'Face', 'Muzzle', 'Snout',
            'Nose', 'Mouth', 'Teeth', 'Fangs', 'Canines', 'Incisors',
            'Molars', 'Jaw', 'Chin', 'Cheek', 'Ear', 'Ears',
            'Tail', 'Paw', 'Paws', 'Claws', 'Nails', 'Fur',
            'Coat', 'Hair', 'Mane', 'Ruff', 'Collar', 'Leash',
            'Lead', 'Chain', 'Rope', 'Cord', 'String', 'Thread',
            'Wire', 'Cable', 'Lasso', 'Snare', 'Trap', 'Cage',
            'Kennel', 'Den', 'Lair', 'Nest', 'Home', 'House',
            'Shelter', 'Haven', 'Refuge', 'Sanctuary', 'Retreat', 'Hideaway',
            'Hideout', 'Secret', 'Private', 'Personal', 'Special', 'Unique',
            'Rare', 'Uncommon', 'Unusual', 'Strange', 'Odd', 'Weird',
            'Bizarre', 'Freaky', 'Crazy', 'Mad', 'Wild', 'Fierce',
            'Savage', 'Brutal', 'Ruthless', 'Merciless', 'Relentless', 'Tireless',
            'Endless', 'Infinite', 'Eternal', 'Everlasting', 'Immortal', 'Deathless',
            'Undying', 'Resilient', 'Tough', 'Strong', 'Hardy', 'Sturdy',
            'Solid', 'Firm', 'Stable', 'Steady', 'Constant', 'Fixed',
            'Settled', 'Established', 'Founded', 'Built', 'Created', 'Made',
            'Formed', 'Shaped', 'Molded', 'Crafted', 'Designed', 'Planned',
            'Prepared', 'Ready', 'Set', 'Go', 'Start', 'Begin',
            'Launch', 'Initiate', 'Commence', 'Open', 'Unlock', 'Release',
            'Free', 'Liberate', 'Emancipate', 'Deliver', 'Save', 'Rescue',
            'Recover', 'Retrieve', 'Return', 'Restore', 'Renew', 'Refresh',
            'Revive', 'Awaken', 'Rouse', 'Stir', 'Wake', 'Alert',
            'Vigilant', 'Watchful', 'Observant', 'Attentive', 'Aware', 'Conscious',
            'Mindful', 'Thoughtful', 'Considerate', 'Kind', 'Gentle', 'Sweet',
            'Nice', 'Good', 'Fine', 'Great', 'Excellent', 'Superb',
            'Wonderful', 'Marvelous', 'Fantastic', 'Amazing', 'Incredible', 'Unbelievable',
            'Extraordinary', 'Remarkable', 'Outstanding', 'Exceptional', 'Phenomenal',
            'Spectacular', 'Magnificent', 'Glorious', 'Majestic', 'Grand', 'Noble',
            'Royal', 'Regal', 'Imperial', 'Sovereign', 'Supreme', 'Ultimate',
            'Final', 'Last', 'End', 'Finish', 'Complete', 'Done', 'Finished',
            'Ace', 'Bandit', 'Copper', 'Diesel', 'Echo', 'Fargo', 'Gizmo',
            'Hank', 'Iggy', 'Jax', 'Koda', 'Lucky', 'Moose', 'Nero',
            'Otis', 'Pongo', 'Quinn', 'Radar', 'Sarge', 'Tank', 'Uriah',
            'Vader', 'Winston', 'Xander', 'Yogi', 'Zorro', 'Arlo', 'Cody',
            'Dexter', 'Elvis', 'Finn', 'Gus', 'Harley', 'Ivan', 'Jasper',
            'Kobe', 'Louie', 'Maverick', 'Nash', 'Ollie', 'Peanut', 'Rocco',
            'Samson', 'Teddy', 'Ulysses', 'Vince', 'Woody', 'Xena', 'Yukon',
            'Ziggy', 'Ajax', 'Bane', 'Casper', 'Drake', 'Eddie', 'Flash',
            'Goliath', 'Iron', 'Jett', 'Khan', 'Lance', 'Mason', 'Niko',
            'Orion', 'Pudge', 'Rexy', 'Spike', 'Urban', 'Viper', 'Waldo',
            'Yoda', 'Zane', 'Alpha', 'Bravo', 'Delta', 'Eagle', 'Falcon',
            'Griffin', 'Hawk', 'Ibis', 'Jaguar', 'Kestrel', 'Lynx', 'Mantis',
            'Osprey', 'Phoenix', 'Quail', 'Raven', 'Sparrow', 'Talon', 'Umbra',
            'Vulture', 'Wren', 'Xerus', 'Yak', 'Zephyr', 'Blaze', 'Cinder',
            'Ember', 'Flame', 'Glow', 'Heat', 'Ignis', 'Kindle', 'Lava',
            'Magma', 'Nova', 'Oven', 'Pyro', 'Quasar', 'Radiant', 'Solar',
            'Thermal', 'Ultra', 'Volta', 'Warmth', 'Xenon', 'Yellow', 'Zenith',
            'Aurora', 'Breeze', 'Cloud', 'Drizzle', 'Equinox', 'Foggy', 'Gale',
            'Hail', 'Ice', 'Jetstream', 'Kraken', 'Lightning', 'Monsoon', 'Nimbus',
            'Ocean', 'Pacific', 'Quake', 'Rain', 'Stormy', 'Thunder', 'Undertow',
            'Vortex', 'Wave', 'Yonder', 'Abyss', 'Blizzard', 'Cyclone', 'Deluge',
            'Eclipse', 'Frosty', 'Glacier', 'Hurricane', 'Iceberg', 'Jetty', 'Kelp',
            'Lagoon', 'Nebula', 'Orbit', 'Planet', 'Rocket', 'Saturn', 'Tornado',
            'Universe', 'Vacuum', 'Whirlwind', 'Xenith', 'Yield',
        ];

        const catBreeds = [
            'Abyssinian', 'American Shorthair', 'Balinese', 'Bengal', 'Birman',
            'Bombay', 'British Shorthair', 'Burmese', 'Chartreux', 'Cornish Rex',
            'Devon Rex', 'Egyptian Mau', 'Exotic Shorthair', 'Havana Brown',
            'Japanese Bobtail', 'Korat', 'LaPerm', 'Maine Coon', 'Manx',
            'Munchkin', 'Nebelung', 'Norwegian Forest', 'Ocicat', 'Oriental',
            'Persian', 'Pixiebob', 'Ragdoll', 'Ragamuffin', 'Russian Blue',
            'Savannah', 'Scottish Fold', 'Selkirk Rex', 'Siamese', 'Siberian',
            'Singapura', 'Snowshoe', 'Somali', 'Sphynx', 'Tonkinese',
            'Turkish Angora', 'Turkish Van', 'American Curl', 'American Wirehair',
            'Asian', 'Australian Mist', 'Bambino', 'Brazilian Shorthair',
            'Burmilla', 'California Spangled', 'Chantilly', 'Cheetoh', 'Colorpoint',
            'Cyprus', 'Donskoy', 'Dragon Li', 'European Shorthair', 'German Rex',
            'Highlander', 'Khao Manee', 'Kinkalow', 'Kurilian Bobtail', 'Lambkin',
            'Lykoi', 'Minskin', 'Napoleon', 'Ojos Azules', 'Peterbald',
            'Serengeti', 'Sokoke', 'Suphalak', 'Thai', 'Toybob', 'Toyger',
            'Ukrainian Levkoy', 'York Chocolate',
        ];

        const dogBreeds = [
            'Affenpinscher', 'Afghan Hound', 'Airedale Terrier', 'Akita',
            'Alaskan Malamute', 'American Bulldog', 'American Eskimo',
            'American Foxhound', 'American Pit Bull', 'American Staffordshire',
            'Anatolian Shepherd', 'Australian Cattle Dog', 'Australian Shepherd',
            'Australian Terrier', 'Basenji', 'Basset Hound', 'Beagle',
            'Bearded Collie', 'Bedlington Terrier', 'Belgian Malinois',
            'Belgian Sheepdog', 'Belgian Tervuren', 'Bernese Mountain Dog',
            'Bichon Frise', 'Black Russian Terrier', 'Bloodhound', 'Border Collie',
            'Border Terrier', 'Borzoi', 'Boston Terrier', 'Bouvier des Flandres',
            'Boxer', 'Briard', 'Brittany', 'Brussels Griffon', 'Bull Terrier',
            'Bulldog', 'Bullmastiff', 'Cairn Terrier', 'Canaan Dog',
            'Cane Corso', 'Cardigan Welsh Corgi', 'Cavalier King Charles',
            'Chesapeake Bay Retriever', 'Chihuahua', 'Chinese Crested',
            'Chinese Shar-Pei', 'Chow Chow', 'Clumber Spaniel', 'Cocker Spaniel',
            'Collie', 'Curly-Coated Retriever', 'Dachshund', 'Dalmatian',
            'Dandie Dinmont Terrier', 'Doberman Pinscher', 'Dogue de Bordeaux',
            'English Cocker Spaniel', 'English Setter', 'English Springer Spaniel',
            'English Toy Spaniel', 'Entlebucher Mountain Dog', 'Field Spaniel',
            'Finnish Lapphund', 'Finnish Spitz', 'Flat-Coated Retriever',
            'French Bulldog', 'German Pinscher', 'German Shepherd',
            'German Shorthaired Pointer', 'German Wirehaired Pointer',
            'Giant Schnauzer', 'Glen of Imaal Terrier', 'Golden Retriever',
            'Gordon Setter', 'Great Dane', 'Great Pyrenees', 'Greater Swiss Mountain',
            'Greyhound', 'Harrier', 'Havanese', 'Ibizan Hound', 'Icelandic Sheepdog',
            'Irish Setter', 'Irish Terrier', 'Irish Water Spaniel', 'Irish Wolfhound',
            'Italian Greyhound', 'Jack Russell Terrier', 'Japanese Chin',
            'Japanese Spitz', 'Keeshond', 'Kerry Blue Terrier', 'Komondor',
            'Kooikerhondje', 'Kuvasz', 'Labrador Retriever', 'Lakeland Terrier',
            'Leonberger', 'Lhasa Apso', 'Lowchen', 'Maltese', 'Manchester Terrier',
            'Mastiff', 'Miniature Bull Terrier', 'Miniature Pinscher',
            'Miniature Schnauzer', 'Neapolitan Mastiff', 'Newfoundland',
            'Norfolk Terrier', 'Norwegian Buhund', 'Norwegian Elkhound',
            'Norwegian Lundehund', 'Norwich Terrier', 'Nova Scotia Duck Tolling',
            'Old English Sheepdog', 'Otterhound', 'Papillon', 'Parson Russell Terrier',
            'Pekingese', 'Pembroke Welsh Corgi', 'Petit Basset Griffon',
            'Pharaoh Hound', 'Plott Hound', 'Pointer', 'Polish Lowland Sheepdog',
            'Pomeranian', 'Poodle', 'Portuguese Water Dog', 'Pug', 'Puli', 'Pumi',
            'Pyrenean Shepherd', 'Rhodesian Ridgeback', 'Rottweiler',
            'Saint Bernard', 'Saluki', 'Samoyed', 'Schipperke', 'Schnauzer',
            'Scottish Deerhound', 'Scottish Terrier', 'Sealyham Terrier',
            'Shetland Sheepdog', 'Shiba Inu', 'Shih Tzu', 'Siberian Husky',
            'Silky Terrier', 'Skye Terrier', 'Sloughi', 'Smooth Fox Terrier',
            'Soft Coated Wheaten Terrier', 'Spinone Italiano', 'Staffordshire Bull',
            'Standard Schnauzer', 'Sussex Spaniel', 'Swedish Vallhund',
            'Tibetan Mastiff', 'Tibetan Spaniel', 'Tibetan Terrier', 'Toy Fox Terrier',
            'Treeing Walker Coonhound', 'Vizsla', 'Weimaraner', 'Welsh Springer Spaniel',
            'Welsh Terrier', 'West Highland White Terrier', 'Whippet',
            'Wire Fox Terrier', 'Wirehaired Pointing Griffon', 'Xoloitzcuintli',
            'Yorkshire Terrier',
        ];

        const isCat = Math.random() < 0.5;
        const names = isCat ? catNames : dogNames;
        const breeds = isCat ? catBreeds : dogBreeds;

        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const name = pick(names);
        const breed = pick(breeds);
        const species = isCat ? 'cat' : 'dog';

        return { name: `${name} the ${breed} ${species}`, isCat };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
