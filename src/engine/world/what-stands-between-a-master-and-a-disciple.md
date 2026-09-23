# What stands between a master and a disciple

<!-- tier: 2 trigger="somebody takes a disciple, kneels to a master, already has one, or one of them ends it" -->

Four rulings from one night, which had no written home between them: the bond
has no term, a person may hold several, either end can end it, and what the two
of them feel about each other is counted whether or not anybody is teaching.

This is the rule as a reader needs it. The numbers live beside the code that
applies them and are named here rather than repeated, because a figure written
twice is a figure that will disagree with itself.

## A bond is for life

> **"A master-disciple bond is for life."**

There is no term on it and nothing falls due. The oaths taking somebody on opens
have no day they come due (`whatABondOpens`), which is the whole of the
difference from an ordinary debt: an obligation with a clock is a thing you can
wait out, and this is not one.

It ends when somebody ends it and in no other way. Time passing does not end it,
being away does not end it, and a master who teaches nobody for forty years
still has the disciple they took - which is what removing the old neglect rule
settled. *"The master neglect thing, get rid of it. Either they terminate the
relationship or they don't."*

## You often have more than one master

> **"You often have more than one master, and that's okay."**

Several master ties stand at once, and none of them is a betrayal of the others.
A person kneeling to a second master does not put down the first, nobody takes
offence on the world's behalf, and the reads that answer *who is your master*
answer with a list (`theMastersTheyKneltTo`) rather than the one row that
happened to be written last.

The store holds this rather than working around it: a person's ties are keyed by
the other person AND the kind, so a master tie never overwrites a marriage and a
second master never overwrites the first. See `npc-state.ts`,
`whatStandsBetween`.

The exception is the seedling everybody wants. Somebody the world reads as
exceptional answers to at most `A_SEEDLING_ANSWERS_TO_AT_MOST` of them, because
a person with nine masters is not a prodigy, it is a bookkeeping error.

## Either end can end it

Both directions exist and both are reachable.

- **The world's own.** A master casts a disciple out; a disciple walks out on
  their master. A bond that has gone cold enough (`A_BOND_IS_COLD_AT`) is ended
  by one of them in a given year at `A_COLD_BOND_ENDS_IN_A_YEAR`, which is the
  world's version of a thing that quietly stopped being true.
- **The player's, from either side.** Said plainly rather than asked for: *I
  cast Yun Zhi out*, *I disown my disciple*, *I renounce my master*, *I am no
  longer his disciple*. The one shape that used to work was the ask, and nobody
  asks to be cast out. See `ending-a-bond-phrasings.ts` for which words, and
  `ending-a-bond-you-are-in.ts` for the act.

**What an ending leaves is not nothing.** The tie becomes a former one at both
ends rather than vanishing - `former_master` and `former_disciple` - the oath to
teach is filed as broken, and how heavily that is held rises with how long the
bond stood, past `A_BOND_THAT_STOOD_A_LONG_TIME_YEARS`. Putting down somebody
you took on last year and somebody you raised for two centuries are not the same
act and the world does not price them the same.

## How they feel about you is still counted

Removing the neglect rule removed a penalty, not the relationship.

> **"How they feel about you is still counted, however."**

What went is the mechanics of blame: no strain on the dao heart for a master who
was not teaching, and no oath counted as breached by time passing. What stayed
is the ordinary warmth every tie in the world has. Attention given warms the
standing on the bond's own row (`ATTENTION_WARMS_A_TIE_BY`), a long silence
cools it (`A_LONG_SILENCE_COOLS_A_TIE_BY`), and it cools no further than
`A_TIE_GONE_COLD_STOPS_AT`, because indifference is where a neglected bond ends
up and not hatred.

So a master who never comes still has their disciple, and the disciple still has
a master; what they have is cold. That coldness is what the ending rule above
reads, which is how the two halves meet: nothing ends a bond except a person,
and what makes a person end one is years of nothing.

## Where this is applied

- `src/engine/social-leverage/taking-somebody-as-your-own.ts` - who may take
  whom, what a bond opens, and what ending one leaves
- `src/engine/world/the-disciples-a-world-opens-with.ts` - the masters a world
  opens holding, the search that finds a disciple, and the bond somebody ends
- `src/engine/world/who-is-given-attention-this-year.ts` - attention, warmth and
  the long silence
- `src/web/ending-a-bond-you-are-in.ts`, `src/web/ending-a-bond-phrasings.ts` -
  the player's end of it, from either side
- `src/engine/world/npc-state.ts` - why several kinds of tie stand between two
  people at once
