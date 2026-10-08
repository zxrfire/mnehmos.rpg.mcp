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

## A journey is somewhere you are
<!-- tier: 3 -->

Owner clarification, 2026-10-07: travelling between cities puts the character
in a travel scene while time passes and encounters happen, until the actual
journey reaches its destination. The working player-facing label is **On the
way**. This applies on foot, in a carriage, in a spirit boat and aboard a ship.
Open water is part of the world, and a sea journey has the same requirement.

Cities are not all directly connected by road. On foot or in a carriage, if the
existing map admits A to B and B to C, a journey from A to C passes through B,
with the actual time and ground of each leg. Naming C does not create an A-to-C
road. Intermediate cities are physical places reached along the ground route,
not names discarded after adding up a fare. A missing road cannot be supplied
by narration.

The owner immediately distinguished airborne travel: a spirit boat can go
straight to C. A cultivator at ordinal 29 or above, or a sword cultivator with
the existing ability to fly, can also fly directly there. Airborne travel does
not require passing through the intermediate cities of a road route. The
journey scene follows its actual course and mode; it is not a rule that every
mode uses the walking graph. Existing native flight eligibility, actual craft,
resources and destination knowledge still govern the attempt. Ships follow
their actual water passage; the existence of a road does not make a sea lane.

The travel scene is a view of the accepted journey's current position, not one
shared world location where unrelated travellers meet. Company, encounters,
road or water, and arrival come from the existing route and carrier authorities.
The character cannot use an endpoint's rooms or counters while still between
places. Interruption retains the distance already travelled; continuation spends
only the remaining actual journey. Player knowledge may supply an informed
question, but self-navigation still requires the route the character knows.

Implementation must reuse the current graph and progress authorities:
[`locations.ts`](../../src/engine/world/locations.ts),
[`road-course.ts`](../../src/engine/world/road-course.ts), and the existing
carrier passage readers. This ruling does not establish a second progress
record, another pathfinder or a new encounter catalogue. Recorded as a design
ruling; a graph-priced total alone does not prove that played travel visits its
intermediate cities. Each travel mode still needs that behavior verified.

### Directions describe a practical journey
<!-- tier: 3 -->

The owner also requested a played test for asking an actual person, "How do I
get to X?" An informed answer should give useful travel choices: approximately
how many days on foot, how many by carriage, and paid teleportation or another
conveyance where a real service is available. "About five days" is an example
of useful dialogue, not a fixed travel price. Numbers and offered services come
from the existing journey and service authorities, read through what that NPC
actually knows. A person who does not know cannot invent the route or a service.

A player may ask by a remembered destination name before the character has
heard it. An actual answer giving directions can teach the character the route
through the existing knowledge reader. Asking does not itself travel, book a
seat, pay a fare or confer access. Test the actual question, supplied reply facts,
route learning and service availability; a parser match alone is insufficient.

### Public hubs exist, and locals know them
<!-- tier: 3 -->

Owner clarification: a city with a transportation hub has an actual place the
player can reach and use. This includes the existing portal Dao house's surveyed
counter locations. Locals know their public hub exists even if they have never
used it, as someone can know their local airport without ever having flown.
Travel experience or an occupation is not required for that local knowledge.
Public advertised services may supply a way there without personal experience
of the destination. Private or unoffered routes are not public knowledge.

The service must work through the whole played path: ask about it, reach the
actual hub, read its real destinations and terms, pay or otherwise meet its
existing terms, take the service, and arrive through the native passage resolver.
A service mentioned in a menu or by a speaker is not built if that path is absent.
Existing carriage stations, ship landings and surveyed portal counters are the
authorities; this ruling does not put every service in every city.

### The player can carry people too
<!-- tier: 3 -->

Owner clarification: sect missions may ask the player to transport people.
A player can also offer rides in their carriage or craft, free or in exchange
for cash or goods. Read the existing mission, agreement, party, possession and
conveyance rules before adding anything. The people are actual passengers who
agree or are sent through the existing authority, not narrated luggage. Boarding,
capacity, travel, interruption and physical arrival remain engine decisions.
Payment or goods change hands through the ordinary agreed exchange; a transport
mission settles from what was actually done. Accepting a notice or voicing an
offer does not silently complete the delivery. These are required played paths,
including their integration with the same journey scene and current course.

### A party and the people sharing passage
<!-- tier: 3 -->

Owner ruling: use the existing presence and travel systems for fellow travellers.
The earlier proposal to put every passenger in the RPG party was superseded after
the owner described an established party sharing a carriage with strangers, and
a large spirit boat with many people spread across several areas.

An established party keeps its own membership and agreed terms while travelling.
Boarding must not erase those terms, and arrival does not dissolve that party.
Other people sharing passage are actual people present in the same carriage or
in the same accessible area aboard the same vessel, not additional party members.
The actual accepted vessel, course and current area determine their presence;
a generic in-progress travel label must not mix people on unrelated journeys.
Use those existing authorities rather than storing a second passenger group.

A large spirit boat is a moving place: its actual decks, rooms and other areas
matter to who can be seen, approached or spoken to. Sharing a vessel does not
make every person aboard visible from every room. Conversations advance the
actual journey clock and use the current person's ordinary identity and facts.
Existing doors, access, boarding, capacity, interruption and death rules apply.

### Areas belong to their enclosing place
<!-- tier: 3 -->

Owner clarification: rooms in a sect belong to its grounds; cabins and other
interiors aboard belong to their actual vessel. Keep both the immediate area and
the enclosing place readable through the existing containment authorities. Do not
add a second parent graph or treat every contained room as the same visible scene.

A person in a cabin is already aboard. The cabin and its occupant move with the
same actual vessel; they need not leave the cabin for the vessel to depart. Moving
to the deck is local movement, and leaving the vessel is disembarkation.

A person in a room in the sect has not yet boarded a vessel outside it. A travel
request should find and execute the actual local path through exits to the
departure point before boarding, rather than refuse solely because the person
is indoors. Doors, access, local distance, elapsed time and interruptions govern
that approach. Apply the same physical rule to player characters and NPCs.

Ordinary organized departures lead from the room to the actual port for a ship,
or to the 灵舟坞 (Spirit Boat Berth) for a spirit boat. These are physical departure
areas within the existing place hierarchy, with the actual vessel and operator
there; naming a facility does not supply either of them or complete the approach.

When passage ends, fellow travellers' actual arrival and subsequent activities
end their shared travel presence normally. There is no incidental party to
explicitly disband. Continuing together is possible through an actual agreement
using the existing party rules, not a consequence of sharing passage or talking.

### The passage house attends its sites
<!-- tier: 3 -->

Owner requirement: the Shrinking Earth Pavilion's actual passage sites must be
usable through the complete played path: ask where the site is, reach it, read
its terms, pay, take passage and physically arrive. Portal travel and courier
travel retain their existing distinct authorities; a courier counter is not
made into a permanent portal merely by naming it.

The house also sends actual disciples to watch these places through the existing
mission and posting systems. A mission names real work at a real site; accepting
one does not narrate a disciple into attendance or manufacture completed watch
time. Assignment, travel, presence, interruptions, relief and settlement follow
the ordinary house and party rules. Existing service availability and absence
must be respected. Names of sites, watches and missions follow the established
ancient Chinese/xianxia naming conventions, with appropriate translations.

### The pilot commands the vessel
<!-- tier: 3 -->

Owner simplification: the actual driver or pilot is also the person in charge;
on a boat that person is its captain. Read the actual accepted passage's operator
rather than inventing a separate captain or storing a second command authority.

A passenger can ask that person to change the destination. Ordinarily the agreed
route, other passengers and the operator's duties weigh toward refusal, but the
request is possible. Actual danger, obligations, interests, traits and ties can
change their answer through the existing NPC decision rules. No flat guaranteed
refusal or guaranteed obedience decides it. An accepted change still requires a
feasible actual course and its ordinary time, fuel, capacity and payment terms.
Preserve the real vessel, current position and historical passage receipts.

Walking to a deck, room or other area aboard is local movement, not a request to
change the vessel's destination. Dialogue which does not request a course change
must not silently retarget it either.
