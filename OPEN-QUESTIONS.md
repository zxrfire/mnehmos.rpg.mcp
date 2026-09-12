# Open questions

Rewritten after your rulings. Everything you answered is gone from here and is being
built; what is left is either still genuinely open, or a decision of mine you may want to
reverse. Written the night of 11-12 September.

---

## What is being built right now, from your rulings

Six agents, so you can tell what landed from what did not:

| | your ruling |
|---|---|
| **elder life + sect diplomacy** | the patriarch gives orders, not requests; postings to better cities; taking a disciple; auction both ways |
| **dao ground + haggling** | ground is public / private / restricted, not a membership test; haggling is item-for-item and a refusal tells you what would work |
| **news travels** | two axes, distance and importance; a breakthrough files a deed scaled by rung; a sitting delivers what arrived IF somebody would deliver to you |
| **inventory + residence + renames** | one general inventory, not bespoke; a residence holds things and NPCs have them; manuals are complete / missing sections / ruined; rename the essayist encounters |
| *(landed)* | the narrator is told it is a xianxia novelist, not a renderer of findings |
| *(queued)* | the tests typecheck session |

---

## Still open, and I could not decide them for you

Nothing. You cleared all three before going to bed, and they are routed:

- **apex arts** - every apex house holds at least one immortal and one chaos art, their
  spent-or-kept state varied deliberately, and the giving of them political: only to the
  chosen, only once proven. Counting comes first, so we know what the catalog holds today.
- **subcontracting** - approved and building. The board still belongs to the house and a
  rogue still cannot take from it; a disciple who HAS taken a duty can pay somebody else
  to do it. Both directions, and the rogue-being-paid direction matters most because it
  is the one that answers "a rogue has nothing to do".
- **a rogue's quiet decade** - deliberate, and it stays quiet. But INTERRUPTION is not
  gated on standing: two juniors brawling disturb a senior, and that is a trope rather
  than a delivery. Delivery is gated, interruption is not.

## Standing task: the elder pass

Left for me before you slept:

> "don't forget to remind yourself to do a pass over this other stuff cuz clearly there is
> SOMETHING to do for elders and the player can be an elder"

Two claims in that, and I am checking BOTH rather than taking either on faith:

1. **The player can become an elder.** Verify the path is reachable by PLAYING, end to
   end - joining, rising, holding an office - not merely arrangeable with ADMIN. A rank
   nothing can reach is content that does not exist.
2. **There is something for an elder to do.** The affordance probe measured 3.3 acts a
   square at the top band against 4.0 at the bottom, so the game currently gets THINNER as
   you climb. If the elder machinery is wired and simply not reachable, that is a very
   different fix from it not being wired.

An agent is building elder life in parallel - the patriarch's orders, postings, taking a
disciple, auction. This pass is mine and is about REACHABILITY, which is the half an agent
building features will not check on its own.

**FIRST PASS DONE, and the answer to your first claim is YES.** Played it: join a house,
ask to be promoted, and the engine answers

    Sand Well Caravan will not raise Shen Wuyou to Carrier yet: needs realm Qi Condensation
    Layer 5 (currently Qi Condensation Layer 1) and 100 contribution

which names the gate and exactly what would change it. The promotion machinery is wired
for the player, not only for the simulation. There IS a path.

**And the ladder is already visible, through a read almost nothing reaches.** `sect` with
intent `standing` answers:

    Skin of Sand Well Caravan, 0 contribution, 2 spirit stones a month.
    Nine Boards Qiu stands highest in it, at Core Formation Late and titled Waterman.
    Carrier wants Qi Condensation Layer 5, which is 4 rungs up and 100 contribution.

Membership, rank, stipend, who is above you, what the next rung costs. Your visibility
principle, already satisfied - by a read the natural sentences do not reach.

**Three defects found, one fixed:**

- FIXED: the sect listing said *"You are not on anybody's roll and no house has been asked
  yet"* to somebody who had joined a turn earlier. It was gated on whether any house WOULD
  admit you, never on whether one already had - so the engine contradicted its own
  `sectId`. It landed on "what sect am I in", a direct question about the membership it
  was denying.
- ROUTED to the pattern-table agent: `what sect am I in` and `what house am I in` fall
  through to the catalogue of houses that would take you, and `am I in a sect` is a blank
  look. All three should reach `standing`.
- ROUTED: `what is my rank` reaches `status`, which prints realm, root and attributes and
  never names the house or the rank.

## Decisions of mine; reverse them if you disagree

### 4. Turn 0 sits outside the corpus band on purpose
You ruled it the exception: it is about who you are, so it is narration and nobody needs
to speak. It runs 21% speech against 24-38% everywhere else, and is the longest turn.

### 5. I stopped tuning the one-liner rate
Counting said 6-30% by book. Reading said the 30% outlier is the one work by a different
author; the other 23 run 7.2-15.2%, median 9.1%. Composition matters more than rate: two
thirds are a flat act or reveal, a fifth a line of speech alone, an eighth the body doing
one thing.

### 6. Attribution is improving and I am leaving it alone
The corpus carries no speech verb on 75% of its dialogue paragraphs. We were at ~100%;
after telling the narrator it is a novelist it reads 33-50%. I am not tuning it further
because the metric counts a closed verb list and cannot see "a voice drifts from the
crowd".

---

## For the morning, not tonight

### 7. The prose is close and the remaining gap is paragraph length
With the novelist identity in, speech is in band (21-43% against 24-38%) and the crowd
talks properly - *"He's just staring at the boards," a voice drifts from the crowd.
"Staring won't buy him a way out of this hole."* What is still off is that some turns run
long: one came back at a 53-word median against a corpus 21-40.

### 8. 521 type errors in `tests/`
`tsconfig.json` excludes `tests/` and vitest strips types without checking, so a test
file is checked by neither command anybody runs. It already hid one live bug. You said to
spin up a session for it; that is queued behind the six running now, because it will
touch every test file and would collide with all of them.
