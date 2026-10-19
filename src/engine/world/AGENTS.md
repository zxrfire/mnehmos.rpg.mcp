# World simulation instructions

Read [README.md](README.md), [engine guidance](../AGENTS.md), and affected catalog
notes. These rules also govern population/advancement changes outside this directory.

## How many people a house has

[A house and who is in it](a-house-and-who-is-in-it.md) owns roster sampling, complete
postings and elders holding offices. The roster is who a player can know, not a census.

## Long-running simulation

Never require an agent to simulate days individually. A long action uses
`../cultivation/time-skip.ts`, adaptive chunks, events and a narratable digest.
Routine schedules, cultivation, trading, aging and consumption stay cheap and model-free.
Use a model for genuinely complex or novel decisions involving personality, conflicting
goals, relationships, grudges or loyalty. Preserve streams without promising global replay
identity; the root's reproducibility ruling supersedes the older identical-run claim.

## Measure a world on a cultivator's clock, not a mortal one

Judge rates across thousands of years, per millennium and per lifetime. A quiet few
centuries is not proof of a broken rate. Measure long horizons before retuning short ones.
Waiting, neglect, absence and suffering thresholds are fractions of the subject's actual
realm lifespan; missing-person write-off is how long they could still live. Calendars
(intakes, stipends, duty schedules) are exempt: they schedule, not judge a life.

## How often, and on whom: the two questions that catch a dead mechanism

Before a walk, count catalog rows eligible for each selection. Then measure firings
and who/what was chosen across the world, not only totals. Log choices to expose a
self-reinforcing pair or one-row pool. A rule that collapses its pool needs a rule fix;
a pool that began with one row needs a data fix. Lowering frequency fixes neither.
Static checks and constructed-case tests do not prove live reach or spread.
`scripts/probe-which-passes-ever-fire.probe.ts` measures firings;
`scripts/how-a-mechanism-spreads.probe.ts` addresses spread. Check each instrument's
coverage on known cases instead of assuming its hand-maintained pass list is complete.
Draw from the eligible set rather than weight an incompatible population then reject it.
For composed draws use the joint distribution: correlated stages exceed independence,
anti-correlated stages can make individually valid rules effectively never fire.

### List the writes. Do not reason from the function.

Claims about who ends up where need all live writers, wrappers and actual arguments,
or a measurement. A function read with imagined inputs is only a hypothesis. Count fields
in seeded worlds and check live callers; a correct predicate over an unwritten field is dead.

### A changed draw moves every number in the world, and the boundary is dateable

An extra draw or earlier return shifts later attempts sharing that stream. Give new
draws separate streams. After a consumption change, post-advance world figures are not
cross-boundary comparisons, even at the same seed; unaffected day-zero seeding figures
may compare. Label which side produced evidence and check old draws base/change together.

## The population pyramid is a law, not a preference

Far more people inhabit the bottom than the middle and the middle than the top, at all
horizons/scales. Run `tests/engine/world/the-pyramid.test.ts` for advancement, ground,
teaching, seeding or ladder changes, with both arms in one command on identified trees.
Where both bands are populations, an inversion at one seed is structural. Where either
band is individuals, pool seeds; the prodigy institution makes the summit irregular.
Do not accelerate the world's middle to produce a desired handful at the top.

### Every realm is a bucket with an inflow and an outflow

Stage outflow feeds the next, less deaths and settling; tune no band in isolation.
Seek stable volume with slow turnover, some new residents and many long-standing ones.
Measure volume, inflow and outflow separately: stable volume can hide flushing, declining
volume means net attrition, and healthy volume without arrivals lives on seeded inheritance.
Unbounded volume signals insufficient outflow. Separate deaths from settling/structural
breaks, which leave residents present but stop feeding the next stage. A rung crossing
or somebody merely born after seeding is not automatically an arrival into the measured band.

### Rare in the world and common at the top are the same fact

Origins buy inputs, never rank. Elite membership is selected, not a random birth sample.
Measure both marginal birth distributions and origin conditional on institution/rung.
Do not apply the birth lottery to seeded placement or confuse placement with advancement.

### Decline is correct for a house and wrong for the world

Houses rise and fall; missing middle bands are not Late Age flavour. Separate institutional
endings from population shape, and survivors from genuine arrivals in each band. Healthy
headcounts consisting only of seeded survivors still describe a dying band.

## A house's shelf outruns its people, and the gap is the content

Inherited arts beyond any living member are ordinary decline, not vacancies to fill.
Keep holding and teaching capacity distinct: the same shelf with different available
teachers produces different lives. A beginner-admitting house must teach its entry rung.
A lasting membership owes its continuing climb to the house's shelf, however high its
intake; an empty shelf there is broken. Temporary secondments differ: Kiln Wardens and
Root Sill Court admit already trained people, who keep their own road and return home.
The distinction is temporary posting, not a high admission bar.
An art requiring roots never dealt to the house is a seeding defect, not historical decline.
Ask whether an absence has a world history before filling it. Derive trajectory from
shelf versus roster: shelf above people = declining; roster reaches shelf = peak and
outward-looking; people outgrow shelf = rising and seeking acquisitions. Store no trajectory
flag. Let the world answer this comparison and date its lost teaching when records allow it.

## Repetition should cost. A narrow life makes a narrower cultivator

A varied life yields experience/understanding that a repeated loop lacks. Express the
difference through existing lived-experience/comprehension systems, not a stacking verb
penalty that synonyms evade. A cave-bound life lacks the roads, recoveries, crossings and
encounters it never experienced. This concerns who somebody becomes over a long life;
early deaths in a repetitive run are another issue to investigate.

## The acceptance test

Design is frozen: no new subsystems until a nobody's 500-year soak leaves a coherent
world recognisably descended from its start. Houses rise/fall; people die and are inherited
from; grudges persist into descendants; discoverable causes accumulate in history;
locations change and retain scars. Nothing may contradict the resulting world.
