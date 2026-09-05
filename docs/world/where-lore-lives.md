<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# Where lore lives, and which copy the model gets

A policy, because there are three different jobs and one folder cannot do all of them.

## The three jobs

1. **Canon** - what is true, authored by a person, argued over, revised.
2. **What the narrator is allowed to say** - a subset, in the prompt, on every call.
3. **What a player can be told when they ask** - a different subset again, and the only
   one that must be filtered per cultivator.

Conflating 2 and 3 is the mistake to avoid. The narrator's copy is about voice and
constraint; the answer to *"what do I know of the Cloud River Sect"* is about **that
cultivator's knowledge**, and handing the model the canon file would answer it out of the
book instead of out of the character.

## The policy

**Canon lives in `docs/world/`, split by topic.** Human-authored prose, one subject per
file, `INDEX.md` says where things are. This is already how it works and it is right: prose
a person wrote belongs in a file a person edits.

**The runtime gets a projection, never the folder.** `prompt.ts` already documents why:
`docs/` is not copied into the container image, so `NARRATOR_CORE_PATH` has a fallback that
is what a Docker deployment actually runs on. **Anything the model must have has to survive
the folder being absent** - which means it is either assembled into the build or written in
the code. The existing split is the pattern to follow:

- Tier 1 (the constitution) is loaded from disk **with a fallback in the code** that carries
  the rules whose loss would be unsafe.
- The verb surface goes the other way: the TypeScript is the source and `docs/verbs.md` is
  generated from it, because it is a projection of an enum rather than prose.

So the rule is: **whoever wrote it authoritatively owns the source, and the other copy is
generated.** Prose a person wrote -> file is the source, code holds a fallback. A projection
of engine data -> code is the source, document is generated. Never two hand-maintained
copies of one fact; that is the drift `prompt.ts` says it already suffered.

**Answering a player is a read, not a lookup.** `recall`, `knowledge.ts` and the awareness
gate already exist and already decide what a cultivator has heard of. A lore answer must go
through them. The discovery rule in the phase-3 prompt says telling a model not to name what
the player has not heard of is necessary but **not sending it the names is what works** - so
a lore-retrieval surface that hands the model the canon defeats the gate that the rest of the
architecture is built around.

## What that means in practice

| kind of lore | source of truth | how the model gets it |
|---|---|---|
| the narrator's constitution | `docs/world/NARRATOR-CORE.md` | loaded, with a code fallback |
| setting texture, tone | `docs/world/**` | assembled into the phase-3 prompt at build |
| the verb surface | `what-each-verb-is-for-in-the-players-words.ts` | generated into `docs/verbs.md` |
| what a house is, holds, wants | `src/data/cultivation/**` | through `knowledge.ts`, per cultivator |
| what this cultivator knows | the awareness rows | `recall`, gated |

**The one addition worth making**: a build step that fails when a `docs/world/` file the
prompt depends on is missing, rather than silently falling back. The fallback exists so a
deployment degrades instead of dying; it should still be loud, and `narratorCore()` already
reports which copy is in use. Extending that to the rest is a small, honest guard.
