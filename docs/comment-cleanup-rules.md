<!-- tier: 3 -->

# Cutting comments without losing what they know

The bar is in AGENTS.md under *Comments earn their keep*. This is how to apply it to a file
that is already over, and what must survive the cut.

Measure before and after with `npx tsx scripts/comments-earn-their-keep.ts --dir <path>`.

## Never change code. This is a comment pass.

If a comment is wrong about the code, fix the comment, and say so in your report. Do not fix
the code in a comment pass - somebody else may be in that file.

## KEEP

- **A measurement.** "Measured over 168 sentences, 81 reached nothing." Numbers that were
  paid for are the most valuable prose in this repo and the reason defects stay fixed.
- **A defect the shape was chosen against.** "Fuzzy-matching a description into a name would
  pick the fight for them."
- **An ordering that is load-bearing.** "Above `attack`, because coercion sentences contain a
  person and an act of violence."
- **A warning about a plausible edit.** "Do not tidy `private` back on - it breaks the build."
- **A ruling by the design owner**, quoted, where the code cannot show it.
- **Why a thing is NOT done**, where somebody would otherwise do it.

## CUT

- **Restatement.** A sentence that says what the line beneath it says.
- **Archaeology.** "This was unreachable, nothing called it, so it became its own member."
  True once, in the commit. The verb exists now; the file does not need its own biography.
- **Split history.** "Moved out of `actions.ts`, which held this and four other things."
  Nobody reading the file today needs to know where it used to live.
- **A second wording of a rule stated elsewhere.** Link to the one place instead.
- **Ceremony.** Box-drawing banners around one paragraph, `═══` rules, section headers over
  three lines of code.
- **The reasoning you needed to reach the answer** that the reader does not need to use it.

## The shape to aim for

A file header of **five lines or fewer**: what this is, and the one thing that will surprise
somebody. A member or function gets **one line** unless it has a measurement, an ordering or
a warning attached - and then it gets those, and not the story around them.

Where a long block genuinely earns its length, keep it. The target is not uniformity; it is
that every line can answer *what would be lost if this were deleted*.

## Worked example

Before, 17 lines on one enum member:

> Getting there ON something rather than on foot. `what-a-conveyance-does-to-a-journey.ts`
> prices a mount, a drawn carriage, a spirit boat and flight on one's own blade against the
> days and the range... None of it had a caller. `ride` was a LABEL on `move` - one of five
> intents, every one of which resolved through the same flat one-day journey - so "I ride to
> X" and "I walk to X" were the same event... Its own member rather than a widened `move`
> because it is a different question. `move` asks where; this asks where AND on what.

After, two:

> Getting there ON something rather than on foot. Its own member and not a `move` intent:
> `move` asks where, this asks where AND on what, and prices the road in walking days.

The measurement is gone because it was archaeology; the merge-warning stays because somebody
would otherwise fold it back into `move`.


## Ratio is the wrong bar for a declaration list

`src/web/action-set.ts` finished this pass at 2.67 and is **correct**. It is fifty verb
names - fifty lines of code - and one line of description each is a hundred and fifty lines
of comment. The comment IS the content in a file like that, and a name alone cannot say what
`passage` or `posture` is for.

So do not chase the number in a catalogue, an enum, or a schema whose fields carry units and
ranges. `src/schema/cultivation.ts` finishes at 1.07 for the same reason. The bar is whether
each line answers *what would be lost if this were deleted* - and in a declaration list the
answer is usually "the only statement of what this member means".

Where the number does mean something is a file with real logic in it. Those went from 1.5-7.5
down to 0.2-0.6 in this pass, and that is the range to hold them to.
