<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# What an art is worth

Two arts at the same level are not the same art. What already says so, and what does not.

## What a technique row already carries

`category` (attack 41, cultivation 40, defense 18, dual_cultivation 2, forbidden 9,
movement 16, support 27), `grade` (mortal 26, earth 42, heaven 30, immortal 26, chaos 29),
`element`, **`requiredOrdinal`**, `qiCost`, `damage`, `cooldown`.

So arts already differ by grade, by damage, and by whether their element matches your root -
`combat.ts:675` gives affinity when it does. **`requiredOrdinal` is the design owner's
"starting ordinal"**, and it is exactly the rule they described: you cannot begin an art
above you.

## The three gaps

**1. An art has a floor and no ceiling.** `requiredOrdinal` says where you may START. Nothing
says how far the art CARRIES. So this cannot be said:

> A Core Formation art that caps at Nascent Soul. A Core Formation disciple can cultivate it
> to the Nascent Soul level - which makes him unbeatable at Core Formation, and still easily
> rolled by an actual Nascent Soul.

That is the genre's central power-progression trope and the whole of *comprehension* as a
stat. You cannot start level 1 of a Nascent Soul art; but if level 1 is Core Formation and
level 2 is Nascent Soul, you can reach level 2. **The floor gates entry; the ceiling gates
how far the art goes; how far YOU get inside that range is comprehension.** Only the floor
exists.

**2. Elements do not weigh against each other.** `element` reaches combat only as root
affinity. There is no ranking, so lightning is not favoured. The design owner: *"lightning
arts should be strongest, that's the xianxia trope"* - and *"two people at the same ordinal
with arts at the same level: lightning should be slightly favoured in a duel."*

**Slightly** is the word to hold. Every fight is already RNG; this is a weighting on the
odds, not a trump. An element that decides a duel outright would make the other six
decorative.

**3. Techniques cannot heal.** Six mentions of healing in the whole catalog. The design
owner wants healing arts, **especially water, also wood** - and the reason is economic:
*"that also lets cultivators sell their services."* A healer is a profession, and this world
has a market, a physician who cannot reach past mortal medicine, and untreated wounds that
compound. A water art that closes a torn meridian is a business.

## The furnace art, sized exactly

Rules from the design owner, and together they explain why it is forced rather than chosen:

- Caps at **46** - it runs the whole ladder, so nobody is too weak to hold it.
- Gives **zero combat power** for the furnace half - so nobody would ever choose it.
- **Unusable until ordinal 13.** The EXTRACTING half needs 13, so the furnace half does too.
- Therefore **you must reach 13 on a different art first**, and you must cultivate a
  different art to cross. The furnace art cannot carry you over a crossing.
- Therefore **there is no point taking an ordinal 0 or 1 as a furnace.** They are worth
  nothing until somebody has spent years bringing them to 13 on something else.

That is the sinister road stated in numbers rather than in prose: a furnace is not found,
it is *raised*, on somebody else's art, to a floor they did not choose to reach. And what
they are worth at the end is their own stage in the paired art, so the investment is in
their ruin specifically.

`dual_cultivation` is already a category with two rows, and `paired-breath-canon` is in the
catalog. The gate is written in `src/web/an-art-that-needs-both-of-them.ts`; the stage number
is waiting on per-cultivator mastery, which `techniques.ts` says is deliberately not catalog
state.
