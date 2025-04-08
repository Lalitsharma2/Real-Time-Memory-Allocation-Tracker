/**
 * UI Handler
 * Manages visualization of memory and user interactions
 */
class UIHandler {
    constructor(memorySystem) {
        this.memorySystem = memorySystem;
        this.canvas = document.getElementById('memoryCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.memoryBlocks = [];
        this.selectedBlock = null;
        this.colorMap = new Map(); // For consistent process colors
        
        // Event callbacks
        this.setupEventListeners();
        
        // Initialize visualization
        this.renderMemory();
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Canvas click event for selecting blocks
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Find clicked block
            for (const block of this.memoryBlocks) {
                if (x >= block.x && x <= block.x + block.width &&
                    y >= block.y && y <= block.y + block.height) {
                    this.selectBlock(block);
                    break;
                }
            }
        });
        
        // Canvas mousemove for tooltips
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let tooltipShown = false;
            
            // Find hovered block
            for (const block of this.memoryBlocks) {
                if (x >= block.x && x <= block.x + block.width &&
                    y >= block.y && y <= block.y + block.height) {
                    this.showTooltip(block, e.clientX, e.clientY);
                    tooltipShown = true;
                    break;
                }
            }
            
            if (!tooltipShown) {
                this.hideTooltip();
            }
        });
        
        // Canvas mouseout for hiding tooltips
        this.canvas.addEventListener('mouseout', () => {
            this.hideTooltip();
        });
        
        // Memory system event callbacks
        this.memorySystem.onMemoryChanged = () => this.renderMemory();
        this.memorySystem.onPageFault = () => this.showPageFault();
        this.memorySystem.onSegmentViolation = () => this.showSegmentViolation();
        this.memorySystem.onLogEvent = (type, message) => this.addLogEntry(type, message);
    }
    
    /**
     * Render memory visualization
     */
    renderMemory() {
        const mode = this.memorySystem.mode;
        this.clearCanvas();
        
        if (mode === 'paging') {
            this.renderPagingView();
        } else {
            this.renderSegmentationView();
        }
        
        this.updateStats();
    }
    
    /**
     * Render paging view
     */
    renderPagingView() {
        const memory = this.memorySystem.getMemoryState();
        const pageSize = this.memorySystem.pageSize;
        const totalPages = this.memorySystem.totalPages;
        
        // Calculate dimensions
        const padding = 10;
        const blockSize = Math.min(
            (this.canvas.width - padding * 2) / totalPages,
            (this.canvas.height - padding * 2) / pageSize
        );
        
        const startX = (this.canvas.width - blockSize * totalPages) / 2;
        const startY = (this.canvas.height - blockSize * pageSize) / 2;
        
        this.memoryBlocks = [];
        
        // Draw frame grid
        for (let frame = 0; frame < totalPages; frame++) {
            for (let offset = 0; offset < pageSize; offset++) {
                const index = frame * pageSize + offset;
                const x = startX + frame * blockSize;
                const y = startY + offset * blockSize;
                
                // Draw memory cell
                const block = memory[index];
                const blockInfo = {
                    x, y,
                    width: blockSize,
                    height: blockSize,
                    memoryIndex: index,
                    frame,
                    offset,
                    pid: block ? block.pid : null,
                    processName: block ? block.processName : null,
                    type: block ? block.type : 'free',
                    pageNumber: block ? block.pageNumber : null
                };
                
                this.drawMemoryBlock(blockInfo, block ? this.getProcessColor(block.pid) : '#e9ecef');
                this.memoryBlocks.push(blockInfo);
            }
        }
        
        // Draw frame boundaries
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        for (let frame = 0; frame <= totalPages; frame++) {
            const x = startX + frame * blockSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, startY + pageSize * blockSize);
            this.ctx.stroke();
        }
        
        // Draw page labels
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        for (let frame = 0; frame < totalPages; frame++) {
            const x = startX + frame * blockSize + blockSize / 2;
            const y = startY - 5;
            this.ctx.fillText(`Frame ${frame}`, x, y);
        }
    }
    
    /**
     * Render segmentation view
     */
    renderSegmentationView() {
        const memory = this.memorySystem.getMemoryState();
        const totalSize = this.memorySystem.totalMemorySize;
        const segments = this.memorySystem.getSegments();
        
        // Calculate dimensions
        const blockWidth = this.canvas.width - 20;
        const blockHeight = 30;
        const startX = 10;
        const startY = 50;
        
        this.memoryBlocks = [];
        
        // Draw memory overview (horizontal layout)
        this.ctx.fillStyle = '#000';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Memory Map (0 to ' + totalSize + ' KB)', startX, 30);
        
        // Find segments and free blocks
        const blocks = [];
        
        // Add segments
        for (const segment of segments) {
            blocks.push({
                start: segment.start,
                size: segment.size,
                pid: segment.pid,
                processName: segment.processName,
                type: 'segment',
                segmentType: segment.type
            });
        }
        
        // Add free blocks
        const freeBlocks = this.memorySystem.findFreeBlocks();
        for (const block of freeBlocks) {
            blocks.push({
                start: block.start,
                size: block.size,
                type: 'free'
            });
        }
        
        // Sort blocks by start position
        blocks.sort((a, b) => a.start - b.start);
        
        // Draw blocks
        for (const block of blocks) {
            const width = (block.size / totalSize) * blockWidth;
            const x = startX + (block.start / totalSize) * blockWidth;
            const y = startY;
            
            const blockInfo = {
                x, y,
                width,
                height: blockHeight,
                memoryIndex: block.start,
                start: block.start,
                size: block.size,
                pid: block.pid || null,
                processName: block.processName || null,
                type: block.type,
                segmentType: block.segmentType || null
            };
            
            const color = block.type === 'free' ? '#e9ecef' : this.getProcessColor(block.pid);
            this.drawMemoryBlock(blockInfo, color);
            this.memoryBlocks.push(blockInfo);
            
            // Draw segment label if big enough
            if (width > 40 && block.type !== 'free') {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    block.processName + (block.segmentType ? ` (${block.segmentType})` : ''),
                    x + width / 2,
                    y + blockHeight / 2 + 4
                );
            }
        }
        
        // Draw ruler
        this.drawMemoryRuler(startX, startY + blockHeight + 10, blockWidth, totalSize);
    }
    
    /**
     * Draw memory ruler
     */
    drawMemoryRuler(x, y, width, totalSize) {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.stroke();
        
        // Draw ticks
        const numTicks = 10;
        const tickSpacing = width / numTicks;
        
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#000';
        
        for (let i = 0; i <= numTicks; i++) {
            const tickX = x + i * tickSpacing;
            const value = Math.round((i / numTicks) * totalSize);
            
            this.ctx.beginPath();
            this.ctx.moveTo(tickX, y);
            this.ctx.lineTo(tickX, y + 5);
            this.ctx.stroke();
            
            this.ctx.fillText(value.toString(), tickX, y + 15);
        }
    }
    
    /**
     * Draw a memory block
     */
    drawMemoryBlock(block, color) {
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        
        // Draw block
        this.ctx.beginPath();
        this.ctx.rect(block.x, block.y, block.width, block.height);
        this.ctx.fill();
        this.ctx.stroke();
        
        // If selected, add highlight
        if (this.selectedBlock && this.selectedBlock.memoryIndex === block.memoryIndex) {
            this.ctx.strokeStyle = '#2196F3';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(block.x, block.y, block.width, block.height);
        }
    }
    
    /**
     * Get a consistent color for a process
     */
    getProcessColor(pid) {
        if (!pid) return '#e9ecef'; // Free block
        
        if (!this.colorMap.has(pid)) {
            // Generate a color based on the pid
            const hue = (pid * 137) % 360; // Golden ratio to spread colors
            const color = `hsl(${hue}, 70%, 60%)`;
            this.colorMap.set(pid, color);
        }
        
        return this.colorMap.get(pid);
    }
    
    /**
     * Clear the canvas
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Select a memory block
     */
    selectBlock(block) {
        this.selectedBlock = block;
        this.renderMemory();
        
        // If the block belongs to a process, enable deallocation
        document.getElementById('deallocateBtn').disabled = !block.pid;
    }
    
    /**
     * Show tooltip for a memory block
     */
    showTooltip(block, x, y) {
        let tooltip = document.getElementById('memoryTooltip');
        
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'memoryTooltip';
            tooltip.className = 'tooltip';
            document.body.appendChild(tooltip);
        }
        
        // Set tooltip content
        let content = '';
        
        if (block.type === 'free') {
            content = `Free block<br>Start: ${block.start || block.memoryIndex}KB<br>Size: ${block.size || 1}KB`;
        } else if (this.memorySystem.mode === 'paging') {
            content = `Process: ${block.processName}<br>PID: ${block.pid}<br>` +
                      `Frame: ${block.frame}<br>Offset: ${block.offset}<br>` +
                      `Page: ${block.pageNumber}`;
        } else {
            content = `Process: ${block.processName}<br>PID: ${block.pid}<br>` +
                      `Segment: ${block.segmentType}<br>Start: ${block.start}KB<br>` +
                      `Size: ${block.size}KB`;
        }
        
        tooltip.innerHTML = content;
        
        // Position tooltip
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${y + 10}px`;
        tooltip.style.display = 'block';
    }
    
    /**
     * Hide the tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('memoryTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    /**
     * Update stats display
     */
    updateStats() {
        const stats = this.memorySystem.getStats();
        
        document.getElementById('totalMemory').textContent = `${stats.totalMemory} KB`;
        document.getElementById('usedMemory').textContent = `${stats.usedMemory} KB`;
        document.getElementById('freeMemory').textContent = `${stats.freeMemory} KB`;
        document.getElementById('fragmentation').textContent = 
            `${stats.fragmentation} KB ${this.memorySystem.mode === 'paging' ? '(internal)' : '(external)'}`;
    }
    
    /**
     * Show page fault alert
     */
    showPageFault() {
        const alert = document.getElementById('pageFaults');
        alert.classList.remove('d-none');
        
        // Hide after 3 seconds
        setTimeout(() => {
            alert.classList.add('d-none');
        }, 3000);
    }
    
    /**
     * Show segment violation alert
     */
    showSegmentViolation() {
        const alert = document.getElementById('segmentViolation');
        alert.classList.remove('d-none');
        
        // Hide after 3 seconds
        setTimeout(() => {
            alert.classList.add('d-none');
        }, 3000);
    }
    
    /**
     * Add log entry
     */
    addLogEntry(type, message) {
        const logContainer = document.getElementById('memoryLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
        
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = UIHandler;
} else {
    window.UIHandler = UIHandler;
} 