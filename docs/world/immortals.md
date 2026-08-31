<!-- tier: 2 trigger="the cultivator is at Tribulation Transcendence or above, or the player is investigating ascension, the Lid, or an immortal ancestor" -->

# The Immortal World

What is on the other side of the Lid, what an ascending cultivator leaves behind, what can
cross in either direction, and why immortal-era play is deliberately thin. **Do not load
this for ordinary play.** It is Tier 2 with a high threshold: the player has to be near the
top of the ladder, or actively investigating ascension, for any of it to matter.

The three ways the last crossing resolves - True Immortal, False Immortal, and the
ordinary failure - are mechanics, and live in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md).

---

## It is a place, not only a rank

The Immortal Realm is not only a rank. It is a **place**, and reaching it moves you there.

This is the one point where cultivation progression is also *geographic* progression. A
True Immortal does not keep walking around their starting province as a stronger version of
themselves; they go through the Lid, and what is on the other side is a different layer of
the same world - not another planet, not another universe, and not a second game.

### What it is like up there

Not the same map with bigger numbers. A genuinely different environment:

- qi at densities the lower world cannot produce, and has not held since before its history
- natural law that behaves differently, and is not negotiable by anyone newly arrived
- resources, materials and techniques with no equivalent below
- native cultivators who were born there
- civilisations, immortal sects and clans that are older than the lower world's records
- environmental dangers calibrated for immortals, which is a phrase worth taking seriously
- politics that has been running, uninterrupted, for a very long time

### A newly ascended immortal is a nobody

This is the important part and the reason the layer exists.

Measured against the world they left, a newly ascended immortal is beyond comprehension -
a being whose descent would reorganise a continent. Measured against the world they have
arrived in, they are a newcomer with no lineage, no standing, no allies, and cultivation
that is unremarkable.

Both facts are true simultaneously, and the gap between them is the entire perspective
shift. It also produces one of the best available payoffs: an immortal descends into the
lower world and is an absolute monster there, and the player later discovers that this
"invincible ancestor" is not considered exceptional at all where they come from.

That gives the scaling shift without the universe having to become infinitely larger,
which is the world layer's governing constraint - see
[`../../src/engine/world/README.md`](../../src/engine/world/README.md).

### The lower world does not pause

Both layers keep running. The mortal world continues its own history after an ascension -
the sect grows or is destroyed, the disciple becomes an elder and then a corpse, a war
starts, a new prodigy appears and dies young - none of it waiting for anyone.

An ascended cultivator therefore does not leave a snapshot behind. They leave a world that
will be substantially different whenever they next look at it.

### It is not a hard reset

The player has not entered Game World 2. History, karma, relationships, factions,
artifacts, descendants, debts and consequences all cross the boundary. What changes is
*access*, and access is restricted in both directions - the crossings described below are
ruinous precisely so that the boundary means something.

### Higher layers, later or never

The architecture should permit `mortal world -> immortal world -> something further`
without any of it existing now. **One mortal world plus one immortal world is sufficient.**
Do not generate additional layers to increase scale; add one only if the world's own
history ever produces a reason for it, and probably never.

---

## What immortals leave behind

<!-- tier: 2 trigger="the player finds a designed inheritance, or asks who built one" -->

Nothing goes through the Lid except the cultivator. They know this well in advance, and
they act on it.

So the years before a crossing are spent **divesting**. An ascending cultivator sells,
gifts, buries, seals and arranges: artifacts they will not need, manuals they will not
read again, spirit stones that will buy nothing where they are going, and above all
**inheritances** - deliberately constructed, deliberately hidden, deliberately gated, left
for whoever proves worth them.

**This is the author of the world's entire inheritance economy.** It is why sealed caves
have trials in them, why the trials are *calibrated* rather than merely lethal, why a
manual three grades above anything taught is sitting behind a door with a riddle on it.
Somebody put it there on purpose, on their way out, knowing they would never come back to
check.

It is also why the sect an ancestor left is holding a parting gift, and why the recency of
a crossing is most of a sect's prestige - see [`sects.md`](sects.md). And it is what
separates an inheritance from a grave, which is a profession's worth of distinction:
[`economy.md`](economy.md).

## What crosses the Lid

**People do not.** A cultivator below True Immortal who reaches the other side is crushed -
not attacked, simply unable to exist at that pressure. And an immortal returning downward
draws tribulation lightning on the way through, because the Lid does not distinguish
between a hole made outward and one made inward.

Neither is *impossible*. Both are ruinously expensive. An immortal who comes back down
pays a price that almost none of them are willing to pay, and the ones who did are
remembered for it - usually because whatever they came back for was worth more to them
than what it cost, which is by itself the most interesting fact anyone will ever learn
about them.

**Information does.** There exist artifacts - extremely rare, mostly ancient, several of
them the deliberate parting gift of somebody's ascension - through which knowledge can
pass the Lid in either direction. A message. An answer. A warning. The confirmation that
someone arrived.

This is the setting's only reliable channel between the two sides, and it is the reason
anything below the Lid knows the other side exists at all. It also means the most valuable
commodity in the world is not a treasure or a technique but **a working line of enquiry to
somebody who already went through** - which is precisely the sort of thing a Dao house
would kill to control, and precisely the sort of thing that gets misreported, faked and
sold.

### The two crossings nobody makes

**Sending someone up is not a plan, it is a way to destroy two things at once.**

A cultivator below True Immortal cannot exist on the other side. Not "faces long odds" -
cannot exist. And the artifacts capable of moving something through the Lid are among the
rarest objects in the world. So the trade is: burn an irreplaceable treasure, and the
person you spent it on dies on arrival. Nobody who understands the exchange proposes it,
and the handful of times it has been attempted are remembered as a category of madness
rather than as a gamble.

**Coming down costs an immortal more than it is worth, almost always.**

An immortal returning below the Lid is not travelling; they are forcing an opening
inward, and the Lid does not distinguish that from any other breach. They pay for it out
of cultivation condensed over ages - the actual substance of what they became - and they
get very little time. Ten breaths is the figure people quote, and people who quote it have
usually never seen it done.

If it goes badly, and it often does: the body fails and what is left is a single drop of
blood, drawn back up through the seam by the Lid itself. The immortal survives, technically,
and spends the next several thousand years recovering enough to be a person again.

If it goes worse than that, they do not come back at all. **This is one of the few ways an
immortal actually dies**, and it is why the ones who did come down are remembered so
precisely: whatever they returned for was worth more to them than the several thousand
years, and working out what it was is one of the most interesting questions in the world.

The engine should treat both crossings as real, resolvable, and catastrophically
expensive - never as a travel option, and never as a narration flourish.

---

## Immortal lineages

<!-- tier: 2 trigger="a sect's or clan's ancestry is being counted, claimed, or disputed" -->

Sects and clans are counted by how many immortals they have produced, and the counting is
the prestige:

```text
1 immortal            a supreme lineage
2                     extraordinary
3                     legendary
4+ in succession      very nearly mythical
```

Track current immortals, historical immortals, the total produced, and consecutive
generations producing one. **Prestige should emerge from that history rather than from a
hardcoded multiplier** - a lineage with three immortals is formidable because of what those
three did and left, not because a number says so.

**Mortal sects can be branches of immortal lineages.** An ancient immortal clan above, a
branch established below, a regional sect that descends from it. The branch may know this,
may have forgotten it, or may be *claiming* it without proof - which is another thing the
Dao houses sell verification of, and another thing worth killing to keep unexamined.

A recognised branch can expect inheritance, protection and enormous political leverage. It
can also expect to be used.

### Characters cross the boundary

People stay relevant through ascension in both directions. Someone important in the lower
world may later ascend, be summoned upward, deliberately remain below, become a branch
ancestor, die, or found a lineage. And an ancient immortal may descend and become
important to a story that began long before anyone knew they existed.

---

## Immortal-era play is deliberately light

<!-- tier: 3 -->

**Immortal-era play is intentionally thin, and should stay that way.**

It is the "you have beaten the game" state. There is lore up there, there are things to
find out, and there is a quiet loop. There should **not** be a second full progression
system, a second economy, or a second survival layer. The weight of this game lives below
the Lid, and the Immortal World's job is to give that weight somewhere to point.

### Ascension does not end the run

Reaching True Immortal is not a game-over screen. The player may keep going.

An immortal run is a different game, and deliberately so: the concerns are no longer
survival and scarcity but obligation, legacy, what to leave, whom to answer, and what is
worth the price of reaching back down. Everything below is still there - the sects, the
descendants, the grudges, the people who knew them - and they can still be reached, at
cost.

**And the player may end the run whenever they choose.** Ascension is the one point at
which a run can be closed voluntarily rather than by dying: a cultivator can go through,
settle their affairs, leave what they leave, and step off the ladder deliberately. The
ledger records the run as ended by ascension rather than by death, which - in a game where
almost every other run ends with a corpse - is the rarest line in it.

### What an immortal run actually is

It is a quieter game, and a deliberately smaller one.

An immortal has no survival pressure, no scarcity, and nothing above them to climb toward
that anyone below the Lid can describe. What they have is **time, resources, and the
people they left**. So the loop is:

- potter about, largely undisturbed
- spend absurd money throwing something down to a sect, a descendant, a disciple - a
  technique nobody in the world can teach, an artifact three grades above anything in the
  region, a warning
- receive word back: a descendant has done something, a sect has risen or been destroyed,
  someone has died, someone is asking after them
- eventually get bored, and step off the ladder

That last one is a real ending and the player chooses when. Nothing forces it.

The emotional content is that everything below keeps moving and you can only ever touch it
at arm's length, through objects and messages, while the people who remember you die off
one at a time. Sending a gift down is the most an immortal does in a century, and it is
enough to reshape a region.

## Related

- [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) - the last crossing, True and False Immortal
- [`sects.md`](sects.md) - ancestral records and the millennial offering
- [`economy.md`](economy.md) - graves versus inheritances
- [`the-late-age.md`](the-late-age.md) - why nobody has crossed in living memory
- [`../../src/engine/world/README.md`](../../src/engine/world/README.md) - why the world gains depth rather than layers
