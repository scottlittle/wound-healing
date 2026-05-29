class SimulationMetrics {
    constructor() {
        this.time_to_50 = null;
        this.time_to_90 = null;
        this.time_to_98 = null;
        this.healing_curve = [];
        this.total_time = 0;
        this.seed = 0;
    }
}

class WoundSimulation {
    static CELL_EMPTY = 0;
    static CELL_EPITHELIAL = 1;
    static CELL_FIBROBLAST = 2;
    static CELL_IMMUNE = 3;
    static CELL_HEALED = 4;

    constructor(config = {}) {
        this.grid_size = config.grid_size || 80;
        this.wound_radius = config.wound_radius || 15;
        this.wound_irregularity = config.wound_irregularity || 0.5;
        this.p_migrate = config.p_migrate || 0.15;
        this.p_proliferate = config.p_proliferate || 0.08;
        this.p_fibroblast_migrate = config.p_fibroblast_migrate || 0.12;
        this.t_inflammation = config.t_inflammation || 20;
        this.seed = config.seed || Math.floor(Math.random() * 2147483647);

        this.rng = this.createRNG(this.seed);
        this.grid = new Uint8Array(this.grid_size * this.grid_size);
        this.immune_age = new Int16Array(this.grid_size * this.grid_size);
        this.transient_immune = new Int16Array(this.grid_size * this.grid_size);
        this.initial_wound_mask = new Uint8Array(this.grid_size * this.grid_size);
        this.current_wound_mask = new Uint8Array(this.grid_size * this.grid_size);
        this.wound_resistance = new Float32Array(this.grid_size * this.grid_size);

        this.metrics = new SimulationMetrics();
        this.metrics.seed = this.seed;

        this._initialize_grid();
    }

    createRNG(seed) {
        let s = seed;
        return {
            random: function() {
                s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
                return (s >>> 0) / 0xFFFFFFFF;
            },
            integer: function(max) {
                return Math.floor(this.random() * max);
            }
        };
    }

    idx(y, x) {
        return y * this.grid_size + x;
    }

    _initialize_grid() {
        const size = this.grid_size * this.grid_size;
        this.grid.fill(WoundSimulation.CELL_EPITHELIAL);

        const cx = Math.floor(this.grid_size / 2);
        const cy = Math.floor(this.grid_size / 2);

        const dist = new Float32Array(size);
        for (let y = 0; y < this.grid_size; y++) {
            for (let x = 0; x < this.grid_size; x++) {
                dist[this.idx(y, x)] = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            }
        }

        const base_wound = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            base_wound[i] = dist[i] <= this.wound_radius ? 1 : 0;
        }

        const wound_mask = new Uint8Array(base_wound);

        if (this.wound_irregularity > 0) {
            const edge_width = Math.max(2, Math.floor(this.wound_radius * this.wound_irregularity));

            const inner_indices = [];
            const outer_indices = [];

            for (let y = 0; y < this.grid_size; y++) {
                for (let x = 0; x < this.grid_size; x++) {
                    const d = dist[this.idx(y, x)];
                    if (d >= this.wound_radius - edge_width && d <= this.wound_radius) {
                        inner_indices.push(this.idx(y, x));
                    }
                    if (d > this.wound_radius && d <= this.wound_radius + edge_width) {
                        outer_indices.push(this.idx(y, x));
                    }
                }
            }

            const n_erode = Math.min(
                Math.floor(inner_indices.length * this.wound_irregularity * 0.4),
                inner_indices.length
            );
            const n_expand = n_erode;

            for (let i = inner_indices.length - 1; i > 0; i--) {
                const j = this.rng.integer(i + 1);
                [inner_indices[i], inner_indices[j]] = [inner_indices[j], inner_indices[i]];
            }
            for (let i = 0; i < n_erode; i++) {
                wound_mask[inner_indices[i]] = 0;
            }

            for (let i = outer_indices.length - 1; i > 0; i--) {
                const j = this.rng.integer(i + 1);
                [outer_indices[i], outer_indices[j]] = [outer_indices[j], outer_indices[i]];
            }
            for (let i = 0; i < n_expand; i++) {
                wound_mask[outer_indices[i]] = 1;
            }

            for (let i = 0; i < size; i++) {
                if (base_wound[i] && wound_mask[i] && this.rng.random() < 0.05) {
                    wound_mask[i] = 0;
                }
            }
        }

        this.initial_wound_mask.set(wound_mask);
        this.current_wound_mask.set(wound_mask);

        for (let i = 0; i < size; i++) {
            if (wound_mask[i]) {
                this.grid[i] = WoundSimulation.CELL_EMPTY;
                this.wound_resistance[i] = 0.7;
            }
        }

        const perimeter_indices = [];
        for (let y = 0; y < this.grid_size; y++) {
            for (let x = 0; x < this.grid_size; x++) {
                const d = dist[this.idx(y, x)];
                if (d > this.wound_radius && d <= this.wound_radius + 3) {
                    perimeter_indices.push(this.idx(y, x));
                }
            }
        }

        const n_immune = Math.min(
            Math.floor(perimeter_indices.length * 0.25),
            perimeter_indices.length
        );
        for (let i = perimeter_indices.length - 1; i > 0; i--) {
            const j = this.rng.integer(i + 1);
            [perimeter_indices[i], perimeter_indices[j]] = [perimeter_indices[j], perimeter_indices[i]];
        }
        for (let i = 0; i < n_immune; i++) {
            this.grid[perimeter_indices[i]] = WoundSimulation.CELL_IMMUNE;
            this.immune_age[perimeter_indices[i]] = 0;
        }

        const wound_indices = [];
        for (let i = 0; i < size; i++) {
            if (this.initial_wound_mask[i]) {
                wound_indices.push(i);
            }
        }
        const n_fibroblast = Math.min(
            Math.floor(wound_indices.length * 0.05),
            wound_indices.length
        );
        for (let i = wound_indices.length - 1; i > 0; i--) {
            const j = this.rng.integer(i + 1);
            [wound_indices[i], wound_indices[j]] = [wound_indices[j], wound_indices[i]];
        }
        for (let i = 0; i < n_fibroblast; i++) {
            this.grid[wound_indices[i]] = WoundSimulation.CELL_FIBROBLAST;
        }
    }

    _get_neighbors(y, x, radius = 1) {
        const neighbors = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dy === 0 && dx === 0) continue;
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < this.grid_size && nx >= 0 && nx < this.grid_size) {
                    neighbors.push([ny, nx]);
                }
            }
        }
        return neighbors;
    }

    _count_neighbors(y, x, cell_type, radius = 1) {
        const neighbors = this._get_neighbors(y, x, radius);
        let count = 0;
        for (const [ny, nx] of neighbors) {
            if (this.grid[this.idx(ny, nx)] === cell_type) {
                count++;
            }
        }
        return count;
    }

    _has_neighbor(y, x, cell_type) {
        return this._count_neighbors(y, x, cell_type, 1) > 0;
    }

    step() {
        const new_grid = new Uint8Array(this.grid);
        const new_immune_age = new Int16Array(this.immune_age);
        const new_transient_immune = new Int16Array(this.transient_immune);
        const resistance_attempts = new Map();

        let has_empty = false;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === WoundSimulation.CELL_EMPTY) {
                has_empty = true;
                break;
            }
        }
        if (!has_empty) return false;

        const epithelial_indices = [];
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === WoundSimulation.CELL_EPITHELIAL) {
                epithelial_indices.push(i);
            }
        }

        for (const idx of epithelial_indices) {
            const y = Math.floor(idx / this.grid_size);
            const x = idx % this.grid_size;

            const non_empty_neighbors = this._count_neighbors(y, x, WoundSimulation.CELL_EPITHELIAL) +
                this._count_neighbors(y, x, WoundSimulation.CELL_FIBROBLAST) +
                this._count_neighbors(y, x, WoundSimulation.CELL_IMMUNE) +
                this._count_neighbors(y, x, WoundSimulation.CELL_HEALED);

            const contact_inhibition = non_empty_neighbors >= 6 ? 0.3 : 1.0;

            let migrate_prob = this.p_migrate;
            if (this._has_neighbor(y, x, WoundSimulation.CELL_FIBROBLAST)) {
                migrate_prob *= 1.5;
            }

            if (this.rng.random() < migrate_prob * contact_inhibition) {
                const neighbors = this._get_neighbors(y, x);
                const empty_neighbors = neighbors.filter(([ny, nx]) =>
                    this.grid[this.idx(ny, nx)] === WoundSimulation.CELL_EMPTY
                );
                if (empty_neighbors.length > 0) {
                    const [ny, nx] = empty_neighbors[this.rng.integer(empty_neighbors.length)];
                    const tidx = this.idx(ny, nx);
                    const resistance = this.wound_resistance[tidx];
                    if (this.rng.random() < (1 - resistance)) {
                        new_grid[tidx] = WoundSimulation.CELL_EPITHELIAL;
                        resistance_attempts.set(tidx, 'success');
                    } else {
                        resistance_attempts.set(tidx, 'fail');
                    }
                }
            }

            const near_immune = this._count_neighbors(y, x, WoundSimulation.CELL_IMMUNE, 2);
            let proliferate_prob = this.p_proliferate;
            if (near_immune > 0) {
                proliferate_prob *= (1 + 0.2 * near_immune);
            }

            if (this.rng.random() < proliferate_prob * contact_inhibition) {
                const neighbors = this._get_neighbors(y, x);
                const empty_neighbors = neighbors.filter(([ny, nx]) =>
                    this.grid[this.idx(ny, nx)] === WoundSimulation.CELL_EMPTY
                );
                if (empty_neighbors.length > 0) {
                    const [ny, nx] = empty_neighbors[this.rng.integer(empty_neighbors.length)];
                    const tidx = this.idx(ny, nx);
                    if (new_grid[tidx] === WoundSimulation.CELL_EMPTY) {
                        const resistance = this.wound_resistance[tidx];
                        if (this.rng.random() < (1 - resistance)) {
                            new_grid[tidx] = WoundSimulation.CELL_EPITHELIAL;
                            resistance_attempts.set(tidx, 'success');
                        } else {
                            resistance_attempts.set(tidx, 'fail');
                        }
                    }
                }
            }
        }

        const fibroblast_indices = [];
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === WoundSimulation.CELL_FIBROBLAST) {
                fibroblast_indices.push(i);
            }
        }

        for (const idx of fibroblast_indices) {
            const y = Math.floor(idx / this.grid_size);
            const x = idx % this.grid_size;

            let migrate_prob = this.p_fibroblast_migrate;

            const immune_count = this._count_neighbors(y, x, WoundSimulation.CELL_IMMUNE, 2);
            if (immune_count > 0) {
                migrate_prob *= (1 + 0.3 * immune_count);
            }

            const healed_neighbors = this._count_neighbors(y, x, WoundSimulation.CELL_HEALED);
            if (healed_neighbors > 0) {
                migrate_prob *= Math.pow(0.7, healed_neighbors);
            }

            if (this.rng.random() < migrate_prob) {
                const neighbors = this._get_neighbors(y, x);
                const empty_neighbors = neighbors.filter(([ny, nx]) =>
                    this.grid[this.idx(ny, nx)] === WoundSimulation.CELL_EMPTY
                );
                if (empty_neighbors.length > 0) {
                    const [ny, nx] = empty_neighbors[this.rng.integer(empty_neighbors.length)];
                    const tidx = this.idx(ny, nx);
                    const resistance = this.wound_resistance[tidx];
                    if (this.rng.random() < (1 - resistance)) {
                        new_grid[tidx] = WoundSimulation.CELL_FIBROBLAST;
                        resistance_attempts.set(tidx, 'success');
                    } else {
                        resistance_attempts.set(tidx, 'fail');
                    }
                }
            }

            const neighbors = this._get_neighbors(y, x);
            for (const [ny, nx] of neighbors) {
                if (this.grid[this.idx(ny, nx)] === WoundSimulation.CELL_EMPTY) {
                    const tidx = this.idx(ny, nx);
                    const resistance = this.wound_resistance[tidx];
                    if (this.rng.random() < 0.2 * (1 - resistance)) {
                        new_grid[tidx] = WoundSimulation.CELL_IMMUNE;
                        new_transient_immune[tidx] = 10;
                        new_immune_age[tidx] = 0;
                        resistance_attempts.set(tidx, 'success');
                    } else if (!resistance_attempts.has(tidx)) {
                        resistance_attempts.set(tidx, 'fail');
                    }
                }
            }
        }

        const immune_indices = [];
        for (let i = 0; i < new_grid.length; i++) {
            if (new_grid[i] === WoundSimulation.CELL_IMMUNE) {
                immune_indices.push(i);
            }
        }

        for (const idx of immune_indices) {
            const y = Math.floor(idx / this.grid_size);
            const x = idx % this.grid_size;

            if (new_transient_immune[idx] > 0) {
                new_transient_immune[idx] -= 1;
                if (new_transient_immune[idx] === 0) {
                    new_grid[idx] = WoundSimulation.CELL_HEALED;
                    new_immune_age[idx] = 0;
                }
            } else {
                new_immune_age[idx] += 1;
                if (new_immune_age[idx] >= this.t_inflammation) {
                    new_grid[idx] = WoundSimulation.CELL_EPITHELIAL;
                    new_immune_age[idx] = 0;
                } else {
                    const neighbors = this._get_neighbors(y, x);
                    const empty_neighbors = neighbors.filter(([ny, nx]) =>
                        this.grid[this.idx(ny, nx)] === WoundSimulation.CELL_EMPTY
                    );
                    if (empty_neighbors.length > 0 && this.rng.random() < 0.1) {
                        const [ny, nx] = empty_neighbors[this.rng.integer(empty_neighbors.length)];
                        const tidx = this.idx(ny, nx);
                        const resistance = this.wound_resistance[tidx];
                    if (this.rng.random() < (1 - resistance)) {
                        new_grid[tidx] = WoundSimulation.CELL_IMMUNE;
                        new_immune_age[tidx] = new_immune_age[idx];
                        new_transient_immune[tidx] = new_transient_immune[idx];
                        resistance_attempts.set(tidx, 'success');
                        } else {
                            resistance_attempts.set(tidx, 'fail');
                        }
                    }
                }
            }
        }

        for (const [tidx, result] of resistance_attempts) {
            if (result === 'success') {
                this.wound_resistance[tidx] = 0;
            } else {
                this.wound_resistance[tidx] *= 0.95;
            }
        }

        for (let i = 0; i < this.grid_size * this.grid_size; i++) {
            if (new_grid[i] === WoundSimulation.CELL_EPITHELIAL) {
                const y = Math.floor(i / this.grid_size);
                const x = i % this.grid_size;
                const neighbors = this._get_neighbors(y, x);
                let healed_count = 0;
                for (const [ny, nx] of neighbors) {
                    if (new_grid[this.idx(ny, nx)] === WoundSimulation.CELL_HEALED) {
                        healed_count++;
                    }
                }
                if (healed_count >= 4 && this.rng.random() < 0.1) {
                    new_grid[i] = WoundSimulation.CELL_IMMUNE;
                    new_transient_immune[i] = 10;
                    new_immune_age[i] = 0;
                }
            }
        }

        this.grid = new_grid;
        this.immune_age = new_immune_age;
        this.transient_immune = new_transient_immune;

        for (let i = 0; i < this.grid.length; i++) {
            this.current_wound_mask[i] = this.grid[i] === WoundSimulation.CELL_EMPTY ? 1 : 0;
        }

        return true;
    }

    get_wound_percentage() {
        let initial_total = 0;
        let remaining = 0;
        for (let i = 0; i < this.initial_wound_mask.length; i++) {
            if (this.initial_wound_mask[i]) {
                initial_total++;
                if (this.current_wound_mask[i]) {
                    remaining++;
                }
            }
        }
        if (initial_total === 0) return 100.0;
        return (1.0 - remaining / initial_total) * 100.0;
    }

    run(max_steps, callback) {
        this.metrics = new SimulationMetrics();
        this.metrics.seed = this.seed;

        for (let step = 0; step < max_steps; step++) {
            const wound_pct = this.get_wound_percentage();
            this.metrics.healing_curve.push(wound_pct);

            if (this.metrics.time_to_50 === null && wound_pct >= 50) {
                this.metrics.time_to_50 = step;
            }
            if (this.metrics.time_to_90 === null && wound_pct >= 90) {
                this.metrics.time_to_90 = step;
            }
            if (this.metrics.time_to_98 === null && wound_pct >= 98.0) {
                this.metrics.time_to_98 = step;
            }

            if (callback) {
                callback(step, wound_pct, this.grid.slice());
            }

            if (wound_pct >= 98.0) {
                this.metrics.total_time = step + 1;
                break;
            }

            this.step();
        }

        if (this.metrics.time_to_98 === null && this.get_wound_percentage() >= 98.0) {
            this.metrics.time_to_98 = this.metrics.total_time;
        }

        return this.metrics;
    }

    reset(seed) {
        if (seed !== undefined) {
            this.seed = seed;
        }
        this.rng = this.createRNG(this.seed);
        this.immune_age.fill(0);
        this.transient_immune.fill(0);
        this.wound_resistance.fill(0);
        this._initialize_grid();
        this.metrics = new SimulationMetrics();
        this.metrics.seed = this.seed;
    }
}
