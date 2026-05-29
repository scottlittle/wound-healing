class StatisticalResult {
    constructor(metric_name, intention_mean, control_mean, p_value, cohens_d, percent_faster, significant_at_005, significant_at_001, bootstrap_ci_low, bootstrap_ci_high) {
        this.metric_name = metric_name;
        this.intention_mean = intention_mean;
        this.control_mean = control_mean;
        this.p_value = p_value;
        this.cohens_d = cohens_d;
        this.percent_faster = percent_faster;
        this.significant_at_005 = significant_at_005;
        this.significant_at_001 = significant_at_001;
        this.bootstrap_ci_low = bootstrap_ci_low;
        this.bootstrap_ci_high = bootstrap_ci_high;
    }
}

class Analysis {
    static computeMetrics(results) {
        const metrics = {
            time_to_50: [],
            time_to_90: [],
            time_to_100: [],
        };

        for (const result of results) {
            for (const key of Object.keys(metrics)) {
                const value = result[key];
                if (value !== null && value !== undefined) {
                    metrics[key].push(value);
                }
            }
        }

        return metrics;
    }

    static cohensD(group1, group2) {
        const n1 = group1.length;
        const n2 = group2.length;
        if (n1 < 2 || n2 < 2) return 0.0;

        const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
        const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

        const var1 = group1.reduce((sum, v) => sum + (v - mean1) ** 2, 0) / (n1 - 1);
        const var2 = group2.reduce((sum, v) => sum + (v - mean2) ** 2, 0) / (n2 - 1);

        const pooled_std = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));

        if (pooled_std === 0) return 0.0;

        return (mean1 - mean2) / pooled_std;
    }

    static mannWhitneyU(group1, group2) {
        const n1 = group1.length;
        const n2 = group2.length;

        const combined = [];
        for (let i = 0; i < n1; i++) {
            combined.push({ value: group1[i], group: 1 });
        }
        for (let i = 0; i < n2; i++) {
            combined.push({ value: group2[i], group: 2 });
        }

        combined.sort((a, b) => a.value - b.value);

        let rank = 1;
        let i = 0;
        while (i < combined.length) {
            let j = i;
            while (j < combined.length && combined[j].value === combined[i].value) {
                j++;
            }
            const avgRank = (rank + rank + j - i - 1) / 2;
            for (let k = i; k < j; k++) {
                combined[k].rank = avgRank;
            }
            rank = j + 1;
            i = j;
        }

        const R1 = combined.filter(x => x.group === 1).reduce((sum, x) => sum + x.rank, 0);
        const U1 = R1 - n1 * (n1 + 1) / 2;
        const U2 = n1 * n2 - U1;

        const U = Math.min(U1, U2);
        const mu = n1 * n2 / 2;
        const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);

        const z = (U - mu) / sigma;
        const p_value = 2 * (1 - Analysis.normalCDF(Math.abs(z)));

        return { U: Math.min(U1, U2), p_value };
    }

    static normalCDF(x) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    static tTest(group1, group2) {
        const n1 = group1.length;
        const n2 = group2.length;
        if (n1 < 2 || n2 < 2) return { t: 0, p: 1 };

        const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
        const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

        const var1 = group1.reduce((sum, v) => sum + (v - mean1) ** 2, 0) / (n1 - 1);
        const var2 = group2.reduce((sum, v) => sum + (v - mean2) ** 2, 0) / (n2 - 1);

        const se = Math.sqrt(var1 / n1 + var2 / n2);
        if (se === 0) return { t: 0, p: 1 };

        const t = (mean1 - mean2) / se;

        const df = (var1 / n1 + var2 / n2) ** 2 / (
            (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)
        );

        const p_value = 2 * (1 - Analysis.tCDF(Math.abs(t), df));

        return { t, p: p_value };
    }

    static tCDF(t, df) {
        const x = df / (df + t * t);
        return 1 - 0.5 * Analysis.incompleteBeta(x, df / 2, 0.5);
    }

    static incompleteBeta(x, a, b) {
        if (x === 0 || x === 1) return x === 0 ? 0 : 1;

        const bt = Math.exp(
            Analysis.logGamma(a + b) - Analysis.logGamma(a) - Analysis.logGamma(b) +
            a * Math.log(x) + b * Math.log(1 - x)
        );

        if (x < (a + 1) / (a + b + 2)) {
            return bt * Analysis.betaCF(x, a, b) / a;
        } else {
            return 1 - bt * Analysis.betaCF(1 - x, b, a) / b;
        }
    }

    static logGamma(z) {
        const c = [
            76.18009172947146, -86.50532032941677, 24.01409824083091,
            -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
        ];

        let y = z;
        let tmp = z + 5.5;
        tmp -= (z + 0.5) * Math.log(tmp);
        let ser = 1.000000000190015;

        for (let j = 0; j < 6; j++) {
            ser += c[j] / ++y;
        }

        return -tmp + Math.log(2.5066282746310005 * ser / z);
    }

    static betaCF(x, a, b) {
        const maxit = 200;
        const eps = 3e-7;
        const qab = a + b;
        const qap = a + 1;
        const qam = a - 1;
        let c = 1;
        let d = 1 - qab * x / qap;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        d = 1 / d;
        let h = d;

        for (let m = 1; m <= maxit; m++) {
            const m2 = 2 * m;
            let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < 1e-30) d = 1e-30;
            c = 1 + aa / c;
            if (Math.abs(c) < 1e-30) c = 1e-30;
            d = 1 / d;
            h *= d * c;

            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < 1e-30) d = 1e-30;
            c = 1 + aa / c;
            if (Math.abs(c) < 1e-30) c = 1e-30;
            d = 1 / d;
            const del = d * c;
            h *= del;

            if (Math.abs(del - 1) < eps) break;
        }

        return h;
    }

    static bootstrapCI(group1, group2, n_bootstrap = 10000, confidence = 0.95) {
        const rng = new Analysis.SimpleRNG(42);

        const log1 = group1.map(x => Math.log(x));
        const log2 = group2.map(x => Math.log(x));

        const observed_diff = log1.reduce((a, b) => a + b, 0) / log1.length -
                              log2.reduce((a, b) => a + b, 0) / log2.length;

        const combined = [...log1, ...log2];
        const n1 = log1.length;
        const n2 = log2.length;

        const bootstrap_diffs = [];
        for (let i = 0; i < n_bootstrap; i++) {
            let sum1 = 0, sum2 = 0;
            for (let j = 0; j < n1; j++) {
                sum1 += combined[rng.integer(combined.length)];
            }
            for (let j = 0; j < n2; j++) {
                sum2 += combined[rng.integer(combined.length)];
            }
            bootstrap_diffs.push(sum1 / n1 - sum2 / n2);
        }

        bootstrap_diffs.sort((a, b) => a - b);

        const alpha = (1 - confidence) / 2;
        const ci_low = bootstrap_diffs[Math.floor(alpha * bootstrap_diffs.length)];
        const ci_high = bootstrap_diffs[Math.floor((1 - alpha) * bootstrap_diffs.length)];

        return { ci_low, ci_high };
    }

    static statisticalAnalysis(intention_results, control_results, n_bootstrap = 10000) {
        const intention_metrics = Analysis.computeMetrics(intention_results);
        const control_metrics = Analysis.computeMetrics(control_results);

        const results = [];

        for (const metric_name of ['time_to_50', 'time_to_90', 'time_to_100']) {
            const intention_vals = intention_metrics[metric_name];
            const control_vals = control_metrics[metric_name];

            if (intention_vals.length < 3 || control_vals.length < 3) continue;

            const intention_log = intention_vals.map(x => Math.log(x));
            const control_log = control_vals.map(x => Math.log(x));

            const tt = Analysis.tTest(intention_log, control_log);
            const d = Analysis.cohensD(intention_log, control_log);
            const ci = Analysis.bootstrapCI(intention_vals, control_vals, n_bootstrap);

            const intention_mean = intention_vals.reduce((a, b) => a + b, 0) / intention_vals.length;
            const control_mean = control_vals.reduce((a, b) => a + b, 0) / control_vals.length;

            const log_mean_diff = control_log.reduce((a, b) => a + b, 0) / control_log.length -
                                  intention_log.reduce((a, b) => a + b, 0) / intention_log.length;
            const percent_faster = (1 - Math.exp(-log_mean_diff)) * 100;

            const ci_ratio_low = Math.exp(ci.ci_low);
            const ci_ratio_high = Math.exp(ci.ci_high);

            results.push(new StatisticalResult(
                metric_name,
                intention_mean,
                control_mean,
                tt.p,
                d,
                percent_faster,
                tt.p < 0.05,
                tt.p < 0.01,
                ci_ratio_low,
                ci_ratio_high
            ));
        }

        return results;
    }
}

Analysis.SimpleRNG = class {
    constructor(seed) {
        this.seed = seed;
    }

    random() {
        this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (this.seed >>> 0) / 0xFFFFFFFF;
    }

    integer(max) {
        return Math.floor(this.random() * max);
    }
};
