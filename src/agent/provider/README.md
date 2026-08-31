<!-- tier: 3 -->

# Runtime Providers

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected into a
> narration prompt.

The LLM provider abstraction, how a provider is selected, and the one rule that keeps
provider knowledge from leaking into the rest of the codebase. Read this before adding a
provider or touching `config.ts`.

---

## The abstraction

Providers live behind a single interface in `types.ts` and are selected by
**configuration, never by engine code**:

```text
runtime_provider = claude
```

or

```text
runtime_provider = ollama
ollama_model = <model>
```

Constraints this must satisfy:

- **No provider-specific logic in the game engine.** Claude-specific and Ollama-specific
  code stays behind the provider interface, in this directory.
- **The same saved world is playable under either provider.** A player can switch from
  Claude to Ollama without changing or resetting the world.
- **Game state, MCP tools, simulation engine and persistence are identical** across
  providers. Only prose style differs.
- Claude is integrated through the Claude API / agent interface. The engine does not
  assume a human is manually operating Claude Code.

Supported: **Claude (Anthropic)** as primary and default, **Ollama** for local
self-hosted inference, plus OpenAI and OpenRouter. `claude` is an accepted alias for the
canonical wire name `anthropic`.

---

## The rule: `config.ts` is the only interpreter of a provider name

> No provider name string may be interpreted anywhere else in the codebase.

Everything else - the engine, the MCP tools, the agent runtime, the web narrator - takes
an already-resolved `ProviderName`, or asks `config.ts` for a *neutral fact* about a
provider: which env var configures it, whether it needs a secret at all, what its default
model is. That is what keeps "no provider-specific logic in the game engine" true as
providers are added.

If you need provider knowledge somewhere else, **expose a neutral accessor** from
`config.ts`. Do not write `if (provider === 'ollama')` outside this directory.

`Narrator.providerName` in [`../../web/README.md`](../../web/README.md) exists for
diagnostics only and is never branched on.

---

## Config resolution precedence

Highest wins:

```text
1. explicit argument   a caller that already knows, e.g. a stored agent row
2. environment         RUNTIME_PROVIDER, then RPG_RUNTIME_PROVIDER
3. config file         config/runtime.json - same runtime_provider keys
4. default             anthropic
```

The environment layer is where `.env` lands: `src/server/index.ts` loads the project-root
`.env` through dotenv before anything reads `process.env`, so an operator setting
`RUNTIME_PROVIDER=ollama` in `.env` is picked up with no extra plumbing.

The config file's keys deliberately use the snake_case spelling from the design docs, so
the file reads like the spec it implements. `RPG_RUNTIME_CONFIG` relocates it.

`resolveRuntimeProviderConfig()` returns the resolved provider and model **plus where each
came from** (`argument | environment | config_file | default`). Those source fields are
surfaced in diagnostics and are never branched on.

---

## Per-provider facts, as tables rather than conditionals

`config.ts` keeps one record per concern, keyed by `ProviderName`, so adding a provider is
a row in each table rather than a new branch anywhere:

| Table | What it answers |
|---|---|
| `PROVIDER_ALIASES` | Which friendly names resolve to which canonical name |
| `PROVIDER_CONFIG_ENV` | The env var an operator must set, quoted verbatim in "not configured" errors |
| `PROVIDER_CONFIG_OPTION` | The `ProviderFactory` field that overrides that env var |
| `PROVIDER_REQUIRES_API_KEY` | Whether a secret is needed at all |
| `PROVIDER_MODEL_ENV` | The env var carrying the model default |
| `PROVIDER_DEFAULT_MODEL` | The model used when nobody names one |

**Ollama needs no secret.** It is self-hosted local inference and is available as soon as
it is enabled, which is why `initialize()` must not gate it on a key. Its configuration
knob is a base URL rather than a key. This is the case most easily broken by a
well-meaning "require an API key" guard.

Default models are defaults, not policy: every one is overridable per agent row and by the
env vars above.

---

## Adding a provider

1. Add the canonical name to `PROVIDER_NAMES`.
2. Add a row to each of the tables above, plus any friendly alias.
3. Implement the `LLMProvider` interface from `types.ts` in a new file here.
4. Wire it into `factory.ts`.
5. Add nothing anywhere else. If step 5 is not possible, the missing piece is a neutral
   accessor on `config.ts`.

## Related

- [`../../../AGENTS.md`](../../../AGENTS.md) - the provider-neutrality working agreement
- [`../../web/README.md`](../../web/README.md) - how the narrator consumes a provider
- [`../../../context.md`](../../../context.md) - the runtime agent architecture
