/**
 * Memory Management System
 * Handles memory allocation using paging and segmentation algorithms
 */
class MemorySystem {
    constructor(totalMemorySize = 64, pageSize = 4) {
        this.totalMemorySize = totalMemorySize; // Total memory in KB
        this.pageSize = pageSize; // Page size in KB
        this.mode = 'paging'; // Default mode: 'paging' or 'segmentation'
        
        // Memory representation
        this.memory = new Array(totalMemorySize).fill(null);
        
        // For paging
        this.totalPages = Math.floor(totalMemorySize / pageSize);
        this.pageTable = new Array(this.totalPages).fill(null);
        
        // For segmentation
        this.segments = [];
        
        // Process tracking
        this.processes = new Map();
        this.nextPID = 1;
        
        // Statistics
        this.stats = {
            usedMemory: 0,
            freeMemory: totalMemorySize,
            pageFaults: 0,
            segmentViolations: 0,
            internalFragmentation: 0,
            externalFragmentation: 0
        };
        
        // Event callbacks
        this.onMemoryChanged = null;
        this.onPageFault = null;
        this.onSegmentViolation = null;
        this.onLogEvent = null;
    }
    
    /**
     * Set the memory management mode
     * @param {string} mode - 'paging' or 'segmentation'
     */
    setMode(mode) {
        if (mode !== 'paging' && mode !== 'segmentation') {
            throw new Error("Mode must be either 'paging' or 'segmentation'");
        }
        
        // Clear memory and reset state when changing modes
        this.memory = new Array(this.totalMemorySize).fill(null);
        this.pageTable = new Array(this.totalPages).fill(null);
        this.segments = [];
        this.processes = new Map();
        this.nextPID = 1;
        
        this.resetStats();
        this.mode = mode;
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Switched to ${mode} mode`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
    }
    
    /**
     * Reset all statistics
     */
    resetStats() {
        this.stats = {
            usedMemory: 0,
            freeMemory: this.totalMemorySize,
            pageFaults: 0,
            segmentViolations: 0,
            internalFragmentation: 0,
            externalFragmentation: 0
        };
    }
    
    /**
     * Allocate memory for a process
     * @param {string} processName - Name of the process
     * @param {number} size - Size in KB
     * @param {string} segmentType - Only for segmentation mode
     * @returns {boolean} Success status
     */
    allocateMemory(processName, size, segmentType = 'code') {
        if (size <= 0) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Invalid size: ${size} KB`);
            }
            return false;
        }
        
        if (size > this.stats.freeMemory) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Not enough memory: requested ${size} KB, available ${this.stats.freeMemory} KB`);
            }
            return false;
        }
        
        const pid = this.nextPID++;
        
        if (this.mode === 'paging') {
            return this.allocateWithPaging(pid, processName, size);
        } else {
            return this.allocateWithSegmentation(pid, processName, size, segmentType);
        }
    }
    
    /**
     * Allocate memory using paging
     * @private
     */
    allocateWithPaging(pid, processName, size) {
        const requiredPages = Math.ceil(size / this.pageSize);
        const allocatedFrames = [];
        let internalFragmentation = 0;
        
        // Find free frames
        for (let i = 0; i < this.totalPages && allocatedFrames.length < requiredPages; i++) {
            if (this.pageTable[i] === null) {
                allocatedFrames.push(i);
            }
        }
        
        // Check if enough frames were found
        if (allocatedFrames.length < requiredPages) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Cannot allocate ${requiredPages} pages for process ${processName} (PID: ${pid}). Memory too fragmented.`);
            }
            return false;
        }
        
        // Calculate internal fragmentation (last page might not be fully used)
        const lastPageUsage = size % this.pageSize;
        if (lastPageUsage > 0) {
            internalFragmentation = this.pageSize - lastPageUsage;
        }
        
        // Allocate the frames
        for (let i = 0; i < allocatedFrames.length; i++) {
            const frameIndex = allocatedFrames[i];
            this.pageTable[frameIndex] = {
                pid,
                processName,
                pageNumber: i,
                used: (i < allocatedFrames.length - 1) ? this.pageSize : 
                       (lastPageUsage === 0 ? this.pageSize : lastPageUsage)
            };
            
            // Fill memory array
            for (let j = 0; j < this.pageSize; j++) {
                const memIndex = frameIndex * this.pageSize + j;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = {
                        pid,
                        processName,
                        type: 'page',
                        pageNumber: i,
                        offset: j
                    };
                }
            }
        }
        
        // Update process tracking
        this.processes.set(pid, {
            pid,
            name: processName,
            size,
            pages: [...allocatedFrames],
            internalFragmentation
        });
        
        // Update stats
        this.stats.usedMemory += size;
        this.stats.freeMemory -= size;
        this.stats.internalFragmentation += internalFragmentation;
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Allocated ${size} KB (${requiredPages} pages) for process ${processName} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    /**
     * Allocate memory using segmentation
     * @private
     */
    allocateWithSegmentation(pid, processName, size, segmentType) {
        // Find a free block using best-fit algorithm
        const block = this.findBestFit(size);
        
        if (!block) {
            // Try to compact memory if allocation failed
            this.compactMemory();
            
            // Try again after compaction
            const blockAfterCompaction = this.findBestFit(size);
            
            if (!blockAfterCompaction) {
                if (this.onLogEvent) {
                    this.onLogEvent('error', `Could not allocate ${size} KB for segment '${segmentType}' of process ${processName} (PID: ${pid})`);
                }
                
                // Maybe trigger a segment violation
                if (this.onSegmentViolation) {
                    this.stats.segmentViolations++;
                    this.onSegmentViolation();
                }
                
                return false;
            }
            
            return this.allocateSegment(pid, processName, size, segmentType, blockAfterCompaction);
        }
        
        return this.allocateSegment(pid, processName, size, segmentType, block);
    }
    
    /**
     * Allocate a memory segment at the specified block
     * @private
     */
    allocateSegment(pid, processName, size, segmentType, block) {
        const { start, size: blockSize } = block;
        
        // Create segment
        const segment = {
            pid,
            processName,
            type: segmentType,
            start,
            size,
            limit: size - 1
        };
        
        this.segments.push(segment);
        
        // Fill memory array
        for (let i = 0; i < size; i++) {
            const memIndex = start + i;
            if (memIndex < this.totalMemorySize) {
                this.memory[memIndex] = {
                    pid,
                    processName,
                    type: 'segment',
                    segmentType,
                    offset: i
                };
            }
        }
        
        // Add or update process
        if (!this.processes.has(pid)) {
            this.processes.set(pid, {
                pid,
                name: processName,
                size: 0,
                segments: []
            });
        }
        
        const process = this.processes.get(pid);
        process.size += size;
        process.segments.push({
            type: segmentType,
            start,
            size,
            limit: size - 1
        });
        
        // Update stats
        this.stats.usedMemory += size;
        this.stats.freeMemory -= size;
        
        // Update external fragmentation
        this.calculateExternalFragmentation();
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Allocated ${size} KB for '${segmentType}' segment of process ${processName} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    /**
     * Find the best fitting free block for segmentation
     * @private
     */
    findBestFit(size) {
        let freeBlocks = this.findFreeBlocks();
        let bestFit = null;
        
        for (const block of freeBlocks) {
            if (block.size >= size) {
                if (bestFit === null || block.size < bestFit.size) {
                    bestFit = block;
                }
            }
        }
        
        return bestFit;
    }
    
    /**
     * Find all free blocks in memory for segmentation
     * @private
     */
    findFreeBlocks() {
        const freeBlocks = [];
        let currentStart = 0;
        let blockStart = 0;
        let inFreeBlock = true;
        
        // Edge case: completely empty memory
        if (this.memory.every(block => block === null)) {
            return [{ start: 0, size: this.totalMemorySize }];
        }
        
        // Edge case: completely full memory
        if (this.memory.every(block => block !== null)) {
            return [];
        }
        
        // Scan through memory to find free blocks
        for (let i = 0; i < this.totalMemorySize; i++) {
            if (this.memory[i] === null && !inFreeBlock) {
                // Start of a free block
                blockStart = i;
                inFreeBlock = true;
            } else if (this.memory[i] !== null && inFreeBlock) {
                // End of a free block
                const blockSize = i - blockStart;
                freeBlocks.push({ start: blockStart, size: blockSize });
                inFreeBlock = false;
            }
        }
        
        // Handle the case where memory ends with a free block
        if (inFreeBlock) {
            const blockSize = this.totalMemorySize - blockStart;
            freeBlocks.push({ start: blockStart, size: blockSize });
        }
        
        return freeBlocks;
    }
    
    /**
     * Compact memory by removing fragmentation (segmentation mode only)
     * @private
     */
    compactMemory() {
        if (this.mode !== 'segmentation') return;
        
        // Sort segments by their start position
        this.segments.sort((a, b) => a.start - b.start);
        
        let currentPosition = 0;
        
        // Compact each segment
        for (const segment of this.segments) {
            // Skip if segment is already at the right position
            if (segment.start === currentPosition) {
                currentPosition += segment.size;
                continue;
            }
            
            // Move segment
            const oldStart = segment.start;
            segment.start = currentPosition;
            
            // Update memory array
            for (let i = 0; i < segment.size; i++) {
                this.memory[currentPosition + i] = this.memory[oldStart + i];
                this.memory[oldStart + i] = null;
            }
            
            // Update process info
            const process = this.processes.get(segment.pid);
            const segmentInProcess = process.segments.find(s => s.start === oldStart);
            if (segmentInProcess) {
                segmentInProcess.start = currentPosition;
            }
            
            // Move position
            currentPosition += segment.size;
        }
        
        // Update external fragmentation
        this.calculateExternalFragmentation();
        
        if (this.onLogEvent) {
            this.onLogEvent('info', 'Memory compaction performed');
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
    }
    
    /**
     * Calculate external fragmentation
     * @private
     */
    calculateExternalFragmentation() {
        if (this.mode !== 'segmentation') return;
        
        const freeBlocks = this.findFreeBlocks();
        let totalFreeSpace = freeBlocks.reduce((sum, block) => sum + block.size, 0);
        
        // Skip calculation if there's no free space
        if (totalFreeSpace === 0) {
            this.stats.externalFragmentation = 0;
            return;
        }
        
        // Find the largest free block
        const largestBlockSize = Math.max(...freeBlocks.map(block => block.size));
        
        // Calculate external fragmentation as percentage of free space that's fragmented
        this.stats.externalFragmentation = Math.round(
            ((totalFreeSpace - largestBlockSize) / totalFreeSpace) * 100
        );
    }
    
    /**
     * Deallocate memory for a specific process or memory block
     * @param {number} pid - Process ID to deallocate
     * @returns {boolean} Success status
     */
    deallocateMemory(pid) {
        if (!this.processes.has(pid)) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Process with PID ${pid} not found`);
            }
            return false;
        }
        
        const process = this.processes.get(pid);
        
        if (this.mode === 'paging') {
            return this.deallocateWithPaging(process);
        } else {
            return this.deallocateWithSegmentation(process);
        }
    }
    
    /**
     * Deallocate memory using paging
     * @private
     */
    deallocateWithPaging(process) {
        const { pid, name, size, pages, internalFragmentation } = process;
        
        // Clear page table entries and memory array
        for (const frameIndex of pages) {
            this.pageTable[frameIndex] = null;
            
            for (let j = 0; j < this.pageSize; j++) {
                const memIndex = frameIndex * this.pageSize + j;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = null;
                }
            }
        }
        
        // Update stats
        this.stats.usedMemory -= size;
        this.stats.freeMemory += size;
        this.stats.internalFragmentation -= internalFragmentation || 0;
        
        // Remove process from tracking
        this.processes.delete(pid);
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Deallocated ${size} KB (${pages.length} pages) from process ${name} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    /**
     * Deallocate memory using segmentation
     * @private
     */
    deallocateWithSegmentation(process) {
        const { pid, name, size, segments } = process;
        
        // Clear memory for each segment
        for (const segment of segments) {
            for (let i = 0; i < segment.size; i++) {
                const memIndex = segment.start + i;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = null;
                }
            }
        }
        
        // Remove segments from tracking
        this.segments = this.segments.filter(segment => segment.pid !== pid);
        
        // Update stats
        this.stats.usedMemory -= size;
        this.stats.freeMemory += size;
        
        // Update external fragmentation
        this.calculateExternalFragmentation();
        
        // Remove process from tracking
        this.processes.delete(pid);
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Deallocated ${size} KB (${segments.length} segments) from process ${name} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    /**
     * Simulate a page fault
     */
    simulatePageFault() {
        if (this.mode !== 'paging') return;
        
        this.stats.pageFaults++;
        
        if (this.onPageFault) {
            this.onPageFault();
        }
        
        if (this.onLogEvent) {
            this.onLogEvent('warning', 'Page fault simulated');
        }
    }
    
    /**
     * Simulate a segment violation
     */
    simulateSegmentViolation() {
        if (this.mode !== 'segmentation') return;
        
        this.stats.segmentViolations++;
        
        if (this.onSegmentViolation) {
            this.onSegmentViolation();
        }
        
        if (this.onLogEvent) {
            this.onLogEvent('error', 'Segment violation simulated');
        }
    }
    
    /**
     * Get memory statistics
     * @returns {Object} Memory statistics
     */
    getStats() {
        return {
            totalMemory: this.totalMemorySize,
            usedMemory: this.stats.usedMemory,
            freeMemory: this.stats.freeMemory,
            fragmentation: this.mode === 'paging' 
                ? this.stats.internalFragmentation 
                : this.stats.externalFragmentation,
            pageFaults: this.stats.pageFaults,
            segmentViolations: this.stats.segmentViolations
        };
    }
    
    /**
     * Get current memory state
     * @returns {Array} Current memory state
     */
    getMemoryState() {
        return this.memory;
    }
    
    /**
     * Get page table (paging mode only)
     * @returns {Array} Page table
     */
    getPageTable() {
        return this.pageTable;
    }
    
    /**
     * Get segments list (segmentation mode only)
     * @returns {Array} Segments list
     */
    getSegments() {
        return this.segments;
    }
    
    /**
     * Get list of processes
     * @returns {Map} Process map
     */
    getProcesses() {
        return this.processes;
    }
}

// Export the class
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = MemorySystem;
} else {
    window.MemorySystem = MemorySystem;
} 