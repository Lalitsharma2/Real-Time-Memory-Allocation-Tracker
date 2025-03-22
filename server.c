#include <winsock2.h>
#include <windows.h>
#include <psapi.h>
#include <tlhelp32.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma comment(lib, "ws2_32.lib")

#define PORT 8080
#define BUFFER_SIZE 8192
#define MAX_PROCESSES 1024

typedef struct {
    DWORD processId;
    char name[MAX_PATH];
    SIZE_T workingSetSize;
} ProcessInfo;

typedef struct {
    ULONGLONG totalPhys;
    ULONGLONG availPhys;
    SIZE_T pageSize;
    int pageCount;
    double memoryUsagePercent;
    ProcessInfo processes[MAX_PROCESSES];
    int processCount;
} SystemInfo;

SystemInfo getSystemInfo() {
    SystemInfo info = {0};
    MEMORYSTATUSEX memStatus;
    SYSTEM_INFO sysInfo;
    
    memStatus.dwLength = sizeof(memStatus);
    GlobalMemoryStatusEx(&memStatus);
    GetSystemInfo(&sysInfo);
    
    info.totalPhys = memStatus.ullTotalPhys;
    info.availPhys = memStatus.ullAvailPhys;
    info.pageSize = sysInfo.dwPageSize;
    info.pageCount = (int)((memStatus.ullTotalPhys - memStatus.ullAvailPhys) / sysInfo.dwPageSize);
    info.memoryUsagePercent = (double)(memStatus.ullTotalPhys - memStatus.ullAvailPhys) / memStatus.ullTotalPhys * 100;

    // Get process information
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe32;
        pe32.dwSize = sizeof(pe32);

        if (Process32FirstW(snapshot, &pe32)) {
            do {
                HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pe32.th32ProcessID);
                if (hProcess != NULL) {
                    PROCESS_MEMORY_COUNTERS pmc;
                    if (GetProcessMemoryInfo(hProcess, &pmc, sizeof(pmc))) {
                        info.processes[info.processCount].processId = pe32.th32ProcessID;
                        info.processes[info.processCount].workingSetSize = pmc.WorkingSetSize;
                        WideCharToMultiByte(CP_UTF8, 0, pe32.szExeFile, -1,
                            info.processes[info.processCount].name,
                            MAX_PATH, NULL, NULL);
                        info.processCount++;
                    }
                    CloseHandle(hProcess);
                }
            } while (Process32NextW(snapshot, &pe32) && info.processCount < MAX_PROCESSES);
        }
        CloseHandle(snapshot);
    }
    
    return info;
}

void createJsonResponse(SystemInfo info, char* buffer) {
    int offset = sprintf(buffer, 
        "{"
        "\"totalMemory\": %llu,"
        "\"usedMemory\": %llu,"
        "\"availableMemory\": %llu,"
        "\"pageSize\": %zu,"
        "\"pageCount\": %d,"
        "\"memoryUsagePercent\": %.2f,"
        "\"processes\": [",
        info.totalPhys,
        info.totalPhys - info.availPhys,
        info.availPhys,
        info.pageSize,
        info.pageCount,
        info.memoryUsagePercent
    );

    // Add process information
    for (int i = 0; i < info.processCount; i++) {
        offset += sprintf(buffer + offset,
            "%s{\"pid\": %lu, \"name\": \"%s\", \"memory\": %zu}",
            i > 0 ? "," : "",
            info.processes[i].processId,
            info.processes[i].name,
            info.processes[i].workingSetSize
        );
    }

    sprintf(buffer + offset, "]}");
}

// WebSocket handshake response
void createHandshakeResponse(char* clientKey, char* buffer) {
    char* magicString = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    char concatenated[128];
    sprintf(concatenated, "%s%s", clientKey, magicString);
    
    sprintf(buffer,
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: %s\r\n"
        "\r\n",
        concatenated
    );
}

int main() {
    WSADATA wsaData;
    SOCKET serverSocket;
    struct sockaddr_in serverAddr;
    
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        printf("WSAStartup failed\n");
        return 1;
    }
    
    serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket == INVALID_SOCKET) {
        printf("Socket creation failed\n");
        WSACleanup();
        return 1;
    }
    
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(PORT);
    
    if (bind(serverSocket, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        printf("Bind failed\n");
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }
    
    if (listen(serverSocket, 5) == SOCKET_ERROR) {
        printf("Listen failed\n");
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }
    
    printf("Server started on port %d\n", PORT);
    
    while (1) {
        SOCKET clientSocket;
        struct sockaddr_in clientAddr;
        int clientAddrLen = sizeof(clientAddr);
        char buffer[BUFFER_SIZE];
        
        clientSocket = accept(serverSocket, (struct sockaddr*)&clientAddr, &clientAddrLen);
        if (clientSocket == INVALID_SOCKET) {
            printf("Accept failed\n");
            continue;
        }
        
        printf("Client connected\n");
        
        int bytesReceived = recv(clientSocket, buffer, BUFFER_SIZE, 0);
        if (bytesReceived > 0) {
            buffer[bytesReceived] = '\0';
            
            char response[BUFFER_SIZE];
            createHandshakeResponse("dummyKey", response);
            send(clientSocket, response, strlen(response), 0);
            
            while (1) {
                SystemInfo info = getSystemInfo();
                char jsonResponse[BUFFER_SIZE];
                createJsonResponse(info, jsonResponse);
                
                if (send(clientSocket, jsonResponse, strlen(jsonResponse), 0) == SOCKET_ERROR) {
                    printf("Send failed\n");
                    break;
                }
                
                Sleep(1000);
            }
        }
        
        closesocket(clientSocket);
    }
    
    closesocket(serverSocket);
    WSACleanup();
    return 0;
}
