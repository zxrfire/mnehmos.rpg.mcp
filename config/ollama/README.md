# A model file of this game's own

You do other things with Ollama on this machine. This directory exists so that
sizing a context window for the game does not reach any of them.

## Why a tag of our own rather than a setting

Ollama holds a model in VRAM at **one** window. A request that asks for a
different `num_ctx` than the loaded instance makes the server unload and reload
the weights - so a game that asked `gemma4:31b` for 32768 while another tool
used the same tag at its default would make both of them reload on every
alternation. Twenty seconds of loading, per turn, in both directions.

A separate tag is a separate loaded instance. Nothing else on the machine
notices.

## What the window is sized to

Measured against the prompts this repo actually sends (2026-09-24, from the model's own
`prompt_eval_count`):

| call | tokens |
|---|---|
| phase 1 (intent) | ~6,000 - system prompt with the whole verb glossary, plus the state summary |
| phase 3 (narration) | ~21,600 system (the storyteller, the voice docs, the worked turns) + up to ~2,400 per turn, the previous turn included |

The tag holds **65536**, which needs two settings on the Ollama SERVER, set as user
environment variables on this machine:

```
OLLAMA_FLASH_ATTENTION=1   # exact attention in tiles; same result, less memory, faster
OLLAMA_KV_CACHE_TYPE=q8_0  # the remembered keys and values at 8 bits; a small precision loss
```

Why they matter: gemma4:31b has 60 layers, and 50 of them attend only over a 1024-token
sliding window, a fixed cost whatever the window. Only the 10 global layers grow with it
(4 KV heads of 512): 80 KB a token at f16, 40 KB at q8_0. Measured on the RTX 5090 (32 GB),
all 100% GPU:

| num_ctx | f16 cache | q8_0 cache + flash attention |
|---|---|---|
| 32768 | 27 GB, 2.4 GB free | 25 GB, 4.5 GB free |
| 65536 | would not fit beside the desktop | 26 GB, 2.8 GB free |
| 98304 | - | 28 GB, 1.4 GB free |
| 131072 | - | 30 GB, 0.55 GB free |

65536 is the largest that leaves more VRAM free than the old 32768 did. Without the two
server settings, drop the tag back to 32768. The owner accepted the 8-bit precision loss:
*"loss of accuracy is no big deal for an rpg with low stakes for consistency"*.

**What the room is for.** A narration turn uses about 24,000 of it. The rest is for the
narrator to remember more of the conversation it is in (the game is mostly talking), not
for a longer rulebook: attention thins over a long prompt, and the per-turn last line is
where the model is steered. `tests/web/discovery.test.ts` holds the system prompt to
88,000 characters as that discipline.

**Measured before this tag existed**, on plain `gemma4:31b` at its 128k default:
35GB resident on a 32GB card, 12% of it on the CPU, and a 27.5k-token narration
prompt took 93s - three times the server's 30s default timeout, so every turn
fell back to the engine's own fact lines. Run the game on this tag, and see
`run-game.ps1` for the timeout and keep-alive it sets.

## Building it

```bash
ollama create rpg-gemma4-31b -f config/ollama/gemma4-31b.Modelfile
```

Then point the game at it:

```bash
OLLAMA_MODEL=rpg-gemma4-31b
```

Change `FROM` to build the same thing off a different base.
