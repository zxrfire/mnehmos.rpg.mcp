<!-- tier: 3 -->

# Perception

What somebody can see from where they are standing, and what they miss.

Retained from the D&D substrate and **kept for divine sense**. Every piece here
has a reading in this genre, and the first one fills a hole the cultivation side
does not currently have at all:

- `attentional-capacity.ts` is a pool that scales with rung, is debited by use
  and refills. That is 神識 - a cultivator's spiritual awareness, which is
  finite, reaches further the higher they stand, and runs out. Nothing in
  `engine/cultivation/` models it as a budget today; `price-of-advancement.ts`
  only speaks of an elder's attention being elsewhere, as fortune.
- `hierarchy-of-controls.ts` ranks countermeasures the way mine safety does -
  eliminate, substitute, engineer, administrate, protect - and the world already
  has one of each: seal the ground, send something lesser in first, raise a
  formation, post a patrol, hand out a talisman. The ranking is the same
  ranking; only the nouns are ours.
- `blind-spot-detector.ts` and `hazard-detector.ts` answer what a reader knows
  they cannot see, and what a place is carrying that a look would catch. Both
  read committed state only, which is the same rule the engine keeps everywhere:
  do not report what has not been filed.

Its own honesty rule is worth keeping as well: it refuses to recommend removing
a hazard when it cannot query whether removal is possible. That is what makes a
lens trustworthy when it is wrong, and it is the refusal discipline the rest of
this engine already keeps.

| file | what it is |
|---|---|
| [`attentional-capacity.ts`](./attentional-capacity.ts) | Attentional-capacity arithmetic. |
| [`blind-spot-detector.ts`](./blind-spot-detector.ts) | Blind-spot detector - the §3.5 fog-as-information thesis encoded. |
| [`hazard-detector.ts`](./hazard-detector.ts) | Hazard detector - reads from committed state only. |
| [`hierarchy-of-controls.ts`](./hierarchy-of-controls.ts) | Hierarchy-of-Controls ranker. |
