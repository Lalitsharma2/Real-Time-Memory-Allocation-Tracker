# Real-Time Memory Allocation Tracker

A web-based tool that visualizes system memory allocation, paging, and segmentation in real-time.

## Features
- Real-time memory usage visualization
- Dynamic page allocation tracking
- Memory segmentation display
- Interactive colorful web interface
- WebSocket-based real-time updates

## Requirements
- Windows OS
- GCC compiler
- Web browser (Chrome/Firefox/Edge)

## Building
1. Compile the C server: `gcc server.c -o server.exe -lws2_32`
2. Run the server: `.\server.exe`
3. Open `index.html` in your web browser

## Architecture
- Backend: Pure C with Windows API
- Frontend: HTML5, CSS3, JavaScript with Chart.js
- Communication: WebSocket for real-time updates
