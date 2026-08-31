<!-- tier: 3 -->

# Cultivation Content Catalogs

> **Tier 3 - reference.** The authoring contract for the content beside it. Never
> auto-injected into a narration prompt. The narrator's always-loaded text is
> [`../../../docs/world/NARRATOR-CORE.md`](../../../docs/world/NARRATOR-CORE.md).

Techniques, pills, recipes, herbs, sects and encounter tables. Read this before adding or
editing an entry in `src/data/cultivation/`.

**Every catalog in this directory is inert data.** The engine owns all decisions; these
modules only answer questions about what exists. Nothing here rolls, resolves, or
succeeds. If you find yourself writing a conditional in this directory that changes an
outcome, it belongs in [`../../engine/cultivation/`](../../engine/cultivation/README.md)
instead.

The content is first-party and compiled in rather than loaded from a JSON pack, so there
is no fetch, no cache and no schema-version negotiation. The TypeScript types are the
contract and the tests are the validator.

---

## The catalogs

| File | Holds | The invariant that matters |
|---|---|---|
| `techniques.ts` | The art library | Grade maps onto disjoint, ordered ordinal bands; qi costs are banded the same way |
| `pills.ts` | Alchemy output | Grade drives value and toxicity together, in disjoint ascending bands |
| `recipes.ts` | One recipe per pill | Ingredients resolve to real herbs; success rate falls as grade rises; refinement adds value |
| `herbs.ts` | The ingredient layer under alchemy | Value rises with grade, availability falls, and the realm needed to survive where it grows rises |
| `beasts.ts` | The population that is not human, its materials and its tides | One ladder: danger is a realm ordinal, never a stat block. Anything that speaks is at least Core Formation |
| `sects.ts` | Sects, Dao houses, destroyed houses | Every sect is *late*: none of them built what they live in |
| `encounters.ts` | The tables the time-skip draws from | `summaryTemplate` is an engine-authored factual summary, never prose |
| `false-immortals.ts` | Ordinal 45: the three legacy paths, the trajectory, the vacant dao protector post, and the faces the living one leaves where he lectures | Rank is shut and the dao is not. No sealed ancestor anywhere may sit at or above ordinal 45, no house has a serving False Immortal protector, and the post is vacant rather than abolished. The one who is still alive holds no object of any rung, and nothing may quietly give him one |
| `inheritance-trials.ts` | Trials and graves: what is behind the door | The interior is unreachable through `outsideViewOf`, by type. Three gate kinds, different in kind. What a grave holds is decided by how the occupant died |
| `catastrophe.ts` | What a disaster can end, who answers it, and who pays | A catastrophe destroys a sect or a court and cannot reach an apex head. What it costs is paid by the people with the least, and the elders walk out |
| `standoff.ts` | The top of the world, and whether it can be moved | One argument in several parts: the margin, the stall, the conspiracy, the revolt, and why none of it happens. Nothing here decides a fight - every figure is measured by the resolver and the prose yields when it disagrees |
| `crossings.ts` | Who crossed, who still answers, and what comes back down | `count` is not a roster: every crossing is on a `roll`, titled, even where the name is withheld. An ascended ancestor who might answer is a deterrent whose willingness nobody can verify |
| `index.ts` | Barrel export and cross-catalog lookups | All lookups O(1) against prebuilt Maps; provenance always available |

Do not hardcode entry counts anywhere. The catalogs grow, and a number written into prose
is a number that goes stale silently. Ask the catalog.

---

## Balance philosophy: grade is a single legible axis

There are five grades - `mortal`, `earth`, `heaven`, `immortal`, `chaos` - and they are
the same five everywhere: techniques, pills, herbs and recipes. The design commitment is
that **grade is one number the player can reason about**, and it moves everything
monotonically and in the same direction.

For techniques, the five grades map onto **disjoint, ordered bands of the ladder**
(`GRADE_ORDINAL_BANDS`). A manual is never learnable before its band opens, so at every
point on the ladder there is a visible next tier the cultivator cannot yet touch. Qi costs
are banded the same way, so higher grade means later, costlier and stronger, with no
exceptions anywhere in the catalog.

For pills, grade drives value and toxicity together. A higher-grade pill is strictly more
expensive and may be strictly more poisonous, so spamming heaven-grade medicine at
Foundation Establishment is a way to die of the cure. Within a grade, the pills that touch
progression - breakthrough odds, cultivation progress, lifespan - sit at the top of both
the value and toxicity ranges, because **buying advancement should always cost more than
buying survival**.

For herbs, grade raises value, lowers availability, and raises the minimum realm needed to
survive the place it grows. A mortal cultivator can pick qi grass by the roadside;
chaos-grade ingredients grow where a Grand Ascension cultivator dies for reaching them.

For recipes, the success-rate bands *are* the difficulty curve of alchemy in one table. A
chaos-grade refinement is never as likely to work as an immortal-grade one, and a
mortal-grade one is never as risky.

The bands are expressed **as data**, so the tests assert against the same table the
content was authored from. Change the band, and the tests tell you which entries no longer
fit.

### Regard: the one generic column that answers by height

Grade says what a thing *is*. `regard` says how the world answers the person asking for it, and
it is the second axis every catalog in this directory now carries.

The mechanism lives in [`../../engine/cultivation/regard.ts`](../../engine/cultivation/regard.ts)
and the table lives in `src/schema/cultivation.ts`. What this directory owes it is one thing: an
honest gate. Every record already has one - `harvestOrdinal`, `minOrdinal`, `requiredOrdinal`,
`ordinal` - and the resolver reads whichever of those the record happens to name. The gap between
the asker's rung and that gate is looked up in seven bands, and the band carries the yield, the
duration, the price, the damage and whether the thing is put forward at all.

`RegardProfileSchema` is the optional column, and it should stay rare:

| Field | When to use it |
|---|---|
| `gate` | The record's rung is not in any of the ordinary columns. A pill, for instance |
| `span` | The record is not outgrown at the ordinary rate. `span: 4` on qi deviation is how "nothing is ever fully outgrown" is said in data rather than in a branch |
| `neverOffered` / `alwaysOffered` | The record is a thing you must ask for, or one nobody stops offering |
| `reaction` | The generic band line is factually wrong for this record |

Two rules that are the whole point:

- **The refusal at the top is as real as the one at the bottom.** A record the asker has outgrown
  is not offered, and the reason is reported. "Nothing here is worth your time and everyone can
  see what you are" is an answer. An empty array is not.
- **A resolver that narrows a pool must be able to say what it dropped.** `offeredTo` has
  `refusalsFor` beside it, and `findWorkForOrdinal` has `workWithheldFrom`, for exactly this.

`OCCUPATIONS` is the worked example of the whole idea: the commissions a Deity Transformation
cultivator is offered are rows in the same array, under the same schema, read by the same
`findWorkForOrdinal`. An "immortal work" table beside the occupation table would be the same
mistake as an "immortal weapons" table beside the artifact table.

### Elements, and the starved ones

`element` is one of the seven, or null. Null means elementless: any spirit root may
cultivate the art without wuxing conflict, which is why elementless arts are usually a
little weaker per qi spent than an elemental art of the same grade used by a matching
root.

The two mutated elements, lightning and ice, are **deliberately starved**. A mutated root
cultivates faster and hits harder than anyone, and then discovers the world contains
almost no manuals it can use. `techniques.ts` is where that scarcity is actually made
true: every wuxing element has strictly more arts than either mutated element does. The
lore statement of the same fact is in
[`../../../docs/world/qi.md`](../../../docs/world/qi.md); the root definitions are in
[`../../engine/cultivation/README.md`](../../engine/cultivation/README.md).

---

## Provenance: knowledge is recovered, not invented

This is a late age. Nobody develops a new heaven-grade method. Every technique and every
recipe therefore carries where it came from, and the three values are a statement about
the world rather than a tag:

| Provenance | What it means | What it costs to obtain |
|---|---|---|
| `taught` | Transmitted by at least one living sect. A teacher exists | They can be paid, joined, or robbed |
| `ruin` | Recovered, not taught. Copies survive only in sealed sites | Nobody alive learned it from a person. You dig |
| `grave` | Taken off a body | Somebody died carrying it, somewhere remote enough that it stayed where they fell, and their sect very likely knows where that was |

Consequences the catalogs enforce:

- **No sect teaches a ruin- or grave-provenance art.** If it were teachable, its
  provenance would be `taught`. That single rule is what makes exploration the only route
  to the good manuals, and it is asserted by the sect catalog.
- Provenance is resolved from id sets rather than repeated on every entry, so the Late Age
  rule reads as one block instead of scattered flags.
- Recipes use `known` and `recovered` for the same distinction, and
  `getRecipesForPill` / the recovered filters let a caller ask "what could only have come
  out of a tomb?"

The economic and narrative consequences of a grave versus a deliberate inheritance are in
[`../../../docs/world/economy.md`](../../../docs/world/economy.md).

### Every art has a route, and an art with none says so

Provenance answers *how* a copy would reach a reader. It does not answer whether one is
anywhere, and for a long time nothing did: `scripts/audit-lore.ts` found fifteen arts that
no sect taught, no trial awarded, no grave held, no False Immortal's carving had yielded
and no parting gift carried. None of them was deliberately unobtainable. They were
unreferenced, which reads identically from inside the data.

The routes are five, they are closed, and they are different in kind:

| Route | Field | What it is |
|---|---|---|
| taught | `SectEntry.teaches` / `signatureTechniqueId` | A teacher, who can be paid, joined or robbed |
| trial | `InheritanceTrial.interior.prize.techniqueIds` | A door, calibrated for somebody who is not you |
| grave | `Grave.interior.contents[].techniqueId` | A body, and nothing on it was the right size for the finder |
| carving | `DaoCarving.yieldedTechniqueIds` in `false-immortals.ts`, reached through `allDaoCarvings()` | A face somebody cut, usually for a reader who never came |
| parting gift | `SECT_ANCESTRY[...].partingGift.techniqueIds` | An estate put down on the way out of the world |

And one non-route, which is the point of the rule: `NO_SURVIVING_COPY_TECHNIQUE_IDS`
marks an art the world can name and cannot produce, and `NO_SURVIVING_COPY_NOTES` gives
the reason for each. It sets `survivingCopy: false` on the entry and replaces the generic
`sourceNote` with that reason. Keep the set small: an art that is merely hard to find
belongs in a sealed site.

`tests/data/cultivation-technique-routes.test.ts` asserts every entry has a route or the
marker, that the marker and the routes never both apply, that a parting gift is held
rather than taught, and that a route never quietly raises a sect's power. The audit
reports a marked art as a stated absence rather than an ORPHAN, and reports a marked art
that something hands over as a CONTRADICTION.

**Ask `allDaoCarvings()` rather than walking `FALSE_IMMORTALS`.** The carving route is the
kind of thing - a face somebody cut - and not the array it happens to hang off. Seven of
those faces are attached to a record in the catalog of endings because their authors are
gone. Three are not, because their author is still walking around and does not belong in
that catalog. Anything asking what a face can hand somebody must go through the accessor,
or it quietly answers for two thirds of the faces in the world; the routes suite and
`scripts/audit-lore.ts` both read it.

Note what does *not* bound a route: the Lid. `OBJECT_CEILING_BELOW_THE_LID` in
`realms.ts` caps objects, because an object rated at a rung lets its holder strike at that
rung and one from above the Lid goes back up inside fifteen breaths rather than being
left, looted or inherited. A manual is paper. It can be studied to full mastery and the
reader is still exactly the rung they were, so `MANUALS_MAY_EXCEED_THE_LID` is true and an
art may sit anywhere on the ladder and still be handed over down here. What bounds the
routes is `CONTENT_MAX_ORDINAL`, which is this catalog's own decision about what it
authors - and that decision is now the top of the ladder rather than the last crossing,
because both rungs above the Lid have exactly one channel each and both channels have
something at the far end of them. The scarcity up there is carried by how few arts there
are and how narrow the way to them is, not by the catalog declining to write them down.

---

## Techniques are developed, not selected

A technique is not a spell chosen from a menu. Over time a cultivator can learn it,
practise it, master it, *understand* it, modify it, combine it with other insights,
derive something new, find its flaws, discover higher applications, teach it, or abandon
it.

```text
basic technique -> mastery -> understanding -> modification -> personalised technique
```

Two characters who begin from the same manual must be able to end up with genuinely
different arts. High comprehension is what makes that possible.

Mechanically, this is why **mastery is per-cultivator state and never catalog state**.
Every entry here starts at zero and the authoring helper keeps that out of the literals.
The catalog describes the manual; what a particular person has made of it belongs to the
cultivator's row.

**Specialisation matters.** Sword, body, soul, elemental, formations, alchemy, artifact
refinement, movement, assassination, defence, domain. No character should need to be good
at everything; specialisation is what makes characters asymmetrical, and a chosen path
should shape identity and opportunity, not just damage type.

**Unconventional paths must be viable.** A character should be able to find or build a
route that is not the standard one - a body-focused road, an unusual energy system, a
self-created method. Non-standard paths carry real trade-offs: slower at first, harder to
understand, resource-hungry, politically unsupported. And potentially exceptional.

---

## How content is authored

- **Satisfy the schema.** Every pill satisfies `PillSchema`, every sect entry is a `Sect`
  plus the content-side fields the engine does not store, and `SectSchema.parse` strips
  the extras so an entry can be handed straight to storage without a mapping step.
- **Never write prose that is trying to be a story.** `summaryTemplate` in
  `encounters.ts` is an engine-authored factual summary with `{token}` slots the engine
  fills with resolved numbers. The runtime agent turns the resulting fact line into
  narration; it never invents the facts. See
  [`../../web/README.md`](../../web/README.md) for the same rule at the narrator seam.
- **Use the authoring helpers.** They resolve provenance and mastery so the invariants
  cannot be forgotten on a new entry.
- **Reference by id, never by name.** Recipes name herb ids; if a herb is not in the
  catalog, no recipe may name it.
- **Balance numbers still live in `src/schema/cultivation.ts`.** The bands in this
  directory describe *content* shape; survival constants, satiety costs and lethal
  thresholds are not content and do not belong here.
- **Add the test.** Each catalog's invariants are asserted in `tests/data/cultivation/`.
  A new entry that breaks a band should fail there, not in play.

### Encounter weighting

`weight` is a relative draw weight within the set of entries whose ordinal range contains
the cultivator. Ranges overlap heavily on purpose: a Qi Condensation cultivator meets
bandits and untouched herb patches, a Nascent Soul cultivator meets sect wars and sealed
tombs, and the handful of entries that span the whole ladder - qi deviation, being robbed
in seclusion - are the reminders that nothing is ever fully outgrown.

`threatOrdinal` is the realm ordinal of whatever is hostile, or null when the entry is not
a fight. The engine compares it to the cultivator's own ordinal, and the power multipliers
in `realms.ts` are steep enough that a four-rank gap is not a hard fight, it is a death.

### Beasts are on the same ladder

`beasts.ts` carries no combat statistics, because the ladder already answers the question.
A beast's `ordinal` is read with `rankName` exactly as a cultivator's is, and everything
else about an entry is the shape of the problem rather than its size: where it lives, what
it does to a vein, whether it can be talked to, and one line on what specifically makes it
hard.

Three rules the catalog enforces, because they are world facts rather than flavour:

- **Nothing speaks below Core Formation.** The change at `BEAST_CHANGE_ORDINAL` brings a
  core, a shape and a voice together, so anything offering terms has a known floor under it
  and is never the cheap option.
- **They live where the qi is**, so the richest ground is contested before any sect arrives
  and a beast on a vein is a competing draw on it - the same arithmetic as `enc-valley-overdrawn`.
- **The Late Age applies to them.** Drawn-down ground has small, sparse populations and bad
  culling rates; anything impressive is behind a seal, cultivating without interruption.

Materials use the herb catalog's grades, value bands and rarity ceilings deliberately, so
salvage and alchemy price off one ladder. A core is the condensed cultivation of something
past the change, which is the whole reason beasts are hunted rather than avoided.

## Related

- [`../../engine/cultivation/README.md`](../../engine/cultivation/README.md) - the engine that resolves against this content
- [`../../../docs/world/the-late-age.md`](../../../docs/world/the-late-age.md) - why nothing here is invented
- [`../../../docs/world/sects.md`](../../../docs/world/sects.md) - what the sect catalog is a model of
- [`../../../docs/world/economy.md`](../../../docs/world/economy.md) - what things cost and why
- [`../../../docs/world/immortals.md`](../../../docs/world/immortals.md) - what `false-immortals.ts` is a model of
