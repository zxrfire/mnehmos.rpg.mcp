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

---

## Where else to look

- [`../consolidated/README.md`](../consolidated/README.md) - what every transport hands a
  request to. Validation happens there, never here.
- [`../../storage/README.md`](../../storage/README.md) - `tenant-context.ts` is the other half
  of `tenant-token.ts`: a token becomes a tenant, and the tenant is what scopes every query.
- [`../README.md`](../README.md) - `events.ts` and the session context a transport populates.
- [`../state/README.md`](../state/README.md) - the singletons are per process, so the transport
  layer is also where the one-replica constraint is felt.
- [`../../web/README.md`](../../web/README.md) - **`web/server.ts` is a separate HTTP server**
  for the played game, on `node:http` and nothing else. It is single-operator and opens one
  database through `useSingleUserDatabase`, deliberately *not* the multi-tenant `getDb()` path
  this directory's token is for. Adding a player-facing endpoint here is almost always the
  wrong file.

