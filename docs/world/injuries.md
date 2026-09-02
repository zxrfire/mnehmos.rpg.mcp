<!-- tier: 2 trigger="somebody is wounded, asks about a wound, seeks treatment, or fights while carrying one" -->

# Injuries

What a wound does to a cultivator, what it costs, and what it does not touch.

Read alongside [`items.md`](items.md), which prices the medicine, and
[`understanding.md`](understanding.md), which owns the axis a wound cannot reach.

<!-- tier: 3 -->

## Sections

| Section | The scene it answers |
|---|---|
| [Two families of wound](#two-families-of-wound) | Deciding what a new injury should cost |
| [A torn meridian does not kill you](#a-torn-meridian-does-not-kill-you) | Somebody is carrying untreated damage |
| [What it costs, and what it cannot touch](#what-it-costs-and-what-it-cannot-touch) | A wounded cultivator fights, cultivates or thinks |
| [Severity](#severity) | Grading a wound, and what each grade means |

---

## Two families of wound

<!-- tier: 2 trigger="a wound is created or graded" -->

Everything below follows from one question, and it is the same question that prices the
medicine: **does this wound threaten your life, or does it take a rung from you?**

**The channel wounds** - `torn-meridians`, `scorched-channels` - are the common family. Qi was
forced through faster than the channel could pass it, or the walls were torn rather than burned.
They hurt, they last, they are a genuine impairment, and **they do not stop you climbing.**

**The wounds of the cultivation** - a cracked core, a shattered foundation, an unformed
nascent soul - are the rare family, and they are a different kind of problem
entirely. **These take something back.** A cracked core is not an inconvenience on the road; it
is the road closing. A shattered foundation is an injury in every ordinary sense - it is done to
you, it can be inflicted, and it can in principle be mended - and it belongs here rather than
beside a torn channel, because what it costs is a rung and not a season.

Note the vocabulary: **this setting says CORE.** It does not use `dantian` anywhere, and a
wound to the core is `cracked-core` and nothing else.

There used to be a second one. `ruined-dantian` sat in the maiming band describing a
cracked reservoir, which is the same organ under a borrowed word, and the two rows were
told apart only by the vocabulary - one halted, the other did not. The borrowed word is
gone and so is the second diagnosis. What it named lives on as `incomplete-cultivation`,
which is a wound to the cultivation base rather than to the core: it is minted at six
walls, five of which form no core at all, so it could not take the core's name, and it is
minted on the FAILURE side, so it must not close a road. A saved row carrying the old key
still reads correctly - see `RETIRED_WOUND_KEYS` in `data/cultivation/wounds.ts`.

The useful shorthand is **body against cultivation**. A channel wound is damage to the flesh
qi moves through. A foundation or a core is damage to the cultivation itself. Both are injuries;
only the second one takes something the ladder already gave you.

**The two must never be treated as one scale with a bigger number at the end.** A crippling
torn meridian is still a channel wound and is still survivable; a cracked core is categorically
worse than any amount of channel damage. That is why the medicine that mends the first is
ordinary and the medicine that mends the second is not - see the scarcity rule in
[`items.md`](items.md).

---

## A torn meridian does not kill you

<!-- tier: 2 trigger="somebody carries untreated meridian damage, or asks what it will do to them" -->

**It is a torn muscle.** Very, very annoying. Slow to mend, painful to work through, and it does
not put you in the ground. A cultivator carrying untreated meridian damage is not bleeding out
and is not on a clock.

This is worth stating flatly because the opposite is the intuitive design and it was the game's
commonest cause of death: runs ending at nineteen or twenty from accumulated channel damage,
while everything else the world could do to somebody went unmet. **A wound that ends most lives
before they have begun is not a hazard, it is a wall in front of the content.**

What still kills is what should: a fight lost, hunger, a lifespan running out, a crossing
attempted and failed. **Being hurt is a condition you live and work with**, and the whole
economy of medicine, sects, favours and stored pills exists because people carry these things
for decades and want them gone.

---

## What it costs, and what it cannot touch

<!-- tier: 2 trigger="a wounded cultivator fights, cultivates, or attempts to understand something" -->

**You can still do everything. You are simply worse at it, and it hurts.**

- **Combat.** You keep every art you know - a wound does not lock a technique. What it takes is
  the *quality* of the execution: slower, less accurate, and therefore less reliable. Express it
  in what the blow actually does rather than in what you are permitted to attempt.
- **Cultivation speed.** Slower. Qi is being pushed through something damaged, and it tells.

And the one thing a wound must never reach:

- **Comprehension is untouched.** Understanding, insight, the roads walked, everything on the
  axis [`understanding.md`](understanding.md) owns. **A wounded cultivator still thinks clearly.**
  They cannot push qi properly; there is nothing wrong with what they can see. Somebody laid up
  for a decade with torn channels may come out of it having understood more than they went in
  with, and that is not an exception to be explained - it is the correct behaviour of two axes
  that were never the same axis.

The temptation, whenever a new penalty is being added, is to let a wound dim everything at once
because that feels serious. It is the wrong instinct. **A wound is a fact about the body.**

---

## Severity

<!-- tier: 3 -->

Three grades - `minor`, `serious`, `crippling` - and they scale the impairment rather than
changing its kind. A crippling channel wound is a channel wound: it is severe, it is worth a
great deal to cure, and it still does not kill.

The grade is what the medicine ladder reads, together with the rung of the person carrying it,
so a crippling wound at height is the corner of the matrix where the cure is genuinely hard to
obtain. That pairing is documented once, in [`items.md`](items.md), and should not be restated
here with different numbers.
