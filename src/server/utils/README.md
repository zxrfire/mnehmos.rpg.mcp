<!-- tier: 3 -->

# Server output formatting

One file. `RichFormatter` is the static helper every consolidated tool's human-readable
output goes through - headers, sections, key/value blocks, tables, bars - while the JSON
payload beside it stays machine-shaped for a front end.

It is imported by roughly eighteen tool modules, which makes it the single widest formatting
dependency in the server. **A change to a header or a separator here changes what every tool
prints**, and the tool tests that assert on prose will see it.

| file | what it is |
|---|---|
| [`formatter.ts`](./formatter.ts) | `RichFormatter` - markdown and ASCII output helpers |

## Where else to look

- [`../consolidated/README.md`](../consolidated/README.md) - every caller. If you are changing
  what a tool prints, the wording is usually in the tool, and only the furniture is here.
- [`../../web/README.md`](../../web/README.md) - **the player never sees this formatter.** The
  prose a player reads is composed in `web/` (`tool-result-prose.ts`, `register-prose.ts`,
  `narrator.ts`) and the rule there is that the engine states facts and the narrator writes
  sentences. Banner furniture belongs to the tool surface, not to play.
- [`../../utils/README.md`](../../utils/README.md) - `a-count-agrees-with-what-it-counts.ts`
  is the other half of readable output: a count and the noun behind it agreeing, where the
  noun came out of a catalog at runtime.
- [`../README.md`](../README.md) - the server this serves, and `tool-metadata.ts` /
  `schema-shape.ts`, which shape the other thing a tool returns.
