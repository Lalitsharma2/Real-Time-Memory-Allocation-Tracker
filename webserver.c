#include <stdio.h>
#include <winsock2.h>
#include <windows.h>
#include <psapi.h>
#include <tlhelp32.h>

#pragma comment(lib, "ws2_32.lib")

#define PORT 8080
#define BUFFER_SIZE 8192

// Function to get memory information as JSON
void getMemoryInfoJson(char* buffer) {
    MEMORYSTATUSEX memInfo;
    memInfo.dwLength = sizeof(MEMORYSTATUSEX);
    GlobalMemoryStatusEx(&memInfo);

    SYSTEM_INFO sysInfo;
    GetSystemInfo(&sysInfo);

    // Calculate values
    double total_gb = (double)memInfo.ullTotalPhys / (1024 * 1024 * 1024);
    double used_gb = (double)(memInfo.ullTotalPhys - memInfo.ullAvailPhys) / (1024 * 1024 * 1024);
    double avail_gb = (double)memInfo.ullAvailPhys / (1024 * 1024 * 1024);
    double usage_percent = (double)(memInfo.ullTotalPhys - memInfo.ullAvailPhys) * 100.0 / memInfo.ullTotalPhys;

    // Create JSON response
    sprintf(buffer, 
        "{"
        "\"totalMemory\": %.2f,"
        "\"usedMemory\": %.2f,"
        "\"availableMemory\": %.2f,"
        "\"memoryUsage\": %.1f,"
        "\"processes\": [",
        total_gb, used_gb, avail_gb, usage_percent
    );

    // Add process information
    int offset = strlen(buffer);
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe32;
        pe32.dwSize = sizeof(pe32);
        int count = 0;
        BOOL isFirst = TRUE;

        if (Process32FirstW(snapshot, &pe32)) {
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
                            if (!isFirst) {
                                offset += sprintf(buffer + offset, ",");
                            }
                            offset += sprintf(buffer + offset,
                                "{\"name\":\"%s\",\"memory\":%.1f}",
                                processName, processMB);
                            isFirst = FALSE;
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
    strcat(buffer, "]}");
}

// Function to send HTTP response
void sendHttpResponse(SOCKET client, const char* content_type, const char* content) {
    char response[BUFFER_SIZE];
    sprintf(response, 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Content-Length: %d\r\n"
        "\r\n"
        "%s",
        content_type, strlen(content), content);
    send(client, response, strlen(response), 0);
}

// Function to serve static files
void serveFile(SOCKET client, const char* filename) {
    FILE* file = fopen(filename, "rb");
    if (file == NULL) {
        const char* not_found = "404 Not Found";
        sendHttpResponse(client, "text/plain", not_found);
        return;
    }

    char* content_type;
    if (strstr(filename, ".html")) content_type = "text/html";
    else if (strstr(filename, ".css")) content_type = "text/css";
    else if (strstr(filename, ".js")) content_type = "application/javascript";
    else content_type = "text/plain";

    char buffer[BUFFER_SIZE];
    size_t bytes_read = fread(buffer, 1, sizeof(buffer), file);
    buffer[bytes_read] = '\0';
    fclose(file);

    sendHttpResponse(client, content_type, buffer);
}

int main() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        printf("WSAStartup failed\n");
        return 1;
    }

    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    if (server == INVALID_SOCKET) {
        printf("Socket creation failed\n");
        WSACleanup();
        return 1;
    }

    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(PORT);

    if (bind(server, (struct sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        printf("Bind failed\n");
        closesocket(server);
        WSACleanup();
        return 1;
    }

    if (listen(server, 3) == SOCKET_ERROR) {
        printf("Listen failed\n");
        closesocket(server);
        WSACleanup();
        return 1;
    }

    printf("Server running at http://localhost:%d\n", PORT);

    while (1) {
        struct sockaddr_in client_addr;
        int client_addr_len = sizeof(client_addr);
        SOCKET client = accept(server, (struct sockaddr*)&client_addr, &client_addr_len);

        if (client == INVALID_SOCKET) {
            printf("Accept failed\n");
            continue;
        }

        char buffer[BUFFER_SIZE];
        int bytes_received = recv(client, buffer, BUFFER_SIZE, 0);
        if (bytes_received > 0) {
            buffer[bytes_received] = '\0';

            // Parse the request
            char method[10], path[256];
            sscanf(buffer, "%s %s", method, path);

            if (strcmp(path, "/api/memory") == 0) {
                // Handle API request
                char json_response[BUFFER_SIZE];
                getMemoryInfoJson(json_response);
                sendHttpResponse(client, "application/json", json_response);
            }
            else if (strcmp(path, "/") == 0 || strcmp(path, "/index.html") == 0) {
                // Serve index.html
                serveFile(client, "index.html");
            }
            else {
                // Try to serve the file
                char filepath[256];
                sprintf(filepath, ".%s", path);
                serveFile(client, filepath);
            }
        }

        closesocket(client);
    }

    closesocket(server);
    WSACleanup();
    return 0;
}
