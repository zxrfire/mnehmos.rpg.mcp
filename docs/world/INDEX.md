<!-- tier: 3 -->

# Where is it written down?

**Start here before you write any design prose.** This file answers one question -
*has somebody already decided this, and where did they put it* - and it is the answer
to a failure that cost real work three times in one evening.

## Why this exists

Three agents, one evening, all on the same subject area:

1. Somebody needed the Hollow Court's holdings, searched `docs/`, found nothing,
   **invented an answer, wrote it into `trust.md` and relayed it to another agent**
   who was about to render it into the UI. It had to be retracted. The real answer was
   in two places the whole time: `src/data/cultivation/crossings.ts` (the Court's records
   are its strength) and [`past-the-ceiling.md`](past-the-ceiling.md#the-hollow-court-is-the-exception-to-all-of-it).
2. A retraction was mis-stated and a correct passage in `past-the-ceiling.md` came within
   one dispatched agent of being deleted.
3. Somebody needed the rule for what happens when a house catches you using its art,
   could not find it, and started writing it into `trust.md`. It was written, in
   [`items.md`](items.md#holding-is-a-signature) - **and that agent had read that exact
   passage an hour earlier in the same session.**

The third one is the diagnosis. This is not people skipping the docs.

> **The material is filed by NOUN and searched for by QUESTION.**

What happens when you are caught practising a stolen art lives under *Items*, because a
manual is an object. That is correct filing and useless retrieval. Nobody with that
question searches a file called `items.md`, and no grep for the topic words lands there.

The fix already existed and nothing surfaced it. Every section in this directory carries a
`<!-- tier: N trigger="..." -->` marker, and **the trigger is the question in plain
English**. `items.md`'s reads *"somebody is seen with, or practising, something that is
not theirs"* - exactly the sentence that could not be found a file for. There are around
two hundred of them and they were readable only by grepping for the marker syntax.

So the table below is every one of them, in one place, sorted by the situation.

## How to use this file

**Ctrl-F for the situation, not for the noun.** Search the way you would describe what is
happening at the table - "caught", "leaves a sect", "asks a price", "nobody recognises" -
and read the trigger column. The triggers were written to be the sentence a scene makes
true.

Two things to know before you conclude something is unwritten:

- **A large part of the design record is not in `docs/` at all.** It is in header comments
  and prose constants in `src/data/cultivation/*.ts`, which no search of `docs/` reaches.
  The [catalog table](#the-catalogs-design-material-that-is-not-in-docs) below is the
  index for those. Measured at the time of writing: those files carry more words of
  comment prose than the whole of `docs/world/` carries of everything.
- **If you find two places that disagree, report it. Do not resolve it.** Two
  contradictions were found in one evening and both needed the owner's ruling.

---

## The questions that have cost us work

Hand-maintained. These are the specific things somebody looked for and could not find, and
where the answer actually was. Add a row whenever a search fails and the answer turns out
to exist.

| The question | Where the answer is |
|---|---|
| What happens when a house catches you practising an art that is not yours | [`items.md` - Holding is a signature](items.md#holding-is-a-signature). Three outcomes, by whose art it is |
| What the Hollow Court is, why it takes who it takes, and why leaving for it costs nothing | [`past-the-ceiling.md` - The Hollow Court is the exception to all of it](past-the-ceiling.md#the-hollow-court-is-the-exception-to-all-of-it) |
| Who the Court's four seats actually are, and at what ordinal | `WITHDRAWN_POWERS` in [`src/data/cultivation/sects.ts`](../../src/data/cultivation/sects.ts). **Named nowhere in `docs/`** |
| Who is standing on the four mountains below the seats, and why standing inside is invisible from outside | [`src/data/cultivation/hollow-court-roster.ts`](../../src/data/cultivation/hollow-court-roster.ts), file header |
| Why the Court's decline is medium rather than terminal - the records argument | `ARCHIVE_AS_CLAIM` in [`src/data/cultivation/crossings.ts`](../../src/data/cultivation/crossings.ts) |
| How many rungs the ladder has | `MAX_ORDINAL` in [`src/engine/cultivation/realms.ts`](../../src/engine/cultivation/realms.ts). **Never restate it in prose** |
| What an art can do at each height, and what that escalation is *in kind* | [`techniques.md`](techniques.md) |
| Why nobody at the top of the world moves | `WHY_NOBODY_MOVES` in [`src/data/cultivation/the-top-of-the-world.ts`](../../src/data/cultivation/the-top-of-the-world.ts). Not in `docs/` |
| What a False Immortal is, how a seat is identified, how many there are | [`src/data/cultivation/false-immortals.ts`](../../src/data/cultivation/false-immortals.ts). Partly in [`immortals.md`](immortals.md) |
| What crosses the Lid, and the two crossings nobody makes | [`immortals.md` - What crosses the Lid](immortals.md#what-crosses-the-lid) |
| Whether a signal can be forged, and what a token is worth | [`trust.md`](trust.md) - and note it is **not listed in [`README.md`](README.md)** |
| What a ruin, sealed cave or abandoned seat is, and the inheritance economy | [`closed-ground.md`](closed-ground.md) - also **not listed in [`README.md`](README.md)** |
| What a favour buys at an admission bar, and the one house where it buys nothing | [`origin.md`](origin.md) and [`src/data/cultivation/a-favour-skips-the-admission-bar.ts`](../../src/data/cultivation/a-favour-skips-the-admission-bar.ts) |
| What a house can teach against what it can hold on its shelf | [`manuals.md`](manuals.md). Teaching capacity as a separate number is in `AGENTS.md` and the catalogs, **not in `docs/world/`** |

---

## Every situation, and the section that answers it

Generated from the `trigger` attributes in this directory. Do not edit by hand - run
`node scripts/build-world-index.mjs`.

<!-- BEGIN GENERATED: triggers -->

**199 situations, from 22 files.**
Sorted by the situation, not by the file, because the file is the thing you do not know.

| When this is true | Read | Section |
|---|---|---|
| a birth is irregular, somebody is carrying shame, or a placement has no institutional reason behind it | [`origin.md`](origin.md#the-second-reason-which-is-not-a-bar) | The second reason, which is not a bar (tier 2) |
| a building's element is read off it, or somebody assumes a house is built to suit its people | [`architecture.md`](architecture.md#elemental-architecture-is-a-function-of-intake-not-of-occupants) | Elemental architecture is a function of intake, not of occupants (tier 2) |
| a character is being made, or somebody's birth is raised as an explanation | [`origin.md`](origin.md#birth-is-the-third-dealt-thing) | Birth is the third dealt thing (tier 2) |
| a child is being placed at a house whose bar they do not meet, or somebody asks how they got in | [`origin.md`](origin.md#somebodys-word-and-the-bar-it-skips) | Somebody's word, and the bar it skips (tier 2) |
| a cultivator considers changing house, is offered a place elsewhere, or leaves one | [`past-the-ceiling.md`](past-the-ceiling.md#leaving-and-what-it-costs) | Leaving, and what it costs (tier 2) |
| a cultivator considers copying a manual, or a house's last master of an art dies | [`manuals.md`](manuals.md#who-can-make-another-one) | Who can make another one (tier 2) |
| a cultivator discovers their path suits them badly, or considers changing it | [`understanding.md`](understanding.md#affinity-and-finding-out-too-late) | Affinity, and finding out too late (tier 2) |
| a cultivator forms, enters, or is caught inside a personal realm | [`understanding.md`](understanding.md#personal-realms) | Personal realms (tier 2) |
| a cultivator has run out of manual, or is deciding whether to go looking for one | [`past-the-ceiling.md`](past-the-ceiling.md#top-of-file) | (top of file) (tier 2) |
| a cultivator is deciding what to pursue, or has hit a ceiling they did not expect | [`understanding.md`](understanding.md#and-it-is-limited-by-what-you-can-reach) | And it is limited by what you can reach (tier 2) |
| a cultivator with no lineage holds a post, or is offered one | [`sects.md`](sects.md#guest-elders) | Guest elders (tier 2) |
| a cultivator with standing has a child to place, or a placed child asks who arranged it | [`origin.md`](origin.md#spending-one-on-your-own-child) | Spending one on your own child (tier 2) |
| a cultivator's Dao, affinity, or chosen path is named, chosen, or challenged | [`understanding.md`](understanding.md#your-dao) | Your Dao (tier 2) |
| a Dao house is in play, or the player encounters karma, fate, oaths, names, or spatial authority as an institution | [`dao-houses.md`](dao-houses.md#top-of-file) | (top of file) (tier 2) |
| a Dao house or deep-foundation library is opened to the player, or refuses to be | [`past-the-ceiling.md`](past-the-ceiling.md#6-being-let-into-a-house-of-accumulated-knowledge) | 6. Being let into a house of accumulated knowledge (tier 2) |
| a decree is attempted and its limits are being tested | [`techniques.md`](techniques.md#the-three-things-a-decree-cannot-say) | The three things a decree cannot say (tier 2) |
| a disciple is admitted, promoted, favoured, or refused a book | [`manuals.md`](manuals.md#a-shelf-and-who-reaches-up-it) | A shelf, and who reaches up it (tier 2) |
| a disciple is being sent up, recruited away, or handed over between houses | [`sects.md`](sects.md#moving-up-the-feeder-relationship) | Moving up: the feeder relationship (tier 2) |
| a fact about an object has to be shown to somebody, and the question is where it goes | [`items.md`](items.md#the-almanac-and-the-ledger) | The almanac and the ledger (tier 2) |
| a great house's heir is failing, or the player resents somebody's birth | [`origin.md`](origin.md#the-children-of-great-houses-mostly-fail-anyway) | The children of great houses mostly fail anyway (tier 2) |
| a house asserts a shelved book works when nobody there can open it | [`techniques.md`](techniques.md#they-know-it-works) | "They know it works" (tier 2) |
| a house claims an ancestor who crossed the Lid | [`sects.md`](sects.md#immortal-lineages) | Immortal lineages (tier 2) |
| a house controls the way in, and the player must pay, join, or serve to enter | [`ruins.md`](ruins.md#access-disciples-only-a-fee-or-a-task) | Access: disciples only, a fee, or a task (tier 2) |
| a house finds a lost material and considers sending it up an answering channel | [`ancient.md`](ancient.md#the-trade-material-up-a-pill-back) | The trade: material up, a pill back (tier 2) |
| a house holds a manual it cannot supply, or the player is offered a book with no stock behind it | [`ancient.md`](ancient.md#the-library-that-holds-the-book-and-none-of-the-material) | The library that holds the book and none of the material (tier 2) |
| a house holds something nobody in it can use, and somebody asks why they do not sell it | [`items.md`](items.md#why-a-holder-keeps-what-they-cannot-use) | Why a holder keeps what they cannot use (tier 2) |
| a house holds territory with nothing beneath it | [`sects.md`](sects.md#direct-rule-a-backer-with-no-subsidiaries) | Direct rule: a backer with no subsidiaries (tier 2) |
| a house is obeyed in territory it does not formally hold | [`sects.md`](sects.md#direct-rule-by-deference) | Direct rule by deference (tier 2) |
| a house with no vein and no accounts reliably turns out strong disciples | [`techniques.md`](techniques.md#the-starkest-case-which-nobody-authored) | The starkest case, which nobody authored (tier 2) |
| a house's ancestors are counted, claimed, or woken | [`sects.md`](sects.md#two-kinds-of-ancestor) | Two kinds of ancestor (tier 2) |
| a house's greatest living expert dies, or somebody expects a discipline to die with its holder | [`dao-houses.md`](dao-houses.md#and-it-outlives-its-experts) | And it outlives its experts (tier 2) |
| a house's library has outrun its living teachers, or a lineage has had a thin generation | [`techniques.md`](techniques.md#the-two-reasons-a-house-ends-up-in-this-state) | The two reasons a house ends up in this state (tier 2) |
| a house's longevity holdings are counted, spent, or bargained over | [`ancient.md`](ancient.md#who-holds-one) | Who holds one (tier 2) |
| a house's principle is brought to bear somewhere other than a fight | [`dao-houses.md`](dao-houses.md#the-principle-must-operate-outside-combat) | The principle must operate outside combat (tier 2) |
| a house's sealed one-off power is asked after, or the player finds the vault it sleeps in | [`architecture.md`](architecture.md#the-sealed-ceiling-is-a-place) | The sealed ceiling is a place (tier 2) |
| a house's strongest member stands far above what it can produce, or a cultivator needs materials | [`manuals.md`](manuals.md#what-a-house-can-teach-and-what-it-can-supply) | What a house can teach and what it can supply (tier 2) |
| a knowledgeable NPC sees what the player is practising | [`ancient.md`](ancient.md#the-upkeep-is-legible-and-that-is-the-point) | The upkeep is legible, and that is the point (tier 2) |
| a longevity pill's grade, price, or the years it buys is in question | [`ancient.md`](ancient.md#the-ladder) | The ladder (tier 2) |
| a manual is held, taught, bought, copied, refused, or found; or somebody asks how far a book or a house can carry them | [`manuals.md`](manuals.md#top-of-file) | (top of file) (tier 2) |
| a manual survives only in scattered volumes, or the player holds a gapped set | [`past-the-ceiling.md`](past-the-ceiling.md#1b-the-scattered-set) | 1b. The scattered set (tier 2) |
| a manual's ceiling is reached, quoted, or compared to another's | [`manuals.md`](manuals.md#where-books-stop) | Where books stop (tier 2) |
| a medicine is created, priced, stocked, or refused; or somebody asks how to mend an injury | [`items.md`](items.md#how-rare-a-medicine-should-be) | How rare a medicine should be (tier 2) |
| a medicine is refined or attempted, or somebody asks why a grade of medicine is rare | [`items.md`](items.md#who-is-allowed-to-make-it) | Who is allowed to make it (tier 2) |
| a party arrives with elders, boats, or anything nobody could plausibly afford to fake | [`trust.md`](trust.md#expensive-signals-and-forging-one) | Expensive signals, and forging one (tier 2) |
| a player picks up, is offered, or is seen practising an ancient art | [`ancient.md`](ancient.md#what-an-ancient-art-costs) | What an ancient art costs (tier 2) |
| a powerful figure could act on the player directly and does not | [`people.md`](people.md#the-powerful-act-indirectly) | The powerful act indirectly (tier 2) |
| a price is quoted, or the player asks what something is worth | [`economy.md`](economy.md#what-things-cost) | What things cost (tier 2) |
| a recent disaster has left a site, or a ruin's age is in question | [`ruins.md`](ruins.md#not-every-ruin-is-ancient-and-the-world-makes-more-of-them) | Not every ruin is ancient, and the world makes more of them (tier 2) |
| a recipe survives and its ingredient does not | [`ancient.md`](ancient.md#lost---they-have-the-recipe-just-not-the-materials) | Lost - they have the recipe, just not the materials (tier 2) |
| a route is refused, or the player asks why one is closed to them | [`past-the-ceiling.md`](past-the-ceiling.md#not-every-door-is-open-to-everybody) | Not every door is open to everybody (tier 2) |
| a route past a manual's ceiling is attempted, offered, or refused | [`past-the-ceiling.md`](past-the-ceiling.md#the-three-rules-every-route-obeys) | The three rules every route obeys (tier 2) |
| a ruin is being described, compared, or chosen between | [`ruins.md`](ruins.md#the-four-axes) | The four axes (tier 2) |
| a ruin's window is opening, closing, or being waited on | [`ruins.md`](ruins.md#convergence-a-ruin-is-not-a-place-you-can-go) | Convergence: a ruin is not a place you can go (tier 2) |
| a run opens with a placement the cultivator cannot account for | [`origin.md`](origin.md#opening-as-a-fostered-child) | Opening as a fostered child (tier 2) |
| a sect's motives, decisions, or internal politics are in play | [`sects.md`](sects.md#sects-are-institutions) | Sects are institutions (tier 2) |
| a sect's or clan's ancestry is being counted, claimed, or disputed | [`immortals.md`](immortals.md#immortal-lineages) | Immortal lineages (tier 2) |
| a sect's standing, prestige, ancestry, or vault is in question | [`sects.md`](sects.md#ancestral-records-and-the-millennial-offering) | Ancestral records and the millennial offering (tier 2) |
| a senior figure's own residence is entered, or status is being read off a building | [`architecture.md`](architecture.md#where-the-style-is-allowed-to-bend) | Where the style is allowed to bend (tier 2) |
| a stronger character declines to remove a weaker one | [`people.md`](people.md#why-didnt-the-stronger-person-just-kill-them) | Why didn't the stronger person just kill them? (tier 2) |
| a well-born cultivator's advantages are weighed, or somebody expects birth to buy rank | [`origin.md`](origin.md#what-privilege-actually-buys) | What privilege actually buys (tier 2) |
| a wound is created or graded | [`injuries.md`](injuries.md#two-families-of-wound) | Two families of wound (tier 2) |
| a wounded cultivator fights, cultivates, or attempts to understand something | [`injuries.md`](injuries.md#what-it-costs-and-what-it-cannot-touch) | What it costs, and what it cannot touch (tier 2) |
| always relevant; the compressed form is Tier 1 in NARRATOR-CORE.md | [`qi.md`](qi.md#top-of-file) | (top of file) (tier 2) |
| an ancient art and a modern one of the same height are set against each other | [`techniques.md`](techniques.md#era---and-this-one-is-the-guard-that-matters) | `era` - and this one is the guard that matters (tier 2) |
| an ancient art is on offer and the question is whether it changes a fight or changes the cultivator permanently | [`ancient.md`](ancient.md#two-kinds-of-ancient-art-and-the-second-is-the-more-interesting) | Two kinds of ancient art, and the second is the more interesting (tier 2) |
| an art can be named and dated and nobody holds a working copy | [`ancient.md`](ancient.md#no-surviving-copy---the-last-one-is-gone) | No surviving copy - the last one is gone (tier 2) |
| an art is used, taught, described, refused, or compared to another art; anybody asks what somebody at a given height can actually do | [`techniques.md`](techniques.md#top-of-file) | (top of file) (tier 2) |
| an art lands on many people at once and somebody takes that for height | [`techniques.md`](techniques.md#a-wide-swing-is-not-a-rung) | A wide swing is not a rung (tier 2) |
| an art written above the Lid turns up down here, or somebody asks whether immortals write elemental arts | [`techniques.md`](techniques.md#a-modern-immortal-art-is-possible-ill-suited-and-would-belong-down-here) | A modern immortal art is possible, ill-suited, and would belong down here (tier 2) |
| an immortal-grade object is held, wanted, asked for, or refused | [`items.md`](items.md#the-tier-nobody-here-makes) | The tier nobody here makes (tier 2) |
| an important character dies | [`people.md`](people.md#death-is-a-world-state-transition) | Death is a world-state transition (tier 2) |
| an inheritance is being opened, designed, or claimed | [`economy.md`](economy.md#inheritances-as-a-mechanism) | Inheritances as a mechanism (tier 2) |
| an inheritance was left stocked with its own supply, or somebody with no house behind them is far up a material-gated art | [`ancient.md`](ancient.md#stocked-inheritances) | Stocked inheritances (tier 2) |
| an NPC does something the player did not prompt, or the player asks what somebody wants | [`people.md`](people.md#npcs-are-protagonists-of-their-own-lives) | NPCs are protagonists of their own lives (tier 2) |
| an NPC talks past the player about things the player has never heard of | [`discovery.md`](discovery.md#characters-assume-you-know) | Characters assume you know (tier 2) |
| an NPC's goal, deadline, or obstacle is in play, or somebody dies with an unfinished aim | [`people.md`](people.md#goals-persist-and-outlive-their-holder) | Goals persist, and outlive their holder (tier 2) |
| an NPC's motives, allegiance, or willingness to do something ugly is in question | [`people.md`](people.md#morality-is-contextual) | Morality is contextual (tier 2) |
| an object changes hands, is bought, sold, copied, spent, hidden, or refused; or somebody asks what a thing is worth or how many exist | [`items.md`](items.md#top-of-file) | (top of file) (tier 2) |
| an object is created, stored, or transferred, and the question is how many there are | [`items.md`](items.md#counted-or-tracked) | Counted or tracked (tier 2) |
| an old house is weighed against a prodigy, or a faction is formidable without holding the strongest individual | [`dao-houses.md`](dao-houses.md#knowledge-accumulated-for-millennia-is-itself-a-form-of-power) | Knowledge accumulated for millennia is itself a form of power (tier 2) |
| any NPC is on screen, being reasoned about, or being remembered | [`people.md`](people.md#top-of-file) | (top of file) (tier 2) |
| anybody asks where an art was written, or why nothing above the Lid looks like what is taught down here | [`techniques.md`](techniques.md#ancient-is-a-paradigm-not-a-date) | Ancient is a paradigm, not a date (tier 2) |
| character creation, or when the player's background becomes relevant | [`origin.md`](origin.md#top-of-file) | (top of file) (tier 2) |
| character creation, talent, or a manual's element is in play | [`qi.md`](qi.md#spirit-roots-how-your-body-takes-qi) | Spirit roots: how your body takes qi (tier 2) |
| comparing an ancient art to a modern one, or a manual to a fighting art | [`techniques.md`](techniques.md#how-it-composes-with-the-two-axes-that-already-exist) | How it composes with the two axes that already exist (tier 2) |
| deciding where to place an ancient object, or whether a low-realm cultivator would know about one | [`ancient.md`](ancient.md#where-all-of-this-is-and-where-it-is-not) | Where all of this is, and where it is not (tier 2) |
| describing an art, or comparing what somebody can do to what somebody else can do | [`ancient.md`](ancient.md#modern-is-elemental-ancient-is-categorical) | Modern is elemental. Ancient is categorical. (tier 2) |
| describing anything old, ruined, inherited, or built by someone else | [`the-late-age.md`](the-late-age.md#the-texture-to-aim-for) | The texture to aim for (tier 2) |
| describing what somebody can do at a given height | [`techniques.md`](techniques.md#the-question-the-ladder-asks) | The question the ladder asks (tier 2) |
| everyone practising a given art turns out to be old, or the player is told what an art will cost in years | [`ancient.md`](ancient.md#the-old-are-the-practitioners-and-no-rule-says-so) | The old are the practitioners, and no rule says so (tier 2) |
| exploration, ruins, inheritances, or any question about why the world is the way it is | [`the-late-age.md`](the-late-age.md#top-of-file) | (top of file) (tier 2) |
| karma is read, traced, or invoked against somebody | [`dao-houses.md`](dao-houses.md#what-a-karma-house-can-see) | What a karma house can see (tier 2) |
| nothing is taught at the height the player has reached and the only road left is writing it | [`ancient.md`](ancient.md#derivation-the-road-money-cannot-open) | Derivation: the road money cannot open (tier 2) |
| one of the named powers appears, is invoked, or is being traded with | [`sects.md`](sects.md#the-standing-powers) | The standing powers (tier 2) |
| ownership of an object is disputed, or the player acquires something significant | [`economy.md`](economy.md#possession-ownership-and-where-things-came-from) | Possession, ownership, and where things came from (tier 2) |
| ruins, portals, an unfamiliar art, an elder practising something nobody recognises, or any question about why the past could do things nobody can now | [`ancient.md`](ancient.md#top-of-file) | (top of file) (tier 2) |
| somebody above the Lid offers to teach, or an immortal takes an interest in the player | [`past-the-ceiling.md`](past-the-ceiling.md#4-being-shown-by-somebody-above-the-lid) | 4. Being shown by somebody above the Lid (tier 2) |
| somebody argues ancient beats modern, or the player is choosing between an ancient art and a modern one | [`ancient.md`](ancient.md#neither-one-is-better) | Neither one is better (tier 2) |
| somebody asks a house for a manual, or a book changes hands | [`manuals.md`](manuals.md#a-manual-is-an-item-with-a-count) | A manual is an item with a count (tier 2) |
| somebody asks what it actually takes to reach the top of the ladder | [`origin.md`](origin.md#the-shape-of-an-immortal-life) | The shape of an immortal life (tier 2) |
| somebody asks why cheap goods restock forever and good ones do not, or a grade's supply is being decided | [`items.md`](items.md#why-that-line-falls-where-it-does) | Why that line falls where it does (tier 2) |
| somebody asks why nobody writes arts the way the old ones were written | [`ancient.md`](ancient.md#why-the-era-changed) | Why the era changed (tier 2) |
| somebody asks why the great houses are full of well-born people | [`origin.md`](origin.md#rare-in-the-world-common-at-the-top-and-both-at-once) | Rare in the world, common at the top, and both at once (tier 2) |
| somebody asks why the top of the ladder has so few rungs, or two adjacent high rungs are compared | [`techniques.md`](techniques.md#the-bands-narrow-as-they-rise) | The bands narrow as they rise (tier 2) |
| somebody asks why the world is poorer than it was, or sets the present against the ages behind it | [`the-late-age.md`](the-late-age.md#the-world-is-old-and-it-is-not-what-it-was) | The world is old, and it is not what it was (tier 2) |
| somebody at one of the last three rungs states a thing about the world | [`techniques.md`](techniques.md#the-word-at-the-top-three-rungs) | The word at the top three rungs (tier 2) |
| somebody carries untreated meridian damage, or asks what it will do to them | [`injuries.md`](injuries.md#a-torn-meridian-does-not-kill-you) | A torn meridian does not kill you (tier 2) |
| somebody claims a great house somewhere that house is not | [`trust.md`](trust.md#recognition-runs-backwards-to-prestige) | Recognition runs backwards to prestige (tier 2) |
| somebody claims a house owns or controls a principle | [`dao-houses.md`](dao-houses.md#specialisation-is-not-ownership) | Specialisation is not ownership (tier 2) |
| somebody doubts a claim and has to decide whether to go and find out | [`trust.md`](trust.md#checking-costs-time-and-time-is-what-nobody-has) | Checking costs time, and time is what nobody has (tier 2) |
| somebody expects their cultivation manual to escalate in kind, or a manual is compared to a fighting art | [`techniques.md`](techniques.md#class---and-this-one-is-an-invariant-not-a-guard) | `class` - and this one is an invariant, not a guard (tier 2) |
| somebody has to decide whether to believe who another person says they are, or whether a token, a retinue or a claim is genuine | [`trust.md`](trust.md#top-of-file) | (top of file) (tier 2) |
| somebody is carrying a house's token that is not theirs, or a house notices one of its own has stopped answering | [`trust.md`](trust.md#tokens-shatter-so-somebody-has-to-be-taken-alive) | Tokens shatter, so somebody has to be taken alive (tier 2) |
| somebody is counting how many of a lost material remain, or hunting one | [`ancient.md`](ancient.md#what-is-actually-left-and-where) | What is actually left, and where (tier 2) |
| somebody is practising an art with an upkeep, or an elder predicts how far somebody will get | [`techniques.md`](techniques.md#and-what-runs-out) | And what runs out (tier 2) |
| somebody is seen practising, or a manual is stolen, sold, or offered on a black market | [`manuals.md`](manuals.md#an-art-is-a-signature) | An art is a signature (tier 2) |
| somebody is seen with, or practising, something that is not theirs | [`items.md`](items.md#holding-is-a-signature) | Holding is a signature (tier 2) |
| somebody is trapped by a closing window, or claims they can leave anyway | [`ruins.md`](ruins.md#the-escape-hatch-is-real-and-self-cancelling) | The escape hatch is real, and self-cancelling (tier 2) |
| somebody is wounded, asks about a wound, seeks treatment, or fights while carrying one | [`injuries.md`](injuries.md#top-of-file) | (top of file) (tier 2) |
| somebody near the top of the ladder changes what may be taught | [`past-the-ceiling.md`](past-the-ceiling.md#9-decreeing-the-curriculum) | 9. Decreeing the curriculum (tier 2) |
| somebody needs to know whether a house is still that house, or a person really of it | [`trust.md`](trust.md#the-art-is-the-strongest-check) | The art is the strongest check (tier 2) |
| somebody outranks a person plainly stronger than they are | [`sects.md`](sects.md#at-the-top-rank-stops-tracking-realm) | At the top, rank stops tracking realm (tier 2) |
| somebody outside a house wants to study its principle, or asks whether a house would teach them | [`dao-houses.md`](dao-houses.md#which-is-why-they-take-guest-students) | Which is why they take guest students (tier 2) |
| somebody proposes buying years from above the Lid | [`ancient.md`](ancient.md#the-extinction-is-symmetric) | The extinction is symmetric (tier 2) |
| somebody tries to buy something rare, or asks the price of something nobody sells | [`items.md`](items.md#what-money-cannot-buy) | What money cannot buy (tier 2) |
| somebody tries to identify who built a ruin from what is left standing | [`architecture.md`](architecture.md#the-style-is-the-archaeological-fingerprint) | The style is the archaeological fingerprint (tier 2) |
| somebody tries to identify who built a site, or the player meets an expert reader | [`ruins.md`](ruins.md#reading-a-ruin-is-a-skill-and-it-is-not-a-realm) | Reading a ruin is a skill, and it is not a realm (tier 2) |
| somebody who matters is weaker than the people around them | [`people.md`](people.md#importance-is-not-cultivation) | Importance is not cultivation (tier 2) |
| something is consumed, and later somebody investigates what a house once had | [`items.md`](items.md#spent-is-not-gone) | Spent is not gone (tier 2) |
| something notable happens to a cultivator, or an NPC's history is being weighed against their rank | [`understanding.md`](understanding.md#achievements) | Achievements (tier 2) |
| spirit stones change hands, or somebody is cultivating where the ambient qi will not support them | [`economy.md`](economy.md#spirit-stones) | Spirit stones (tier 2) |
| territory, sect conflict, a massacre, or competition over a region is in play | [`qi.md`](qi.md#and-qi-is-contested) | And qi is contested (tier 2) |
| the Azure Cloud Pavilion's doors come up, or somebody offers to get a person in there | [`origin.md`](origin.md#the-one-house-where-the-word-buys-nothing) | The one house where the word buys nothing (tier 2) |
| the cultivator is at Tribulation Transcendence or above, or the player is investigating ascension, the Lid, or an immortal ancestor | [`immortals.md`](immortals.md#top-of-file) | (top of file) (tier 2) |
| the narrator is about to name a place, house, or person | [`discovery.md`](discovery.md#the-hard-rule-for-the-narrator) | The hard rule for the narrator (tier 2) |
| the narrator is about to say what a house specialises in | [`dao-houses.md`](dao-houses.md#discovery-not-exposition) | Discovery, not exposition (tier 2) |
| the only holder of a living knowledge is sealed, imprisoned, or otherwise out of reach | [`ancient.md`](ancient.md#dormant---nothing-is-missing-and-you-still-cannot-have-it) | Dormant - nothing is missing, and you still cannot have it (tier 2) |
| the player asks anyone about anything they do not already know | [`asking.md`](asking.md#top-of-file) | (top of file) (tier 2) |
| the player asks how anybody affords an ancient art's upkeep | [`ancient.md`](ancient.md#the-four-routes-to-being-able-to-feed-one) | The four routes to being able to feed one (tier 2) |
| the player asks somebody to teach them, to take them on, to introduce them, or for a thing | [`asking.md`](asking.md#asking-for-something-which-is-not-asking-about-something) | Asking for something, which is not asking about something (tier 2) |
| the player asks what lies beyond what they have already met | [`discovery.md`](discovery.md#you-do-not-start-knowing-what-exists) | You do not start knowing what exists (tier 2) |
| the player asks why a house is where it is, or who a house answers to | [`sects.md`](sects.md#sects-are-a-pyramid-and-the-pyramid-is-the-vein-network) | Sects are a pyramid, and the pyramid is the vein network (tier 2) |
| the player attempts to write the next stage of a manual themselves | [`past-the-ceiling.md`](past-the-ceiling.md#7-deducing-the-next-volume) | 7. Deducing the next volume (tier 2) |
| the player considers changing their own root or body to fit an art | [`past-the-ceiling.md`](past-the-ceiling.md#3-the-body) | 3. The body (tier 2) |
| the player considers taking a manual by force or theft, or is accused of having done so | [`past-the-ceiling.md`](past-the-ceiling.md#8-taking-it) | 8. Taking it (tier 2) |
| the player encounters something above their current stratum, or asks about the wider world | [`discovery.md`](discovery.md#top-of-file) | (top of file) (tier 2) |
| the player enters a site everybody agrees is finished | [`ruins.md`](ruins.md#a-stripped-ruin-is-empty-of-things-and-full-of-understanding) | A stripped ruin is empty of things and full of understanding (tier 2) |
| the player finds a designed inheritance, or asks who built one | [`immortals.md`](immortals.md#what-immortals-leave-behind) | What immortals leave behind (tier 2) |
| the player finds a working method everybody stopped using, and has to decide whether to be seen using it | [`ancient.md`](ancient.md#abandoned---it-still-works-and-nobody-uses-it) | Abandoned - it still works, and nobody uses it (tier 2) |
| the player finds an inheritance trial, a sealed door, or any test of suitability rather than strength | [`past-the-ceiling.md`](past-the-ceiling.md#2-the-door-that-tests-fit) | 2. The door that tests fit (tier 2) |
| the player finds something nobody can make, use, or read any more | [`ancient.md`](ancient.md#three-tiers-of-absence) | Three tiers of absence (tier 2) |
| the player finds, is offered, or hears of a life-extending medicine, or asks what an old house is holding | [`ancient.md`](ancient.md#the-thousand-year-medicine) | The thousand-year medicine (tier 2) |
| the player finds, researches, enters or leaves closed ground - a ruin, a sealed cave, an inheritance, an abandoned seat - or asks who built one and why | [`closed-ground.md`](closed-ground.md#top-of-file) | (top of file) (tier 2) |
| the player has grown past an NPC who mattered earlier | [`people.md`](people.md#characters-persist-after-they-are-surpassed) | Characters persist after they are surpassed (tier 2) |
| the player has no house, no teacher, and no vein | [`origin.md`](origin.md#and-it-cuts-the-other-way) | And it cuts the other way (tier 2) |
| the player has no house, or is dealing with somebody who has none | [`sects.md`](sects.md#the-unbacked) | The unbacked (tier 2) |
| the player is at a compound's perimeter, or looking for a way in that is not the gate | [`architecture.md`](architecture.md#formation-nodes-are-objects-and-dark-ones-are-doors) | Formation nodes are objects, and dark ones are doors (tier 2) |
| the player is choosing how to get past their manual's ceiling | [`past-the-ceiling.md`](past-the-ceiling.md#the-routes) | The routes (tier 2) |
| the player is dealing with a sect | [`README.md`](README.md#the-tier-scheme) | The tier scheme (tier 2) |
| the player is dealing with a sect, a faction, or one of the standing powers | [`sects.md`](sects.md#top-of-file) | (top of file) (tier 2) |
| the player is deciding whether it is safe to cross a house | [`dao-houses.md`](dao-houses.md#their-power-should-be-frightening-in-a-specific-way) | Their power should be frightening in a specific way (tier 2) |
| the player is deciding whether to join a faction, or has found a book nobody there can read | [`techniques.md`](techniques.md#the-archive-and-what-a-house-holds-that-it-cannot-use) | The archive, and what a house holds that it cannot use (tier 2) |
| the player is deciding whether to keep searching or accept the ceiling | [`past-the-ceiling.md`](past-the-ceiling.md#searching-must-be-rational-not-compulsory) | Searching must be rational, not compulsory (tier 2) |
| the player is earning rank inside a house in order to reach its archive | [`past-the-ceiling.md`](past-the-ceiling.md#5-climbing-to-the-shelf) | 5. Climbing to the shelf (tier 2) |
| the player is exploring, entering a sealed site, or considering grave-reading | [`the-late-age.md`](the-late-age.md#what-ruins-are-for) | What ruins are for (tier 2) |
| the player is in trouble somewhere and has powerful connections | [`ruins.md`](ruins.md#but-somebody-might-come-for-you) | But somebody might come for you (tier 2) |
| the player is in, from, or asking about a qi-poor region | [`qi.md`](qi.md#thin-regions-have-a-ceiling) | Thin regions have a ceiling (tier 2) |
| the player is inside a sect compound, a hall, a vault, or any interior | [`architecture.md`](architecture.md#what-is-generated-and-from-what) | What is generated, and from what (tier 2) |
| the player is inside a site that does not behave like an ordinary place | [`ruins.md`](ruins.md#mechanics-that-change-the-terms) | Mechanics that change the terms (tier 2) |
| the player is investigating a ruin, a discrepancy in the record, or who used to hold a territory | [`dao-houses.md`](dao-houses.md#houses-rise-fall-and-rewrite-what-happened) | Houses rise, fall, and rewrite what happened (tier 2) |
| the player is looking at a building, a ruin, or trying to identify who built something | [`architecture.md`](architecture.md#house-style) | House style (tier 2) |
| the player is looking for a particular room, or asks what a house's buildings say about it | [`architecture.md`](architecture.md#rooms-come-from-what-the-house-does) | Rooms come from what the house does (tier 2) |
| the player is looking for a way around a house's specialisation | [`dao-houses.md`](dao-houses.md#blind-spots-and-counters-are-mandatory) | Blind spots and counters are mandatory (tier 2) |
| the player is looking for, buying, or has found a later volume of a manual they hold | [`past-the-ceiling.md`](past-the-ceiling.md#1-the-later-volume) | 1. The later volume (tier 2) |
| the player is looting a body, entering a sealed site, or considering grave-reading as a profession | [`economy.md`](economy.md#graves-and-grave-readers) | Graves and grave-readers (tier 2) |
| the player is near, entering, researching, buying access to, or asking about a ruin, a sealed site, an old compound or a convergence | [`ruins.md`](ruins.md#top-of-file) | (top of file) (tier 2) |
| the player is priced out of something, or asks why anybody bothers digging | [`economy.md`](economy.md#scarcity-is-the-engine) | Scarcity is the engine (tier 2) |
| the player is searching a site, or wondering why the entrance is bare | [`ruins.md`](ruins.md#loot-is-a-record-not-a-table) | Loot is a record, not a table (tier 2) |
| the player is somewhere people are talking and not to them | [`discovery.md`](discovery.md#overheard) | Overheard (tier 2) |
| the player is somewhere they have not been before, or asking about a place | [`architecture.md`](architecture.md#knowledge-of-a-room-is-not-a-flag-on-the-room) | Knowledge of a room is not a flag on the room (tier 2) |
| the player is standing in front of an opened site and does not know which kind it is | [`economy.md`](economy.md#a-grave-is-not-an-inheritance) | A grave is not an inheritance (tier 2) |
| the player is trading, buying, looting, grave-reading, or disputing who owns something | [`economy.md`](economy.md#top-of-file) | (top of file) (tier 2) |
| the player is trying to get into somewhere they may not be allowed | [`architecture.md`](architecture.md#access-is-a-chain-not-a-door) | Access is a chain, not a door (tier 2) |
| the player is weighing whether to join, stay in, or leave a house | [`sects.md`](sects.md#what-a-sect-is-for-from-the-disciples-side) | What a sect is for, from the disciple's side (tier 2) |
| the player learns about ascension, the Lid, or the top of the ladder | [`qi.md`](qi.md#the-world-and-the-ceiling) | The world and the ceiling (tier 2) |
| the player learns of something new, or their grasp of it is in question | [`discovery.md`](discovery.md#the-ladder-of-knowing) | The ladder of knowing (tier 2) |
| the player meets something plainly beyond their stratum | [`discovery.md`](discovery.md#encountering-something-from-above) | Encountering something from above (tier 2) |
| the player moves between precincts, or a compound's internal ladder is in question | [`architecture.md`](architecture.md#precincts-come-from-the-houses-own-rank-ladder) | Precincts come from the house's own rank ladder (tier 2) |
| the player phrases a question, names somebody, or uses a term they may not understand | [`asking.md`](asking.md#what-you-say-matters-more-than-what-you-are) | What you say matters more than what you are (tier 2) |
| the player picks somebody to ask, or asks somebody plainly out of their depth | [`asking.md`](asking.md#who-you-ask-decides-what-you-get) | Who you ask decides what you get (tier 2) |
| the player receives a vision or echo, or encounters a fragment of another time | [`understanding.md`](understanding.md#visions-echoes-and-other-temporal-phenomena) | Visions, echoes, and other temporal phenomena (tier 2) |
| the player watches somebody far above them act, or asks what a realm actually buys | [`techniques.md`](techniques.md#what-is-different-at-each-step-in-practice) | What is different at each step, in practice (tier 2) |
| the timing of an opening is being sold, guarded, or guessed at | [`ruins.md`](ruins.md#the-schedule-is-its-own-kind-of-knowledge) | The schedule is its own kind of knowledge (tier 2) |
| two books cover the same rungs, or somebody complains their method is slow | [`manuals.md`](manuals.md#how-well-the-book-is-written) | How well the book is written (tier 2) |
| two cultivators of the same rank are compared, or somebody asks why one of them is dangerous | [`understanding.md`](understanding.md#understanding-the-axis-that-is-not-accumulation) | Understanding: the axis that is not accumulation (tier 2) |
| two houses' standing is being compared, or a house's decline is in question | [`sects.md`](sects.md#recency-is-most-of-the-prestige) | Recency is most of the prestige (tier 2) |
| two people meet and one has to decide what to make of the other | [`trust.md`](trust.md#two-things-about-the-reader) | Two things about the reader (tier 2) |
| what a house or person knows about a site is in question | [`ruins.md`](ruins.md#knowledge-follows-engagement-not-altitude) | Knowledge follows engagement, not altitude (tier 2) |
| working out whether a particular lie would hold in front of a particular person | [`trust.md`](trust.md#a-signal-is-worth-what-they-cannot-check) | A signal is worth what they cannot check (tier 2) |

<!-- END GENERATED: triggers -->

---

## The catalogs: design material that is not in `docs/`

Generated from the leading block comment of each file in `src/data/cultivation/`.

**These are `.ts` files. No search of `docs/` reaches them, and they hold a large share of
the written design rationale for this world** - the argument for why a thing is shaped the
way it is, usually in the file header or in a prose constant near the top.

A blank "Also in" cell means this file is the only written record of what it describes. A
filled one means the topic is in two places and **can drift**; if you change one, read the
other.

<!-- BEGIN GENERATED: catalog -->

**47 catalog files, 16 of which name a doc.**
These are `.ts` files and no search of `docs/` reaches them. Where the
"Also in" column is empty, this file is the only written record of what
it describes.

| File | What it answers | Lines | Also in |
|---|---|---|---|
| [`a-favour-skips-the-admission-bar.ts`](../../src/data/cultivation/a-favour-skips-the-admission-bar.ts) | What a favour is for: it skips the admission ordinal. | 319 | - |
| [`artifacts.ts`](../../src/data/cultivation/artifacts.ts) | The artifact catalog. One table for every artifact in the world, ordered by `power` descending, because the ordering is the argument: an object an ascended founder sent back down and a notched sabre off a dead bandit are the same kind of row with different numbers in one column. Read top to bottom and the whole hierarchy of force in the setting is legible without a single sentence of explanation. | 555 | - |
| [`beasts.ts`](../../src/data/cultivation/beasts.ts) | Spirit beasts - the part of the world that is dangerous and is not a person. | 1114 | - |
| [`bodies-that-cannot-keep-their-members-children.ts`](../../src/data/cultivation/bodies-that-cannot-keep-their-members-children.ts) | Three institutions with no place for their own members' children. | 211 | - |
| [`catastrophe.ts`](../../src/data/cultivation/catastrophe.ts) | What a disaster can end, and who pays for it. | 170 | - |
| [`contingencies.ts`](../../src/data/cultivation/contingencies.ts) | Recorded contingencies: plans held by parties, waiting on events that have not happened. | 333 | - |
| [`crossings.ts`](../../src/data/cultivation/crossings.ts) | How the last crossing is actually attempted, and who still has somebody answering from the other side of it. | 818 | [`immortals.md`](immortals.md) [`past-the-ceiling.md`](past-the-ceiling.md) |
| [`cultivators-the-road-finished.ts`](../../src/data/cultivation/cultivators-the-road-finished.ts) | The fallen: cultivators the road already finished with, and what they do now. | 752 | - |
| [`demonic-sects-and-what-they-are-willing-to-do.ts`](../../src/data/cultivation/demonic-sects-and-what-they-are-willing-to-do.ts) | What makes a demonic sect demonic, stated so a reader can tell six of them apart. | 300 | - |
| [`encounters.ts`](../../src/data/cultivation/encounters.ts) | Encounter and opportunity tables for the time-skip simulation. | 2059 | - |
| [`faction-character.ts`](../../src/data/cultivation/faction-character.ts) | Faction character - the retroactive distinctness pass. | 1539 | [`manuals.md`](manuals.md) |
| [`faction-history.ts`](../../src/data/cultivation/faction-history.ts) | How each faction came to be where it is, and what that explains. | 923 | - |
| [`faction-relationships.ts`](../../src/data/cultivation/faction-relationships.ts) | How each faction stands with the bodies above it, below it and beside it. | 1061 | - |
| [`faction-roll.ts`](../../src/data/cultivation/faction-roll.ts) | Who is on each faction's roll, from every catalog that holds people, in one place. | 177 | - |
| [`fallen.ts`](../../src/data/cultivation/fallen.ts) | Moved to `cultivators-the-road-finished.ts`. | 11 | - |
| [`false-immortals.ts`](../../src/data/cultivation/false-immortals.ts) | False Immortals: what they do with the time, the office that used to exist, and the two ways they leave the world. | 1461 | [`immortals.md`](immortals.md) |
| [`governance-and-water-rights.ts`](../../src/data/cultivation/governance-and-water-rights.ts) | Governance: who holds the water, and on what terms. | 2924 | [`discovery.md`](discovery.md) |
| [`herbs.ts`](../../src/data/cultivation/herbs.ts) | Spirit herbs - the ingredient layer under alchemy. | 813 | [`the-late-age.md`](the-late-age.md) |
| [`hierarchy.ts`](../../src/data/cultivation/hierarchy.ts) | Moved to `governance-and-water-rights.ts`. | 11 | - |
| [`history.ts`](../../src/data/cultivation/history.ts) | The deep past: four ages, two civilisations that are gone, and the four or five questions about all of it that nobody can answer. | 1853 | - |
| [`hollow-court-roster.ts`](../../src/data/cultivation/hollow-court-roster.ts) | Who is actually standing on the four mountains, and how the world sees them. | 509 | [`past-the-ceiling.md`](past-the-ceiling.md) |
| [`immortal-items.ts`](../../src/data/cultivation/immortal-items.ts) | Things that came down from above. The provenance rule this rests on - counted against tracked, what money cannot buy, why a holder keeps what they cannot use - is `docs/world/items.md`. What crosses the Lid at all is `docs/world/immortals.md`. What is here and in neither of them is the stock argument: `STOCK_VERSUS_FLOW`, `THE_TWO_CLAIMS`, and what service actually buys. Indexed in `docs/world/INDEX.md`. | 957 | [`immortals.md`](immortals.md) [`items.md`](items.md) |
| [`index.ts`](../../src/data/cultivation/index.ts) | Cultivation content catalog - barrel export and cross-catalog lookups. | 625 | - |
| [`inheritance-trials.ts`](../../src/data/cultivation/inheritance-trials.ts) | Inheritance trials and graves: what is actually behind the door, and the three completely different questions a door can ask. | 3382 | - |
| [`institutions-that-hold-deposits-for-the-dead.ts`](../../src/data/cultivation/institutions-that-hold-deposits-for-the-dead.ts) | Bodies that will hold a thing for somebody who is not coming back, and the terms each of them holds it on. | 378 | - |
| [`lost-ages.ts`](../../src/data/cultivation/lost-ages.ts) | The ancient tier: what a richer age made, what is left of it, and who is holding the remains. | 1122 | [`ancient.md`](ancient.md) [`discovery.md`](discovery.md) |
| [`members.ts`](../../src/data/cultivation/members.ts) | Members - the people inside the institutions, at human scale. | 3870 | - |
| [`mortal-world.ts`](../../src/data/cultivation/mortal-world.ts) | The mortal world: what people do, what things cost, where they live, and what they think of cultivators. | 801 | - |
| [`named-figures.ts`](../../src/data/cultivation/named-figures.ts) | The named dead, the named absent, and the named enormous. | 1236 | - |
| [`pills.ts`](../../src/data/cultivation/pills.ts) | Alchemy - the pill catalog. Pills are the only reliable way to undo damage in this game, and the reason a run's economy exists. Every entry satisfies `PillSchema`. | 831 | - |
| [`places-that-teach-a-dao.ts`](../../src/data/cultivation/places-that-teach-a-dao.ts) | Places that teach a dao: named ground where a road besides your own can be walked, and who is standing on the door. | 611 | [`immortals.md`](immortals.md) |
| [`recipes.ts`](../../src/data/cultivation/recipes.ts) | Alchemy recipes. One recipe per pill in `pills.ts`, keyed to ingredient ids in `herbs.ts`. | 760 | - |
| [`regions.ts`](../../src/data/cultivation/regions.ts) | Regions - five of them, and the contrast between them is the content. | 3188 | [`making-places-different.md`](making-places-different.md) [`qi.md`](qi.md) |
| [`roads-to-the-top-of-the-ladder.ts`](../../src/data/cultivation/roads-to-the-top-of-the-ladder.ts) | The four roads that reach the top of the ladder, and what it actually takes to be walked up one. | 262 | - |
| [`rogues.ts`](../../src/data/cultivation/rogues.ts) | Rogue cultivators: the unaffiliated, who are most of the player's peers and who barely existed in this catalog until now. | 965 | - |
| [`rumours-and-what-they-get-wrong.ts`](../../src/data/cultivation/rumours-and-what-they-get-wrong.ts) | What ordinary people say about the powers above them, and where it is wrong. | 1058 | [`discovery.md`](discovery.md) |
| [`sealed-ancestors.ts`](../../src/data/cultivation/sealed-ancestors.ts) | Sealed ancestors: sealed and dormant high-realm beings, held and unheld. | 675 | - |
| [`sects.ts`](../../src/data/cultivation/sects.ts) | Sects - the social layer, and the only reliable source of manuals, stipends, pills and enemies. | 4789 | [`past-the-ceiling.md`](past-the-ceiling.md) |
| [`standoff.ts`](../../src/data/cultivation/standoff.ts) | Moved to `the-top-of-the-world.ts`. Its own first line already said it: the top of the world, and whether it can be moved. | 11 | - |
| [`structural-repair-medicine.ts`](../../src/data/cultivation/structural-repair-medicine.ts) | The medicine that mends a cracked cultivator, and the fixed set of it that exists. | 647 | [`items.md`](items.md) |
| [`techniques.ts`](../../src/data/cultivation/techniques.ts) | Technique (art) library. Content, not engine. Every entry here is inert data that the cultivation engine resolves against; nothing in this file decides anything. | 4035 | [`ancient.md`](ancient.md) [`escapes.md`](escapes.md) |
| [`the-top-of-the-world.ts`](../../src/data/cultivation/the-top-of-the-world.ts) | The top of the world, and whether it can be moved. | 523 | - |
| [`traditions.ts`](../../src/data/cultivation/traditions.ts) | Two traditions, one ladder. The world holds two genuinely different ways of cultivating, and the difference between them is the oldest quarrel in it. Both climb the SAME rungs: a fourth-realm practitioner of either is Core Formation, ordinal 17 to 20, and `realmOrdinal` means exactly what it means everywhere else. There is no second scale in this file and there must never be one. | 312 | - |
| [`wanderers.ts`](../../src/data/cultivation/wanderers.ts) | Wandering figures: people who belong to nothing and are therefore worth asking. | 906 | [`asking.md`](asking.md) |
| [`what-each-house-makes-and-what-crosses-the-water.ts`](../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.ts) | What each house makes, and what crosses the water because it makes it. | 505 | - |
| [`what-two-houses-both-have-a-hand-on.ts`](../../src/data/cultivation/what-two-houses-both-have-a-hand-on.ts) | What two houses both have a hand on, and therefore what they are contending over whether or not anybody wrote it down. | 474 | - |
| [`wounds.ts`](../../src/data/cultivation/wounds.ts) | The wound table - every way a person in this world can be hurt, as data. | 589 | [`injuries.md`](injuries.md) [`items.md`](items.md) |

<!-- END GENERATED: catalog -->

---

## Keeping this current

- `node scripts/build-world-index.mjs` rewrites the two generated tables.
- `node scripts/build-world-index.mjs --check` fails if they are stale.
- `tests/docs/the-world-index-is-not-stale.test.ts` runs the check, so a new section with
  a new trigger fails the suite rather than going quietly unindexed.
- The hand-written table above is not generated. **Add a row every time a search fails and
  the answer turns out to have existed.** That table is the record of what this directory
  is bad at, and it is the most useful thing in this file.
