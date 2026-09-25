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

**64 verbs.** 17 of them take nothing from the player,
29 spend in-world time and can therefore kill, and
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
| [`oath`](#oath) | `target` `intent` `topic` | varies | yes | - | [5](#oath) |
| [`attack`](#attack) | `target` `terms` `opening` | time | yes | - | - |
| [`coerce`](#coerce) | `target` `intent` `opening` | time | yes | - | [7](#coerce) |
| [`insult`](#insult) | `target` | time | yes | - | - |
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
| [`destroy`](#destroy) | `target` | varies | yes | - | - |
| [`stow`](#stow) | `intent` `target` | varies | yes | - | [3](#stow) |
| [`list_techniques`](#list_techniques) | - | nothing | yes | yes | - |
| [`learn_technique`](#learn_technique) | `target` | time | yes | - | - |
| [`teach`](#teach) | `target` `topic` `intent` `days` | time | yes | - | [2](#teach) |
| [`acquisition`](#acquisition) | `target` | nothing | yes | yes | - |
| [`derive`](#derive) | `target` | time | yes | - | - |
| [`ceiling`](#ceiling) | - | nothing | yes | yes | - |
| [`teacher`](#teacher) | - | nothing | yes | yes | - |
| [`destinations`](#destinations) | - | nothing | yes | yes | - |
| [`roads`](#roads) | - | nothing | yes | yes | - |
| [`wait`](#wait) | `days` `target` | time | yes | - | - |
| [`work`](#work) | `days` `target` | time | yes | - | - |
| [`market`](#market) | - | nothing | yes | yes | - |
| [`sect`](#sect) | `intent` `target` `topic` | varies | yes | - | [24](#sect) |
| [`site`](#site) | `target` `intent` | time | yes | - | [4](#site) |
| [`legacy`](#legacy) | `intent` `target` `days` | time | yes | - | [5](#legacy) |
| [`petition`](#petition) | `target` `intent` `topic` | nothing | yes | yes | [3](#petition) |
| [`posture`](#posture) | `target` `intent` | varies | yes | - | [5](#posture) |
| [`seal`](#seal) | `target` `intent` | varies | yes | - | [2](#seal) |
| [`offer`](#offer) | `target` `intent` `topic` | varies | yes | - | [3](#offer) |
| [`descend`](#descend) | `target` | time | yes | - | - |
| [`look`](#look) | `intent` `target` | nothing | yes | yes | [12](#look) |
| [`status`](#status) | - | nothing | yes | yes | - |
| [`assess`](#assess) | `target` | nothing | yes | yes | - |
| [`recall`](#recall) | `target` `intent` | nothing | yes | yes | [2](#recall) |
| [`recognise`](#recognise) | `target` | nothing | yes | yes | - |
| [`news`](#news) | - | nothing | yes | yes | - |
| [`tell`](#tell) | `target` `topic` `intent` | varies | yes | - | [1](#tell) |
| [`request`](#request) | `target` `intent` `topic` `days` | time | yes | - | [14](#request) |
| [`challenge`](#challenge) | `target` | varies | yes | - | - |
| [`guard`](#guard) | `target` `days` | time | yes | - | - |
| [`propose`](#propose) | `target` `intent` `topic` | varies | yes | - | [2](#propose) |
| [`decline`](#decline) | `target` `intent` | varies | yes | - | [2](#decline) |
| [`child`](#child) | `days` `target` `intent` | time | yes | - | [2](#child) |
| [`carry`](#carry) | `target` `intent` | varies | yes | - | [13](#carry) |
| [`conceal`](#conceal) | `intent` | varies | yes | - | [3](#conceal) |
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

go somewhere on foot. "target" is the destination; "intent" is how - travel, flee, approach, enter, follow. "flee" is leaving the scene rather than naming somewhere to go - "I leave", "I back off" - which is also how somebody answers being told to get off ground other people are working.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'move'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.move` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`.

Intents: `travel`, `flee`, `approach`, `enter`, `follow`.

### `ride`

go somewhere ON something: a mount, a drawn carriage, a spirit boat, or flight on the cultivator's own blade. "target" is the destination; "topic" names what is under them when the player said. The engine picks what actually suits the road out of what they can put under them, charges the walking days the catalog states, and says what the arrival reads as.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'ride'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.ride` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `topic`.

### `fold`

step across the distance instead of covering it. "target" is the destination. Void Tribulation and above, and only to ground the cultivator has stood on or can see; the engine says so when they cannot.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'fold'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.fold` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `passage`

a Shrinking Earth Pavilion counter. "intent" is "board" to read what runs from here and what each costs, or "buy" to take a place on one; "target" is where to. Reading the board is free and is how somebody who has never left their province finds out there are others.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'passage'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.passage` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`.

Intents: `buy`, `board`.

### `oath`

a word given, carried, served out or not kept, and a claim held or given up. "intent" is "swear", "read", "break", "release" or "serve"; "target" is who it is given to, let off or done for; "topic" is what is being sworn or undertaken, in the player's own words. Breaking one is permanent and opens an account naming them, so never choose it for a question. "serve" is DOING SOMEBODY A SERVICE, which is a rung of the offer ladder and is not a favour. A favour is an account somebody carries; a service is a stretch of days spent on their business, and it is discharged by spending them rather than by being owed. Said once it opens the term, said again to the same person it serves the term out. "I do him a service", "I do a service for her", "I serve out my term" are this. "release" is the OTHER DIRECTION from the rest, and the distinction is whose claim it is. "break" is walking out of a word this cultivator gave and costs them; the forgiving one is letting somebody off a debt, a favour or a grudge that is owed TO them, and it costs them the claim. "I forgive his debt" and "I let her off what she owes" are this; "I break my oath" is not.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'oath'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `target`, `intent`, `topic`.

Intents: `read`, `swear`, `break`, `release`, `serve`.

### `attack`

hit somebody, at any severity. A push, a slap, a poke, a punch, a thrust through the chest - they are all this verb, and there is no separate verb for driving somebody off. "target" names the person. DO NOT SAY WHAT THE PLAYER WAS TRYING TO END UP WITH. This entry used to take an "intent" of drive_off, subdue, kill or humiliate, and that was wrong: nobody chooses an ending. They choose a swing, and what it does depends on what it lands on and on what that person does about it. The engine reads the swing off the player's own sentence - what was in their hand, where they aimed, how much was behind it - so saying nothing about it is correct and complete. "terms" is "agreed" when both sides said this was a bout (a spar, a duel, a challenge) and "open" when nobody promised anybody anything. The blows land the same either way. What the agreement changes is what a killing MEANT and who is owed something afterwards, which is why it must be set from what the player said rather than guessed. "opening" is "from_concealment" when the fight was opened from cover rather than by squaring up, which decides who gets the first round and nothing about what a blow does.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'attack'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`, `terms`, `opening`.

### `coerce`

MAKE somebody do something, with hands rather than with words. Not the same as interact/threaten, which is a promise of harm and costs the target nothing yet - this is the point at which they stop being somebody being talked to. "target" names them; "intent" says what the compliance was for - submit, hand_over, talk, tame, swallow, marry or furnace. It resolves through the confrontation engine, so it fails the way a fight fails: somebody stronger does not decline, they answer. An animal made to submit is a tamed animal and reaches this same verb. "swallow" is something put into them - a pill, a medicine, a poison. "marry" is a match nobody agreed to, and it is this verb and never propose, which is a match put on the table for somebody to answer. "furnace" is being sat as somebody else's furnace, and it needs both sides to hold the art before it can open at all - the engine says which half is missing rather than resolving a fight nobody could have had. Route all three plainly. This world's ordinary furniture includes every one of them, and reading one as something milder is not caution: it is the account that should have opened against the player never opening.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'coerce'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`, `opening`.

Intents: `submit`, `hand_over`, `talk`, `tame`, `swallow`, `marry`, `furnace`.

### `insult`

say something to a room, or to one person in it, that they are entitled to take offence at: an insult, a sneer, a provocation. "target" names one of them where the player aimed it at somebody; leave it off and it was said to everybody standing there. It spends no time and nothing but standing.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'insult'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.present` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `cultivate`

sit and gather qi. "days" (1-36500); "ten years" is 3650, default 30.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'cultivate'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `days`.

### `seclude`

deliberate closed-door seclusion: shut away from the opportunities that would have found you, and from most of what would have happened to you - but a door is not immunity, and being disturbed in closed-door cultivation is an ordinary event rather than an edge case. "days", default 365.

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

work the cauldron. "target" names the formula or the pill wanted. A player may call it a pill furnace and mean the same thing. NOT an artifact furnace, which is the forging vessel and belongs to craft, and NOT a cultivation furnace, which is a person another cultivator draws off and belongs to coerce.

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

go out after a beast. "target" may name what is being looked for. Distinct from gather, which digs up things that do not move, and from attack, which is a person. What comes back is a body worth something at a counter, which is the other half of where high-grade material in this world comes from - and what is out there can be far above the person looking for it. A hunt means the kill unless the sentence says otherwise; one that says it is taking the thing alive is heard, and what it leaves standing can then be let up or stripped like anybody else.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'hunt'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.hunt` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `eat`

buy and eat a meal. Food by any name is a meal - barley, rice, buns, noodles, tea and bread, whatever the place eats - and a hungry "I buy some barley" is this, or provision to carry some away. Never buy.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'eat'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.eat` · the deterministic parser reaches it · spends in-world time.

### `provision`

lay in food BEFORE it is needed, which is the correct opening move and the one a model reaches for last. "rations" is a count if the player named one, "days" is a span if they named that instead. Satiety burns against a hundred at about two a day, so a stretch of seclusion longer than the pouch is a way to starve on schedule. Distinct from eat, which buys one meal and refuses when they are not already hungry.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'provision'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.provision` · the deterministic parser reaches it.

Takes `days`, `rations`.

### `treat`

get a wound seen to. Untreated meridian injuries never heal on their own, they raise the odds of the next one, and this is the only route out of that. Choose it whenever the player says they are hurt and wants it dealt with, whether or not they name a physician. Costs stones and a month.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'treat'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

### `buy`

buy one line off the mortal price board by name. "target" is the thing: a pill, a physician's visit, a course of care, a ferry crossing. Use this rather than "interact" for anything with a price on it - a purchase is not an approach to a person. Food is not bought here: it is eat, or provision.

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

### `destroy`

break something they are holding, or a thing of theirs standing where they are, deliberately and for good. "target" names it. It is the other end of "craft" and "refine": what this engine can make, it can unmake, and nothing else - a stall, an inn and a village are not objects the engine models and the refusal says so rather than pretending it could not read the sentence. A cheap thing is gone from the pouch and the people standing there talk about it; a heaven-grade thing keeps its row, ruined, and the news travels. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'destroy'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `target`.

### `stow`

leave a thing in the room the player's house gave them, take one back, or look at what is in there. "intent" is which of the three and "target" names the thing. The room comes with the rung: what it holds is read off the house's own stipend at that rung, so promotion is the only thing that makes it bigger. It wants the house's ground underfoot - a room does not reach across a province - and what is left in it survives travelling away and survives a reload. A cultivator on nobody's roll has no room and is told so plainly. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'stow'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `intent`, `target`.

Intents: `leave`, `collect`, `look`.

### `list_techniques`

the arts this cultivator could actually be taught, filtered by realm, spirit root, dao standing and what has surfaced in this life at all. Passes no time. Use it for "what can I learn".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'list_techniques'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.listTechniques` · the deterministic parser reaches it · passes no time.

### `learn_technique`

take up an art for the first time. "target" names it. NOT the same as train_technique, which practises one already held. An art that fights the spirit root is learnable and can tear meridians on the spot, so choose this only when the player plainly asked to learn something.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'learn_technique'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.learnTechnique` · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `teach`

SOMEBODY'S ATTENTION ON THE PEOPLE IN FRONT OF THEM, from either end of the room. "intent" is "listen" to sit in on whoever is already teaching where the player is standing - "I go and listen to the lecture", "I sit in on Elder Hu's talk" - with "target" naming them when the sentence did; no asking and no price, and what each listener gets thins with how many are listening. "intent" is "lecture" to give a talk to whoever here stands below the speaker - "I give a dao lecture for three days"; "days" is how long, it costs those days, and the listeners who are of the speaker's own house earn the speaker contribution. With no intent it is: HAND AN ART ON TO SOMEBODY ELSE - the speaker doing the teaching, which is the opposite direction from learn_technique and from request/teaching. "target" is who is being taught and must be somebody standing here; "topic" is which art, and may be left out, in which case the engine picks from what this teacher could pass to this student and asks if there is more than one. Only reachable with an art the speaker holds and has taken to the end - the same bar a master in the world has to clear to write a copy out. It spends the time the art is worth, which is months for a primer and years for a deep road, puts the art on the other person, and opens an account in the teacher's favour. Whose art it was is priced on the same four rungs a leaked book is: handing on a house's own canon is not refused, it is answered.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'teach'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`, `topic`, `intent`, `days`.

Intents: `listen`, `lecture`.

### `acquisition`

how a manual could go further, priced by every route there is at once: finding the next volume, being taught it, or writing it yourself. "target" names the art. Passes no time and costs nothing, which is the point of it - the comparison is the decision, so it must not itself cost a decade. Use it for "how do I get past this book".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'acquisition'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.guidance` · the deterministic parser reaches it · passes no time.

Takes `target`.

### `derive`

WRITE THE NEXT STAGE OF A MANUAL YOURSELF, so the book carries one rung further than anybody has written it. "target" names the art and may be left out, in which case the engine takes the one that has stopped carrying them. NOT acquisition, which is the free comparison of all three routes and passes no time; this is doing one of them. NOT learn_technique, which takes up somebody else's book. Only open to somebody who has made that manual's road their own - a leaning reads and cannot write - and it costs decades: twelve years at the bottom of the ladder and centuries near the top, spent through the same skip a seclusion runs through. It costs no stones and no standing, and there is nothing to buy.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'derive'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `target`.

### `ceiling`

why nothing is accumulating, with the binding gate named: the manual, the province, the seat, the qi, or the settling clock. Passes no time. This is the right answer to "why am I not making progress", "am I stuck", "what is my ceiling" and "what is stopping me" - NOT status, which is the sheet, and NOT assess, which is somebody else's opinion of them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'ceiling'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.ceiling` · the deterministic parser reaches it · passes no time.

### `teacher`

who stands above this cultivator and would teach, with what each one will not say. Passes no time. Names only people they already hold a record for; "nobody you know of" is a real answer. Use it for "who can teach me", "I look for a master" and "is there anyone here stronger than me" - NOT status and NOT look, both of which answer a different question entirely.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'teacher'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.teacher` · the deterministic parser reaches it · passes no time.

### `destinations`

where they could go, with what the journey costs, what the qi is like there and how far that province carries anybody. Passes no time. Use it for "where can I go", "what is nearby", "what is past this province", "what lies beyond" and "where is there better spiritual energy". Distinct from recall, which reads their own head; distinct from move, which goes somewhere they have already named.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'destinations'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.destinations` · the deterministic parser reaches it · passes no time.

### `roads`

the dao grounds within reach: ground that teaches something, what each one teaches, and precisely what the cultivator is short by where it will not have them. Passes no time, reads only what they have heard of, and cannot teach them a name. The other half of destinations - that one is where they could go, this one is what standing there would be worth. Use it for "where can I comprehend something" and "what daos could I take up". A road HERE is a dao, a way of understanding, and never a road you walk: "the road to Cloud Gate" and "what is past this province" are about travel, and are asked of somebody or are destinations.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'roads'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.loadWorld` · the deterministic parser reaches it · passes no time.

### `wait`

let time go by doing nothing in particular. "days" (default 1); "target" names a thing the world has a date for - an intake posted here, a word falling due - and the engine spends the days between now and it. A name nothing here answers to is met with what does have a day on it, never with a day nobody asked for.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'wait'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · spends in-world time.

Takes `days`, `target`.

### `work`

take an occupation for a span, for wages. "days" (default 90); "target" may name the kind of work. This is how somebody with no stones eats, and it is the right answer far more often than a model expects.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'work'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.work` · the deterministic parser reaches it · spends in-world time.

Takes `days`, `target`.

### `market`

what is for sale where they are standing, and at what price. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'market'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.market` · the deterministic parser reaches it · passes no time.

### `sect`

anything to do with a house: getting into one, and everything a member or an officer of one can do. "intent" is the step - "join" to be taken in, "standing" to read where they stand, "stipend" to draw one, "promote" to ask for a rung, "duty" to take something off the mission board, "donate" to pay money into the house's coffers, which buys no rung and no contribution, "hand_in" to hand a THING they are holding in to their own house - "target" names it - which the house credits as contribution where it wants the thing and says why where it does not, "guest" to sit in at a house that has not taken you, "leave" to resign, "summons" to ask what the house has asked of you, "accept" to answer it yes and go, "refuse" to answer it no - which also answers people already working ground the player has walked onto, and hands off to the confrontation - and "ignore" to answer it not at all, "complaints" to read what the house is holding against its own and decide one where the room is theirs, "plead" to speak for somebody it is holding something against - "target" names them - and "siphon", "order", "recruit", "admission", "curriculum" and "expel" for what the rungs above a disciple buy. "expel" is a house putting somebody off its roll - said as doing it or as having it done, which are the same act - and what the power actually reaches is an ELDER's dismissal, at the top of the ladder: the answer names who holds it where the player does not, and says that nobody puts an ordinary member off a roll by saying so. Three more belong to somebody who holds a room. "authority" READS which rooms of the house are the player's to speak for, and it is free - it is the sentence before the one that claims, because an order given in the house's name is only a decision if they could have found out whether it was true. "decree" gives that same order in the house's name rather than in their own, and somebody may be watching who knows what the player actually runs. "take" is putting a hand on a thing the house owns - "target" names it - which is not stow, where the room is the player's own and nothing is being taken from anybody. Default to the read - "standing" - unless the player plainly asked for a step, because joining is a life's worth of allegiance and cannot be unsaid.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'sect'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.sect` · the deterministic parser reaches it.

Takes `intent`, `target`, `topic`.

Intents: `leave`, `promote`, `stipend`, `standing`, `join`, `siphon`, `order`, `recruit`, `admission`, `curriculum`, `expel`, `duty`, `donate`, `guest`, `summons`, `refuse`, `accept`, `ignore`, `complaints`, `plead`, `take`, `authority`, `decree`, `hand_in`.

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

ask an INSTITUTION for something: a grant, an object off its standing stock, recognition of a line, or a NOMINATION to one of the two postings nobody applies to - for that one, "target" is the house being asked to put the name up and "topic" names the posting. "target" names the body; "topic" is what is being asked for, in the player's own words, and is carried verbatim onto the form. "intent" is "stock" for an application against something a body is holding and cannot reorder (a Requisition, a schedule amendment, a request for one of its pills), "descent" for a claim of an ancestral line, "grant" for everything else that goes upward. Nearly always refused, and the refusal is the answer - it comes back in the instrument's own terms. Passes no time.

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

observe the surroundings, or ask about a house or a province from where the player is standing. Passes no time. "intent" narrows what is being looked at: "history" for what people say has happened HERE (not news, which is elsewhere), "ground_time" for how long this ground would take somebody, "crowding" for how many are already drawing on it, "bills" for what is posted on the wall, "company" for who else is standing here, "holder" for who holds this ground and what there is to complain to if you are wronged on it, "warmth" for what the people standing here carry about the player themselves - who is glad to see them and who has not forgotten something. Omit it for the plain read. AND FIVE READS ABOUT SOMEBODY ELSE'S HOUSE, where "target" names it: "what_they_hold" for what a house has to its name - its purse, what is on its shelves, and the ground it holds; "what_they_teach" for each road it teaches, the rung it opens at, the rung it stops at, and how far the asker's own root would walk it; "who_is_above_them" for who stands behind it; "would_they_take_me" for whether that house would have this cultivator and at what bar. All four want the house named. The fifth, "what_is_made_here", names nothing: it is what the province the player is standing in produces and what leaves it on the water. Every one of the five is free and is a READ. "would_they_take_me" is asked before crossing a province to find out, and it must never be answered with sect/join, which resolves the name and enrols - that would make the asking permanent. "what_they_teach" is the question before joining and is not request/teaching, which is asking a PERSON to teach you and spends days. Prefer these over recall, which reads only what the cultivator has already been told, and over investigate, which examines a thing in front of them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'look'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · passes no time.

Takes `intent`, `target`.

Intents: `history`, `ground_time`, `crowding`, `bills`, `company`, `holder`, `warmth`, `what_they_hold`, `what_they_teach`, `who_is_above_them`, `what_is_made_here`, `would_they_take_me`.

### `status`

report the cultivator's own condition. Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'status'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it · passes no time.

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

TELL SOMEBODY THAT A WRONG WAS DONE - to them, or to somebody of theirs. The other direction of news: that one asks what people are saying, this one carries it to the person it is about. "target" is who is being told and they have to be here; "topic" is what is being said, in the player's own words, including the name of whoever is being blamed if the sentence gives one. Use it for "I tell him that Cao Antao killed his brother", "I let her know who killed her master", "I tell him what happened to his brother" and "I tell him that I killed his brother". Passes no time. Route it whether or not the claim is true - naming the wrong person, or a killing that never happened, is an ordinary thing to say and the engine is what answers for it. ALSO FOR TELLING SOMEBODY WHO YOU ARE, which is the same act one subject over: "I tell the gate guard that I am of the Cinnabar Crucible Sect", "I introduce myself to the steward as a Core Formation cultivator", "I tell her my name is Shen Wuyi". Route those the same way whether or not any of it is so - the engine holds what this cultivator actually is and decides. A bare greeting with no name, house or rung in it is interact, not this. NOT for "tell me about X", which is a question and belongs to investigate, and NOT for a threat, which is about something that has not happened yet. AND AT A DISTANCE, intent "send_word": word sent on a communication talisman (a transmission or message talisman) to somebody who is not here. "target" is who it is for - "my master", "the sect", a house or a person's name - and "topic" is the message. Use it for "I burn a communication talisman to tell my master that the pass is held" and "I send word to the sect that I have found a door". Passes no time.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'tell'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `target`, `topic`, `intent`.

Intents: `send_word`.

### `request`

ASK A NAMED PERSON FOR A NAMED THING, which is not the same as interact and must not be routed there. "target" is who it is put to; "intent" is what kind of thing is being asked for - teaching (be taught an art: it takes the months or years the art is worth at their elbow, and an interrupted lesson leaves nothing), guidance (be watched and corrected while you cultivate - "I ask my master to guide my cultivation for a month", "I cultivate under Elder Hu's guidance for a year", "will you watch me run the form"; "days" is how long; the span is spent sitting with the guided rate, and it is their attention and not their presence that counts, so a master standing nearby who is not asked teaches nothing; anybody, a master included, is asked like any favour and may say no, and somebody at their own practice or at their own wall declines and says when they will be free), discipleship (be taken on), ending_a_bond (PUT A MASTER-DISCIPLE BOND DOWN, from either end - a master casting a disciple out, a disciple walking out on a master. Nothing is being asked for and nobody may refuse it; what it costs is stated rather than weighed: each of them keeps a former tie to the other, and the end that did not do it holds a broken oath against the end that did, the heavier the longer the bond had stood. "target" is who it is with, and "my master" with more than one is answered by naming them and asking which), introduction (be put in front of somebody), telling (be told something they know), a_thing (be given, lent or sold an object), terms (what would it take - the price asked before it is paid), a_trade (something put down for it that is not money), advancement (be raised a rung in your own house - it only moves if the person asked is the one whose call it is, and money alone will not buy it), company (ask them to come with you - "topic" is where the party is bound when the sentence said, and "days" is how long they were asked for; they travel with the player until the term runs out, and most people have no reason to follow a stranger), nothing (ask for NOTHING - buy them a drink, sit with them, call on them, do them a small favour; costs a day and no stones, and it is the only thing that makes a stranger somebody who will do you a favour later); "topic" is what was named - the art, the person, the thing. This is the ONLY route to being taught by a person, which the engine says repeatedly is one of the two ways past a manual's ceiling. It spends days and can spend the purse, so choose it only when the player is actually asking somebody for something rather than asking about them.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'request'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.request` · the deterministic parser reaches it · spends in-world time.

Takes `target`, `intent`, `topic`, `days`.

Intents: `teaching`, `guidance`, `discipleship`, `ending_a_bond`, `introduction`, `telling`, `a_thing`, `a_making`, `terms`, `a_trade`, `advancement`, `company`, `nothing`, `unstated`.

### `challenge`

SAY TO SOMEBODY'S FACE THAT WHAT THEY TOLD YOU ABOUT THEMSELVES IS NOT TRUE. "target" is who is being called on it, and they have to be standing here. Use it for "I tell him he is not of the Verdant Spring Valley", "I call her a liar about her rank", "that is not your house", "I say he made that name up". Passes no time and costs no stones. It needs an account they actually gave you - somebody who has only ever told you their name has said nothing that can be challenged. If you have nothing to put against what they said, they are simply being called a liar in front of whoever is here, and they will hold that. NOT for accusing somebody of a deed - "I tell him he killed my brother" is tell. NOT for a threat, and NOT for an insult about anything other than their own account of who they are, which is interact.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'challenge'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `target`.

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

### `carry`

what is on this body and what is in its hands. "intent" says which: "wear" puts robes on (and says whose they are and what a house's people make of somebody in them), "take_off" takes them off, "draw" puts a blade in the hand, "put_away" returns it, "drop" lets it go on the ground, "show" offers the house token as proof of what you are - which is what a robe is not. "store" puts the thing named into the storage ring on their hand, "retrieve" takes it back out, "unmark" breaks somebody else's mark on a ring so it will open. "load" puts a thing into their cart, carriage or boat and "unload" takes it out; "leave_behind" leaves the vehicle where it stands and "take_along" takes it with them again. "target" is what was named, in the player's own words. No day passes and nothing is rolled. NOT for attacking: "I draw my sword on him" is attack. Inside a fight none of this applies - dropping a sword there is a surrender, and the fight reads it.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'carry'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `target`, `intent`.

Intents: `wear`, `take_off`, `draw`, `put_away`, `drop`, `show`, `store`, `retrieve`, `unmark`, `load`, `unload`, `leave_behind`, `take_along`.

### `conceal`

getting out of sight. "intent" says which sense: "self" is the body somewhere it is not seen, and the answer names who here would still place you and why; "cultivation" is carrying nothing that says what you are - the hidden expert in the plain robe - and it STANDS until the player says otherwise; "show" puts the weight back on. No day passes. A concealment said as part of another sentence ("hiding my cultivation, I ask him where the elder is") is NOT this verb - it is a manner on that act and is already read there.

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves at `case 'conceal'` in [`GameService.execute`](../src/web/turn-engine.ts) · the deterministic parser reaches it.

Takes `intent`.

Intents: `self`, `cultivation`, `show`.

### `unclear`

DO NOT CHOOSE THIS. It is the deterministic parser's fallback for a sentence it could not read. If you are unsure, choose "look" or "investigate".

Declared in [`ACTION_NAMES`](../src/web/action-set.ts) · resolves through `case 'unclear'` in [`GameService.execute`](../src/web/turn-engine.ts) and `GameService.guidance` · what the deterministic parser answers when nothing else matched · passes no time.

<!-- END GENERATED: verbs -->

---

## The operator surface

<!-- BEGIN GENERATED: admin -->

**16 operator actions**, reached by a line beginning `ADMIN`.

They are not verbs and no model reads one: an `ADMIN` line is handled before phase 1,
read deterministically, and refused rather than improvised where the reader has no noun
for what it names. What each one takes, which phrasings reach it, and the law it follows
are in [`admin.md`](admin.md) - this list is only the set, so that a new action there
cannot go unlisted here.

`roster` · `spawn_encounter` · `spawn_site` · `grant_item` · `set_ambient` · `set_location` · `advance_days` · `set_realm` · `set_age` · `grant_progress` · `grant_knowledge` · `join_sect` · `audit_log` · `help` · `reset` · `<any playable verb>`

Declared as `ADMIN_ACTIONS` in [`game.ts`](../src/web/turn-engine.ts).

<!-- END GENERATED: admin -->
