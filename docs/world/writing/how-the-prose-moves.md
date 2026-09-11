<!-- tier: 3 -->

# How the prose moves

Tier 3 on purpose: this is a reference for whoever is writing the tier-1 voice guidance or
tuning the narrator, not something to ship in a prompt. It is long because it is an
argument; the prompt gets the conclusions.

[`tone.md`](./tone.md) covers the register and the vocabulary. This covers the **motion** -
sentence length, paragraph shape, who talks, where the beats fall. The two are independent,
and the second is the one the narrator keeps getting wrong: a played turn came back as

> Clear River Ford. The air here is thick enough to notice on the first breath. Whatever is
> under this ground is close to the surface, and the ground shows signs of being worked. It
> is an ordinary day and it intends to stay one.

Every fact in that is correct and every existing rule is obeyed. It reads like a quiet
literary novel in English. The genre does not move like that, and the design owner's ruling
is that the whole game has to feel like the genre, not only the opening.

The properties below were taken from reading translated cultivation web novels and writing
down what the prose actually does. Every example here is rendered into this world's own
places and people; none of it is quoted from anywhere.

## What has now been measured, and what has not

The first version of this page was written off the opening chapters of a **single work**,
which is enough to catch the loud properties - paragraph length, dialogue tags, address by
rank - and not enough to tell a genre convention apart from one author's habit.

**It has since been measured across twenty-four books: 311,360 paragraphs and 789,521
sentences.** Twenty-two of those are professionally translated and are one author's work,
in three series - one of twelve volumes, one of nine, and one of a single volume. The other
two are held out as a control: one volume by a different author with a different translator,
and one fan-edited machine translation. Where the groups disagree the disagreement is stated
below, because a property that holds only in the machine translation is an artefact of the
machine.

**Two measuring rules, both learned the hard way and both load-bearing:**

- **Weight books equally; do not pool raw paragraphs.** The corpus runs from 2,821 to 90,580
  paragraphs a book, so a pooled average is mostly the longest book's opinion. Every figure
  below that differs meaningfully between the two is given both ways, and the guidance
  follows the per-book mean.
- **Keep a per-book sanity floor on dialogue.** Any book reporting under 10% dialogue
  paragraphs is a broken detector, not a quiet author. See the defect below.

**Four claims on this page were measurably wrong and are corrected in place**, each marked
where it sits. They are kept rather than quietly replaced, because a rule that was reversed
is worth being able to tell from one that never moved. The tier-1 section in
[`tone.md`](./tone.md) carries the same four corrections and the same marking.

What is measured and what is still a hypothesis:

| Measured across all twenty-four | Still read rather than counted |
|---|---|
| paragraph and sentence length, and what a long paragraph contains | *address by rank* - counting honorifics is easy, counting whether one was used *instead of* a name is not |
| dialogue share, untagged share, which tags are used | *the strong are deadpan* - a claim about characterisation, not a countable form |
| sentence-opening connectives | *a price reverses a refusal* - a plot shape, observed repeatedly and never counted |
| exclamation, question mark and ellipsis rates, split between speech and narration | *the crowd is one body* - same |
| subordinators, commas, participial openers, existential openers | |

**A defect in the first measuring pass is worth recording, because it is the shape this
repo keeps finding.** The sampler tested for dialogue by looking for the curly left double
quote. One book in the corpus is typeset with straight quotes throughout - 77,279 of them
against 1,914 curly - so it reported **1.8% dialogue paragraphs**, which is not a style a
novel can have. Corrected, that book reports 37.1%, the highest in the corpus, and it moved
the pooled untagged-dialogue figure by eight points. The suspicion was first raised as an
encoding fault; every file in the corpus decodes as clean UTF-8 with zero replacement
characters, so that theory was wrong and the real fault was a detector that only knew one of
the two ways a book can be typeset. **A per-book sanity floor catches this and a pooled
average never will.**

A second defect, one size up, and it is the reason the equal-weighting rule exists: **for a
while the corpus was two thirds one book by paragraph count.** Every pooled figure was that
book reporting on itself with twenty-three others as a rounding error. Nothing in a pooled
average announces this; the number looks like a corpus.

Working material is kept in `reference-material/` at the repo root, which is gitignored in
its entirety and may not exist at all. It explains itself if it is there.

Bring back properties and re-rendered examples only. No titles, no authors, no distinctive
invented terminology from any single work, and no verbatim passages - the design is the
owner's own amalgamation and the repo names none of its sources. This page has already had
one near-verbatim line and one lifted character name caught in it and removed.

---

## Sections

| Section | What it covers |
|---|---|
| [Paragraphs are short, and the long one reasons](#paragraphs-are-short-and-the-long-one-reasons) | The single highest-leverage change, and the correction to it |
| [Sentences are declarative and stack verbs](#sentences-are-declarative-and-stack-verbs) | Clause structure |
| [The prose argues](#the-prose-argues) | Sentence-opening connectives, the biggest thing this page missed |
| [Dialogue carries the scene](#dialogue-carries-the-scene) | The description-to-speech ratio |
| [Say "said", and usually say nothing](#say-said-and-usually-say-nothing) | Dialogue tags, against English style advice |
| [Speech is loud](#speech-is-loud) | Punctuation, and how much of it there is |
| [Address by rank, not by name](#address-by-rank-not-by-name) | The strongest genre marker there is |
| [Interiority is flat, physical, and often long](#interiority-is-flat-physical-and-often-long) | Against lyrical inwardness, and the correction to the length rule |
| [The copula is ordinary, and was wrongly banned](#the-copula-is-ordinary-and-was-wrongly-banned) | *It is* / *There is*, and which voice the ban belongs to |
| [Refusal is short](#refusal-is-short) | And the engine is the worst offender |
| [A price reverses a refusal, and nobody is ashamed](#a-price-reverses-a-refusal-and-nobody-is-ashamed) | |
| [The strong are deadpan, the weak emote](#the-strong-are-deadpan-the-weak-emote) | How power reads on the page |
| [Terms are stated in full, by a person](#terms-are-stated-in-full-by-a-person) | How this coexists with "show, never explain" |
| [Cut to the next time](#cut-to-the-next-time) | Scene transitions |
| [The crowd is one body](#the-crowd-is-one-body) | Handling a room full of people |

---

## Paragraphs are short, and the long one reasons

**One to three sentences, most of the time.** Measured across twenty-four books: the median
paragraph is **2 sentences in twenty of them and 3 in the other four**; 61.9-89.6% of
paragraphs are three sentences or fewer, mean **78.7%**; 16.4-42.9% are a single sentence,
mean **27.1%**. The median sentence runs 11-15 words. A four-sentence paragraph is a long
one.

This is still the single change that does most of the work, because it forces the others:
you cannot build a mood across half a page if the paragraph ends.

**But those are corpus-wide figures, and the corpus is not one height.** The per-book mean
of 78.7% three-or-fewer is the MIDDLE of the ladder with the bottom averaged into it, and a
narrator given it as an unconditional rule writes the top of the ladder at the bottom of it.
Re-cut by band, against the same books
([`what-changes-as-the-ladder-is-climbed.md`](./what-changes-as-the-ladder-is-climbed.md)
holds the banding and the rest of the height findings):

| per-book mean | bottom | middle |
|---|---|---|
| three sentences or fewer | 70.4% | 84.2% |
| four or more | 29.7% | 15.8% |
| four or five | 21.2% | 13.1% |
| six or more | 8.4% | 2.8% |
| one sentence | 22.8% | 29.7% |
| mean words in a paragraph | 37.9 | 32.2 |
| median sentence, in words | 12.7 | 13.2 |

The four-plus share falls monotonically book by book across one whole arc - 21.5%, 18.3%,
16.2%, 12.3%, 10.4% - and halves across the other, so it clears the both-arcs bar the
height page applies. **The median sentence does not move even inside the band that has the
longest paragraphs**, which is the strongest form of the sentence/paragraph split on this
page: the two are measured to be independent in the one place they could most easily have
been confounded.

The narration above is four sentences welded into one block. Broken the way the genre breaks
it, the same facts move:

> Clear River Ford.
>
> The qi here is thick. It presses on the skin, close under the ground, and the ground has
> been worked over for it.
>
> An ordinary day.

### Corrected: the six-sentence paragraph, which this page said does not occur

It occurs **16,687 times** across twenty-four books - 1.6% to 12.0% of paragraphs depending
on the book, per-book mean **4.7%**, and it is never zero in any book. **6,858 of them
contain no speech at all**, so they are not a quoted exchange wearing a long paragraph's
shape. The claim was false, and it was the most expensive thing on this page, because it
banned a paragraph the genre uses constantly.

**What a long paragraph here always is: assessment.** Who suspects what, what something is
worth, what follows from what, what it would cost, why the obvious reading is wrong. One
sampled paragraph runs, in substance: a powerful figure declines to pry into how somebody
advanced; it was not that he was slow to work it out; it was that the man's record was
clean; therefore there was nothing to tie him to the one who ran. Four sentences of pure
calculation and not one image in it.

Re-rendered into this world, and this is the shape to copy:

> The elder does not ask how the boy reached the third rung in a year. It is not that he
> cannot work it out. It is that the boy's house has never been in anything, his master is
> three years dead, and nobody has come to the gate asking after him. Therefore there is
> nothing to tie him to the business at the ford. The elder writes the name down and goes
> on to the next one.

Five sentences. Every one of them short. No mood, no image, and a conclusion at the end
that changes what somebody does.

**The rule that survives is the sentence, not the paragraph.** A long paragraph in this
genre is six short declaratives in a row; it is never three long ones. Subordinators run at
0.03-0.06 per sentence across the corpus and commas at 0.58-0.99, per-book mean 0.83 - both
flat whether the paragraph is one sentence or eight. **The paragraph got longer and the
sentence never did**, which is exactly why the long paragraph does not read as English
literary prose.

So the rule to give a narrator is not a length. It is: **the paragraph may run as long as
the reasoning does, and it may not run one sentence past it.**

### How strong this correction is, now that there are twenty-four books

Widening the corpus confirmed the correction and **narrowed how strongly it can be stated**,
which is worth being explicit about rather than leaving in a figure.

*Six does not occur* is still flatly false: long paragraphs appear in **every book measured**,
and in the twelve-volume series alone there are 1,744 of them. But the **speechless** long
paragraph - the pure reasoning block, with no quoted line in it - is distributed very
unevenly:

| | long paragraphs | of those, speechless |
|---|---|---|
| the twelve-volume series | 1,744 | 273 (**15.7%**) |
| the nine-volume series | 4,434 | 1,166 (**26.3%**) |
| the single-volume one | 5,240 | 3,355 (**64.0%**) |

One book supplies about seventy per cent of the professionally translated corpus's
speechless long paragraphs. **So the long reasoning block is a real and available move in
this genre, and it is not the default.** Treat it as a register the narrator may reach for
when there is genuinely something to work out, rather than as a shape to hit regularly. The
short paragraph is still the house style, by a wide margin, in every book measured.

This is the same trap [the top of this page](#what-has-now-been-measured-and-what-has-not)
warns about, arriving from the other side: the first version over-generalised one work's
habit into a ban, and a corpus of sixteen could have over-generalised one work's habit into
a licence.

**And this qualification does not contradict the band table above, which is the thing worth
checking.** The single volume supplying about seventy per cent of the professional corpus's
speechless long paragraphs is itself a book one, so it sits in the bottom band - which could
have meant the bottom band's whole extra length was that one book's habit. It is not. Split
by what is inside the long paragraph:

| per-book mean, share of ALL paragraphs | bottom | middle |
|---|---|---|
| four or more sentences, with speech in it | 13.3% | 8.3% |
| four or more sentences, speechless | 16.4% | 7.6% |

Both halves are roughly twice the middle's, and the speechless share OF long paragraphs
swings 15% to 64% across the three bottom-band books while the four-plus share itself moves
monotonically in both arcs. **So the band governs how long a paragraph may run, and the work
governs whether a long one is a reasoning block.** Those are two different rules and neither
licenses the other: at the bottom take the room, and still write the pure reasoning block
only when there is genuinely something to work out.

## Sentences are declarative and stack verbs

Subject, verb, object. Where a sentence grows, it grows by **adding another verb**, not by
adding a clause that qualifies the first one.

- English-novel: *Having fetched a chair from inside, which he wiped carefully with his
  sleeve out of an eagerness he would have been embarrassed to admit to, he set it down.*
- This genre: *He hurried inside, took out a chair, set it by the table, and wiped it with
  his sleeve.*

Four verbs, one line, no interpretation offered. The eagerness is visible in the wiping and
is never named.

Measured: the median sentence runs 11-15 words. Subordinators - *although, though,
whereas, because, since, unless* - run at **0.03 to 0.06 per sentence**, so fewer than one
sentence in sixteen carries one even at the top of the range. Commas run at **0.58 to 0.99
per sentence**, per-book mean 0.83.

**Softened: the participial opener.** This page used a fronted participle as its *Wrong*
example, which implied the construction is absent. It is not - it opens about **4 sentences
in 100** (per-book mean 3.9, range 2.55 to 5.41), so it is ordinary and uncommon rather than
forbidden. What made the example wrong was the stack: a fronted participle AND a relative
clause AND a parenthetical motive, all before the verb. One participle is fine. Two, or one
carrying a relative clause, is the English-novel tell.

## The prose argues

**The largest property this page missed, and the easiest to copy.** The narration constantly
states which fact follows from which, with a logical connective at the front of the
sentence. Counted across twenty-four books, **51,804 sentence-opening connectives**: per-book
mean **7.8 per 100 sentences**, pooled 6.6, per-book range 3.1 to 12.0. So **roughly one
sentence in thirteen** opens on one, and no book in the corpus goes below one in thirty-two.

Counts below are over all twenty-four books.

| Connective | Count | What it does |
|---|---|---|
| However | 13,702 | the reversal |
| Although | 4,985 | the concession, taken at the front of the sentence |
| As for | 4,615 | the pivot to a new subject without a paragraph break |
| At the same time | 3,966 | the second thing that is also true |
| After all | 3,914 | the reason, supplied after the claim it justifies |
| Furthermore | 3,198 | the escalation |
| In fact | 2,907 | the correction upward |
| Thus | 1,908 | the consequence |
| Of course | 1,872 | the thing the reader should already have known |
| Therefore | 1,778 | the consequence, stated formally |
| Meanwhile | 1,556 | elsewhere |
| And yet | 1,047 | the reversal, with the narrator's thumb on it |

Four of these carry nearly all of it, and each has a shape:

> **After all** - the claim, then its reason. *Nobody at the ford will carry for him. After
> all, the last man who did is still owed.*
>
> **However / Although** - the concession, usually opening the sentence rather than hinging
> it. *Although the price is fair, nobody is buying.*
>
> **Therefore / As a result / Thus** - what follows. *The elder has not answered. Therefore
> the matter is not settled, and everybody in the room knows it.*
>
> **As for** - the pivot. *As for Jiang Peizhi, he has not looked up from the bowl once.*

*As for* is worth naming separately. English literary prose barely uses it; this genre uses
it 4,615 times, and it is how a short paragraph covers two people without a break between
them.

**And the correction frame, which is the same instinct inside a sentence.** A claim, then
the reason it is not what the reader would assume: *It was not that he could not work it
out. It was that the record was clean.* This is the single most characteristic sentence
pair in the corpus and it is what the long reasoning paragraph is usually built out of.

**Why this matters more than it looks.** The engine hands the narrator a list of facts, and
the failure mode this whole page exists to fix is narrating them in the order they arrived.
A connective is the cheapest available instrument against that, because you cannot write
*therefore* without having decided which fact follows from which. The rule *do not narrate
in the order you were given* is hard to obey; *say which one follows* is easy, and it
produces the same result.

## Dialogue carries the scene

After the opening few paragraphs of a scene, **most lines are people talking.** Description
sets the frame once and then gets out of the way. Where an English novel would spend a
paragraph on how a room feels, this genre puts two people in it and lets them speak.

For the narrator this is a hard budget: if a scene has somebody in it and the prose contains
no speech, the scene is being described rather than played.

Measured: **23.1% to 37.1% of paragraphs contain speech**, per-book mean 29.5%. That is a
floor rather than a target, because these are paragraphs and a long exchange is many of
them; what it establishes is that no book in the corpus goes a page without somebody
talking.

## Say "said", and usually say nothing

English style advice says vary your dialogue tags. **This genre does the opposite**, and
doing it the English way is one of the loudest tells. The tag is `said`, sometimes with a
short manner phrase, and it repeats without apology.

> "Second Brother, the Pavilion is taking disciples this year," the carter said seriously.
>
> "Taking disciples?" Fang Zhenshan said, his face pale.
>
> "It is that very Pavilion," the carter said, smiling.

Not *replied*, *murmured*, *interjected*, *offered*. Said, said, said.

**Measured, and the widened corpus turned this from a conditional into a statement.**
Counting tag words within 45 characters of a quoted span's edge - a loose count that scores
every occurrence of the word anywhere in the paragraph is wrong, because it reads *he
laughed*, *he continued walking* and *she spoke of it* as tags - across the **twenty-two
professionally translated books**:

> **said 13,043, against 8,937 for every other tag combined - 1.46 to 1.**
> Per-book mean ratio **1.40**, and the lowest of the twenty-two is **0.92**. The next
> single tag (*murmured*, 1,339) is outrun better than nine to one.

At sixteen books this could only be stated conditionally, because the pooled figure was a
tie. With twenty-two it holds in every book: no professionally translated volume in the
corpus drops *said* below rough parity with the entire rest of the field, and the average
book runs it at nearly half again.

**The control pair is what makes this worth knowing.** The different author runs 0.62. The
fan-edited machine translation runs **0.21** - it supplies 1,087 *laughed* and 874
*chuckled* on its own, and pooling it in is what dragged the all-24 figure down to 1.07.
**Tag variety is what a machine produces when nobody is choosing.** A language model left
alone produces the same variety for the same reason, which is precisely why this rule has to
be stated to the narrator rather than assumed.

### Corrected: most lines carry no tag at all

This page's tier-1 summary said *a third of spoken lines carry no tag*. **It is the
majority, and the claim was inverted.**

| | untagged quoted spans | dialogue paragraphs with no tag anywhere |
|---|---|---|
| all twenty-four, per-book mean | **65.0%** | 69.5% |
| the twenty-two professionally translated, per-book mean | **63.6%** | 68.4% |
| the same twenty-two, pooled | 62.3% | 67.8% |
| the control pair, per-book mean | 80.6% | 82.4% |

Per book the untagged share runs **53.7% to 87.4%**, and **it never falls below half in any
book in the corpus**. **The untagged line is the default; the tagged line is the exception.**
Turn order carries who is speaking, and the tag turns up when the speaker changes in a way
the order does not make obvious, or when the manner is the point.

Widening from sixteen books to twenty-four moved this figure by about five points and did
not touch the rule.

This compounds with the rule above rather than competing with it: when a line does take a
tag, that tag is *said*.

## Speech is loud

Punctuation this genre uses far more heavily than English literary prose, and stripping it
out is a large part of why a played scene comes back sounding like a quiet novel.

Per 100 sentences, over the twenty-two professionally translated books. Books weighted
equally; the pooled figure is given where it differs, and it differs because the longest
books are the quietest ones.

| | per-book mean | pooled | per-book range |
|---|---|---|---|
| exclamation marks, overall | **16.0** | 12.5 | 5.6 - 26.3 |
| exclamation marks, in paragraphs containing speech | **29.0** | 24.5 | 10.8 - 48.1 |
| exclamation marks, in narration | **8.0** | 6.3 | 1.9 - 16.7 |
| question marks, in paragraphs containing speech | **10.8** | 10.1 | 7.0 - 16.6 |
| ellipsis | **6.8** | 5.9 | 3.2 - 14.1 |

The split is the finding, not the total. **Speech carries three to four times the
exclamation rate of the narration beside it**, and runs at roughly **one exclamation every
three to four spoken sentences**. People in this genre shout, object, refuse and are
astonished on the page, and none of it is remarkable; the narration around them stays level.
An exclamation mark in the narrator's own voice is the same defect as closing on the weather
- the narrator having a reaction the world did not supply.

Ellipsis is hesitation and being cut off, not trailing atmosphere. It belongs inside
quotation marks for the same reason the exclamation does.

> "Is it open? The pass - is it open?"
>
> "No."
>
> "Since when? I came four days -"
>
> "Since the day you set out," the gatekeeper says. "You could have asked at the ford."

## Address by rank, not by name

**Read, not counted.** This page has called it the strongest single marker since the first
version; that ranking is a reader's impression and has not been measured. Counting
honorifics is easy and would prove nothing - what matters is whether one was used *instead
of* a name, and nothing here counts that. It is unquestionably present throughout the
corpus. Treat the superlative as unconfirmed.

People address each other by relationship and
station constantly, and often exclusively: Second Brother, Fourth Uncle, Senior Sister,
Elder, Immortal, Young Master, Sect Master, Second Sister-in-Law. A name is used to
introduce somebody or to be rude to them.

Every such address is also a claim about who stands where, so the hierarchy stays visible in
every line of dialogue without any narration about it. A scene where two cultivators call
each other by bare given names is a scene asserting they are equals or enemies, which is
information the reader picks up for free.

The repo already tracks the relationships this needs. Use them.

## Interiority is flat, physical, and often long

Reaction is reported in one short sentence, usually as a body doing something.

> His heart trembled.
>
> He tightened his fists.
>
> He was confused, and then he was curious.

Not *a complicated feeling moved through him, part fear and part something he had no name
for yet*. The genre states the reaction and moves on.

### Corrected: interiority is not limited to one sentence

This page, and the tier-1 rule taken from it, said interiority is **one short sentence**.
The *reaction* is. **The assessment is not**, and the assessment is most of what this genre
does inwardly. See [the long paragraph](#corrected-the-six-sentence-paragraph-which-this-page-said-does-not-occur):
6,858 speechless paragraphs of six or more sentences, and reading them, they are almost all
somebody working out what follows.

So the rule has two halves and only one of them was right:

| | |
|---|---|
| **It assesses** | true, and it is the whole rule. What it costs, who is above you, what is worth taking, who to stay away from, why the obvious reading is wrong |
| ~~**One short sentence**~~ | false. It runs as long as the calculation takes |

What stays constant through a long one is the sentence: short, flat, declarative, one
conclusion per sentence, no image. What it may never become is **musing** - a feeling
examined for its own sake, an atmosphere, a question with no answer coming. A cultivator
prices a room. He does not wonder about one.

> **Musing.** The years he had spent at the ford settled on him, and for a moment he could
> not have said whether what he felt was grief or only tiredness.
>
> **Assessing.** He has been at this ford eleven years. The ones who arrived after him are
> ahead of him now. They got there by leaving, and he did not. Whatever he does about that,
> he will have to do it before the intake closes.

Both are four lines of a man's inner life. Only the second one ends somewhere.

**For the narrator specifically:** a long inward paragraph is more room to be wrong in, not
licence to fill it. Every fact in it has to be one the engine handed over. A reasoned
paragraph that reaches a conclusion nobody gave you is the worst version of breaking the
name and discovery gate, because it arrives with its own argument attached and reads as
authoritative.

## The copula is ordinary, and was wrongly banned

The tier-1 section used to say *It is*, *There is* and *The day* are **the loudest signal of
the wrong genre**. Two of those three are wrong.

Measured across the corpus, existential and copula sentence openers:

| Opener | Count | per 100 sentences |
|---|---|---|
| It was | 14,761 | 1.87 |
| There were | 3,098 | 0.39 |
| There was | 2,807 | 0.36 |
| It is | 700 | 0.09 |
| all six forms | 21,986 | **2.78** pooled, **2.61** per-book mean |

Per book the range is 1.72 to 4.01 per 100, and **no book in the corpus is anywhere near
zero.** The corpus narrates in the past tense, so its *It was* is the construction our
present-tense prose renders *It is*. At about 2.7 per 100 it turns up roughly once every 37
sentences, and it carries most of the explanatory frames in the section above - *It was not
that he could not work it out*, *It was a monumental matter*, *It was the eighth month and
the heat had not broken*. **The genre uses it freely and plainly.**

**What was actually wrong** with the openings this page was written against was neither of
those. It was two other things, in the same sentences:

| The real defect | The sentence it was found in |
|---|---|
| closing on the day's temper | *The day asks nothing in particular* |
| the reader's own interiority written as scenery | *There is nothing here they would notice, because it is what noticing has always been measured from* |

The copula was present in both and was not the fault. Banning it cost the narrator a
sentence shape the genre uses constantly and fixed nothing.

**Two voices, and the rule is different for each.**
`tests/web/the-engine-does-not-close-on-the-weather.test.ts` bans `It is` and `There is` as
sentence **openers**, and that guard is correct and should stay. It reads **engine-authored**
strings: one line, stating one fact, with no room to spend on an existential frame, and the
engine has no paragraph in which to earn one. The narrator has a paragraph. **That guard is
about the engine's voice; this page is about the narrator's**, and the two rules differing
is the correct outcome rather than a contradiction to reconcile.

## Refusal is short

A refusal lands in as few words as possible, is not softened, and is not explained.

> The elder's hand touched the first boy's head. "No good. Left."
>
> "No good. Left."
>
> "No good."

Three people, four words between them, no cushioning and no apology. The cruelty is entirely in the
brevity, and a narrator that writes *he regarded the young man for a long moment before
telling him, not unkindly, that he did not think it would be possible* has removed the only
thing that made it land.

**The engine is the worst offender here**, because a refusal it composes tends to arrive as
a full explanation of why the refusal happened. The explanation belongs in the ruling, which
the player can read. The prose gets the two words.

## A price reverses a refusal, and nobody is ashamed

A refusal is real and it is also **negotiable**, and the genre treats the reversal as
completely ordinary rather than as corruption.

> The elder pressed his hand to the boy's head. "Talent is lacking. Not-"
>
> The boy had the jade box open before the sentence finished. "Elder, my father found this
> in the hills and could never open it."
>
> The elder's eyes narrowed. "Three hundred years, at least. And sealed by a cultivator, so
> of course he could not." He paused. "I am short a hand in the pill room. Are you willing?"

Nobody in the scene finds this shocking, nobody comments on it, and the boy is not written
as having debased himself. This is how the world works. It is also exactly the shape the
engine needs for an ask that is refused on the merits and then met with an offer.

## The strong are deadpan, the weak emote

Power is written as **absence of reaction**. The elder is emotionless, deadpan, unhurried;
the fifteen-year-olds tremble, go pale, weep, and are removed for weeping. Nothing tells the
reader who outranks whom; the difference in how much face each of them shows does it.

This is also how to write somebody very powerful entering a room without writing awe. They
do not radiate anything. They simply do not react, and everybody else does.

## Terms are stated in full, by a person

The one place flat exposition is not only allowed but correct: **a character stating terms.**

> "Follow the steps up. Reach the top and you are qualified. Three days, or you fail. Those
> who fail go back to their families. If you cannot go on, shout, and somebody will come."

Conditions, limit, failure, escape hatch, in four sentences and no hedging. This does not
break *show, never explain*, because the rule about explanation governs the NARRATOR'S
voice. A person with authority laying out what they require is showing you who they are.

So where the engine has real terms - a price, a term of service, a bar to clear - putting
them in somebody's mouth like this is both accurate and in register.

## Cut to the next time

Scene transitions are blunt and short. **"That night." "The next morning." "Half a month
passed."** No fade, no lingering final image, no paragraph of travel.

Occasionally a transition carries one line of village wisdom, stated as general truth:

> There are no secrets in a village that size. By evening everybody knew, including people
> nobody had told.

## The crowd is one body

A room full of people reacts as a single reported mass, and then one or two individuals are
picked out of it.

> All of them cried out at once.
>
> The faces of the ones sent to the left went grey.

This matters for this engine, which frequently knows about a dozen people standing in a
square. The genre answer is not to list them. It is one sentence for the crowd, then the one
person the scene is actually about.

---

## Related

- [`tone.md`](./tone.md) - the register, the humour requirement, the naming conventions, and
  the vocabulary this world uses for itself.
- [`NARRATOR-CORE.md`](../NARRATOR-CORE.md) - the rules that outrank everything here. Nothing
  on this page licenses inventing a name, an outcome, or a mechanism.
- [`normal-in-the-cultivation-world.md`](../normal-in-the-cultivation-world.md) - what the
  people in this world consider unremarkable, which is most of what makes the tone land.
