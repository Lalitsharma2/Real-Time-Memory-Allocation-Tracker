/**
 * Main Application
 * Initializes the memory system and UI handlers
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize memory system
    const memorySystem = new MemorySystem(64, 4); // 64KB total, 4KB page size
    const ui = new UIHandler(memorySystem);
    
    // DOM Elements
    const pagingBtn = document.getElementById('pagingBtn');
    const segmentationBtn = document.getElementById('segmentationBtn');
    const allocateBtn = document.getElementById('allocateBtn');
    const deallocateBtn = document.getElementById('deallocateBtn');
    const processSize = document.getElementById('processSize');
    const processName = document.getElementById('processName');
    const segmentType = document.getElementById('segmentType');
    const segmentationOnly = document.querySelectorAll('.segmentation-only');
    
    // Mode switching
    pagingBtn.addEventListener('click', () => {
        pagingBtn.classList.add('active');
        segmentationBtn.classList.remove('active');
        memorySystem.setMode('paging');
        
        // Hide segmentation-only controls
        segmentationOnly.forEach(el => el.classList.add('d-none'));
    });
    
    segmentationBtn.addEventListener('click', () => {
        segmentationBtn.classList.add('active');
        pagingBtn.classList.remove('active');
        memorySystem.setMode('segmentation');
        
        // Show segmentation-only controls
        segmentationOnly.forEach(el => el.classList.remove('d-none'));
    });
    
    // Allocate memory
    allocateBtn.addEventListener('click', () => {
        const size = parseInt(processSize.value, 10);
        const name = processName.value.trim() || `Process ${Math.floor(Math.random() * 1000)}`;
        const segment = segmentType.value;
        
        if (isNaN(size) || size <= 0) {
            alert('Please enter a valid size');
            return;
        }
        
        const success = memorySystem.allocateMemory(name, size, segment);
        
        // Update process name for next allocation
        if (success) {
            // Extract number from process name if it follows the pattern "Process X"
            const match = name.match(/Process (\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                processName.value = `Process ${num + 1}`;
            } else {
                // If it doesn't match the pattern, just add a random number
                processName.value = `Process ${Math.floor(Math.random() * 1000)}`;
            }
        }
    });
    
    // Deallocate memory
    deallocateBtn.addEventListener('click', () => {
        if (!ui.selectedBlock || !ui.selectedBlock.pid) {
            alert('Please select an allocated memory block first');
            return;
        }
        
        memorySystem.deallocateMemory(ui.selectedBlock.pid);
        ui.selectedBlock = null;
        deallocateBtn.disabled = true;
    });
    
    // Simulation controls
    document.addEventListener('keydown', (e) => {
        // F: Simulate page fault (only in paging mode)
        if (e.key === 'f' && memorySystem.mode === 'paging') {
            memorySystem.simulatePageFault();
        }
        
        // V: Simulate segment violation (only in segmentation mode)
        if (e.key === 'v' && memorySystem.mode === 'segmentation') {
            memorySystem.simulateSegmentViolation();
        }
        
        // C: Compact memory (only in segmentation mode)
        if (e.key === 'c' && memorySystem.mode === 'segmentation') {
            memorySystem.compactMemory();
            ui.addLogEntry('info', 'Memory compaction triggered manually');
        }
    });
    
    // Canvas resize handler
    function resizeCanvas() {
        const canvas = document.getElementById('memoryCanvas');
        const container = canvas.parentElement;
        
        // Set canvas dimensions to match container
        canvas.width = container.clientWidth;
        canvas.height = 400; // Fixed height
        
        // Re-render memory visualization
        ui.renderMemory();
    }
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    
    // Initial canvas setup
    resizeCanvas();
    
    // Add some demo processes for initial view
    setTimeout(() => {
        // Add sample processes for demonstration
        memorySystem.allocateMemory('OS Kernel', 8);
        memorySystem.allocateMemory('Browser', 12);
        memorySystem.allocateMemory('Editor', 6);
        
        // Log welcome message
        ui.addLogEntry('info', 'Memory Allocation Tracker initialized with sample processes');
        ui.addLogEntry('info', 'Keyboard shortcuts: F = Page fault, V = Segment violation, C = Compact memory');
    }, 500);
}); 