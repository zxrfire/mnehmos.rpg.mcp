# Turn and narrator instructions

Read [README.md](README.md), especially phase, target and fallback contracts.
For engine changes load [../engine/AGENTS.md](../engine/AGENTS.md); for played tests
load [../../tests/AGENTS.md](../../tests/AGENTS.md).

## The parser names the act. The engine is the one that says no

Phase 1 reads intent, phase 2 resolves state, phase 3 narrates results. The reader
routes the actual act, including coercion, theft or violence; never soften it into
a polite verb or refuse because of its nature. A vocabulary that can express only
the comfortable half of a mechanic has taken a side. Test both forms in ordinary play.
The narrator gives consequences without editorialising; actual people may fear,
resent or approve according to their interests. Read the genre's conventions.
The reader emits all acts in a sentence, not just one; the engine decides execution
order/costs. Targets remain the player's descriptive words, not model-picked IDs.
Resolve against holdings, then actual local presence, then catalogs. Phase 3 receives
what happened, never a question inviting it to choose an outcome.

## The model reads intent

Phase 1 has context, previous turn and printed names. Fix its information/prompt first
for natural-language failures. The table is a lookup fallback, not a model replacement.
Add patterns only for required model-free sentences or active misrouting (questions
executing acts, reads spending time, names becoming places). Test a new verb's few
natural phrasings and neighbours in the appropriate tier.
A near-synonym failing in model play is a defect; fallback `unclear` on an unsupported
near-synonym alone is accepted and costs no time. Its contract is explicit verb + thing,
safe routing, and accepting every printed name. Do not grow synonym sweeps.
Context-dependent acts belong to higher readers. The table handles only unambiguous
phrasings, leaving inherently ambiguous ones alone. Show a judgement-call reading so
the player can correct it. Never print ambiguity hedges asking the player to perform
the model's job; drop an unresolved field and let the verb answer generally.

## A sentence is a plan

Count session refusals: needless ones reveal a reader unable to carry a player's plan.
Free reads chain through the sentence. `freeAction` records facts without elapsed span;
`lesser-action-costs.ts` owns act prices: replies, meals, quick trades and combat exchanges
cost 1/8 day each; local walks 1/4; thorough searches 1/2. Meals/replies add separately;
existing day spans retain their costs. Budget actual cost, not number of calls.
Fractional acts add in requested order. Never infer an extra time-spending act, quietly
truncate the sentence, or decide outcomes to improve reach.

The original executor convention allows at most one requested act of a day or more.
If two are requested, it runs free reads, does neither long act and asks which comes
first in the player's terms, at no cost. **Retained conflict:** the root agency rule
rejects sentence-shape limits and allows chains interrupted by the world. Do not treat
this older convention as authority to add a new limit; reconcile it with the owner
before changing that contract. Both instructions are preserved here for audit.

Composition acceptance needs a model attached (play against Ollama); a fallback's
single act does not measure plan comprehension. Scripted plans can test execution.
A failure reproducible without a model is a table, target or routing defect, not composition.

## It has to play as a game, not as a command line

Accept descriptions, grade/kind or fragments, not only hidden IDs. A genuinely unresolved
name gives close possibilities; a refusal names the actual route, bar, seller or live verbs.
This is distinct from an ambiguity hedge.
The world volunteers visible people, place and purpose, with affordances in description,
not a command list. Avoid field dumps, repeated facts and paragraphs of arithmetic.
Claude/Ollama can feel fully conversational; in-process/browser tiers may be blunter.
Every tier must remain playable: tell what changed, expose available verbs, give routes
with refusals, and never lie or contradict itself. Inspect missing engine information
before blaming weaker embeddings/readers.
Standing gates doing, not observing. Place access governs visible contents generically;
do not hide boards, shelves or prices because the observer cannot use or afford them.

## A fallback written in ordinary English is invisible

Generic success prose is not proof a result was rendered. After adding a verb, run
`scripts/probe-does-every-verb-say-what-happened.ts` and read whether actual costs,
wounds, stops and outcomes reached the player. Use the root heavy-run wrapper.

## Prompts

When the model repeatedly breaks a rule, read the whole prompt for a narrower or
per-turn contradiction before repeating it. Measure each turn separately, especially
turn zero; pooled averages hide outliers. Give a handful of varied, identically
formatted examples per rule, explicitly shapes to vary rather than stock to reuse.
Examples teach every property: review tense, person, attribution, paragraph length and
register, not only their stated subject. A rule without an example can lose to one
elsewhere. **Prompt examples contain no proper nouns**: each run grants names through
knowledge, and a permanent example can leak one to somebody never introduced.

## After editing any pattern, run the control-character check

Through the root heavy-run wrapper, run:

```powershell
npx.cmd vitest run tests/a-control-character-is-never-what-was-meant.test.ts
```

Shell/script layers can turn `\b` into U+0008 without a syntax/type error. Use raw
strings for backslashes or a direct edit tool; inspect bytes first when a correct regex
matches nothing. Restore the intended escape at its source, never delete the control
character and leave a missing boundary. The check is repo-wide, including Bastion.

## The register is a reflection, not a source

Read holdings and coherent current wants from world state; a curated display is not
another authority. See [the register contract](README.md#the-standing-register).

## If you are the narrator

Interpret, call tools and render only returned outcomes, including bad news. Point
players only at real affordances. [../../docs/verbs.md](../../docs/verbs.md) and the
phase-1 glossary are generated from `what-each-verb-is-for-in-the-players-words.ts`,
a `Record<ActionName, ...>`; never paraphrase a second verb list. After changing the
action set run `node scripts/build-the-verb-surface.mjs` through the heavy runner;
the staleness test checks the same source.

## Forcing a situation to test it

`ADMIN_MODE=true` opens the operator surface. Read [../../docs/admin.md](../../docs/admin.md)
and `../server/consolidated/admin-manage.ts`. Admin arranges preconditions and lifts
gates; it never asserts unresolved results. Code still decides refusals/outcomes.
After an admin mutation show the engine report verbatim and phase 3 over the post-state;
a bad narration there is a phase-3 finding. ADMIN sentences use the ordinary reading
road so they test the configured tier too. Narrator choice is fixed at process start;
engine-only testing starts without a model, not with a new runtime flag.
Keep the deterministic reader as lookup: `BARE_NUMBER_ARG`/`PRIMARY_ARG` describe fields
by action, and closed-catalog argument values may resolve normally. Never infer a
leaning by scanning loose prose that could contain the word in a name.
Only outcomes are closed to the model; reading/phrasing remain permitted.
`reset` ends the run and opens a new birth in the same world; its run-writing home
remains `game.ts` as documented by the existing admin contract.
