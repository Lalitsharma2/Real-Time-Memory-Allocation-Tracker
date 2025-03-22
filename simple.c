#include <stdio.h>
#include <windows.h>
#include <psapi.h>
#include <tlhelp32.h>

int main() {
    while (1) {
        // Get memory info
        MEMORYSTATUSEX memInfo;
        memInfo.dwLength = sizeof(MEMORYSTATUSEX);
        GlobalMemoryStatusEx(&memInfo);

        // Get system info for page size
        SYSTEM_INFO sysInfo;
        GetSystemInfo(&sysInfo);

        // Calculate values
        double total_gb = (double)memInfo.ullTotalPhys / (1024 * 1024 * 1024);
        double used_gb = (double)(memInfo.ullTotalPhys - memInfo.ullAvailPhys) / (1024 * 1024 * 1024);
        double avail_gb = (double)memInfo.ullAvailPhys / (1024 * 1024 * 1024);
        double page_kb = (double)sysInfo.dwPageSize / 1024;
        int page_count = (memInfo.ullTotalPhys - memInfo.ullAvailPhys) / sysInfo.dwPageSize;
        double usage_percent = (double)(memInfo.ullTotalPhys - memInfo.ullAvailPhys) * 100.0 / memInfo.ullTotalPhys;

        // Clear screen
        system("cls");

        // Print header
        printf("\033[1;36m"); // Cyan color
        printf("==================================\n");
        printf("   Memory Allocation Tracker\n");
        printf("==================================\n\n");
        printf("\033[0m"); // Reset color

        // Print memory statistics
        printf("\033[1;33m"); // Yellow color
        printf("Memory Statistics:\n");
        printf("----------------\n");
        printf("\033[0m"); // Reset color
        printf("Total Memory:    %.2f GB\n", total_gb);
        printf("Used Memory:     %.2f GB\n", used_gb);
        printf("Available:       %.2f GB\n", avail_gb);
        printf("Page Size:       %.2f KB\n", page_kb);
        printf("Pages In Use:    %d\n", page_count);
        printf("Memory Usage:    %.1f%%\n\n", usage_percent);

        // Print memory usage bar
        printf("\033[1;32m"); // Green color
        printf("Memory Usage Bar:\n");
        printf("---------------\n");
        printf("\033[0m"); // Reset color
        printf("[");
        int bar_width = 50;
        int filled = (int)((usage_percent / 100.0) * bar_width);
        
        for (int i = 0; i < bar_width; i++) {
            if (i < filled) {
                printf("\033[1;31m#\033[0m"); // Red for used
            } else {
                printf("\033[1;32m-\033[0m"); // Green for free
            }
        }
        printf("] %.1f%%\n\n", usage_percent);

        // Print process info
        printf("\033[1;35m"); // Purple color
        printf("Top Memory Processes:\n");
        printf("-------------------\n");
        printf("\033[0m"); // Reset color

        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot != INVALID_HANDLE_VALUE) {
            PROCESSENTRY32W pe32;
            pe32.dwSize = sizeof(pe32);

            if (Process32FirstW(snapshot, &pe32)) {
                int count = 0;
                do {
                    HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 
                                               FALSE, pe32.th32ProcessID);
                    if (hProcess != NULL) {
                        PROCESS_MEMORY_COUNTERS pmc;
                        if (GetProcessMemoryInfo(hProcess, &pmc, sizeof(pmc))) {
                            char processName[MAX_PATH];
                            WideCharToMultiByte(CP_UTF8, 0, pe32.szExeFile, -1,
                                             processName, MAX_PATH, NULL, NULL);
                            double processMB = (double)pmc.WorkingSetSize / (1024 * 1024);
                            if (processMB > 50.0) { // Only show processes using more than 50MB
                                printf("%-30s: %.1f MB\n", processName, processMB);
                                count++;
                            }
                            if (count >= 10) break; // Show only top 10 processes
                        }
                        CloseHandle(hProcess);
                    }
                } while (Process32NextW(snapshot, &pe32));
            }
            CloseHandle(snapshot);
        }

        printf("\n\033[1;36mPress Ctrl+C to exit\033[0m\n");
        Sleep(1000); // Update every second
    }
    return 0;
}
