<!-- tier: 3 -->

# things

Objects, what they are worth, and what holding one says about you.

**Start here for anything that can be carried, sold, stolen or inherited** -
including the question of what money cannot buy, which is most of what matters.

| File | What it answers |
|---|---|
| [`economy.md`](economy.md) | stones, prices, and the two economies |
| [`items.md`](items.md) | counted and tracked, provenance, and what holding a thing says |

## The design is not all in here

**Much of what this repo has decided about objects and what they cost is written in the catalog, not in
the files above**, in header comments and exported constants that no search of
`docs/` reaches. The rows below are routes into it, not summaries of it.

| Catalog | What sends you into it |
|---|---|
| [`artifacts.ts`](../../../src/data/cultivation/artifacts.ts) | any object with a power on it, from a founder's gift to a notched sabre |
| [`immortal-items.ts`](../../../src/data/cultivation/immortal-items.ts) | something came down from above the Lid |
| [`pills.ts`](../../../src/data/cultivation/pills.ts) | a medicine is offered, priced, or refused |
| [`recipes.ts`](../../../src/data/cultivation/recipes.ts) | somebody wants to make a pill and needs what goes in it |
| [`herbs.ts`](../../../src/data/cultivation/herbs.ts) | an ingredient is gathered, hunted, or has run out |
| [`beasts.ts`](../../../src/data/cultivation/beasts.ts) | the dangerous half of the world that is not a person |
| [`what-each-house-makes-and-what-crosses-the-water.ts`](../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.ts) | what a house produces, and what leaves the province because of it |
| [`structural-repair-medicine.ts`](../../../src/data/cultivation/structural-repair-medicine.ts) | a wound is past what ordinary medicine reaches |

---

Indexes: [`../INDEX.md`](../INDEX.md) by situation,
[`../BY-HOUSE.md`](../BY-HOUSE.md) by house.
Both also reach the design prose in `src/data/cultivation/`.

---

## Where else to look

- [`../../../src/engine/world/README.md`](../../../src/engine/world/README.md) - an object once
  somebody owns it: `possessions.ts`, `ownership-transfer.ts`, `provenance.ts`,
  `object-damage.ts`, `what-a-body-can-carry-and-what-a-ring-holds.ts`,
  `what-is-out-on-loan-and-who-lent-it.ts`.
- [`../../../src/engine/cultivation/README.md`](../../../src/engine/cultivation/README.md) -
  what a thing DOES: `market.ts`, `buying-and-bartering-pills.ts`,
  `what-grade-of-medicine-a-wound-needs.ts`, `whether-a-weapon-survives-being-used.ts`,
  `who-can-refine-a-grade-of-medicine.ts`.
- [`../../../src/engine/social-leverage/README.md`](../../../src/engine/social-leverage/README.md) -
  what somebody would take for a thing they will not sell, what they will take instead of
  money, and who has to agree before it leaves the store.
- [`../../../src/data/cultivation/README.md`](../../../src/data/cultivation/README.md) - the
  object tables in context with the rest of the catalog.
- [`../../../src/web/README.md`](../../../src/web/README.md) - how a player handles objects:
  `register-items.ts`, `handing-somebody-a-thing.ts`, `market-prices.ts`,
  `what-is-being-swapped-for-what.ts`, `object-theft.ts`.

