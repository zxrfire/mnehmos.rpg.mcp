<!-- tier: 2 trigger="a manual is held, taught, bought, copied, refused, or found; or somebody asks how far a book or a house can carry them" -->

# Manuals

Books are objects. They sit in the world with everything else, they have holders, they can
be taken, and there are only so many of them. Almost everything interesting about
cultivation as a *social* activity follows from that one fact rather than from any rule
about qi.

Read alongside [`techniques.md`](./techniques.md), which covers what an art can *do*, and
[`escapes.md`](../writing/escapes.md), which covers what somebody does when their book runs out.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [A manual is an item with a count](#a-manual-is-an-item-with-a-count) | somebody asks a house for a manual, or a book changes hands |
| [Who can make another one](#who-can-make-another-one) | a cultivator considers copying a manual, or a house's last master of an art dies |
| [Where books stop](#where-books-stop) | a manual's ceiling is reached, quoted, or compared to another's |
| [How well the book is written](#how-well-the-book-is-written) | two books cover the same rungs, or somebody complains their method is slow |
| [A shelf, and who reaches up it](#a-shelf-and-who-reaches-up-it) | a disciple is admitted, promoted, favoured, or refused a book |
| [What a house can teach and what it can supply](#what-a-house-can-teach-and-what-it-can-supply) | a house's strongest member stands far above what it can produce, or a cultivator needs materials |
| [An art is a signature](#an-art-is-a-signature) | somebody is seen practising, or a manual is stolen, sold, or offered on a black market |

---

## A manual is an item with a count

<!-- tier: 2 trigger="somebody asks a house for a manual, or a book changes hands" -->

A manual is an item the way a sword is an item, and **a house holds so many copies and no
more.** That single number decides most of how an institution behaves:

- A house with twenty intake primers hands one to everybody who walks through the gate.
- A house with **one** copy of the thing its patriarch cultivates cannot give it to forty
  people, and everybody in the building knows which room it is in.

This is why an archive is guarded, why theft is worth the risk, and why a house that loses
a room loses a *capability* rather than a decoration. It is also why the most tempting
object in any compound is the one the house cannot replace.

Copies fall steeply with how far a book carries. A primer is stock - issued, worn out,
replaced. A book at the top of a shelf is usually a single physical object.

---

## Who can make another one

<!-- tier: 2 trigger="a cultivator considers copying a manual, or a house's last master of an art dies" -->

**Common books: anybody who holds one.** No mastery, no permission, no ceremony. That is a
loop rather than a coincidence - copyable means plentiful, plentiful means cheap, cheap
means the next person can afford one and copy it too. A gathering primer has been copied by
every house, league and hedge-teacher for a thousand years, and a market stall sells one
next to the cooking pots. **Selling copies is an ordinary living** for a cultivator who
needs stones and has nothing else to trade.

This is what keeps an unbacked nobody from being locked out of cultivation entirely, and it
puts a real decision in front of a poor one early: the stones exist, and they can go on a
book or on food.

**Everything above that line: only somebody who took the book to its end.** Reproduction
needs a master. So:

> A house whose last master of an art has died holds a **finite number of physical
> objects**, and when they are gone the art is gone.

An art becomes scarce, then rare, then lost, and nobody ever decided it should. That is the
whole mechanism of the late age in one sentence, and it needs no special rule.

**A book nobody present can copy is a treasure, not a resource.** A house can hold a manual
that runs past anybody it has ever produced - an inheritance, a bequest from an ancestor who
crossed, something dug out of a hole. Nobody in the building can read it to the end, so
nobody can write it out again, so there will only ever be this one. It is usually not being
cultivated by anybody: a book waiting for somebody good enough to arrive, which may be
nobody, for centuries.

---

## Where books stop

<!-- tier: 2 trigger="a manual's ceiling is reached, quoted, or compared to another's" -->

**Typically a manual is written to perfection**, and the realm boundaries are where books
stop. The reason is craft rather than convention: it is much harder to write down how to
reach a *later realm* than how to refine somebody within the one they are in. A realm
boundary is a change in kind, and a method that carries somebody across one is a different
piece of work from a method that polishes them. So an author finishes at the natural place
to finish, and the next realm is somebody else's book, a later volume, or nobody's.

**A manual takes you to Perfection and stops there.** Not part of the way into a realm -
all of it, the hundred per cent peak of the last rung. That is what a complete book is for
and it is the whole of what it does.

**The crossing out is not in the book, and no book can put it there.** What stands between
Perfection and the next realm is heart demons, or tribulation lightning, or whatever that
particular boundary asks of a person, and *which one you face is decided by where you stand
on the ladder rather than by what you practise* - `triggersHeavenlyTribulation` in
`realms.ts` takes an ordinal and nothing else. Two cultivators crossing the same boundary
meet the same thing whether their methods have anything in common or not.

A good manual **explains** the crossing. It tells you what is coming, which is worth a great
deal and is not the same as telling you how to pass it. What it actually contributes when
you are standing in it is indirect and entirely material: the foundation it spent your last
realm building, and the techniques it taught you along the way. You survive the crossing on
what the book made of you, never on what the book says about it.

**Which is why people wait at Perfection.** Sitting at a hundred per cent of your realm is
not stalling, it is the one moment in a cultivator's career when they can see exactly what is
coming and still choose when to meet it. Everything that improves the odds is bought *here*:
the pill, the artifact, a place where the lightning has somewhere to go, somebody standing by
who can pull you out, another decade of foundation. A cultivator who crosses the moment they
touch Perfection has taken the worst version of a fight they could have picked the terms of.

And it cannot be waited out forever. `stagnationYearsForOrdinal` gives every rank an
allowance measured against its own lifespan, and a plateau longer than the realm permits ends
the life where it stands - `stagnation_aging` in `survival.ts` is a real cause of death. So
Perfection is a decision with a clock on it: too soon and you meet the crossing with nothing
in hand, too long and the crossing never happens at all. **This is the single most legible
choice the ladder offers, and it is available at every boundary.**

**Then it lands you on the first rung of the next realm, and that is where the `cap` sits.**
The number in the catalog is not where the paper stops - the paper stopped at Perfection.
It is where the crossing leaves you standing, which is why complete books cap at 13, 17, 21,
25, 29, 33, 37, 41 and 45 rather than at 12, 16 and 20. The realms run 0-12, 13-16, 17-20,
21-24, 25-28, 29-32, 33-36, 37-40 and 41-44.

**Including the last one, and that is the number people keep wanting to lower.** A book
covering the final realm caps at 45, and the reflex on reading that is to correct it to 44,
because 44 is the last rung anybody climbs to and 45 is the rung
[the crossing](./immortals.md) lands on. The sentence is right and the correction is not: a
cap is the first rung at which the paper stops carrying you, so a book capped at 44 stops
the reader who is *standing* on 44 - the only person in the world who is gathering for the
last crossing, since the attempt is made from there. Write 44 on those books and the
Immortal realm becomes unreachable by every route at once. Measured in
`scripts/probe-what-cap-44-would-do-to-the-last-crossing.ts`; the catalog suites do catch
the edit, five tests across two files, so this is a note about why they are right rather
than a hole in the guards.

**And there you are stuck.** You have never been higher and you have never been less able to
say what to do next: the realm you have just entered is a different thing, and the book that
carried you every step of the way to here says nothing whatsoever about its second rung. Not
vague guidance, not a hint - nothing, because refining a nascent soul is not a harder version
of gathering qi. A cultivator standing on the first rung of a new realm with the book that
got them there is holding a work that has been correct and complete the entire way and is
now finished with them.

Unless the book is advanced enough to cover the next realm too, which is what a long manual
is, and why one is worth so much.

This was got wrong once, in this file, and the correction is worth keeping because the wrong
version is the intuitive one. Capping at a realm's *last* rung - 12, 16, 20 - and opening
each successor one rung later puts **a one-rung wall at every realm boundary in the world**:
a reader stops at 16, every successor wants 17, and nothing can stand between them. The
counterfactual was measured rather than argued: the catalog as it stands has walls at none of
the boundaries, and the proposed rule puts one at all nine. The existing numbers already are
the perfection rule, expressed as a position rather than as a syllabus, and that is what
makes the chain interlock with no seam.

Two consequences worth holding onto:

**A cap that lands mid-realm is an anomaly, and it has a story.** The author died before
finishing. The upper sections were lost. The copy this house holds is missing its last
volume. The one person who could have completed it crossed the Lid instead. If a manual
stops somewhere strange, **say what happened to it** - an unexplained mid-realm cap is a
number somebody picked, and it reads as one.

**A gap above a book is normal and is not a defect.** A patriarch standing at 38 whose
house's best manual stops at 36 is not evidence of a broken shelf: their book took them to
Body Integration Perfection, which is exactly what a complete book does, and the two rungs
past it came from somewhere else - a lucky encounter, an inheritance, a ruin. That gap sits
above every house's shelf and it is why [`escapes.md`](../writing/escapes.md) has the routes it has.

**A gap *inside* a shelf is a defect.** A primer capping at 13 followed by a book requiring
21 is eight rungs nobody in the house can cross, and a house that has stood for centuries
would have solved it - with an intermediary art, very possibly one shared with an allied
house. Measured, twenty of thirty-two shelves had such a gap, and nearly all of it traced to
one genuine absence: there was no elementless road at Core Formation anywhere in the world,
so a wood, water, earth or muddled root arriving at 17 had nothing to pick up.

**A successor opens where its predecessor's cap left the reader standing**, not one rung
later. That is what makes a shelf walkable, and it is the same fact as the caps above: the
cap is a position, so the next book meets the reader at it.

**Span varies, and it means something.** A book covering 13 to 29 is a deep foundation and a
rare thing to own; its disciples change method less often, which is its own coherence and a
real advantage, since every switch is a risk. A short book is cheap and replaceable - and
sometimes safer, because a long one whose later stages nobody in the building has actually
walked is a promise the house cannot keep. **No book is a whole career.** However far one
carries, the ceiling arrives; a good manual only decides when.

---

## How well the book is written

<!-- tier: 2 trigger="two books cover the same rungs, or somebody complains their method is slow" -->

Everything above is **coverage** - which rungs a book carries you over, and where it
stops. Coverage is one axis. **Quality is a second, and they are independent.**

> **A trash Core Formation manual and an excellent one carry a reader over exactly the
> same rungs.** One of them takes eighty years about it.

That sentence is the whole of it. A bad manual does not stop anybody - it is slow, and
being slow is fatal only because the clocks above are already running. *"I have a trash
Core Formation technique. I can continue, but it's going to take eighty years"* is the
situation the axis exists to produce, and both halves of it are load-bearing.

`quality` on the catalog row, in five tiers, each named for its **cause** rather than for
a quantity, because the causes are what the world actually produces:

| | what makes a book this |
|---|---|
| **corrupt** | The text is damaged. Miscopied by hands that never mastered it, fragmentary, reassembled out of a wreck, or set down by somebody who did not survive what they were describing. |
| **crude** | Plainly set down and honestly complete. Nothing wrong with it and nothing in it either. This is what a market stall sells. |
| **sound** | A working book with a lineage behind it and somebody alive who has read it to the end. |
| **refined** | Worked over by generations who each took it to its end and wrote down what they found there. |
| **pristine** | The author's own hand, complete, nothing lost in transmission. |

**This is not the grade, and it cannot be.** `grade` is a statement about HEIGHT and is
pinned there: `GRADE_ORDINAL_BANDS` binds every art's grade to its `requiredOrdinal` and
the content suite checks it on every row. So a market primer and an apex house's intake
canon, which cover identical rungs and therefore both open at ordinal 0, are **both
necessarily `mortal`** - and that is exactly the pair worth separating.

**Which is the answer to the obvious objection.** If a road to Foundation can be bought at
a stall for the price of a meal, what does joining a house buy a beginner? Not a range of
rungs - those are for sale. **A better-taught version of the same range.** The Azure Dew
Sect's gathering canon opens at 0 and stops at 13 exactly as the block-printed primer
does, and four hundred years of Dew teachers have written into it what each of them
learned working a village. Measured, it clears Qi Condensation in 66 years where the stall
copy takes 88. That is what somebody sweeps a courtyard for.

**A better book does three things, and none of them is teaching the crossing.**

- **You climb faster.** The largest single term in the rate that is not a realm.
- **You arrive better prepared.** Not better instructed - see above; the crossing is not in
  the book and no book can put it there. What arrives with you is the foundation the book
  spent the whole realm building. Measured at Core Formation Perfection, a damaged text
  leaves an ordinary cultivator on 9.9% and an author's own copy on 19.3%.
- **You are stronger at the same rung.** A better-explained method makes a better
  cultivator, which is the genre's own claim.

### And a great book in the wrong hands is a paperweight

**A better book is denser, not longer, so the better it is the more it asks of whoever
opens it.** A mediocre person would not understand a manual from a Tribulation
Transcendence cultivator either. They spend the years and take almost nothing out, and the
arithmetic says so: a mediocre reader gets **less** out of an author's own canon than out
of a plain working book - 49% of it lands, and 49% of something excellent is worse than all
of something ordinary. **This is what stops "find the best book" being the whole game.**

The bottom two tiers ask nothing at all, and that is deliberate: **nobody is ever punished
for reading a bad book.** They are simply slow. It is the only guarantee that keeps
ordinary cultivators in the world, and it must not be traded away.

Three outcomes, and all three have to be real at once:

- **A prodigy with a great manual is transformed.**
- **A mediocre person with the same manual is stuck** - and would have done better with a
  plain one.
- **A mediocre person with a plain manual gets there slowly, and gets there.**

### A shelf is not a book

An institution holds a shelf, and rank reaches up it - so what a house hands a disciple is
the best thing on it they can actually work, never the top of it. This matters: pricing a
house at the top of its shelf made a mediocre child of a Dao house climb *slower* than a
retainer's child, because the worked canon was over their head and the working book was
not. The paperweight rule is correct for a book somebody **holds** - a ruin find, a stolen
canon, the one object in the room - because there is nothing else to read. It is wrong for
an institution.

### Bad copies happen on their own

Nobody authors a bad copy. **Common books are copyable by anybody holding one**, most of
whom never mastered the thing, and a copy written out by somebody who did not reach the end
of it comes out one tier down. That is the copying rule above meeting this axis, and two
consequences fall out of it with nothing else written:

- **The market primer is the worst-worn book in the world**, because it is the most copied.
- **Nothing high is ever merely plain.** `crude` is the mass-copy tier and mass copying
  needs masters; anybody who reached Nascent Soul is already an exception, so above Core
  Formation the crowd that wears a book down does not exist. A bad book up there is
  **damaged**, and it has a story.

---

## A shelf, and who reaches up it

<!-- tier: 2 trigger="a disciple is admitted, promoted, favoured, or refused a book" -->

A house's working library is a shelf, ordered by how far each book carries, and **rank
decides how far up it somebody reaches.** Admission reaches exactly one book, however deep
the shelf is.

**Admission buys something, and never the core.** Nobody hands the inner method to somebody
who walked through the gate last month. What a house gives instead takes one of three
shapes, and which one it uses says a great deal about it:

- **A reduced form** - a deliberately weakened version of its own art, written to be given
  away. It works, it carries somebody a long way up the bottom of the ladder, and it stops
  early by design. A house that does this has thought about being copied.
- **The opening stages only** - the real book, its first stages. The disciple already holds
  the thing they are trying to earn more of, which is its own kind of pressure.
- **A teacher and no book at all** - an inner disciple will teach you, *if you can win their
  favour*. Cheapest for the house and by far the most demanding for the disciple, because
  their progress now runs through somebody's goodwill rather than an object they hold, and
  goodwill can be withdrawn.

**Two gates, not one.** Rank says what the house will *give* you; the manual's own entry
requirement says what you can *open*, and being favoured does not lift it. So being promoted
is not the same day as being taught, and holding a book you cannot yet read is an ordinary
and rather sharp situation.

**The chosen.** A house that has decided somebody is worth it hands them the top of the
shelf years before their rank would reach it - the most legible form favour takes, because
everybody can see what it produces later. How many a house can favour is decided by **how
many copies of the top book it has**, so generosity is a consequence of wealth rather than
temperament, and a poor house's chosen is a far lonelier and more conspicuous position than
a rich one's.

Favour is not permanent and must not be. A house that loses its favourite names another; a
house that stops doing so stops mattering within a century.

**This is not the other favour, and the two must not be run together.** Everything above
happens *inside* a house, to somebody already admitted, and what it moves is a shelf: the
house hands a disciple a book earlier than their rank would reach it, bounded by how many
copies it owns. The other one is spent from *outside* a house, by somebody who is not in it,
on somebody who is not in it yet, and what it moves is a gate - it makes a house suspend its
own admission bar for one person, once. See [Somebody's word, and the bar it
skips](../houses/origin.md#somebodys-word-and-the-bar-it-skips). A person can be the subject of both
in one life, in that order, and they are two separate debts to two separate people.

**Somebody has to carry you over a gap.** Where a shelf does not join up, the setting's
answer is a person rather than a book: guidance from somebody of an appropriate level, a
method passed master to student. A house that still holds a living master of the higher
manual can bring somebody across; one that has lost its last master cannot. That turns an
arithmetic dead end into a fact about who is still alive in the building, and gives a house
something concrete to lose when an elder dies.

---

## What a house can teach and what it can supply

<!-- tier: 2 trigger="a house's strongest member stands far above what it can produce, or a cultivator needs materials" -->

These are different questions and the gap between them is where most of a house's motives
come from.

A house standing at 36 that reliably produces only 28 **is not failing to teach.** It has
the books and it has the master. What it does not have is the pills and the comprehension
materials, and its own 36 reached that peak by their own means.

Crucially those materials **exist in the world today** and somebody else has them. This is
not the ancient-materials problem - that is extinction, and it is covered in
[`ancient.md`](../history/ancient.md). This is *access*: modern methods still want materials, those
materials are purchasable and sourceable, and sourcing them **requires backing.** So the gap
is a motive to buy, dig, ally, marry or fight, rather than a decline a house passively
suffers.

It also explains a fact about the world that would otherwise need a rule: **rogue
cultivators are ordinary and high-level rogues are vanishingly rare.** Anybody can climb the
bottom of the ladder without a house. Nobody sources what the upper ladder costs without
one.

Some comprehension materials are **single-use** - once it is in your head it is gone. Those
are made by immortals and sent down, or found in ruins, and they are the reason a house's
ceiling can move in a single generation when its access changes.

---

## An art is a signature

<!-- tier: 2 trigger="somebody is seen practising, or a manual is stolen, sold, or offered on a black market" -->

You cannot cultivate a house's manual quietly. Cultivating it is visible and knowledgeable
people recognise it on sight - which is already how this world works, where a knowledgeable
NPC seeing what you are practising is a scene the narrator is told to run.

**So a stolen or black-market manual is not a safe purchase.** It works, it carries you
exactly as far as the real thing, and the day somebody from the house that wrote it watches
you use it, you are holding an object you cannot explain. The manual is evidence, and it is
evidence for as long as you keep climbing on it - which is the rest of your life, because
putting it down means starting again.

That is what makes a black market a decision rather than a discount. There is an honest
trade beside it: a cultivator who finds a manual they can never use - no resources, no
backing, no chance - selling it for a great deal of money to a buyer who has all three. That
is what an auction house is for. The black market is where the same object arrives having
been taken off somebody, and the price is lower for a reason.

**Selling copies is a living; selling somebody else's book is a betrayal.** The same act is
honest trade or the worst thing you have ever done to the people who fed you, and the only
difference is whose book it was. A house's shelf *is* its power, its recruitment pitch, and
the reason anybody sweeps its floors for forty years. A disciple who sells the inner manual
has not stolen an object - they have given away the institution. It runs from *nobody's
property, sell freely*, through *awkward, somebody will want to know where you got it*, to
**unforgivable and permanent**: once the top of a house's shelf is out, no amount of killing
you puts it back.
