<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# The map, in four layers

The design owner's shape for the world, and what it costs to get there from what is
there now. Not yet built: this is the spec, written while a place-name rename was in
flight, to be done as its own pass afterwards.

```text
Region            north / south / east / west
  Sect            the state: territory, law, economy, protection, succession
    Area          SIBLINGS, all of one kind - the sect's own hall, a village,
                  a forest, a waterfall, a desert, an ancient battlefield
      Room        interiors - a tavern's common room, a hall, a cell
```

Two rulings that are easy to miss and are the whole point of the shape:

**Areas are siblings and the sect's headquarters is one of them.** A village is not a
different kind of thing from a waterfall. The hall a sect governs from is an area like
any other area, and it is in the list with them rather than above them.

**Only three layers are drawn.** Rooms do not appear on the admin panel's map, and areas
nest UNDER the village tab rather than beside it.

## Unheld ground

The design owner's ruling, and it is the simplest thing that works:

> That is just region -> no sect -> area.

**The sect layer is nullable.** An area nobody holds hangs off its region with nothing in
between, and "no sect" is an ordinary bucket in the view rather than a case anybody has to
special-case:

```text
North
  Cloud River Sect
    Cloud River Hall, Willow Village, Jade Pass
  Black Mountain Sect
    ...
  (no sect)
    Nine Hundred Paces, the burn edge
```

`groundIsUnheld` stays a real state with a real affordance behind it, and it becomes a
question about the tree rather than a flag beside it: unheld IS having no sect above you.

Contested ground stays expressible for the same reason it always was - **holding is a
RELATION and the tree edge is not the holding**. Two sects can claim one area, the area
still sits in exactly one place in the tree, and the claim rows say the rest.

## The fourth layer already exists, and nothing reaches it

`room_nodes` is a complete table in `storage/migrations.ts`: id, name, description,
biome, atmospherics, **exits** (direction, target, type, dc), entity ids, visit count,
last visited. `characters.current_room_id` joins to it. `spatial-manage.ts`,
`spatial-handlers.ts`, `engine/world/architecture.ts` and the two perception detectors
all read it.

**`grep -rl "roomId\|room_nodes\|currentRoom" src/web/` returns nothing.** No typed
sentence reaches any of it.

That is this repository's most-repeated defect and the fourth instance found in a single
afternoon, after `planTheBuild`, `furnace-technique.ts` and the 34 unread ruin names.
So layer four is a WIRING job, not a building job, and anybody who starts by designing a
room system has already made the mistake. Read `architecture.ts` first.

## And it is what makes a cultivation room exist

The design owner's point, and it is the reason layer four is worth the wiring rather
than a nicety: a 静室 - a quiet room, a closed-door chamber - is an interior with **its
own ambient band**, and every part of that already exists separately.

- `AmbientQi` already prices what a stretch of sitting yields.
- Ambient is already declared per location, not computed globally.
- `runSeclusion` already spends the years.
- A sect already has ranks, contribution and duties.

Put those in one place and a rank buys something material for the first time: a better
room is a better rate, the rate is the whole of what a cultivator has, and the room is
therefore worth doing duties for, worth being promoted for, and worth somebody taking
off you. None of that needs a new system. It needs an ambient band on a room and a sect
that allocates rooms by standing.

It also gives seclusion somewhere to happen. Today a cultivator shuts a door that is not
attached to anything.

## What has to move

Today the containment is `Region -> Province -> (optional Prefecture) -> Place`, with
sects holding ground alongside it rather than inside it. Six provinces; only two have
prefectures; four provinces have no `Region` at all.

The readers that will notice: `regionIdOfPlace`, `declaredAmbientAt`, `prefectureCarrying`
- all three match a place by its display STRING and all three **fail open**, returning
`undefined` and falling back to the home province. A missed edge here does not throw. It
quietly answers with the wrong province, which is the same failure mode `place-names.ts`
was written to stop.

`regions/provinces.ts` explains why its six rows are one table, and
`regions/prefectures.ts` why its rows live with their provinces. Read both before
deciding whether a prefecture becomes an area, a sect, or nothing.

## Sequencing

After the place-name rename lands. A topology change on top of a live sweep of ~1,200
name occurrences is how a map ends up half-renamed and half-restructured, with a guard
that does not scan `tests/` reporting green over the top of it.
