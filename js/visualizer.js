const COLORS = {
    0: '#1a1a2e',
    1: '#4a90d9',
    2: '#2ecc71',
    3: '#e74c3c',
    4: '#95a5a6',
};

class Visualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    renderGrid(grid, gridSize, title) {
        const ctx = this.ctx;
        const cellSize = this.width / gridSize;

        ctx.clearRect(0, 0, this.width, this.height);

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cellType = grid[y * gridSize + x];
                ctx.fillStyle = COLORS[cellType];
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        if (title) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px sans-serif';
            ctx.fillText(title, 10, 20);
        }
    }

    drawLineChart(canvasId, datasets, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = options.maxY || Math.max(...allValues, 100);
        const minVal = options.minY || 0;
        const maxX = options.maxX || Math.max(...datasets.map(d => d.data.length), 10);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            const val = maxVal - ((maxVal - minVal) * i) / 4;
            ctx.fillText(val.toFixed(0), padding.left - 5, y + 4);
        }

        if (options.showLines) {
            for (const line of options.showLines) {
                const y = padding.top + chartHeight * (1 - (line.value - minVal) / (maxVal - minVal));
                ctx.strokeStyle = line.color || 'gray';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        for (const dataset of datasets) {
            ctx.strokeStyle = dataset.color || '#4a90d9';
            ctx.lineWidth = dataset.lineWidth || 2;
            ctx.beginPath();

            for (let i = 0; i < dataset.data.length; i++) {
                const x = padding.left + (i / maxX) * chartWidth;
                const y = padding.top + chartHeight * (1 - (dataset.data[i] - minVal) / (maxVal - minVal));
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            if (dataset.fillColor && dataset.data.length > 1) {
                ctx.fillStyle = dataset.fillColor;
                ctx.beginPath();
                ctx.moveTo(padding.left, padding.top + chartHeight);
                for (let i = 0; i < dataset.data.length; i++) {
                    const x = padding.left + (i / maxX) * chartWidth;
                    const y = padding.top + chartHeight * (1 - (dataset.data[i] - minVal) / (maxVal - minVal));
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(padding.left + ((dataset.data.length - 1) / maxX) * chartWidth, padding.top + chartHeight);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.xLabel || 'Time Step', width / 2, height - 5);

        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(options.yLabel || '', 0, 0);
        ctx.restore();

        if (options.title) {
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(options.title, width / 2, 18);
        }

        if (options.legend) {
            let x = width - padding.right - 10;
            ctx.textAlign = 'right';
            ctx.font = '10px sans-serif';
            for (let i = options.legend.length - 1; i >= 0; i--) {
                const item = options.legend[i];
                ctx.fillStyle = item.color;
                ctx.fillRect(x - 60, padding.top + i * 15, 10, 10);
                ctx.fillStyle = '#333';
                ctx.fillText(item.label, x - 65, padding.top + i * 15 + 9);
            }
        }
    }

    drawBoxPlot(canvasId, intentionValues, controlValues, metricName) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        const allValues = [...intentionValues, ...controlValues];
        if (allValues.length === 0) return;

        const minVal = Math.min(...allValues) * 0.9;
        const maxVal = Math.max(...allValues) * 1.1;

        const boxPlot = (values, x, color) => {
            if (values.length === 0) return;

            const sorted = [...values].sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const median = sorted[Math.floor(sorted.length * 0.5)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const iqr = q3 - q1;
            const whiskerLow = Math.max(minVal, sorted.find(v => v >= q1 - 1.5 * iqr) || q1);
            const whiskerHigh = Math.min(maxVal, [...sorted].reverse().find(v => v <= q3 + 1.5 * iqr) || q3);

            const toY = (v) => padding.top + chartHeight * (1 - (v - minVal) / (maxVal - minVal));
            const boxWidth = Math.min(60, chartWidth / 4);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(x, toY(whiskerLow));
            ctx.lineTo(x, toY(q1));
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, toY(q3));
            ctx.lineTo(x, toY(whiskerHigh));
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x - boxWidth / 2, toY(whiskerLow));
            ctx.lineTo(x + boxWidth / 2, toY(whiskerLow));
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x - boxWidth / 2, toY(whiskerHigh));
            ctx.lineTo(x + boxWidth / 2, toY(whiskerHigh));
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x - boxWidth / 2, toY(q3), boxWidth, toY(q1) - toY(q3));
            ctx.globalAlpha = 1;
            ctx.strokeRect(x - boxWidth / 2, toY(q3), boxWidth, toY(q1) - toY(q3));

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - boxWidth / 2, toY(median));
            ctx.lineTo(x + boxWidth / 2, toY(median));
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5;
            for (const v of values) {
                const jitter = (Math.random() - 0.5) * boxWidth * 0.3;
                ctx.beginPath();
                ctx.arc(x + jitter, toY(v), 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        };

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight * i) / 4;
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            const val = maxVal - ((maxVal - minVal) * i) / 4;
            ctx.fillText(val.toFixed(0), padding.left - 5, y + 4);
        }

        const x1 = padding.left + chartWidth / 3;
        const x2 = padding.left + (2 * chartWidth) / 3;

        boxPlot(intentionValues, x1, '#4a90d9');
        boxPlot(controlValues, x2, '#e74c3c');

        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Intention', x1, height - 10);
        ctx.fillText('Control', x2, height - 10);

        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Box Plot: ${metricName.replace('_', ' ').titleCase()}`, width / 2, 18);
    }

    drawCDF(canvasId, intentionValues, controlValues, title) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        const allValues = [...intentionValues, ...controlValues];
        if (allValues.length === 0) return;

        const maxVal = Math.max(...allValues) * 1.1;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight * i) / 4;
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(((4 - i) / 4).toFixed(2), padding.left - 5, y + 4);
        }

        const drawCDF = (values, color, label) => {
            if (values.length === 0) return;
            const sorted = [...values].sort((a, b) => a - b);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < sorted.length; i++) {
                const x = padding.left + (sorted[i] / maxVal) * chartWidth;
                const y = padding.top + chartHeight * (1 - (i + 1) / sorted.length);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        };

        drawCDF(intentionValues, '#4a90d9', 'Intention');
        drawCDF(controlValues, '#e74c3c', 'Control');

        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, width / 2, 18);

        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText('Time to Closure (steps)', width / 2, height - 5);

        let x = width - padding.right - 10;
        ctx.textAlign = 'right';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#4a90d9';
        ctx.fillRect(x - 70, padding.top, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText('Intention', x - 75, padding.top + 9);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x - 70, padding.top + 15, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText('Control', x - 75, padding.top + 24);
    }
}

String.prototype.titleCase = function() {
    return this.replace(/\b\w/g, c => c.toUpperCase());
};
