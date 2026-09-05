<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# Traits, not archetypes

The design owner's ruling on how a character's motivation should be modelled:

> Dao + traits + circumstances, over predefined archetypes. The simulation should not need
> a `Protector` class. The UI could say "Protective", or even infer "Protector" from their
> behaviour, but there should be no `if protector` branch.

And the shape:

```text
Traits         -> tendencies
Dao            -> convictions
Relationships  -> obligations
Resources      -> available choices
Situation      -> decision
```

"Protector" then **emerges from a combination**, and different combinations produce people
who would all answer to the word and are nothing alike:

| combination | what they do about a city inside a blood-sacrifice formation |
|---|---|
| Protective + Duty-bound + Pragmatic + Ruthless | destroys it |
| Protective + Merciful + Self-sacrificing | burns the sect's only life-returning talisman and answers for it |
| Protective + Possessive + Ambitious | saves the disciples; the civilians are not ours |

That is the RimWorld property the design owner is after: afterwards you look at the
character and think *of course he did that* - not because a branch fired, but because his
traits, his Dao, his obligations and what he had to hand made it predictable.

## How much of this exists

**The trait pattern is already here, twice, and both are the right shape:**

- `engine/social-leverage/how-freely-somebody-parts-with-what-they-have.ts` - open-handedness
- `engine/social-leverage/emotional-reticence.ts` - how much of a moment shows

Both are **derived from the person's id**: present for everybody, stable forever, no
storage, no seeder pass, no migration. That is the cheap and correct way to add the rest -
Protective, Duty-bound, Pragmatic, Ruthless, Possessive, Self-sacrificing, Merciful,
Risk-averse, Ambitious, Loyal, Calculating, Fanatical.

**The other four legs also exist**: the Dao heart landed today (`what-a-crossing-asks-of-the-dao-heart.ts`,
reading whether a record is finished rather than whether it was good), obligations are the
ledger, resources are the purse and the pouch, and the situation is the turn.

**What is missing is the middle**: nothing reads traits at an NPC's decision points. The
values exist and only the dialogue channel consumes one of them.

## The rule to hold when adding them

**No branch may test a trait by name for a behaviour.** The moment something says
`if (traits.protective)` and does a protective thing, the archetype is back with extra
steps. A trait weights; the decision is read off the weights together with the Dao, the
obligations and what is available. Take a trait away and the person must price out as
somebody ordinary, with no residue - the same test AGENTS.md applies to a lore item.

And the elder who will not take the pill is the case to check the design against. He is not
`Protector`; he is protective, duty-bound and pragmatic, holding a resource that is not his,
and reaching a conclusion the protagonist hates:

> "You could have lived." / "Yes." / "Then why?" / "Because I am not the future of this sect."

**The Dao heart does not certify that he was right.** It records that he lived by his
principle when the principle demanded his own death - which is exactly what the consistency
model measures, and exactly what a morality score could not.
