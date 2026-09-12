# Open questions

Everything waiting on your judgement, worst-first within each group. Written overnight
while agents ran; I did not act on any of these unilaterally.

---

## A. Things I think are bugs, and would fix unless you say otherwise

### 1. A breakthrough is not news, and in this genre it always is
`aDeedEntersTheWorld` is called from fights and from sites. It is NOT called from the
breakthrough path. So a player crosses a realm and nobody in the world ever hears about
it. The corpus makes a breakthrough the most talked-about thing that happens: people
react out loud, the boast is the SPEED of it, sects forbid internal fighting during one
because that is when somebody is open, and it draws tribulation.

**Question:** file the deed, and scale how far it travels by rung — a first-rung step is
local, a rung most people never see travels? That mirrors what destruction now does.

### 2. Time in seclusion is dead world-time
Played: five years intended, one year spent, provisions ran out honestly, accounting was
exact. And NOTHING reached the player — no message waiting, no caller turned away, no
news. In the genre, emerging is when the backlog lands: *"a jade slip that had arrived
half a year ago, informing him that..."*, somebody at the door with a pill bottle. The
named price of a long sitting is being *"forgotten by the world"*, and that price is only
legible if the world visibly moved.

**Question:** should coming out of a long sitting deliver what happened while you were
under? I suspect the world driver already produces the events and nothing surfaces them.

### 3. "I take the job" after reading the board gives you day labour
Read the duty board, see one 20-day contract, say "I take the job" — and you get three
months of Shipmaster work instead. Not a refusal, so it is outside the blank-look
problem; it is mis-targeting. Both readings are honest, but the board was just printed.

**Question:** worth bending routing precedence for, or leave it?

### 1b. A book cannot be smashed, though a pill can
Found by playing, one turn after buying:

    what am I carrying  ->  Books: Lesser Qi-Gathering Manual, ...
    I smash the manual  ->  "...You are carrying nothing."

A counted PILL destroys correctly (*"Qi-Gathering Pill is gone. There is nothing left
of it to put anywhere."*). A counted BOOK is not in the destroy verb's reach at all, so
the engine contradicts its own inventory one turn later. That is worse than a refusal —
it is a false statement about the player's own pack.

Almost certainly just that books are held separately from the pouch and
`whatIsWithinReachOf` sees one and not the other. Small.

### 2b. The catalog states a tribulation rule the engine does not implement
`src/data/cultivation/inheritance-trials.ts` says outright: *"Heavenly tribulation destroys
nearly everything the cultivator was carrying. What comes off a tribulation grave is a short
list, and every item on it has survived the heaviest thing in the world. Anybody who died any
other way leaves a full inventory that nothing has ever tested."* And of one trial: *"That
ratio is the rule this catalog is built on."*

`estate-at-death.ts` receives a `DeathCause` and uses it for exactly one thing — whether
somebody looted the body (`somebodyDidThis`, true only for `combat_defeat`). **A tribulation
death leaves the same full inventory as dying of old age.** The authored trials are built on
a ratio the live world does not produce.

This now sits one line from working: an agent just added "what comes off a body is marked by
where it fell", keyed on the place's danger. Tribulation is the same shape keyed on the
CAUSE, and it is the one cause the catalog already argues for.

And it connects to what you said about a sword blocking tribulation lightning — that is the
same rule seen from the item's side.

**Question:** should the cause of death mark what comes off the body, the way the place now
does?

### 3b. "Local" gossip is not local, it is just quiet
Your ruling was *"earth people still gossip ... it is just less important"*. Destruction
now grades correctly by significance, and earth-and-below is genuinely not silent —
witnesses are drawn, the fact is on the record — but `circulating` has NO PROXIMITY TERM.
So a minor event is quiet EVERYWHERE rather than known nearby and unknown far away. The
near/far axis your ruling implies does not exist yet.

Related, found the same way: witnesses are stored on a fact, but `linkFactToWhoItNames`
links only the named ACTORS. So somebody who watched a thing happen does not carry it on
their own record, and cannot later be the one who tells you about it — which is most of
what a witness is for.

**Question:** worth building the near/far axis? It is the difference between "small news"
meaning low-ranked and it meaning local.

---

## B. Design questions I could not answer for you

### 4. There is no haggling
The corpus haggles constantly — delaying to lower a price, refusing one out loud,
*"he wanted to delay and lower the price"*, *"That's... that's way too expensive!"*.
Our prices are fixed and `haggle` routes to the market read. A whole class of
interaction is absent.

**Question:** is price negotiation a mechanic you want, or are fixed prices deliberate?

### 5. The numbers on heaven+ manual uses — ANSWERED WELL, CONFIRM IF YOU LIKE
heaven 3, immortal 1, chaos 1; mortal and earth unlimited. Argued rather than picked:

- **Heaven 3** is read off `copiesOf` — an inner or elder shelf carries 1-3 copies, so
  three readings a copy is a house founding a handful of people on its own art and then
  needing a master to spend 60-250 years writing it out again. That makes `manuals.md`'s
  existing claim TRUE rather than asserted: *"a house with one copy of the thing its
  patriarch cultivates cannot give it to forty people."*
- **Immortal 1 and chaos 1** because `possessions.ts` already says nothing below the Lid
  makes either grade, there is a finite number in the world, and no process adds one.
- **They tie on purpose.** `GRADE_ORDER` says in as many words that it is not a power
  ordering, so a ladder at the top would be this rule inventing one.
- Uses are per ROW, so `copyCount` multiplies — two heaven copies is six readings.

**Question:** confirm, or retune. A test pins them so a change is a deliberate edit.

### 5b. The manual rule binds the player and not the world
Flagged by that agent and I agree it matters: `grantBooksToMembers` is a pure projection
that hands houses their books at world open, and binding uses there would change what
every house's apex book is worth. So today a player's heaven manual runs out and an
NPC house's does not. That is the mirror image of this repo's usual defect.

**Question:** should the world be bound by the same rule, knowing it repricing every
house's shelf?

### 6. Encounter names that read like designer headings
A few of the 107 are essayist rather than in-world: *"What a Poor Prefecture Has Instead
of Monsters"*, *"The Arithmetic, Acted On"*, *"A Region With a Ceiling"*, *"What Happens
Afterwards"*. I measured that ZERO of the 107 reach the player in 60 turns of play — the
`summaryTemplate` is what is read — so this is latent, not live. But the duty-board
refusal did print one once.

**Question:** rename the handful, or leave them as internal labels?

### 6b. An engine module cannot read the reverse volume index
`estate-at-death.ts` needs to know which ordered work a volume belongs to, so a corpse
yields volumes 1 and 2 of a work rather than 1 and 3 with a hole. The reverse index lives
in `src/web/manual-volumes.ts`, and an engine module must not import from `src/web` — so
NPC deaths currently draw per ROW instead of per WORK.

It cannot bite today: the three scattered volumes are held by houses, and houses do not
die. The clean fix is to put the reverse index beside `SCATTERED_MANUAL_VOLUMES` in
`src/data/cultivation/techniques.ts`, which nobody touched with agents live.

**Question:** move it, or leave it until something can actually hit it?

---

## C. Things I decided; reverse them if you disagree

### 7. Turn 0 is the exception to the speech rule
You ruled it: turn 0 is about who you are, so it is narration and nobody needs to speak.
It currently runs 12-18% speech against 24-38% everywhere else, and is the longest turn.
Flagging only because it is the one place our prose deliberately sits outside the corpus
band.

### 8. I stopped chasing the one-liner rate
Counting said 6-30% by book; reading said the 30% outlier is the one work by a different
author, and the other 23 run 7.2-15.2% with a median of 9.1%. Composition matters more
than rate: two thirds of one-liners are a flat act or reveal, a fifth a line of speech
alone, an eighth the body doing one thing. The prompt now says "about one in ten" and
warns that a turn which is mostly short lines has overcorrected.

### 9. Attribution is still high and I left it
The corpus carries no speech verb on 75% of its dialogue paragraphs. Ours attributes
most lines. Fixing this once moved single-line paragraphs 6% to 14% on its own, so it is
the highest-leverage remaining prose lever — but the metric counts a closed verb list and
cannot see "a voice drifts from the crowd", so I do not trust it enough to tune harder
without reading more output.

---

## D. Not mine to schedule

### 10. Nothing typechecks the tests
`tsconfig.json` excludes `tests/`, and vitest strips types without checking them, so a
test file is checked by neither command anybody runs. Measured: **521 real type errors**
in `tests/`. It already hid one live bug — a shared harness literal missing three
required fields, which in turn propped up a wrong assertion about `/api/health`.
Recorded in AGENTS.md with the config that reveals them, deliberately wired into no
command, because switching it on fails on all 521 at once.

**Question:** worth its own session sometime?
