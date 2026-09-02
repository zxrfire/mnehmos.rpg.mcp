<!-- tier: 2 trigger="somebody has to decide whether to believe who another person says they are, or whether a token, a retinue or a claim is genuine" -->

# Being believed

How anybody decides whether you are who you say you are. Read alongside
[`asking.md`](asking.md), which covers what happens once they have decided, and
[`discovery.md`](discovery.md), which covers how anybody comes to know a thing at all.

<!-- tier: 3 -->

## Sections

| Section | The scene it answers |
|---|---|
| [Two things about the reader](#two-things-about-the-reader) | anybody is judging anybody |
| [The spectrum of signals](#the-spectrum-of-signals) | somebody has to establish who they are |
| [A signal is worth what they cannot check](#a-signal-is-worth-what-they-cannot-check) | deciding whether a particular deception works |
| [Recognition runs backwards to prestige](#recognition-runs-backwards-to-prestige) | somebody from a great house is far from it |
| [Expensive signals, and forging one](#expensive-signals-and-forging-one) | a retinue, a spirit boat, anything nobody could afford to fake |
| [Tokens shatter, so somebody has to be taken alive](#tokens-shatter-so-somebody-has-to-be-taken-alive) | somebody is holding a house's token that is not theirs |
| [Checking costs time](#checking-costs-time-and-time-is-what-nobody-has) | somebody doubts a claim and has to decide whether to go and find out |
| [The art is the strongest check](#the-art-is-the-strongest-check) | deciding whether a house is still the house, or a person still of it |
| [The woken ancestor](#the-woken-ancestor) | checking whether any of this is bespoke |
| [What of this the engine actually holds](#what-of-this-the-engine-actually-holds) | before building any of it |

---

## Two things about the reader

<!-- tier: 2 trigger="two people meet and one has to decide what to make of the other" -->

**Trust is not a property of a person. It is a function of them and of whoever is looking.**
Every signal below is read by somebody, and what they get out of it depends on two things
about the reader, which are **independent and must not be collapsed into one number**:

> **REALM is capability. WORLDVIEW is reference.**

**Realm** decides what you can *perceive*: whether a token is genuine, what an elder is
actually standing at, whether a set of remains still teaches, how old a thing is. It scales
with the ladder, and it is the same perceptual channel that authenticates a relic.

**Worldview** decides what you have a *reference* for: whether you have seen that sect's
disciples before, whether you know those faces, whether you know what a real apex retinue
costs. **It scales with a life, not with a rung.**

**And worldview is not one number. It is a ladder, held separately for every subject.** How
somebody came to know a thing decides which lies about it they can catch, and the grades are
different in kind rather than in degree:

| How they know it | What it lets them catch | What still gets past them |
|---|---|---|
| **Heard the name** | nothing | anything at all wearing that name |
| **Read about it, and it fits** | contradictions - a claim that does not match the account | any impersonation that matches the account |
| **Seen it** | everything the account does not capture | very little |

**The middle rung is the interesting one**, because it is secondhand and still genuinely useful:
a careful reader catches inconsistency without ever having been in the room. **It is also
exactly what a good forger studies**, so the same records that arm the reader arm the liar, and
the two arrive at the table having read the same page.

**This is already in the engine and does not need inventing.** `KnowingStage` in
`src/engine/social/discovery.ts` runs `unaware → whisper → named → placed → encountered →
known`, which is this ladder with more rungs - **so the second axis is per-subject knowledge the
world already tracks**, not a new stat. Worldview is what you get by asking that ladder about
everything at once.

The two axes come apart, and both failures are worth playing:

- **A high-realm recluse** can tell you exactly what every cultivator in the room is standing
  at, and cannot tell you whether that is the Azure Cloud's retinue or a hired imitation.
- **A travelled merchant at Foundation Establishment** cannot read one of them, has seen the
  real thing four times, and knows something is wrong about the boats.

Two consequences follow, and the second is why this matters to the setting rather than only
to the mechanic:

- **Who is in the room is load-bearing.** The same deception succeeds or fails on who happens
  to be present, which makes *who is here* a question about who can see through what.
- **Reference is the one authority in this world that does not come off the ladder.** A
  merchant, a wanderer, an old servant who spent forty years at a great house: none of them
  can fight, and any of them can ruin a deception that would fool a Nascent Soul.

It also gives a player something to accumulate that is not a rung. Travel, meeting people,
having seen a thing once - progress available to somebody stuck at a ceiling, which is where
most of a run is spent.

---

## The spectrum of signals

<!-- tier: 3 -->

Weakest to strongest. They stack, and each is defeated by something below it.

| Signal | What defeats it |
|---|---|
| **Nothing.** A stranger. | - |
| **Dress and bearing.** You look the part. | Anybody who actually knows that house, and sees the wrong detail. |
| **A claim.** Words. | Anybody with a reason to doubt you. |
| **A name in common.** You both know somebody. | Anybody who can go and ask that person. |
| **A token.** The thing a house issues. | The posters, once they arrive - and they are always behind you. |
| **Somebody present who vouches.** | Their own standing, if it is poor. |
| **Being known personally.** | Nothing. |
| **Demonstration.** What you can do. | Nothing. Cultivation cannot be faked. |

**A name in common is the strongest of the informal ones, and the cheapest to build**, which
makes it the route upward for somebody with no house, no token and no rank. Three properties
earn it that place:

- **It is checkable in the moment.** *"You know Wei Fuzhi? How is his shoulder?"* is a test a
  liar fails and an honest person passes without effort. No other informal signal can be
  interrogated on the spot.
- **It puts a third party's standing behind you** - and puts them at risk if you are lying,
  which is why people are careful whose name they invoke.
- **It is transitive.** One real friend reaches people you could never approach cold.

---

## A signal is worth what they cannot check

<!-- tier: 2 trigger="working out whether a particular lie would hold in front of a particular person" -->

**The rule the whole spectrum resolves through.** Not what the signal is; what this reader is
unable to verify.

- **Dress fails on anybody who knows that sect** and works beautifully on everybody else.
- **A token fails on anybody who has heard about the cancellation**, which is a question of
  proximity to the house rather than of rank.
- **A name in common fails on anybody who can actually go and ask.**

So **the fraud is always downmarket**, and for a structural reason rather than a moral one:
the people a deception works on are the people who cannot check it. That is the same shape as
a forged relic, which fools nobody high enough to perceive that it does not teach.

**Two gates, and they are different questions.** Authenticating the object and authenticating
the standing behind it do not have the same answer:

> **Is this token genuine? - perceptual, realm-gated.**
> **Has it been cancelled? - social, proximity-gated.**

**The powerful are not immune here.** An apex elder far from the issuing house is as blind to
a revocation as anybody, and being able to authenticate the object gives them false confidence
about the person holding it.

---

## Recognition runs backwards to prestige

<!-- tier: 2 trigger="somebody claims a great house somewhere that house is not" -->

A local sect's disciple is recognisable **because there are a lot of them nearby** and people
have a reference. An apex disciple is a thing everybody has heard of and almost nobody has
seen, so there is nothing to match against.

**And the size of the claim works against it.** *"I am of the Azure Cloud Pavilion"* invites
disbelief precisely because it is impressive - it is exactly what somebody would say if they
were lying, and everybody knows that. **A modest true claim travels better than a great one.**

**The resolution is demonstration**, which is why the powerful do not carry proof: they *are*
the proof. Tokens, vouching and shared names are the apparatus of people whose standing cannot
be seen at a glance.

So the spectrum has a shape rather than a slope:

> **Easy at the bottom - nobody cares who you are.
> Hard in the middle - you need apparatus.
> Easy at the top - you simply are what you say.**

**The middle band is where most of a run is spent**, and it is a real predicament: too high for
anybody local to have a reference for your house, not high enough for your cultivation to settle
the question by itself. An unbelievable claim and insufficient means to prove it. This is exactly
where a token or a name in common becomes load-bearing.

---

## Expensive signals, and forging one

<!-- tier: 2 trigger="a party arrives with elders, boats, or anything nobody could plausibly afford to fake" -->

A retinue of elders and spirit boats is believed because **assembling one is beyond almost
everybody.** Nobody checks it, nobody can check it, and it works anyway - **its strength is
the cost of faking it, not any verification.**

- **Believing it is correct, not naive.** The base rate overwhelmingly favours the display being
  real. Trust is not gullibility when the signal is expensive.
- **A forged display is itself information.** Nobody fakes a retinue to impress a market town, so
  if it *is* fake, something serious is happening - a frame, a killing meant to be attributed
  elsewhere.
- **Only a peer can afford it**, which narrows the field enormously. **The counter-play is not
  doubting the boats; it is asking who could afford them** - a question the world can answer.

And the deception is only sustainable while nobody who could price it is present. Somebody who
knows what those elders cost, or who those faces are, reads it instantly. **A frame at this scale
works on a province and fails in a room containing one well-connected old man.**

---

## Tokens shatter, so somebody has to be taken alive

<!-- tier: 2 trigger="somebody is carrying a house's token that is not theirs, or a house notices one of its own has stopped answering" -->

**A house keeps a plate for each of its disciples, and the plate shatters when they die.**
The disciple's own token goes with them. Nothing about this is subtle and every consequence
below falls straight out of it:

- **You cannot take a working token off a corpse.** It is gone at the moment of death. The
  obvious route to a stolen identity - kill somebody and take their proof - **does not exist.**
- **So the identity has to be taken alive, and kept alive.** That converts a clean killing into
  an ongoing crime with a living victim, a place they are being held, and somebody who can be
  rescued. **It is a far better thing for the world to contain than a body in a ditch.**
- **A house knows the instant one of its own dies.** There are no unreported deaths inside a
  house - only unexplained ones.
- **And a disciple who is missing while their plate is still whole is the worse signature.**
  The house knows they live and knows they are not answering, which is precisely what a captive
  looks like. **That is when the posters go out.**
- **So a stolen token is hot from the moment it is taken.** The posters *are* the cancellation,
  and they travel at the speed of the gossip system: through hands, distorted, degrading with
  distance. The window is the gap between the taking and the notice arriving, and it closes
  behind the holder every day they keep using it.
- **Which makes using it suspicious in a specific way rather than a general one.** Anybody who
  has seen the notice is looking at a token whose owner is known to be alive somewhere else.

**And the name itself is carried on an object, which is what stops a lineage from being only a
claim.** A jade tag with the house's name cut into it. So *"I am of the Ru"* is not words - **it
is a token**, and every rule above lands on it unchanged: it shatters when its holder dies, it
can be cancelled, and a taken one is hot from the moment it is taken.

**That is what makes a prestigious surname hard to lie about.** To pass as a Ru you need a Ru
tag, and because it shatters you cannot take one off a body - **you would have to take a living
Ru and keep them alive**, against a family sitting at the top of an apex house. Nobody runs that
deception casually, which is precisely why the name is worth anything.

**But the tag authenticates the line, not the person.** It says Ru. It does not say *which* Ru.
So a genuine tag in the wrong hands still reads as *a Ru* - **it answers the question the family
check asks and leaves the individual wide open**, which is the seam somebody would actually work.
Verifying the object is realm-gated; verifying that this is the person it was issued to is not a
question the object can answer at all.

**Two things follow that are worth building toward.**

**The unhoused are the safe target.** A rogue cultivator has no plate and no house to miss them,
so the entire apparatus above never engages. The people nobody would come looking for are the
people it is safe to rob, and **the world should be legible about that** rather than pretending
the risk is evenly distributed.

**And a shattered plate is a question, not an answer.** It tells a house that one of theirs died
and nothing else - not where, not how, not by whose hand. A house holding a shattered plate and
no body will pay for the answer, and somebody who brings the remains back gets credit for it.
See [`items.md`](items.md) on provenance, which is the same fact read from the other end.

---

## Checking costs time, and time is what nobody has

<!-- tier: 2 trigger="somebody doubts a claim and has to decide whether to go and find out" -->

**Verification is almost never impossible. It is priced, and the price is time.** That is the
dial the whole model turns on, and it is more useful than treating doubt as a fixed trait.

**The price scales with realm, steeply.** For a mortal merchant, going to a house to check a
token is a journey of months and therefore is not a real option - their doubt has nowhere to go.
For somebody far up the ladder, distance is close to free: the great houses' seats have not
moved in a very long time, and she can go, ask, and be back. **A high realm does not only let
you perceive more; it lets you afford to check.**

**And then pressure takes it away again.** A sect under siege, a plan already in motion, a
window that closes at dusk - **any of these turn the affordable check back into an impossible
one**, for the strongest character in the world as surely as for a farmer.

> **People believe things because they have not got time to find out.**

That is the lever worth playing. It means urgency is what makes deception work - so a liar's
real skill is manufacturing haste, and **a careful player's counter is refusing to be hurried.**
It also means the same claim, to the same person, resolves differently on a quiet afternoon and
on the eve of an assault, which is exactly the kind of thing this world should be able to say.

---

## The art is the strongest check

<!-- tier: 2 trigger="somebody needs to know whether a house is still that house, or a person really of it" -->

**Names are not the definitive check and probably not even the main one. The techniques are.**

This is [the spectrum's](#the-spectrum-of-signals) last row read at a larger scale. There,
*demonstration* is what settles a **person's** standing because cultivation cannot be faked;
here the same principle settles a **house's**, because a house's arts are a thing bodies do
rather than a thing anybody holds. **One rule, asked of an individual and of an institution.**

A house's arts are the closest thing it has to an identity, and **a technique cannot be worn,
bought, inherited by accident or carried off a corpse - it is something a body does.** Watching
somebody cultivate is therefore the one reading that goes straight to the thing in question,
and for anybody with the realm to perceive it, it is nearly unanswerable.

**There is exactly one way to fake it, and it costs the forger the thing they are faking.** You
would have to get somebody to actually *learn* the art. Which means either they truly have it -
in which case the house's art survived, which is what the check was asking - **or somebody
taught it to them, and the art has leaked, which is a graver finding than the deception it was
meant to cover.** The forgery and the truth are almost the same fact.

**But demonstration only works if you know what it is supposed to look like.** That gate is
absolute and it applies to the strongest check exactly as it applies to the weakest. Watching
somebody perform a house's art tells a stranger **nothing whatsoever** unless they hold a
reference for it - and an art is precisely the thing houses keep from strangers.

**So the hierarchy does not escape the two axes; it runs back through them.** Realm decides
whether you can perceive the demonstration at all. **Worldview decides whether you know what you
just watched.** Both are needed, and having only the first is the recluse's failure arriving at
the top of the ladder rather than the bottom of it.

Which means the rule from earlier holds with no exceptions anywhere:

> **Every check, including the strongest one, is worth what this particular reader cannot verify.**

**But guarding an art means refusing to *teach* it, not refusing to be seen doing it**, and
those are independent. Houses compete. Even the apex ones run martial tournaments, and the
reason is developmental rather than ceremonial: **that is how a house's youngest and best grow,
by being challenged.** A house that stopped competing to protect its secrets would be trading
its next generation for the privacy of the current one.

**So the normal case is the strongest position available: an art nobody can acquire and the
right people can recognise.** Secret in transmission, performed in public.

**But the public is not the public.** Tournaments are held in the grandest cities, and **you have
to be somebody, or connected to somebody, to watch.** A hick farmer cannot get in. **Neither can
a rich merchant** - this is one of the things money does not buy. **The gate is standing, and
the reference class is therefore aristocratic rather than broad.**

**Which means being able to run the check says something about the reader.** Somebody who can
say *that is the Azure Cloud's art, I have watched it performed* has announced they move in
rooms most people cannot enter. **The check reveals the checker**, and a claim to recognise is
itself a claim somebody can test - *who else was there?*

**And then it travels downward, which is the awareness ladder doing its ordinary job.** Whoever
was in the room tells a friend, who is usually of lower standing; that friend tells another.
**Each hop costs fidelity**, and the ladder in `KnowingStage` is exactly that gradient:

| Distance from the room | Roughly | What they can do with it |
|---|---|---|
| **Was there** | `encountered` / `known` | authenticate |
| **Told by somebody who was** | `placed` | catch a bad imitation, not a good one |
| **Two or three hops out** | `named` / `whisper` | be impressed, and be fooled |
| **Beyond that** | `unaware` | nothing |

**So worldview about an art is social distance from a gated room**, measured in hops rather than
in miles. Somebody who has crossed the world on foot may never have seen an apex art performed,
while a minor noble who has barely left one city has. **Connection, not mileage** - and the
diffusion is why an ordinary person can hold a real opinion about a house they will never see,
while still being exactly the person a good forgery works on.

**The Hollow Court breaks this in a better way than being invisible.** They take nobody below a
Void Refinement floor, so **every one of their people arrives already trained somewhere else.**
The Court is built of transfers, and it holds as many arts as it has taken people.

**So a Court member performing an art shows their origin house's art** - genuinely theirs,
honestly learned, perfectly recognisable, and **completely misleading about who they now serve.**
There is nothing to see through. The strongest check in the hierarchy returns a true answer to a
question nobody asked.

> **An art tells you where somebody was trained. It does not tell you whom they serve.**

**And the player has to be able to ask.** *Is this the Azure Cloud's art?* is a question a
character can put to themselves at any time, it costs nothing, and it is never refused - looking
at what is in front of you and thinking about it is always legitimate. **The answer is graded,
not a verdict:**

| The reader | What they get |
|---|---|
| **No reference** | they could not hold the question - *you would not know it if you saw it* |
| **Reference, low realm** | **honestly hedged.** It matches what they have heard described, and they could not tell a good imitation from the real thing |
| **Reference, high realm** | **flat and certain.** *That is not the Azure Cloud's art* - at a glance |

**The hedging must be real hedging**, never a coin flip dressed as knowledge: a player has to be
able to trust that an uncertain answer means their character is uncertain. And **certainty is
the reward** - the terse, instant answer at high realm is progression the player can feel that
has nothing to do with being able to fight.

**That is general, and the Court is only its extreme case.** Anybody who has changed houses
carries the same ambiguity; the Court is an entire institution made of it.

**And the secrecy rule is narrower than it sounds, in a way that matters everywhere.**

> **A manual is an object. What is in your head is not.**

A house can stop a manual leaving - it is physical, countable, lockable, and **missed** - and
houses police that exactly as they should. **A house cannot stop somebody teaching aloud what
they already know, so it does not try.** The economy is enforceable on objects and unenforceable
on memory, which is why both things are true at once: arts are guarded, *and* people carry them
out of every house in the world in the only container nobody can search.

**Unenforceable in advance is not unpunished, and that is written down already.**
[`items.md`](items.md#holding-is-a-signature) has the consequence in full: practising an art is
visible, so it is **evidence for as long as you keep climbing on it** - which is the rest of
your life, because putting it down means starting again - and what happens when they catch you
turns on whose art it is, not on the theft. **Nobody asks the Hollow Court**, because going
there costs the house nothing and is an honour on it, and a house that has been honoured for a
member's leaving is not placed to complain about what that member carried in their head.

**And a manual is not the better half of that pair - the engine has it the other way round.**
`techniques.ts` distinguishes an art **shown** from an art **read**, and a book *"cannot answer,
cannot correct, and cannot repeat anything"*; `opacity` is literally *"how much of an art fails
to survive being written down"*. **A person transmits better than a book.** So somebody teaching
their old house's art aloud is the good case, not a degraded copy of one.

**What a manual has instead is reach.** [`manuals.md`](manuals.md) has it: a house holds so many
copies and no more, and reproduction needs a master. **A book scales to forty people; a person
scales to whoever they have hours for** - which is why the manual is still the thing worth
stealing, and why it is a tracked object with provenance in [`items.md`](items.md) while the
knowing of it is not.

**And at the Court the sharing is not a quirk of the place - it is the reason the place exists.**
Everybody there is past the Void Refinement floor, everybody is climbing the same last stretch,
and everybody arrived out of a different house. **Peers telling each other what they know is
what gets people to the top faster**, which is the whole point of gathering them. A holy land is
not somewhere with good ground; it is somewhere the person beside you knows something you do not
and will say it.

**At the Court this resolves an apparent contradiction, and the resolution is the useful part.**
The Court **as an institution** teaches exactly one art - the Seats' own, passed at 41 as the
vehicle for the last climb to 44. **Its members, informally and out loud, share what their old
houses taught them** - which is the institution working as intended, not a leak it tolerates. **Both are true because they are different
acts.** Institutional transmission is one thing and a person telling another person what they
know is another, and only the first can be written down, counted, or forbidden.

**The Court holds two separate strengths and it is not a choice between them.** The pooled
knowledge above, which no house can stop leaving - and an archive: `crossings.ts` has it that
their records are good and *"that is not incidental to their strength - it is their strength"*,
which is why their depletion is medium rather than terminal at four thousand four hundred years.
Every other institution's decline includes a component of simple forgetting. Theirs does not.
See [`past-the-ceiling.md`](past-the-ceiling.md#the-hollow-court-is-the-exception-to-all-of-it)
for its selection and its ground.

**The recognition consequence is the part that belongs here:** every member arrived trained
somewhere else and still performs that art, which is genuinely theirs and genuinely their old
house's. **So the check reads them correctly and places them wrongly.** And the Seats' art is
not withheld to prevent imitation - **it is simply an instrument for a stretch of ladder almost
nobody has stood on**, used on an occasion almost nobody witnesses.

**It is also the precise reason a woken ancestor is the authority she is.** She is the rare
reader holding *both* axes for her own era: the realm to read a demonstration exactly, and a
first-hand memory of what it is supposed to look like. **Not because the art check is
unconditional - it is not - but because she is one of the few people who can actually run it.**

So the checks fall into an order, and each fails in its own way:

| Check | What it proves | How it fails |
|---|---|---|
| **The arts** | what a house *is* | a reader with no idea what it should look like - and only then by somebody genuinely learning them, which is itself a leak |
| **The old objects** | what a house *held* | relics change hands; possession is not descent |
| **The names on the roll** | which lines *continued* | names are not exclusive, and lines end innocently |
| **The faces** | nothing | everybody is new; that is the calendar, not a signal |

**Names also do a second job, and it is the player's rather than the world's.** This is a
roguelike: runs end, and what survives a death is what the person at the keyboard learned. **A
name is the handle that knowledge attaches to.** First run, Ru means nothing; five runs in,
seeing a Ru on a roster makes the player sit up - and that recognition was *earned by dying*.
**Which is the real reason a prestigious name must never be randomly generated:** a Ru farmhand
would not merely muddle a lineage in the fiction, it would poison knowledge the player paid for.
The in-world use and the player-facing use want exactly the same guarantee.

**Xu is the worked example of why names sit that low.** Xu Ci lies under the Anchorhold's datum
stone - and there are Xu at the Measured Span and at Held Names as well. **A name carried by
three houses identifies none of them.** It is worth something as corroboration and nothing on
its own.

**And that is the ordinary case, not a flaw in the world.** Most surnames are common; Gu and Cao
are house lines and are also names any stranger may be born with. **A name that proves nothing is
the rule, and a name that carries a house by itself is the rare exception** - which is why the
reserved set is deliberately tiny. A reader who treats a shared surname as identification has
made the same mistake as one who treats a hall of strangers as loss.

**And for a dao house this is not the strongest check, it is the only one.** A dao house holds
no ground: the catalog is explicit that it *stands on nothing* and holds a specialisation and a
civil standing. **So the art is not evidence about the house's identity - the art is the
identity**, and a dao house whose specialisation has drifted has become a different house while
keeping its name and its door. Nothing else about it is checkable, which is also why it has a
counter rather than a patron.

---

## The woken ancestor

<!-- tier: 3 -->

**The check that none of this is bespoke.** A rule that governs one situation is wrong; this one
governs a stranger in a market, an apex disciple far from home, a house running a frame - and
somebody who has been sealed for centuries and just opened her eyes, which nobody designed it for.

**And she does not get her own checks. She walks down the same hierarchy as everybody else** -
the arts, then the objects, then the names, then the faces that tell nobody anything. **Sealed
ancestors need no machinery of their own at all**; they are the ordinary model handed an
unusual reader. Everything below is what that reader does differently on the same ladder, and
nothing below is a new rung.

She is the second axis taken to its limit: **maximum realm, no current worldview.** She can
perceive anything and recognise nobody.

**But be careful about what she is actually missing, because it is not the object.** A hollowed
court's token, or one cut deep in a style nobody uses now, **is still exactly that** - genuine
work stays genuine, and age does not make it less readable. She is not deceived about the thing
in front of her at all. **What has gone stale is one level up: what the object implies.** Whether
that house still stands as it stood, still honours what it issued, still means what it meant.

So the split is sharper than *object versus everything else*:

> **She reads the thing correctly and the institution behind it wrongly.**

**And she does not know nothing.** Her reference is **partial, not absent** - mostly stale, and
some of it still holds. Names that still mean roughly what they meant, a hall that is still
where it was, a family that kept its habits. **That is a worse state than an empty one, not a
better one:** somebody with no reference asks about everything, while somebody with a
*partly* correct one **cannot tell which parts are the correct ones**, and stops asking exactly
where she should not have.

**But she has a way of checking that is available to nobody else, and it runs through objects.**

> **She cannot ask the people - they are all new. She can ask the things.**

**Material outlasts membership.** A house's relics, its foundations, the instruments its
ancestors held, the pieces she herself saw made: those survive every disciple who has died since
she was sealed. **So she tests institutional continuity by testing material continuity** - does
this house still hold what it held? - and she can authenticate the answer perceptually, on the
axis where she is strongest. **Her strong axis repairs her weak one, and objects are the only
channel through which it can.**

**And the standard she checks against is her own memory**, which is a peculiar kind of
authority. She is not comparing the house to a record - records can be revised, and every
record made since she was sealed was made by people she has no reason to trust. She is
comparing it to what she personally saw. **Nothing alive can alter that, which makes it the
one reference in this world the gossip system cannot degrade.**

**Expect partial agreement, because partial is the normal result.** Some of it will match and
some will not, and **the pattern of which is the actual information** - far more than any
single verdict:

**Faces tell her nothing, and that is arithmetic rather than subtlety.** Everybody she knew
is dead. A hall full of strangers is the *expected* result after that long and carries no
information whatsoever - reading it as loss is simply reading the calendar.

**What persists is families.** A name outlives every person who carries it, so **the surname
is the continuity she can actually read** - which of the house's lines are still on the roll,
generations down.

**The extreme case is a name still sitting at the top of the house.** The Ru line holds the
Azure Cloud Pavilion's Pavilion Master and its immortal, so somebody waking and finding a Ru
still holding the Pavilion knows more than that the house survived - **the line that made it
is still running it.** That is continuity nobody can acquire, unlike relics, which change
hands. And the inverse is the strongest negative signal in the world: **the Ru gone from Azure
Cloud would not be drift, it would be a catastrophe with a cause.**

**The given name is a clock.** A generation shares a character - Ru Anjing, Ru Anwei, Ru Anxi
are one generation, and Ru Wenshi and Ru Bo are not. So the roll does not only say *whether*
the line held; **it says how many generations have passed**, which is exactly the quantity a
sealed ancestor has lost and cannot get any other way.

**And the name descends through whoever carries the lineage, not through the fathers.** The
Ru line runs through women - the Pavilion Master and the sister who left - and the name goes
down it regardless, **because what is being carried is an immortal lineage rather than a
patriline.** A child of that family is a Ru. The same holds for the dao houses: where a house
's name is the thing of value, the name follows the parent who has it.

**The catalog already holds three houses that read differently on this, which is the argument
that the mechanic is not invented for one of them:**

- **Ru, at the Azure Cloud Pavilion - the line is at the top.** It holds the Pavilion Master
  and the immortal both, so its presence on the roll settles the question in one look.
- **Xu, at the Anchorhold - the line persists and the house refuses to read it.** Xu Ci lies
  under the datum stone and living Xu still walk the house, which has *never treated the
  succession as a family matter*. **The signal is there and is deliberately not used**, which
  is a more interesting state than either extreme.
- **Meng, at the Nine Peaks Ascetic Order - the mechanic, already written out.** Of Patriarch
  Meng Da the catalog says the line *runs to him unbroken and legibly, and he would recognise
  it in a sentence*. **That is this entire section, stated in the data before it was stated
  here**, for a sealed ancestor nobody designed the model around.

**And a line can simply end.** Cultivators have few children and most of them die on the
ladder, so a family going out is **ordinary rather than sinister** - and a house can turn over
entirely, every name on the roll new, while having been continuously itself the whole time.

> **An absent name is a question, not a verdict.**

Reading it as proof of catastrophe is the same error as reading a hall of strangers as loss:
**mistaking attrition for a crime.** And it is worse for her than for anybody else, because
she cannot tell an ended line from a purged one by looking - **only by asking**, which costs
the time the previous section says she may not have. **The check she trusts most is the one
most likely to hand her a false catastrophe**, and she has no way to know which she is holding.

- **The old pieces are there and the old names are not** - the house kept its things and lost
  its lines. **A family does not simply fade**; somebody was purged, exiled, or walked out,
  and that is an event with a cause somebody is still carrying.
- **The names are there and the old pieces are gone** - hard centuries. The same lines, and
  the heirlooms sold to get through them.
- **Everything matches, exactly** - somebody knew she was waking, and prepared the room.

**And a surviving name is a way back in that nobody else has.** She can approach a stranger of
a line she knew and have standing with them - not with the person, whom she has never met, but
with the family. **That is a relationship her memory grounds and no living person can
contest**, and it is her one route into a world where she knows nobody at all.

**And her certainty is unshareable.** She knows the blade is wrong because she watched it
made, and she cannot demonstrate that to anybody - there is no evidence, there is only her.
**Being certain and unable to convince is the position she is permanently in**, and it is a
better engine than simply being powerful.

Two failure modes fall out of that, and both are worth playing:

- **A house that sold or lost its old things reads as discontinuous when it is not.** Poverty,
  a bad century, a debt paid with an ancestor's blade - and the house fails her test while being
  exactly the house she remembers. She may be the only person alive who would hold that against
  them, and she would be wrong to.
- **A house holding somebody *else's* old things can pass a check it has not earned.** Relics
  change hands. Continuity of material is not continuity of line, and **conflating the two is a
  forgery she is uniquely vulnerable to** precisely because the objects themselves are genuine.

**And it makes her valuable rather than only lost.** She is the one person who can say *that is
not your ancestor's blade, I watched it made* - **a living authority on everything from her era,
and a catastrophe for anybody whose claim rests on a piece from it.** Waking her is a thing a
house might want, and a thing a forger would pay to prevent.

**Which is exactly where the price of checking bites.** She, of all people, can go and find
out - the seats have not moved, and the journey is nothing to her. **Her deficit is repairable
in an afternoon, and only while she has the afternoon.** Woken into a siege, or into a plan
already running, she has to act on a reference class centuries out of date, and that is when
being enormously powerful stops protecting her.

The sealed ancestors are in the catalogs - `SECT_ANCESTRY.dormant`, `HELD_INSTRUMENTS`,
`UNOWNED_ANCESTORS` - and at the time of writing nothing in `src/engine/` reads them. The lineage
half of this is wiring rather than new ground: `src/engine/world/lineage.ts` exists, regions
already use clan surnames, and `named-figures.ts` carries a member who shares a surname with the
sealed ancestor beneath his stone. This model
is the first thing that gives them something to do, and it does it without a special case.

---

## What of this the engine actually holds

<!-- tier: 3 -->

**Read this before building on the above.** Most of this document is design, and a reader who
mistakes it for a description of the running world will build on sand.

| Piece | State |
|---|---|
| **Realm as the perceptual axis** | **exists**, everywhere |
| **`KnowingStage`** - the reference axis, per subject | **exists**, `src/engine/social/discovery.ts` |
| **`RESERVED_SURNAMES`** - lineage names never rolled | **exists**, `src/engine/world/history.ts`; **no consumer yet** |
| **`surnameOf`** - reading a family off a name | **exists and has zero callers.** Nothing in the engine reads a surname as a lineage |
| **Recognising whose art you just watched** | **does not exist.** The strongest check in the hierarchy is entirely unimplemented |
| **Life plates, and tokens that shatter** | **do not exist** anywhere in the repo |
| **A jade tag carrying a house's name** | **does not exist** as an identity object |
| **Sealed ancestors** | **in the catalogs** - `SECT_ANCESTRY.dormant`, `HELD_INSTRUMENTS`, `UNOWNED_ANCESTORS` - and **nothing in `src/engine/` reads them** |

**The encouraging half:** both axes already exist, so this model is a *reading* of state the
world keeps rather than new state it would have to grow. **The discouraging half:** every check
above the weakest rung is unbuilt, and the lineage half has a function with no callers - which
is this project's signature defect, written down here so the next person does not rediscover it.
