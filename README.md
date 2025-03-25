# Real-Time Memory Allocation Tracker

A web-based visualization tool that tracks and displays memory allocation in real-time. This project provides an interactive interface to monitor memory usage with dynamic charts and detailed allocation history.

## Features

- Real-time memory usage visualization using Chart.js
- Interactive start/stop tracking controls
- Memory metrics display (Total, Used, and Free memory)
- Allocation history log
- Responsive design for all device sizes
- Smooth animations and modern UI

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- No additional dependencies required (all libraries are loaded via CDN)

### Installation

1. Clone this repository or download the files:
   ```bash
   git clone https://github.com/yourusername/memory-allocation-tracker.git
   ```

2. Open `index.html` in your web browser

That's it! No build process or server setup required.

## Usage

1. Open the webpage in your browser
2. Click the "Start Tracking" button to begin monitoring memory
3. Watch the real-time chart update with memory usage
4. View individual memory allocations in the history section
5. Use the "Stop Tracking" button to pause monitoring
6. Click "Clear Data" to reset all visualizations

## Technical Details

The project currently uses simulated memory data for demonstration purposes. In a production environment, you would replace the `MemorySimulator` class with actual memory API calls.

### Components

- **HTML**: Structured layout with semantic elements
- **CSS**: Modern styling with CSS variables and responsive design
- **JavaScript**: Real-time data handling and chart updates
- **Chart.js**: For memory usage visualization

### Memory Tracking

The tracker updates every second and includes:
- Total memory capacity (simulated as 16GB)
- Used memory with randomized variations
- Free memory calculations
- Random memory allocations (30% chance per update)

## Customization

You can customize the appearance by modifying the CSS variables in `styles.css`:

```css
:root {
    --primary-color: #4a90e2;
    --secondary-color: #50c878;
    --background-color: #f5f7fa;
    --text-color: #2c3e50;
    --card-background: #ffffff;
    --danger-color: #e74c3c;
}
```

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 