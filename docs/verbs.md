# The verb surface - everything a player can actually do

**Generated. Do not edit the tables by hand.**

```bash
npm run docs:verbs                                # rewrite
node scripts/build-the-verb-surface.mjs --check   # exit 1 if stale
```

`tests/docs/the-verb-surface-is-not-stale.test.ts` runs the check, so a verb added without
a description fails the suite. The prose around the generated regions is hand-written and
the script does not touch it.

## What this is for

A narrator that does not know the verb list invents affordances. It writes *"you could try
climbing the wall"* where there is no climb verb, and the player spends a turn discovering
that the prose lied. The engine's own action set is the only honest account of what
somebody may be pointed at, so this is that account, joined to the code that implements
it: what each verb is, what it takes, where it is declared, where it resolves, and whether
plain English reaches it without a model running.

**The narrator is not shown this page.** It is shown a compact glossary composed from the
same source - [`what-each-verb-is-for-in-the-players-words.ts`](../src/web/what-each-verb-is-for-in-the-players-words.ts),
which is a `Record<ActionName, …>` and therefore fails to compile until a new verb has been
described. `prompt.ts` composes the phase-1 glossary from it and this document is generated
from it, so the two are renderings of one source rather than two wordings of one list.

That is the [`NARRATOR-CORE.md`](world/NARRATOR-CORE.md) precedent with the direction
reversed, and deliberately. Tier 1 is prose a person wrote, so the file is the source and
the runtime loads it verbatim. The verb surface is a projection of a TypeScript enum, so
the TypeScript is the source and this page is the projection - which also keeps the
classifier off a disk read, and `docs/` reaching the runtime is not something the current
Docker image promises.

## Where this lives, and why

`docs/world/` is the setting: what a spirit tide is, what a house does when it catches you.
This is the **interface** - the shape of the interaction rather than the world it happens
in - so it sits at the root of `docs/` beside [`admin.md`](admin.md), which is the other
interface document and covers the operator surface the same way.

The design rationale for each verb is not here and should not be duplicated here. It lives
beside the verb in [`actions.ts`](../src/web/actions.ts), where it is addressed to whoever
maintains the enum; every row below links to it. What is here is addressed to whoever has
to point a player at something.

## What the closed set is for

`ACTION_NAMES` in [`actions.ts`](../src/web/actions.ts) is the complete set of actions the
engine can execute, and it is closed: `action` is a Zod enum over it, so a model answering
with anything else fails validation and the deterministic parser runs instead. The
expressive range lives in the PARAMETERS - `target`, `intent`, `topic` - and not in the
number of verbs, because a flat taxonomy of verbs only grows and every social nuance ends
up as an engine mechanic. Nothing in the engine branches on `intent` to decide an outcome.
[`src/web/README.md`](../src/web/README.md) is the argument in full.

Three columns below carry the failure modes this repository keeps hitting:

- **Plain English** counts the branches in the deterministic parser that produce the verb.
  A verb with no route is playable only where a provider is configured, which makes the
  game two different games. `attack` was in that state: the sentence fell through the whole
  table and was caught by the cultivation branch, so *"I attack the nearest cultivator"* sat
  the player down to breathe for a month.
- **Bare word** is whether typing the verb on its own reaches it. The gate is
  `READ_ONLY_ACTIONS`, so a bare word can never cost a day, a stone or a life.
- **Intents** is the verb's own sub-list. A verb whose real surface is its intents is
  undocumented if only the verb is named - `sect` carries fourteen of them and each is a
  different act.

---

## Every verb

<!-- BEGIN GENERATED: summary -->

**56 verbs.** 17 of them take nothing from the player,
26 spend in-world time and can therefore kill, and
every one of them is reachable by a sentence with no model running.

A verb the deterministic parser cannot reach is playable only where a provider is
configured, which makes the game two different games. A bare word reaches a verb only
where that verb takes nothing - see `theVerbsOwnName`.

| Verb | Takes | Costs | Plain English | Bare word | Intents |
|---|---|---|---|---|---|
| [`interact`](#interact) | `target` `intent` `topic` | varies | yes | - | [11](#interact) |
| [`investigate`](#investigate) | `target` | nothing | yes | yes | - |
| [`move`](#move) | `target` `intent` | time | yes | - | [5](#move) |
| [`ride`](#ride) | `target` `topic` | time | yes | - | - |
| [`fold`](#fold) | `target` | time | yes | - | - |
| [`passage`](#passage) | `target` `intent` | time | yes | - | [2](#passage) |
| [`oath`](#oath) | `target` `intent` `topic` | varies | yes | - | [3](#oath) |
| [`attack`](#attack) | `target` `intent` `terms` `opening` | time | yes | - | [4](#attack) |
| [`coerce`](#coerce) | `target` `intent` `opening` | time | yes | - | [4](#coerce) |
| [`cultivate`](#cultivate) | `days` | time | yes | - | - |
| [`seclude`](#seclude) | `days` | time | yes | - | - |
| [`breakthrough`](#breakthrough) | - | time | yes | - | - |
| [`train_technique`](#train_technique) | `target` | time | yes | - | - |
| [`refine`](#refine) | `target` | time | yes | - | - |
| [`craft`](#craft) | `target` `days` | time | yes | - | - |
| [`gather`](#gather) | `target` | time | yes | - | - |
| [`hunt`](#hunt) | `target` | time | yes | - | - |
| [`eat`](#eat) | - | time | yes | - | - |
| [`provision`](#provision) | `days` `rations` | varies | yes | - | - |
| [`treat`](#treat) | - | time | yes | - | - |
| [`buy`](#buy) | `target` | varies | yes | - | - |
| [`sell`](#sell) | `target` | varies | yes | - | - |
| [`give`](#give) | `target` `topic` `stones` | varies | yes | - | - |
| [`inventory`](#inventory) | - | nothing | yes | yes | - |
| [`consume_pill`](#consume_pill) | `target` | time | yes | - | - |
| [`list_techniques`](#list_techniques) | - | nothing | yes | yes | - |
| [`learn_technique`](#learn_technique) | `target` | time | yes | - | - |
| [`acquisition`](#acquisition) | `target` | nothing | yes | yes | - |
| [`ceiling`](#ceiling) | - | nothing | yes | yes | - |
| [`teacher`](#teacher) | - | nothing | yes | yes | - |
| [`destinations`](#destinations) | - | nothing | yes | yes | - |
| [`roads`](#roads) | - | nothing | yes | yes | - |
| [`wait`](#wait) | `days` | time | yes | - | - |
| [`work`](#work) | `days` `target` | time | yes | - | - |
| [`market`](#market) | - | nothing | yes | yes | - |
| [`sect`](#sect) | `intent` `target` `topic` | varies | yes | - | [16](#sect) |
| [`site`](#site) | `target` `intent` | time | yes | - | [4](#site) |
| [`legacy`](#legacy) | `intent` `target` `days` | time | yes | - | [5](#legacy) |
| [`petition`](#petition) | `target` `intent` `topic` | nothing | yes | yes | [3](#petition) |
| [`posture`](#posture) | `target` `intent` | varies | yes | - | [5](#posture) |
| [`seal`](#seal) | `target` `intent` | varies | yes | - | [2](#seal) |
| [`offer`](#offer) | `target` `intent` `topic` | varies | yes | - | [3](#offer) |
| [`descend`](#descend) | `target` | time | yes | - | - |
| [`look`](#look) | `intent` | nothing | yes | yes | [6](#look) |
| [`status`](#status) | - | nothing | yes | yes | - |
| [`assess`](#assess) | `target` | nothing | yes | yes | - |
| [`recall`](#recall) | `target` `intent` | nothing | yes | yes | [2](#recall) |
| [`recognise`](#recognise) | `target` | nothing | yes | yes | - |
| [`news`](#news) | - | nothing | yes | yes | - |
| [`tell`](#tell) | `target` `topic` | varies | yes | - | - |
| [`request`](#request) | `target` `intent` `topic` | time | yes | - | [9](#request) |
| [`guard`](#guard) | `target` `days` | time | yes | - | - |
| [`propose`](#propose) | `target` `intent` `topic` | varies | yes | - | [2](#propose) |
| [`decline`](#decline) | `target` `intent` | varies | yes | - | [2](#decline) |
| [`child`](#child) | `days` `target` `intent` | time | yes | - | [2](#child) |
| [`unclear`](#unclear) | - | nothing | fallback | - | - |

`Plain English` is whether the deterministic parser has any branch that produces this
verb. `Costs` is read off `READ_ONLY_ACTIONS` and `TIME_CONSUMING_ACTIONS`; a verb in
neither spends something on some paths and not others - `interact` is the worked case,
free on three of its intents and priced on the rest.

<!-- END GENERATED: summary -->

---

## What each one is for

Each entry links to the file and names the symbol - `case 'sell'`, `GameService.sell` -
rather than pointing at a line. `actions.ts` and `game.ts` are edited by several people at
once, so line anchors would make this document stale on every unrelated edit, and a
staleness test that fails for everybody is one that gets ignored. A symbol is greppable and
it does not move.

<!-- BEGIN GENERATED: verbs -->

### `interact`

anything done to or with a PERSON or a FACTION. "target" names them; "intent" says what was being attempted - negotiate, trade, deceive, interrogate, threaten, bribe, recruit, apologise, talk, or any other short label that fits. Use this rather than asking for a verb that is not on this list. NOT for a request made OF an institution - see petition, posture, seal and offer below. This action walks the player over and describes the party, and answering "I file a Requisition" or "I offer an alliance" with that is worse than answering nothing, because it looks like an answer.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'interact'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.interact` · the deterministic parser reaches it.

Takes `target`, `intent`, `topic`.

Intents: `talk`, `negotiate`, `trade`, `deceive`, `interrogate`, `threaten`, `bribe`, `recruit`, `apologise`, `seduce`, `steal`.

### `investigate`

examine a place, a person, a record, an inscription, an object; search a ruin. "target" names what is being examined.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'investigate'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.investigate` · the deterministic parser reaches it · passes no time.

Takes `target`.

### `move`

go somewhere on foot. "target" is the destination; "intent" is how - travel, flee, approach, enter, follow.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'move'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.move` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`.

Intents: `travel`, `flee`, `approach`, `enter`, `follow`.

### `ride`

go somewhere ON something: a mount, a drawn carriage, a spirit boat, or flight on the cultivator's own blade. "target" is the destination; "topic" names what is under them when the player said. The engine picks what actually suits the road out of what they can put under them, charges the walking days the catalog states, and says what the arrival reads as.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'ride'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.ride` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `topic`.

### `fold`

step across the distance instead of covering it. "target" is the destination. Void Refinement and above, and only to ground the cultivator has stood on or can see; the engine says so when they cannot.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'fold'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.fold` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `passage`

a Measured Span counter. "intent" is "board" to read what runs from here and what each costs, or "buy" to take a place on one; "target" is where to. Reading the board is free and is how somebody who has never left their province finds out there are others.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'passage'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.passage` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`.

Intents: `board`, `buy`.

### `oath`

a word given, carried or not kept. "intent" is "swear", "read" or "break"; "target" is who it is given to; "topic" is what is being sworn, in the player's own words. Breaking one is permanent and opens an account naming them, so never choose it for a question.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'oath'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.oath` · the deterministic parser reaches it.

Takes `target`, `intent`, `topic`.

Intents: `read`, `swear`, `break`.

### `attack`

hit somebody. "target" names them; "intent" is what the player is trying to end up with - drive_off, subdue, kill, humiliate - and "terms" is "agreed" when both sides said this was a bout (a spar, a duel, a challenge) and "open" when nobody promised anybody anything. The blows land the same either way. What the agreement changes is what a killing MEANT and who is owed something afterwards, which is why it must be set from what the player said rather than guessed. "opening" is "from_concealment" when the fight was opened from cover rather than by squaring up, which decides who gets the first round and nothing about what a blow does.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'attack'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.attack` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`, `terms`, `opening`.

Intents: `drive_off`, `subdue`, `kill`, `humiliate`.

### `coerce`

MAKE somebody do something, with hands rather than with words. Not the same as interact/threaten, which is a promise of harm and costs the target nothing yet - this is the point at which they stop being somebody being talked to. "target" names them; "intent" says what the compliance was for - submit, hand_over, talk, or tame. It resolves through the confrontation engine, so it fails the way a fight fails: somebody stronger does not decline, they answer. An animal made to submit is a tamed animal and reaches this same verb.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'coerce'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.somebodyAtHand` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`, `opening`.

Intents: `submit`, `hand_over`, `talk`, `tame`.

### `cultivate`

sit and gather qi. "days" (1-36500); "ten years" is 3650, default 30.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'cultivate'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `days`.

### `seclude`

deliberate closed-door seclusion: safe from encounters, and from every opportunity that would have found you. "days", default 365.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'seclude'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.runSeclusion` · the deterministic parser reaches it · spends in-world time.

Takes `days`.

### `breakthrough`

attempt to advance one rank right now.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'breakthrough'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

### `train_technique`

practise a specific art the cultivator already knows. "target" names it.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'train_technique'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.train` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `refine`

work the cauldron. "target" names the formula or the pill wanted.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'refine'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.refine` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `craft`

build a thing at a bench out of material a hunt brought back - a carriage or a spirit boat. "target" names what is being built; naming nothing carries on with whatever is already on the stocks, or lists the bills if there is nothing. "days" is how long they said they would spend at it. NOT refine, which is the cauldron and wants a named herb for a named pill; a bill wants a quantity at a grade and does not care which animal it came off. Saying they abandon or scrap what is on the stocks comes here too, and clears it. It spends days and it can fail, and a failure keeps the materials.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'craft'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`, `days`.

### `gather`

forage for herbs and materials. "target" may name what is wanted.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'gather'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.gather` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `hunt`

go out after a beast. "target" may name what is being looked for. Distinct from gather, which digs up things that do not move, and from attack, which is a person. What comes back is a body worth something at a counter, which is the other half of where high-grade material in this world comes from - and what is out there can be far above the person looking for it.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'hunt'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.hunt` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `eat`

buy and eat a meal.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'eat'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.eat` · the deterministic parser reaches it · spends in-world time.

### `provision`

lay in food BEFORE it is needed, which is the correct opening move and the one a model reaches for last. "rations" is a count if the player named one, "days" is a span if they named that instead. Satiety burns against a hundred at about two a day, so a stretch of seclusion longer than the pouch is a way to starve on schedule. Distinct from eat, which buys one meal and refuses when they are not already hungry.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'provision'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.provision` · the deterministic parser reaches it.

Takes `days`, `rations`.

### `treat`

get a wound seen to. Untreated meridian injuries never heal on their own, they raise the odds of the next one, and this is the only route out of that. Choose it whenever the player says they are hurt and wants it dealt with, whether or not they name a physician. Costs stones and a month.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'treat'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.treat` · the deterministic parser reaches it · spends in-world time.

### `buy`

buy one line off the mortal price board by name. "target" is the thing: a pill, a physician's visit, a course of care, a ferry crossing. Use this rather than "interact" for anything with a price on it - a purchase is not an approach to a person.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'buy'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.buy` · the deterministic parser reaches it.

Takes `target`.

### `sell`

put something on the counter. "target" names one thing in the pouch; omit it (or say "everything") to price the whole pouch at once. This is the ONLY way a gathered herb becomes spirit stones, so it is the right answer whenever the player wants money and is carrying something. A buyer pays less than list, and how much less depends on the ladder. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'sell'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.sell` · the deterministic parser reaches it.

Takes `target`.

### `give`

hand somebody a thing you are already carrying, for nothing. "target" is who - omit it for whoever is at hand; "topic" is what, in the player's own words, resolved against the pouch; "stones" is the number where the sentence names one. It costs no day and nothing can fail: they are not being asked for anything. NOT for a purchase or a trade - a sentence that says what is wanted back is "buy" or "request". What it leaves is a favour they hold about the player, which is the only way to put somebody in your debt without leaning on them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'give'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.giveSomething` · the deterministic parser reaches it.

Takes `target`, `topic`, `stones`.

### `inventory`

what is in the pouch: pills, herbs, stones, accumulated pill toxicity. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'inventory'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.inventory` · the deterministic parser reaches it · passes no time.

### `consume_pill`

swallow a pill they are carrying. "target" names it. A pill bought and never taken does nothing, and this is the only verb that takes one - including the breakthrough pill, which has to be swallowed BEFORE the attempt for the attempt to know about it. Toxicity accumulates on the body whether or not anybody wanted it to.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'consume_pill'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.consumePill` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `list_techniques`

the arts this cultivator could actually be taught, filtered by realm, spirit root, dao standing and what has surfaced in this life at all. Passes no time. Use it for "what can I learn".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'list_techniques'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.listTechniques` · the deterministic parser reaches it · passes no time.

### `learn_technique`

take up an art for the first time. "target" names it. NOT the same as train_technique, which practises one already held. An art that fights the spirit root is learnable and can tear meridians on the spot, so choose this only when the player plainly asked to learn something.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'learn_technique'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.learnTechnique` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `acquisition`

how a manual could go further, priced by every route there is at once: finding the next volume, being taught it, or writing it yourself. "target" names the art. Passes no time and costs nothing, which is the point of it - the comparison is the decision, so it must not itself cost a decade. Use it for "how do I get past this book".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'acquisition'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.guidance` · the deterministic parser reaches it · passes no time.

Takes `target`.

### `ceiling`

why nothing is accumulating, with the binding gate named: the manual, the province, the seat, the qi, or the settling clock. Passes no time. This is the right answer to "why am I not making progress", "am I stuck", "what is my ceiling" and "what is stopping me" - NOT status, which is the sheet, and NOT assess, which is somebody else's opinion of them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'ceiling'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.ceiling` · the deterministic parser reaches it · passes no time.

### `teacher`

who stands above this cultivator and would teach, with what each one will not say. Passes no time. Names only people they already hold a record for; "nobody you know of" is a real answer. Use it for "who can teach me", "I look for a master" and "is there anyone here stronger than me" - NOT status and NOT look, both of which answer a different question entirely.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'teacher'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.teacher` · the deterministic parser reaches it · passes no time.

### `destinations`

where they could go, with what the journey costs, what the qi is like there and how far that province carries anybody. Passes no time. Use it for "where can I go", "what is nearby" and "where is there better spiritual energy". Distinct from recall, which reads their own head; distinct from move, which goes somewhere they have already named.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'destinations'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.destinations` · the deterministic parser reaches it · passes no time.

### `roads`

the dao grounds within reach: ground that teaches something, what each one teaches, and precisely what the cultivator is short by where it will not have them. Passes no time, reads only what they have heard of, and cannot teach them a name. The other half of destinations - that one is where they could go, this one is what standing there would be worth. Use it for "where can I comprehend something" and "what roads are open to me".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'roads'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.loadWorld` · the deterministic parser reaches it · passes no time.

### `wait`

let a day go by doing nothing in particular.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'wait'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.shortSkip` · the deterministic parser reaches it · spends in-world time.

Takes `days`.

### `work`

take an occupation for a span, for wages. "days" (default 90); "target" may name the kind of work. This is how somebody with no stones eats, and it is the right answer far more often than a model expects.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'work'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.work` · the deterministic parser reaches it · spends in-world time.

Takes `days`, `target`.

### `market`

what is for sale where they are standing, and at what price. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'market'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.market` · the deterministic parser reaches it · passes no time.

### `sect`

anything to do with a house: getting into one, and everything a member or an officer of one can do. "intent" is the step - "join" to be taken in, "standing" to read where they stand, "stipend" to draw one, "promote" to ask for a rung, "duty" to take something off the mission board, "donate" to pay into the ledger, "guest" to sit in at a house that has not taken you, "leave" to resign, and "siphon", "order", "recruit", "admission", "curriculum" and "expel" for what the rungs above a disciple buy. Default to the read - "standing" - unless the player plainly asked for a step, because joining is a life's worth of allegiance and cannot be unsaid.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'sect'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.sect` · the deterministic parser reaches it.

Takes `intent`, `target`, `topic`.

Intents: `leave`, `promote`, `stipend`, `standing`, `join`, `siphon`, `order`, `recruit`, `admission`, `curriculum`, `expel`, `duty`, `donate`, `guest`, `summons`, `refuse`.

### `site`

an inheritance ground: a trial somebody built to be inherited from, or a grave that was arranged for nobody. "target" names it; "intent" is one of approach (get to it, or ask what there is), outside (read it from the threshold without going in), enter (go in - this SPENDS DAYS and can kill), take (carry out what is behind the door). Choose "outside" when the player is looking rather than going, and "enter" only when they plainly said so.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'site'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.site` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`.

Intents: `approach`, `outside`, `enter`, `take`.

### `legacy`

putting things beyond your own death, and collecting what somebody else put beyond theirs. "intent" is "counters" to read who would hold a thing and on what terms, "bury" to put a cache in the ground (spends days), "dig" to go and get one back, "lodge" to leave something with a named house against a phrase, "claim" to collect one. "target" names the house for the last two. Default to "counters" when the player is asking rather than doing.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'legacy'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.legacyAct` · the deterministic parser reaches it · spends in-world time.

Takes `intent`, `target`, `days`.

Intents: `counters`, `bury`, `dig`, `lodge`, `claim`.

### `petition`

ask an INSTITUTION for something: a grant, an object off its standing stock, recognition of a line. "target" names the body; "topic" is what is being asked for, in the player's own words, and is carried verbatim onto the form. "intent" is "stock" for an application against something a body is holding and cannot reorder (a Requisition, a schedule amendment, a request for one of its pills), "descent" for a claim of an ancestral line, "grant" for everything else that goes upward. Nearly always refused, and the refusal is the answer - it comes back in the instrument's own terms. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'petition'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.petition` · the deterministic parser reaches it · passes no time.

Takes `target`, `intent`, `topic`.

Intents: `grant`, `stock`, `descent`.

### `posture`

what one HOUSE is to another. Only the head of a house can do three of these, and the refusal for everybody else names the rung it opens at. "target" names the other party; "intent" is "war", "alliance", "defect" (change who the house holds from), "tribute" (call in a payment), or "stance" to READ where the two already stand. Default to "stance" unless the player plainly declared something - the other four cannot be unsaid.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'posture'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.posture` · the deterministic parser reaches it.

Takes `target`, `intent`.

Intents: `stance`, `war`, `alliance`, `defect`, `tribute`.

### `seal`

the sealed ancestor a house keeps under its mountain. "target" names the house, or omit it for the player's own. "intent" is "read" for the condition and the cost, "wake" to actually do it. Waking your own house's is the head's decision and changes the house permanently, once; waking somebody else's is not a decision at all, it is a theft. Default to "read".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'seal'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.seal` · the deterministic parser reaches it.

Takes `target`, `intent`.

Intents: `read`, `wake`.

### `offer`

the channel through the Lid, from whichever end the player is standing at. Below it: an offering sent up to an ancestor who crossed - "target" names the house, or omit it for the player's own, and "intent" is "channel" to read what the line is or "offering" to make one, which costs a decade of the house's principal and is the head's decision. Above it: "send", which puts an object or a word DOWN a line somebody below is holding, with "topic" as what is said with it. Which end they are at is decided by the engine, not by the label. Default to "channel".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'offer'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.offer` · the deterministic parser reaches it.

Takes `target`, `intent`, `topic`.

Intents: `channel`, `offering`, `send`.

### `descend`

a True Immortal going back down through the Lid, in person. "target" names where they are forcing it open. This is the most expensive action in the game: nine strikes of the heaviest tribulation there is, then ten to fifteen breaths on the ground, then the pressure puts them back. Choose it only when the player has plainly said they are going themselves - "send" is the other answer to the same intention and costs nothing.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'descend'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.descend` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `look`

observe the surroundings. Passes no time. "intent" narrows what is being looked at: "history" for what people say has happened HERE (not news, which is elsewhere), "ground_time" for how long this ground would take somebody, "crowding" for how many are already drawing on it, "bills" for what is posted on the wall, "company" for who else is standing here, "holder" for who holds this ground and what there is to complain to if you are wronged on it. Omit it for the plain read.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'look'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · passes no time.

Takes `intent`.

Intents: `history`, `ground_time`, `crowding`, `bills`, `company`, `holder`.

### `status`

report the cultivator's own condition. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'status'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.freeAction` · the deterministic parser reaches it · passes no time.

### `assess`

what would happen if they tried something: the odds, not the attempt. "target" names the place or the opponent.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'assess'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.assess` · the deterministic parser reaches it · passes no time.

Takes `target`.

### `recall`

what this cultivator is carrying in their own head. "target" names a person, a faction or a subject they may have heard of; omit it for everything they hold. "intent" is "dao" for what they have comprehended, "knowledge" otherwise. Passes no time, and it CANNOT teach them anything - it reads their own records and never the world, so a name they have not been told comes back as nothing. Use it for "what do I know of X".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'recall'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.recall` · the deterministic parser reaches it · passes no time.

Takes `target`, `intent`.

Intents: `knowledge`, `dao`.

### `recognise`

whose art that was. The cultivator watching somebody move and drawing on what they already hold - "target" names the person or the art. Passes no time, is never refused, and the answer is graded by what they have a reference for and how far they have climbed: somebody with no reference is told they would not know, and somebody with a reference and too low a rung is told it matches what they have heard and that they could not tell a good imitation. It says where an art was learned and never whom anybody serves.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'recognise'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.recognise` · the deterministic parser reaches it · passes no time.

Takes `target`.

### `news`

what the people standing HERE say is happening somewhere else. No target and no intent. Passes no time. Use it for "what news is there", "what is happening in the world", "I listen for rumours", "what is the word" and "what have you heard". The opposite verb to recall: that one reads their own head, this one asks other people, and what comes back may be wrong. NOT for "what do people say about this place", which is the ground's own history and belongs to look.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'news'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.news` · the deterministic parser reaches it · passes no time.

### `tell`

TELL SOMEBODY THAT A WRONG WAS DONE - to them, or to somebody of theirs. The other direction of news: that one asks what people are saying, this one carries it to the person it is about. "target" is who is being told and they have to be here; "topic" is what is being said, in the player's own words, including the name of whoever is being blamed if the sentence gives one. Use it for "I tell him that Cao Antao killed his brother", "I let her know who killed her master", "I tell him what happened to his brother" and "I tell him that I killed his brother". Passes no time. Route it whether or not the claim is true - naming the wrong person, or a killing that never happened, is an ordinary thing to say and the engine is what answers for it. NOT for "tell me about X", which is a question and belongs to investigate, and NOT for a threat, which is about something that has not happened yet.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'tell'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.loadWorld` · the deterministic parser reaches it.

Takes `target`, `topic`.

### `request`

ASK A NAMED PERSON FOR A NAMED THING, which is not the same as interact and must not be routed there. "target" is who it is put to; "intent" is what kind of thing is being asked for - teaching (be taught an art, or handed its book), discipleship (be taken on), introduction (be put in front of somebody), telling (be told something they know), a_thing (be given, lent or sold an object), terms (what would it take - the price asked before it is paid), a_trade (something put down for it that is not money), nothing (ask for NOTHING - buy them a drink, sit with them, call on them, do them a small favour; costs a day and no stones, and it is the only thing that makes a stranger somebody who will do you a favour later); "topic" is what was named - the art, the person, the thing. This is the ONLY route to being taught by a person, which the engine says repeatedly is one of the two ways past a manual's ceiling. It spends days and can spend the purse, so choose it only when the player is actually asking somebody for something rather than asking about them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'request'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.request` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`, `topic`.

Intents: `teaching`, `discipleship`, `introduction`, `telling`, `a_thing`, `terms`, `a_trade`, `nothing`, `unstated`.

### `guard`

STAND GUARD OVER SOMEBODY ELSE'S BREAKTHROUGH - the dao protector. "target" is who is crossing and must be somebody standing here; "days" is how long they said they would stand there. A cultivator making a crossing cannot defend themselves at all, and a protector is the only defence that exists. This is not the speaker's own crossing, which is breakthrough. Naming nobody asks the free question instead - who standing here would keep a watch over YOUR next crossing. It spends the span, it resolves the other person's attempt, and it can leave the guard carrying a crippling wound taken for somebody else.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'guard'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`, `days`.

### `propose`

put a match on the table, or agree to one that has been put to you. "target" is who, or whose house; "topic" is what is being offered with it, in the player's own words, and the list of what may go there is open; "intent" is "propose" when they are asking and "accept" when they are answering. Nothing anywhere branches on gender, on who asked, or on which side of it the player is.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'propose'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.proposeAMatch` · the deterministic parser reaches it.

Takes `target`, `intent`, `topic`.

Intents: `propose`, `accept`.

### `decline`

say no to a match, or leave one already made. "intent" is "refuse" for the answer and "leave" for the walk-out. Neither is free and neither is automatic: what it costs is priced by what the asking side staked. Use it whenever the player is turning something down or getting out of it - NOT interact, which would describe the family instead of answering them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'decline'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.declineAMatch` · the deterministic parser reaches it.

Takes `target`, `intent`.

Intents: `refuse`, `leave`.

### `child`

have a child, or place one. "intent" is "have" - "target" names the other parent and "days" the stretch being spent - or "place", where "target" names the house a child is being put to on somebody's word. The engine spends the years the way it spends years everywhere; what the player is choosing here is to spend them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'child'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.haveAChild` · the deterministic parser reaches it · spends in-world time.

Takes `days`, `target`, `intent`.

Intents: `have`, `place`.

### `unclear`

DO NOT CHOOSE THIS. It is the deterministic parser's fallback for a sentence it could not read. If you are unsure, choose "look" or "investigate".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'unclear'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.guidance` · what the deterministic parser answers when nothing else matched · passes no time.

<!-- END GENERATED: verbs -->

---

## The operator surface

<!-- BEGIN GENERATED: admin -->

**15 operator actions**, reached by a line beginning `ADMIN`.

They are not verbs and no model reads one: an `ADMIN` line is handled before phase 1,
read deterministically, and refused rather than improvised where the reader has no noun
for what it names. What each one takes, which phrasings reach it, and the law it follows
are in [`admin.md`](admin.md) - this list is only the set, so that a new action there
cannot go unlisted here.

`roster` · `spawn_encounter` · `spawn_site` · `grant_item` · `set_ambient` · `set_location` · `advance_days` · `set_realm` · `set_age` · `grant_progress` · `grant_knowledge` · `audit_log` · `help` · `reset` · `<any playable verb>`

Declared as `ADMIN_ACTIONS` in [`game.ts`](../src/web/turn-engine.ts).

<!-- END GENERATED: admin -->
