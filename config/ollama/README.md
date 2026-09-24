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

## What the window is sized to, and why it is not bigger

Measured against the prompts this repo actually sends, on a real square:

| call | tokens |
|---|---|
| phase 1 (intent) | ~6,000 - system prompt with the whole verb glossary, plus the state summary |
| phase 3 (narration) | ~18,000 system (the storyteller, the voice docs, the worked turns) + ~2,000 per turn |

`32768` holds the narration call with room for the previous turn and the answer.
The phase-3 system prompt is identical on every call, so Ollama keeps it cached:
measured on gemma4:31b at this tag, a narration costs well under a second of
prompt processing after the first and 5-15s in all.

**Measured before this tag existed**, on plain `gemma4:31b` at its 128k default:
35GB resident on a 32GB card, 12% of it on the CPU, and a 27.5k-token narration
prompt took 93s - three times the server's 30s default timeout, so every turn
fell back to the engine's own fact lines. Run the game on this tag, and see
`run-game.ps1` for the timeout and keep-alive it sets.

**More would not help.** Nothing is being truncated at 8,000 tokens, and nothing
in this architecture grows with the length of a run: there is no conversation
history by design, and phase 1 sees the current state, one turn of what just
happened, and the sentence. See the note on `lastTurn` in `src/web/prompt.ts`.
A larger window is VRAM spent on space that stays empty - and at the model's own
128000 default, gemma4:26b held 22.8GB of a 32GB card.

## Building it

```bash
ollama create rpg-gemma4-31b -f config/ollama/gemma4-31b.Modelfile
```

Then point the game at it:

```bash
OLLAMA_MODEL=rpg-gemma4-31b
```

Change `FROM` to build the same thing off a different base.
