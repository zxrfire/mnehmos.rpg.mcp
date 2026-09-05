<!-- tier: 3 -->

# Transport

How the server is reached: stdio for a local MCP client, HTTP for a hosted one. Neither
decides anything; both hand a validated request to the same tool surface.

| file | what it is |
|---|---|
| [`http.ts`](./http.ts) | - |
| [`tcp.ts`](./tcp.ts) | - |
| [`tenant-token.ts`](./tenant-token.ts) | - |
| [`unix.ts`](./unix.ts) | - |
| [`websocket.ts`](./websocket.ts) | - |
