# A posting and a grant house are not the same thing

<!-- tier: 1 -->

Two bodies stand in relation to a house above them, and the relations are
opposite. They have been running together under one word, which is how this was
found as a naming bug when it is really a modelling one.

## A posting is an arm of the house that holds it

A place another house keeps. Its people are **that house's people**, and whoever
runs it is **that house's officer** - a warden, a keeper, somebody minding a
thing for its owner, which is exactly what the word means and exactly what is
true here.

So a posting:

- **teaches nobody and takes nobody**, by design, because it is not a road onto
  anything. It is a job being done;
- has a ladder of **posts rather than rungs** - `sect-six-li-patrol` runs
  *Marker / Warden / Road Warden / Warden of the Six Li*, four posts on a road;
- has **no elder rung and no grand elder**, and `sects.ts` says in its own header
  that this is deliberate: *"Do not 'complete' them... a Grand Road Warden is
  padding on a body whose whole ladder is four posts on a road."*

**The postings are `sect-kiln`, `sect-deeproot-court` and `sect-six-li-patrol`.**
Their titles are correct as they stand and should not be changed. Completing one
into a sect is a known error that has been made before.

## A grant house is its own sect

Subservient to the house above it and **not a member of it**. The design owner:
*"the patriarchs of subsidiary sects are their own patriarchs. they are
subservient but not a member of the overseeing sect"*, and the clearest line for
it - **"think feeder schools."**

A feeder school has its own headmaster. It does not have a deputy of the school
above it.

So a grant house:

- **takes and teaches its own people**, on its own roll, up its own ladder;
- **answers upward** for its grant, its findings, its tribute - whatever the
  grant is for - and can be leaned on;
- is **headed by its own patriarch**, whose title is a head's title in the
  register of whatever the body is: a Sect has a Sect Master, a Hall a Hall
  Master, and so on down the list in
  [`tone.md`](../writing/tone.md#naming-conventions).

`Azure Dew Sect` and `Azure Mist Court` are the worked cases: both sit in the
Azure grant under `Azure Cloud Pavilion`, both take and teach their own, and
both were titled *Sect Warden* and *Court Warden* - a post held on behalf of
somebody, which is the relation the owner is denying.

## How to tell them apart

The question a reader will actually have, in the order that answers it fastest:

| ask | a posting | a grant house |
|---|---|---|
| does it take anybody onto a roll of its own? | no | yes |
| does it teach? | no | yes |
| whose people are its people? | the house above it | its own |
| what is its ladder made of? | posts on a job | rungs of a house |
| does it have an elder rung? | no | yes |
| what is its head? | **an officer of the house above** | **its own patriarch** |

One line if you want one: **a posting is a job a house is doing somewhere; a
grant house is a house that answers to another house.**

## And the title follows the relationship

Which is why this looked like a naming problem. **An officer's title for a post,
a head's title for a house** - and `warden` is an officer's word, doing duty
across gates, veins, registers, weirs and roads throughout the catalog. Using it
for the head of a subsidiary sect says that person minds the place for its
owner, which is precisely what they are not.

## The worked example: three links on one hill

| house | holds from | its head is |
|---|---|---|
| **Azure Cloud Pavilion** | nobody - it is an apex | a **Pavilion Master** |
| **Azure Mist Court** | the Pavilion | a **Court Master** |
| **Azure Dew Sect** | the Mist | a **Sect Master** |

Sect to court to apex, stated in the data rather than inferred, and **not a
warden among them** - because none of the three is anybody's arm. The Azure hill
is not a special arrangement; it is the ordinary feudal structure between houses
that happen to sit unusually close together, and the closeness shows up as
warmth rather than as a different kind of link.

A house's own history can make this look wrong when it is not. The Pavilion
*"was a Third Sill tenant for fifteen hundred years and stopped being one in the
year Ru Anjing crossed"* - good content, and a reader meeting it may wonder
whether the data still says so. It does not, and
[`a-house-that-answers-to-nobody-is-the-top-of-its-chain.test.ts`](../../../tests/data/a-house-that-answers-to-nobody-is-the-top-of-its-chain.test.ts)
is the guard: an apex is the top of its chain, so a parent on one would be either
a fossil or a house filed under the wrong kind.

**Where it lives.** `FACTION_PARENTAGE` in `governance-and-water-rights.ts` is
the one authority - a parent, a relation kind, the terms, what each house holds.
`what-a-house-answers-to.ts` is how the engine asks it. There is no second
record and none is wanted.

## See also

- [`offices-and-succession.md`](./offices-and-succession.md) - who holds an
  office, how one opens, and who covers it.
- [`sects.md`](./sects.md) - what a house is and what it wants.
- [`tone.md`](../writing/tone.md) - what a body is called, and the registers a
  head's title is drawn from.
