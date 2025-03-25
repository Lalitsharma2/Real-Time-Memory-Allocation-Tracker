// DOM Elements
const startButton = document.getElementById('startTracking');
const stopButton = document.getElementById('stopTracking');
const clearButton = document.getElementById('clearData');
const totalMemoryElement = document.getElementById('totalMemory');
const usedMemoryElement = document.getElementById('usedMemory');
const freeMemoryElement = document.getElementById('freeMemory');
const allocationHistory = document.getElementById('allocationHistory');

// Chart initialization
const ctx = document.getElementById('memoryChart').getContext('2d');
const memoryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Used Memory (MB)',
                data: [],
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                fill: true
            },
            {
                label: 'Free Memory (MB)',
                data: [],
                borderColor: '#50c878',
                backgroundColor: 'rgba(80, 200, 120, 0.1)',
                fill: true
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Memory (MB)'
                },
                beginAtZero: true
            }
        },
        animation: {
            duration: 0
        }
    }
});

// Tracking state
let isTracking = false;
let trackingInterval;
const maxDataPoints = 50;
const updateInterval = 1000; // 1 second

// Simulated memory allocation (replace with actual memory API in production)
class MemorySimulator {
    constructor() {
        this.totalMemory = 16384; // 16GB in MB
        this.baseUsedMemory = 4096; // 4GB base usage
        this.allocations = [];
    }

    getCurrentMemoryState() {
        const time = new Date().toLocaleTimeString();
        const usedMemory = this.calculateUsedMemory();
        const freeMemory = this.totalMemory - usedMemory;

        return {
            time,
            total: this.totalMemory,
            used: usedMemory,
            free: freeMemory
        };
    }

    calculateUsedMemory() {
        // Simulate memory usage with some randomness
        const randomUsage = Math.sin(Date.now() / 10000) * 1024 + 
                          Math.random() * 512;
        return Math.min(
            this.totalMemory,
            Math.max(0, this.baseUsedMemory + randomUsage)
        );
    }

    simulateAllocation() {
        const size = Math.floor(Math.random() * 512); // Random allocation up to 512MB
        const allocation = {
            id: Date.now(),
            size,
            timestamp: new Date().toLocaleTimeString()
        };
        this.allocations.unshift(allocation);
        this.allocations = this.allocations.slice(0, 10); // Keep only last 10 allocations
        return allocation;
    }
}

const memorySimulator = new MemorySimulator();

// Update UI functions
function updateMetrics(memoryState) {
    totalMemoryElement.textContent = `${memoryState.total.toFixed(0)} MB`;
    usedMemoryElement.textContent = `${memoryState.used.toFixed(0)} MB`;
    freeMemoryElement.textContent = `${memoryState.free.toFixed(0)} MB`;
}

function updateChart(memoryState) {
    const { time, used, free } = memoryState;
    
    memoryChart.data.labels.push(time);
    memoryChart.data.datasets[0].data.push(used);
    memoryChart.data.datasets[1].data.push(free);

    // Remove old data points if exceeding maxDataPoints
    if (memoryChart.data.labels.length > maxDataPoints) {
        memoryChart.data.labels.shift();
        memoryChart.data.datasets.forEach(dataset => dataset.data.shift());
    }

    memoryChart.update();
}

function updateAllocationHistory(allocation) {
    const allocationElement = document.createElement('div');
    allocationElement.style.padding = '0.5rem';
    allocationElement.style.borderBottom = '1px solid #eee';
    allocationElement.innerHTML = `
        <span style="color: var(--primary-color)">
            ${allocation.timestamp}:
        </span> 
        Allocated <strong>${allocation.size} MB</strong>
    `;
    
    allocationHistory.insertBefore(allocationElement, allocationHistory.firstChild);
}

// Event handlers
function startTracking() {
    if (isTracking) return;
    
    isTracking = true;
    startButton.disabled = true;
    stopButton.disabled = false;

    trackingInterval = setInterval(() => {
        const memoryState = memorySimulator.getCurrentMemoryState();
        updateMetrics(memoryState);
        updateChart(memoryState);
        
        // Simulate random memory allocation
        if (Math.random() < 0.3) { // 30% chance of allocation
            const allocation = memorySimulator.simulateAllocation();
            updateAllocationHistory(allocation);
        }
    }, updateInterval);
}

function stopTracking() {
    if (!isTracking) return;
    
    isTracking = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    clearInterval(trackingInterval);
}

function clearData() {
    // Reset chart data
    memoryChart.data.labels = [];
    memoryChart.data.datasets.forEach(dataset => dataset.data = []);
    memoryChart.update();

    // Clear allocation history
    allocationHistory.innerHTML = '';

    // Reset metrics to initial state
    const initialState = memorySimulator.getCurrentMemoryState();
    updateMetrics(initialState);
}

// Event listeners
startButton.addEventListener('click', startTracking);
stopButton.addEventListener('click', stopTracking);
clearButton.addEventListener('click', clearData);

// Initialize with current state
const initialState = memorySimulator.getCurrentMemoryState();
updateMetrics(initialState);
updateChart(initialState); 