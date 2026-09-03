/**
 * What ordinary people say about the powers above them, and where it is wrong.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `docs/world/houses/discovery.md` forbids the narrator from naming anything the
 * player has no knowledge record for, and puts the entire burden of the
 * player's education onto other people's mouths. That makes hearsay the only
 * road into the world, and a road that carried nothing but correct proper
 * nouns would be a briefing with a tavern painted on it.
 *
 * So this is the other half of `src/web/lore.ts`. That table answers "which
 * name could this speaker say"; this one answers "and what would they say
 * about it", including the very common case where the answer is confidently
 * false. A name arriving attached to a wrong story is the ordinary way a
 * cultivator learns anything, and it is how a cultivator gets killed.
 *
 * WHAT A ROW IS
 * -------------
 * One thing a person says, in the register they say it in, with the reason
 * they believe it and the thing they do about it. Every row carries what is
 * actually the case in `underneath`, which is engine-side and is NEVER
 * narrated: the player gets the saying and nothing else, and finds out later,
 * or never.
 *
 * THE ACCURACY COLUMN IS NOT A CONFIDENCE SCORE
 * ---------------------------------------------
 * A rumour fails in more ways than a claim does, and the ways are different
 * enough to be worth separating, because they resolve differently when the
 * player finally gets to check:
 *
 *   true                     right, badly put, and usually disbelieved because
 *                            of who is saying it
 *   true_and_wrong_about_why the fact is real and the reason attached to it is
 *                            not, which is the commonest failure in the file
 *                            and the hardest to catch
 *   garbled                  a real fact with a step missing, so it points at
 *                            the right place and describes the wrong thing
 *   stale                    was true. The world moved and the saying did not.
 *   invented                 nothing under it. Usually somebody's interest.
 *   unresolved               nobody can settle it, this catalog included
 *
 * `unresolved` is neither right nor wrong and is counted as neither. It is the
 * honest answer more often than either party would like, and a catalog that
 * forced every saying into true or false would be doing the thing the setting
 * is most careful not to do.
 *
 * NOTHING HERE IS A MECHANIC
 * --------------------------
 * AGENTS.md: lore describes what the systems produce and never adds a system
 * of its own. Nothing in this file is read by a resolver, nothing here changes
 * an outcome, and `accuracy` is a grading for the author and the test suite
 * rather than a die roll. A rumour that would require a new rule to be true is
 * not in this file; where a saying is right, the thing it describes is already
 * a row somewhere else, and where it is wrong, the correction is a row
 * somewhere else too.
 *
 * THE GATES ARE THE SAME GATES
 * ----------------------------
 * `floorOrdinal`, `regionId` and `insiderFactionId` mean exactly what they mean
 * in `lore.ts`, deliberately, so a row here can be handed to the discovery
 * channels without a translation step. Locality is WEIGHT and never exclusion -
 * a saying travels, arriving further from home each time and losing a step at
 * every stop, which is most of why the garbled ones are garbled.
 *
 * WHAT THE SPEAKER CALLS IT
 * -------------------------
 * `aboutName` is the name as the speaker actually says it, which is frequently
 * not the name in the catalog. People clip, shorten, mishear and substitute the
 * one part of a long name they can hold. A player who hears the Ledger called
 * "the Ninefold" and later reads "the Ninefold Ledger" in an archive has to do
 * that join themselves, and doing it is the reward.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export const RumourAccuracySchema = z.enum([
    'true',
    'true_and_wrong_about_why',
    'garbled',
    'stale',
    'invented',
    'unresolved'
]);
export type RumourAccuracy = z.infer<typeof RumourAccuracySchema>;

/** The accuracies that mean the holder is holding something false. */
export const WRONG_ACCURACIES: readonly RumourAccuracy[] = [
    'true_and_wrong_about_why',
    'garbled',
    'stale',
    'invented'
];

export const RumourSchema = z.object({
    id: z.string(),
    /**
     * The saying, verbatim, in the register it is said in. This is the only
     * field a player is ever given.
     */
    saying: z.string().min(40),
    /** The kind of person who says it, stated as an occupation or a position. */
    saidBy: z.string().min(15),
    /**
     * Catalog id of the thing it is about. Null where the saying is about
     * nothing nameable, which is a real and common case: a great deal of what
     * people believe is about cultivators or the world in general.
     */
    aboutId: z.string().nullable(),
    /** The name as the speaker says it, which is often not the catalog's. */
    aboutName: z.string().nullable(),
    accuracy: RumourAccuracySchema,
    /**
     * What is actually the case. Engine-side reference for whoever is checking
     * the world against itself, and never narrated: the player is not told
     * which of these they got.
     */
    underneath: z.string().min(60),
    /**
     * What people do because they believe it. The load-bearing field - a saying
     * with no consequence is atmosphere, and this file is not for atmosphere.
     */
    consequence: z.string().min(40),
    /** Standing at which this is in a person's working vocabulary. */
    floorOrdinal: z.number().int().min(0).max(MAX_ORDINAL + 20),
    /** Where it belongs. Weight, never exclusion. Null means it belongs nowhere. */
    regionId: z.string().nullable(),
    /** Faction whose own people hold it whatever their standing. */
    insiderFactionId: z.string().nullable()
});
export type Rumour = z.infer<typeof RumourSchema>;

// ─────────────────────────────────────────────────────────────────────────
// WHAT MORTALS SAY ABOUT CULTIVATORS
//
// The largest and least examined body of belief in the world, because the
// people holding it will never be in a position to test any of it. Its
// distinguishing feature is that it is mostly about MONEY and BODIES rather
// than about power: a farmer's model of a cultivator is a person who does not
// die on schedule and can pay for things, and almost every error below follows
// from extrapolating that correctly and too far.
// ─────────────────────────────────────────────────────────────────────────

const ABOUT_CULTIVATORS: readonly Rumour[] = [
    {
        id: 'rumour-pills-cure-anything',
        saying: 'They have a pill for it. Whatever it is, there is a pill, and they will not sell it to you because the price would be nothing to them and everything to you.',
        saidBy: 'a village herbalist who has set bones for forty years',
        aboutId: null,
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'There is a pill for a great deal of it, and the withholding is real, but the reason is not contempt. The pills that would help a mortal are the cheap ones and they are still a year of a farmhand\'s savings each, and the ones a cultivator would not miss do nothing whatever to a body with no qi in it.',
        consequence: 'Mortal physicians price against a competitor that does not exist, and a cultivator who offers a pill to a dying villager is heard as making an admission rather than a gift.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-cultivators-do-not-age',
        saying: 'They do not get old. The one who came through when my grandfather was a boy came through again last spring and he had not changed a hair.',
        saidBy: 'an innkeeper on a market road',
        aboutId: null,
        aboutName: null,
        accuracy: 'garbled',
        underneath: 'Lifespan extends with the realm and the extension is enormous by mortal reckoning, but it is an extension and not a stop, and the great majority of cultivators a village will ever meet are in the bottom band and will die of old age like anybody. What the innkeeper saw was almost certainly two people.',
        consequence: 'Villages assume any returning cultivator is the same one and address them by a name they have never held, which is one of the cheapest ways in the world to acquire a false identity.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-spirit-stones-are-mined',
        saying: 'Same as ore. They send men down for it and the men do not come up, and that is why they will not let anybody near the good ground.',
        saidBy: 'a miner, at length, having been asked once too often',
        aboutId: null,
        aboutName: null,
        accuracy: 'invented',
        underneath: 'A spirit stone is compressed qi and nothing is dug for it. The confusion runs the other way in the Quiet Marches, where qi is in the stone and getting it out is genuinely a trade with tools and a death rate, which is where the story came from before it travelled.',
        consequence: 'Mortal miners in the Low Fall are hired at the wrong wage by people who think they are buying a skill, and resent it enough that the correction is now a set speech.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: null
    },
    {
        id: 'rumour-breakthrough-needs-a-death',
        saying: 'Every time one of them goes up a step somebody near them dies. Not the same day. Within the season.',
        saidBy: 'a corpse carrier who has counted',
        aboutId: null,
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The correlation is real and the direction is backwards. Attempts cluster where cultivators cluster, and cultivators cluster where there is a vein, and the people who die near a vein die of the ordinary hazards of living beside people who fight over one. Nothing in a breakthrough takes a life at the other end.',
        consequence: 'Corpse carriers charge more in a sect town during admission season, and are not wrong to, and the sects pay it without ever asking what the surcharge is for.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-they-can-hear-you',
        saying: 'Do not talk about one where you cannot see the door. They hear their own name said. It is the first thing they learn.',
        saidBy: 'a market-town tax clerk, quietly, to a new clerk',
        aboutId: null,
        aboutName: null,
        accuracy: 'garbled',
        underneath: 'Perception extends a long way up the ladder and a high cultivator in a small room genuinely does know who is in it. Nothing in the world attaches to a name being spoken. The belief is a hearing radius with a superstition wrapped round it.',
        consequence: 'Clerks and innkeepers say "the gentleman" and "the visitor" rather than a name, which means that in most towns the one person who can tell you who came through is the gate register, and the gate register costs money.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-a-sect-will-take-a-clever-child',
        saying: 'If the boy is quick they will take him. They came through the year of the flood and took two from Millrun, and their people eat every day.',
        saidBy: 'a farmer with four children and one ox',
        aboutId: null,
        aboutName: null,
        accuracy: 'stale',
        underneath: 'It was true in a richer age and is still told as current. Intake is now tested on the spirit root and quickness is not what is being tested; a bright child with no root is refused at the gate and walks home. Sects do still take, and the ones that take most take least carefully, which is a different offer than the one being described.',
        consequence: 'Admission season fills sect towns with families who have walked for a week, and the missions and temples that take in the refused are the fastest-growing institutions in either province.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-cultivator-blood-heals',
        saying: 'A cup of it and a broken leg knits in a night. There is a man in Sweetspring Isle who sells it and it is not his.',
        saidBy: 'a hawker at the edge of a market',
        aboutId: null,
        aboutName: null,
        accuracy: 'invented',
        underneath: 'Nothing whatever. It is a hawker\'s line and the hawkers know it is a hawker\'s line. What it is doing is selling pig\'s blood at the price of medicine to people whose alternative is a splint and a month.',
        consequence: 'A recurring and ugly small crime in the Drowned Reach, and the reason two market towns will now not let a stranger sell anything red.',
        floorOrdinal: 0,
        regionId: 'region-drowned-reach',
        insiderFactionId: null
    },
    {
        id: 'rumour-they-fight-over-us',
        saying: 'The wars are not about us. Nothing they do is about us. When two of them fall out, the ones who bury it are us.',
        saidBy: 'a headman, at a funeral, without heat',
        aboutId: null,
        aboutName: null,
        accuracy: 'true',
        underneath: 'Exactly right, and stated more accurately than most people inside the institutions would put it. Territory is fought over because it is a vein and a vein is a rate of cultivation; whoever farms it is a fact about the ground rather than a party to the argument.',
        consequence: 'Villages near a contested boundary keep a second store and do not repair anything on the side facing the line, which reads as poverty to a visitor and is a policy.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-realms-are-stories',
        saying: 'There are the ones you see and then there is the rest of it, and the rest of it is a story people tell. Nobody has ever met one.',
        saidBy: 'a Quiet Marches carver, dismissing the question',
        aboutId: 'region-quiet-marches',
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The Marches has a low local ceiling and it is genuinely true that almost nobody there has met anybody from the upper bands. The conclusion drawn from that - that the upper bands are a fiction - is wrong, and it is a reasonable inference from a complete absence of evidence.',
        consequence: 'A high visitor to the Marches is not disbelieved so much as not understood, and the Marches has twice made a serious political misjudgement by assuming an outside body was bluffing.',
        floorOrdinal: 0,
        regionId: 'region-quiet-marches',
        insiderFactionId: null
    },
    {
        id: 'rumour-refusing-is-fatal',
        saying: 'Never say no to one. Say you will think about it, say you have to ask your brother, say anything. Do not say the word.',
        saidBy: 'a caravan master briefing new guards',
        aboutId: null,
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The advice is sound and the model behind it is wrong. What gets people killed is not refusal but being an obstacle in a hurry, and a mortal who says no slowly is not an obstacle. The caravan masters have arrived at correct practice from a theory about temper.',
        consequence: 'An entire register of mortal speech exists for declining without declining, and a cultivator raised outside it reads the whole province as evasive and dishonest.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT PEOPLE SAY ABOUT THE HOUSES AND THE SECTS
//
// The rule this section obeys: nobody outside an institution knows what it is
// FOR. They know what it does to them, which is a different fact, and they
// reason from it. The Anchorhold's whole product is nothing happening, so
// everybody who pays for it thinks they are paying for nothing; the Ledger
// sells findings, so everybody thinks its findings are for sale.
// ─────────────────────────────────────────────────────────────────────────

const ABOUT_INSTITUTIONS: readonly Rumour[] = [
    // -- TWO HOUSES CUT OFF FROM ABOVE, AND THE DIFFERENCE IS WHAT IS KNOWN --
    //
    // The pair is the point and the rows should be read together. Both have
    // lost the object their line ran through and neither can reach the
    // ancestor above it. What separates them is entirely epistemic:
    //
    //   The Storm Tyrant Court. The province SUSPECTS and will not check.
    //   The suspicion is correct, and the Court keeps most of its standing
    //   on other people's unwillingness to establish that - which is an
    //   excellent position and an extremely fragile one, because it is not
    //   being held by anything the Court does.
    //
    //   The Frostmirror Court. The province KNOWS, because the loss was
    //   public. It gets none of the same protection, since there is nothing
    //   left to be uncertain about. And the ancestor it is grieving the loss
    //   of access to has been dead the whole time, which nobody on either
    //   side knows - so the second loss is redundant on the first.
    //
    // The ground truth is in `SECT_ANCESTRY` on both houses, where the
    // register reads it: `claimIsTrue` and `afterCrossing` carry it, and the
    // catalog comment on `afterCrossing` has always said it is unknowable in
    // the world. These rows are what the world says instead.
    {
        id: 'rumour-storm-tyrant-tally-is-gone',
        saying: 'Nobody has seen the Tally in four hundred years. They describe it at successions now. You describe a thing when you cannot show it.',
        saidBy: 'a Crimson Abyss factor who pays their tithe and resents it, quietly, to other people who pay it',
        aboutId: 'sect-storm-tyrant-court',
        aboutName: 'the Storm Tyrants',
        accuracy: 'true',
        underneath: 'It is gone, and the reasoning that gets there is sound rather than lucky: the Court stopped opening the vault, started reading the contents off the record, and two of its own Storm Elders privately doubt the list. What nobody has is the one thing that would settle it, because settling it means walking up to a house that holds the only working lightning curriculum in the world and asking it to prove a negative.',
        consequence: 'Nothing. That is the whole of the Court\'s position and it is not one the Court is maintaining: everybody who could test the belief has worked out that being wrong about it in the wrong direction is fatal, so the deterrent is held up by other people\'s caution rather than by anything in the room. A house whose standing rests on a question nobody will ask is safe exactly until somebody asks it.',
        floorOrdinal: 12,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-storm-tyrant-court'
    },
    {
        id: 'rumour-storm-tyrant-still-answered',
        saying: 'The Standing Storm still answers them. That is why nobody moves on the stone, whatever else they have lost.',
        saidBy: 'a Low Fall grant clerk, explaining to a junior why a probationary court is renewed anyway',
        aboutId: 'sect-storm-tyrant-court',
        aboutName: 'the Storm Tyrant Court',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The ancestor is alive and the Court is right to claim it. He has not answered in nine hundred years and the Court cannot reach him, because reaching upward takes an object the Court no longer has. So the saying is right about the man and wrong about the channel, and the Court is in the strange position of holding a true claim it has no way to use and every reason to let people keep misunderstanding.',
        consequence: 'The Court has never corrected it and never will, because the correction is the admission. Its own stated want is to find out whether the ancestor is still there, and the only bodies that could open that channel are the two it would have to tell.',
        floorOrdinal: 16,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-storm-tyrant-court'
    },
    {
        id: 'rumour-frostmirror-cannot-reach-hers',
        saying: 'The Frostmirror lost theirs and everybody watched. They have not been able to send a word upward since, and they still keep the hall ready.',
        saidBy: 'a Stonewright assayer who was present when it was weighed, and has told the story at every table since',
        aboutId: 'sect-frostmirror-court',
        aboutName: 'the Frostmirror',
        accuracy: 'true',
        underneath: 'Right, and unusually well attested for a saying about an object: the loss was witnessed, assayed and minuted, so there is no version of this the Court can leave unsettled. What the saying does not contain, because nobody alive holds it, is that the ancestor on the far end has been dead for centuries. The Court is not cut off from somebody who is not answering. It is cut off from nobody.',
        consequence: 'It gets none of the protection the Storm Tyrant Court gets from the same loss, because there is nothing left to be uncertain about - and the province prices it accordingly. Every judgement made about the Frostmirror on this basis is correct for a reason that stopped being the reason a long time ago.',
        floorOrdinal: 8,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-frostmirror-court'
    },
    {
        id: 'rumour-anchorhold-does-nothing',
        saying: 'We pay the levy and they come once a year and walk about and go away. Nothing happens. That is what we are paying for, apparently. Nothing.',
        saidBy: 'a perimeter settlement headman, at the levy meeting, every year',
        aboutId: 'house-anchorhold',
        aboutName: 'the Anchorhold',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The settlements exist because the perimeter is maintained, and nothing happening is the entire product. The Anchorhold has never found a way to say this that does not sound like a threat, and has stopped trying.',
        consequence: 'Levy income falls a little every decade, two perimeters are already being held below the standard the house publishes itself, and the house answers by publishing the standard again.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: 'house-anchorhold'
    },
    {
        id: 'rumour-anchorhold-broke-one',
        saying: 'One of the nails is out. They took it out themselves to see what was under it and they have not put it back.',
        saidBy: 'a Gleaner, repeating what he was told at a face',
        aboutId: 'house-anchorhold',
        aboutName: 'the Anchorhold',
        accuracy: 'garbled',
        underneath: 'There is a faction inside the house pressing to break one of the nails, which is a real internal argument and has never been acted on. The saying has turned a proposal into an event, which is the commonest way an institution\'s internal politics reach the outside.',
        consequence: 'Two settlements have withheld levy over it, which makes the perimeter they are worried about the one most likely to actually fail.',
        floorOrdinal: 8,
        regionId: null,
        insiderFactionId: 'house-anchorhold'
    },
    {
        id: 'rumour-ledger-findings-for-sale',
        saying: 'The Ninefold finds whatever the man paying wants found. It is a very expensive way of buying an opinion and everybody knows it.',
        saidBy: 'a losing party outside an arbitration bench',
        aboutId: 'house-ninefold-ledger',
        aboutName: 'the Ninefold',
        accuracy: 'invented',
        underneath: 'The Ledger sells the finding and not the outcome, and its entire value rests on that distinction holding. It has ruled against the paying party often enough that the practice is standard and the losing party is the only source of this saying.',
        consequence: 'Universal, unshakeable, and repeated by the same people who commission the next assessment, because there is nothing else to commission.',
        floorOrdinal: 4,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-ledger-holds-a-name',
        saying: 'They have the name written down and they will not say it. Asked twice by somebody who could have made them, and refused both times on a form.',
        saidBy: 'a Marches placer, who was there for one of the refusals',
        aboutId: 'house-ninefold-ledger',
        aboutName: 'the Ninefold',
        accuracy: 'true',
        underneath: 'Correct in every part, including the detail that the refusal was procedural rather than defiant, which is the part everybody drops when they repeat it. The Ledger holds a name from a scar in its own ledgers and has released it to nobody.',
        consequence: 'The Ledger is the only body in either province that can be relied on to have a record and be relied on not to hand it over, which is why it is used and why it is hated.',
        floorOrdinal: 12,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-held-names-registration-is-a-tax',
        saying: 'It is a toll with a ledger in front of it. Three stones a year to write down a name they already have.',
        saidBy: 'anybody who has passed through a city gate twice',
        aboutId: 'house-held-names',
        aboutName: 'the name-house',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'It is the house\'s real income and the complaint is fair. What the payer does not know is what the register is for on the other side, which is a question of who is permitted to hold a name at all, and that is one of the live disputes between the houses rather than a revenue scheme.',
        consequence: 'Registration is evaded wherever it can be, and the people who evade it are exactly the people the register was built to find, so the evasion is the signal.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: 'house-held-names'
    },
    {
        id: 'rumour-measured-span-charges-for-air',
        saying: 'Priced by true distance. Their true distance. You cannot walk it to check and that is the whole trade.',
        saidBy: 'a caravan master who uses the couriers anyway',
        aboutId: 'house-measured-span',
        aboutName: 'the Span',
        accuracy: 'true',
        underneath: 'Precisely right, stated as an accusation, and the house would agree with the sentence and not with the tone. Nobody outside the Span can verify a true li and everybody pays.',
        consequence: 'The one complaint in the world that has never produced a competitor, because a competitor would have to be able to measure.',
        floorOrdinal: 4,
        regionId: null,
        insiderFactionId: 'house-measured-span'
    },
    {
        id: 'rumour-span-gates-go-somewhere-bad',
        saying: 'The old gates still open. They open on somewhere you do not come back from, which is why the Span walks its own letters.',
        saidBy: 'a waystation keeper on the border road',
        aboutId: 'house-measured-span',
        aboutName: 'the Span',
        accuracy: 'garbled',
        underneath: 'Terminals from the predecessor house do still answer and some of them open somewhere breathable, which is a fact the Span finds difficult and does not discuss. The step that has gone missing is that the Span does not use them because it cannot make a permanent two-way span at all, and has not been able to for centuries.',
        consequence: 'Couriers are assumed to be walking out of caution rather than out of incapacity, which is a reputation the house has never corrected and could not afford to.',
        floorOrdinal: 10,
        regionId: null,
        insiderFactionId: 'house-measured-span'
    },
    {
        id: 'rumour-oaths-cannot-be-broken',
        saying: 'Swear at the hall and that is the end of it. It is not a promise, it is a fact about you afterwards.',
        saidBy: 'a merchant explaining why the fee is worth it',
        aboutId: 'house-bound-word',
        aboutName: 'the oath hall',
        accuracy: 'garbled',
        underneath: 'An oath binds to ground, and there is a house whose whole trade is that ground can be unfixed, which means an oath sworn in the wrong place has nothing to bind to. The merchant\'s version has lost the condition, which is the only part that matters.',
        consequence: 'Oaths get sworn cheaply in unsurveyed places by people who think the words are doing the work, and the resulting disputes are a steady income for the arbitration benches.',
        floorOrdinal: 6,
        regionId: null,
        insiderFactionId: 'house-bound-word'
    },
    {
        id: 'rumour-azure-cloud-takes-anybody',
        saying: 'They take anybody. Walk up, stand in the line, and you are in by autumn.',
        saidBy: 'a father who has walked his son a hundred li',
        aboutId: 'sect-azure-cloud-pavilion',
        aboutName: 'the Pavilion',
        accuracy: 'garbled',
        underneath: 'The Pavilion recruits harder than anybody and takes people onto probation at a rung where nobody else would look at them, which is a real and unusual door. It is not membership, and the distinction between being taken on and being admitted is the one the queue does not know exists.',
        consequence: 'The largest admission queue in either province, and a standing population of probationers in the sect town who are neither in nor out and cannot afford to go home.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-azure-cloud-pavilion'
    },
    {
        id: 'rumour-bone-lantern-buys-bodies',
        saying: 'They pay for the dead. Not grandly. Steadily, and they take what nobody claims, and the carriers all know the rate.',
        saidBy: 'a corpse carrier who has taken the money',
        aboutId: 'sect-bone-lantern-cult',
        aboutName: 'the lantern people',
        accuracy: 'true',
        underneath: 'Correct and openly enough done that the trade is watched. The cult recruits out of the corpse-carrying trade without disguising it, which is why the trade is the one mortal occupation near a sect that a magistrate keeps a list of.',
        consequence: 'Corpse carriers are treated as half-informants everywhere and are paid a little above the wage for the work in order to keep them talking to somebody else.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-bone-lantern-cult'
    },
    {
        id: 'rumour-gleaners-lost-a-man-on-a-bet',
        saying: 'He went in on a wager. Company sealed it up after and raised the wager, which tells you what the Company is.',
        saidBy: 'every Gleaner, as a joke about the Marches',
        aboutId: 'sect-gleaners-company',
        aboutName: 'the Company',
        accuracy: 'true',
        underneath: 'True in every particular and told as a joke, which is the entire risk assessment the region has for that site. Nobody has improved on it and nobody has needed to.',
        consequence: 'The site stays sealed because the story does the work a perimeter would cost money to do, and the Company is aware of this and has never said so.',
        floorOrdinal: 6,
        regionId: 'region-quiet-marches',
        insiderFactionId: 'sect-gleaners-company'
    },
    {
        id: 'rumour-weir-office-owns-the-water',
        saying: 'Nothing moves on the water without the Office and the Office is one man. Take the man and you take the water.',
        saidBy: 'a Low Fall boat family, in private',
        aboutId: 'sect-weir-office',
        aboutName: 'the Office',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The Weir Master is the strongest thing the Office has and the water rights are held by an arrangement rather than by him, so removing him would produce a succession rather than a vacancy. The saying is a reasonable reading of a small institution with one visible person on top of it.',
        consequence: 'The Office is threatened in this specific form about once a generation, and each time it responds by making the arrangement more legible to the people who would have to honour it.',
        floorOrdinal: 8,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-weir-office'
    },
    {
        id: 'rumour-severed-do-not-have-names',
        saying: 'They gave up their names. That is the whole of it. There is nothing else to know and asking is how you find out there is nothing else to know.',
        saidBy: 'a Low Fall elder, closing the subject',
        aboutId: 'sect-the-severed',
        aboutName: 'the Severed',
        accuracy: 'true',
        underneath: 'Accurate, and the elder is right that it is nearly all anybody outside knows. Their people are entered on rolls by what they are rather than who, and the province has stopped finding this remarkable.',
        consequence: 'A Severed cannot be named in a complaint, a suit or a bounty, which is a legal fact the province works around rather than one it has ever tested.',
        floorOrdinal: 10,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-the-severed'
    },
    {
        id: 'rumour-hollow-court-does-not-exist',
        saying: 'There is no such thing. There is a name people say when they do not want to say who actually told them to stop.',
        saidBy: 'a sceptical market-town scribe who reads everything',
        aboutId: 'sect-hollow-court',
        aboutName: 'the Hollow Court',
        accuracy: 'invented',
        underneath: 'It exists, it is at the ceiling of the visible world, and it does not announce, deny, correct or brief, which produces exactly this scepticism in exactly this kind of person. Opacity that complete is indistinguishable from absence to anybody reasoning from documents.',
        consequence: 'The scribe is the most literate person in his town and is the one giving out the worst information about the largest thing near it, and is trusted accordingly.',
        floorOrdinal: 14,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-court-business-shuts-roads',
        saying: 'Road is shut past the ford. Court business, so it will be shut a while. Go round by the mill.',
        saidBy: 'a ferryman, mid-sentence, moving on to the price of salt',
        aboutId: 'sect-hollow-court',
        aboutName: 'the Court',
        accuracy: 'unresolved',
        underneath: 'The road is shut and nobody at the ferry knows who shut it. "Court business" is the phrase the province uses for a closure with no notice attached, and it is right often enough to be useless as evidence and wrong often enough to be dangerous as a habit.',
        consequence: 'Every unexplained closure in the Low Fall is attributed upward, so the actual pattern of who closes roads is invisible to everybody who is not counting.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: null
    },
    {
        id: 'rumour-stonewright-sets-the-rate',
        saying: 'The rate is the rate. There is no arguing with it because there is nobody to argue with, only a hall and a scale.',
        saidBy: 'a stone dealer who has tried',
        aboutId: 'sect-stonewright-consortium',
        aboutName: 'the assay hall',
        accuracy: 'true',
        underneath: 'The assay is the assay and the Consortium\'s whole standing rests on it not being negotiable. There is a person who sets it and the dealer has correctly worked out that meeting them would not help.',
        consequence: 'Every price in the two economies is ultimately quoted against a number a stone dealer cannot argue with, which is what makes the cash-to-stone rate legible at all.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-stonewright-consortium'
    },
    {
        id: 'rumour-crucible-guild-fixes-prices',
        saying: 'Fixed rate, no haggling, take it or carry your basket home. Fair, and dull, and I would rather it were neither.',
        saidBy: 'an herb picker, resigned',
        aboutId: 'sect-cinnabar-crucible-guild',
        aboutName: 'the Guild',
        accuracy: 'true',
        underneath: 'Exactly the arrangement, and the picker\'s two adjectives are the whole of the province\'s opinion. The Guild buys at a fixed rate because a variable one would put its own supply into the hands of whoever could shout loudest at a gate.',
        consequence: 'Herb picking is the only mortal trade in the Low Fall with a predictable income, which is why it is worked by families rather than by drifters.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-cinnabar-crucible-guild'
    },
    {
        id: 'rumour-ashen-forge-swords-are-ploughs',
        saying: 'Half of what they sell was in the ground last year. You are buying somebody\'s ploughshare with a new edge on it.',
        saidBy: 'a caravan guard who has broken two',
        aboutId: 'sect-ashen-forge-clan',
        aboutName: 'the Forge',
        accuracy: 'true',
        underneath: 'Mortal steel from the Forge is reforged from ploughed-up fragments and the clan has never pretended otherwise. The guard has correctly identified the material and drawn the correct conclusion about what it will survive.',
        consequence: 'Mortal blades are priced as consumables by anybody who fights for a living, and a cultivator\'s blade starts at many times the figure, which is the first hard number a new cultivator meets.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: 'sect-ashen-forge-clan'
    },
    {
        id: 'rumour-nine-peaks-refuse-money',
        saying: 'They will not take coin. They will take your labour and your food and your time and they will be very pleasant about it, and at the end you owe them more than coin.',
        saidBy: 'a merchant who has hosted them',
        aboutId: 'sect-nine-peaks-ascetic-order',
        aboutName: 'the ascetics',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The refusal is doctrinal rather than a technique, and the merchant is describing a real effect and attributing it to a strategy nobody in the order is running. What actually accumulates is obligation, which the order does not track and the merchant does.',
        consequence: 'The order is welcome everywhere and trusted nowhere with anything that has to be settled, and has never understood why.',
        floorOrdinal: 4,
        regionId: null,
        insiderFactionId: 'sect-nine-peaks-ascetic-order'
    },
    {
        id: 'rumour-clear-river-counts-in-crossings',
        saying: 'They will not take your money for a crossing. They will write it down. That is worse and you will find out how much worse.',
        saidBy: 'a Low Fall trader warning a newcomer',
        aboutId: 'sect-clear-river-alliance',
        aboutName: 'the Alliance',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The Alliance genuinely counts in crossings owed rather than cash and this is a favour rather than a trap: a crossing is cheap and the debt is redeemable in crossings. The trader has assumed a ledger must be predatory because every other ledger he deals with is.',
        consequence: 'Newcomers pay cash for ferries they could have had free, and the Alliance takes the cash, and neither side has ever raised it.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: 'sect-clear-river-alliance'
    },
    {
        id: 'rumour-sixmile-wardens-are-finished',
        saying: 'The Wardens are six old men and a bell. They will come if you ring it and there is not much point ringing it.',
        saidBy: 'a Sixmile hamlet farmer, who rings it anyway',
        aboutId: 'sect-sixmile-wardens',
        aboutName: 'the Wardens',
        accuracy: 'true',
        underneath: 'The Wardens are the smallest standing body in either province and the assessment is accurate. They still come, which is the part the farmer is not saying and the reason he rings.',
        consequence: 'The Marches\' entire beast-culling arrangement at the low end rests on a body everybody has written off, and it has not failed yet.',
        floorOrdinal: 0,
        regionId: 'region-quiet-marches',
        insiderFactionId: 'sect-sixmile-wardens'
    },
    {
        id: 'rumour-flame-sect-hall-still-burns',
        saying: 'There is a hall up in the caldera that never went out. They leave it alone out of respect for whoever lit it.',
        saidBy: 'caldera villagers, as settled local fact',
        aboutId: 'sect-nine-abyss-flame-sect',
        aboutName: 'the Flame Sect',
        accuracy: 'true_and_wrong_about_why',
        underneath: 'The hall is there and still lit. The sect leaves it alone because it has read the node and knows what leaving it alone is worth, which is a survey decision rather than a courtesy.',
        consequence: 'The villages treat the site as sacred and unguarded, so nobody local robs it and nobody local warns an outsider off it either.',
        floorOrdinal: 6,
        regionId: null,
        insiderFactionId: 'sect-nine-abyss-flame-sect'
    },
    {
        id: 'rumour-lantern-hall-reads-your-letters',
        saying: 'They read it before they pay you. Everybody knows that. Write nothing you would not say at the gate.',
        saidBy: 'a scribe to another scribe, on the first day',
        aboutId: 'sect-lantern-hall',
        aboutName: 'the Hall',
        accuracy: 'true',
        underneath: 'They do, and so does the other body that hires scribes, and neither has ever concealed it. The advice is correct and the tone of settled grievance is unearned.',
        consequence: 'Literacy in a market town is a small and watched population, and every scribe assumes every other scribe is reporting, which is roughly right.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: 'sect-lantern-hall'
    },
    {
        id: 'rumour-narrow-hour-knows-when-you-will-die',
        saying: 'They can tell you the hour. They will not, and the fee for asking is real, and the people who have paid it do not say what they were told.',
        saidBy: 'a city broker who has never paid it',
        aboutId: 'house-narrow-hour',
        aboutName: 'the hour-house',
        accuracy: 'unresolved',
        underneath: 'The house does not discuss what its readings say and the people who have commissioned one are contractually silent, so there is no evidence either way that anybody outside the house can reach. The catalog does not settle it and should not.',
        consequence: 'The fee has risen for two centuries on a reputation nobody has ever tested, which is a fact about markets rather than about divination.',
        floorOrdinal: 12,
        regionId: null,
        insiderFactionId: 'house-narrow-hour'
    },
    {
        id: 'rumour-quiet-cut-is-a-hiring-name',
        saying: 'It is not a house, it is a way of saying you hired somebody. Nobody has ever met one and everybody has used the phrase.',
        saidBy: 'a city guard captain, dismissively',
        aboutId: 'house-quiet-cut',
        aboutName: 'the quiet cut',
        accuracy: 'invented',
        underneath: 'It is a house, it is old, and it is among the strongest bodies either province deals with. The captain has generalised correctly from the fact that the phrase is used loosely and incorrectly from the fact that he has not met one.',
        consequence: 'Every killing with no obvious author is described with a phrase the speaker believes is a figure of speech, which means the province cannot distinguish the house\'s actual work from anybody else\'s.',
        floorOrdinal: 14,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-survey-signs-everything',
        saying: 'Nothing under the Low Fall is anybody\'s until it has been signed for, and there is one signature, and you will never see the hand.',
        saidBy: 'a vein steward explaining a delay',
        aboutId: 'apex-deep-survey',
        aboutName: 'the Survey',
        accuracy: 'true',
        underneath: 'Correct, and understated. A grant is a contract and declining to sign one ends the body that needed it, which is a power exercised by not doing anything.',
        consequence: 'Every negotiation about ground in the province has an absent party in it whom nobody present has met, and the stewards have stopped finding this strange.',
        floorOrdinal: 16,
        regionId: 'region-low-fall',
        insiderFactionId: null
    },
    {
        id: 'rumour-long-cut-is-a-road-company',
        saying: 'The Long Cut is a road outfit. They keep the ground open across the provinces and they take a cut of what moves on it, which is where the name comes from.',
        saidBy: 'a border-road placer, confidently',
        aboutId: 'apex-long-cut',
        aboutName: 'the Long Cut',
        accuracy: 'garbled',
        underneath: 'It holds driven ground across provinces and administers all of it directly, which from a road is indistinguishable from a road company. The name is not about a cut of anything and the placer has reverse-engineered an etymology from a business he understands.',
        consequence: 'A confident wrong explanation that circulates faster than the correct one because it is shorter and answers the question, which is the general reason garbled sayings win.',
        floorOrdinal: 10,
        regionId: 'region-quiet-marches',
        insiderFactionId: null
    },
    {
        id: 'rumour-tally-court-still-sits',
        saying: 'The Tally Court still sits. They meet at the old place once a year and the fact that nobody attends does not stop them.',
        saidBy: 'an antiquarian in a city archive',
        aboutId: 'house-tally-court',
        aboutName: 'the Tally Court',
        accuracy: 'stale',
        underneath: 'The house is gone. What survives is the practice of dating certain documents to a session, which is a form filled in rather than a body sitting, and the antiquarian has read the forms and drawn the natural conclusion.',
        consequence: 'A steady trickle of correspondence addressed to a body that cannot receive it, which one of the surviving houses quietly answers because it is easier than explaining.',
        floorOrdinal: 18,
        regionId: null,
        insiderFactionId: null
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT PEOPLE SAY ABOUT THE GROUND
//
// Place sayings are the ones most worth acting on and the most often wrong,
// because a scar or a sealed compound is the one kind of dangerous thing an
// ordinary person can walk to. Note the pattern: the villages nearest a site
// are consistently the best informed about what it DOES and the worst informed
// about what it IS.
// ─────────────────────────────────────────────────────────────────────────

const ABOUT_PLACES: readonly Rumour[] = [
    {
        id: 'rumour-dead-verge-is-a-boundary',
        saying: 'Go to the Verge and stop. Not because of anything in it. Because the ones who go past it come back wrong or they do not come back, and either way you have lost a man.',
        saidBy: 'a Marches carver, giving directions',
        aboutId: 'region-quiet-marches',
        aboutName: 'the Verge',
        accuracy: 'true',
        underneath: 'The practice is correct and the reasoning is empirical rather than explanatory. Nobody in the Marches can say what the site is and the rule about it has held for long enough that nobody needs to.',
        consequence: 'The most reliable safety rule in the province is held by people who cannot justify it, and a visiting cultivator who asks for the reason and is given none frequently decides there is none.',
        floorOrdinal: 0,
        regionId: 'region-quiet-marches',
        insiderFactionId: null
    },
    {
        id: 'rumour-gapwater-face-is-worked-out',
        saying: 'The face is finished. It has been finished for years. The grant price says otherwise and the grant price is the only thing anybody believes.',
        saidBy: 'a Gapwater carver at the end of a season',
        aboutId: 'region-quiet-marches',
        aboutName: 'the Gapwater face',
        accuracy: 'unresolved',
        underneath: 'Whether a face is worked out is exactly the question the grant price is supposed to answer and exactly the question the carvers cutting it are best placed to answer, and the two answers have disagreed for a decade. Nobody has an instrument that settles it.',
        consequence: 'Carvers pay a day-rate they believe is fraudulent for ground they believe is empty, because the alternative is not cultivating, and this is what the Marches means by work.',
        floorOrdinal: 0,
        regionId: 'region-quiet-marches',
        insiderFactionId: null
    },
    {
        id: 'rumour-dryrun-drank-a-river',
        saying: 'There was water there. My grandmother drew from it. Then something upstream took it and the bed is dry and the name is all that is left of the river.',
        saidBy: 'a Drowned Reach villager, pointing',
        aboutId: 'region-drowned-reach',
        aboutName: 'The Bitter Crossing',
        accuracy: 'unresolved',
        underneath: 'The bed is dry, the name records a river, and no record in either province says what happened to it. Water moves for reasons the world has plenty of and no evidence survives that points at any of them.',
        consequence: 'Every dispute about water rights in the Reach eventually cites The Bitter Crossing as precedent for something, and it is cited for opposite conclusions by both sides.',
        floorOrdinal: 0,
        regionId: 'region-drowned-reach',
        insiderFactionId: null
    },
    {
        id: 'rumour-the-sounding-answers',
        saying: 'Shout at it and it answers late. Not an echo. Later than an echo, and not always the same thing you said.',
        saidBy: 'boys from Sweetspring Isle, who go there on a dare',
        aboutId: 'region-drowned-reach',
        aboutName: 'the Sounding',
        accuracy: 'unresolved',
        underneath: 'The site is named for the phenomenon and no competent body has ever published on it. The boys are the most numerous observers and their evidence is the evidence of boys on a dare.',
        consequence: 'The single most-attested strange thing in the Reach rests entirely on the testimony of children, which is why no institution has ever looked at it.',
        floorOrdinal: 0,
        regionId: 'region-drowned-reach',
        insiderFactionId: null
    },
    {
        id: 'rumour-scarwater-is-named-for-water',
        saying: 'Scarwater. Named for the water, obviously. There is water and it comes off the bad ground and you do not drink it.',
        saidBy: 'a Scarwater market trader, patiently',
        aboutId: 'region-low-fall',
        aboutName: 'Scarwater',
        accuracy: 'true',
        underneath: 'Right, and the trader is right to be patient, because he is asked constantly by visitors who have decided the name must be about something grander. The scar is the older half of the name and the water is what people deal with.',
        consequence: 'A market town whose entire relationship with the largest event in its history is a rule about not drinking, which is what most places do with most history.',
        floorOrdinal: 0,
        regionId: 'region-low-fall',
        insiderFactionId: null
    },
    {
        id: 'rumour-undersnow-has-a-door',
        saying: 'There is a door under the snow up there and it opens the year it wants to. Two men have been through and one of them came back with a bad arm and a bag.',
        saidBy: 'a White Stair village elder',
        aboutId: 'region-white-stair',
        aboutName: 'Undersnow',
        accuracy: 'garbled',
        underneath: 'There is a sealed site and the seasonal element is real, because it is under snow for most of the year and reachable in a narrow window. The window is weather rather than intent, and the bag is either a real find or the reason the elder has an audience.',
        consequence: 'The window is worked hard by people who believe the door chooses, which means they go when they feel chosen rather than when the ground is safe.',
        floorOrdinal: 4,
        regionId: 'region-white-stair',
        insiderFactionId: null
    },
    {
        id: 'rumour-fourhands-counts-you-out',
        saying: 'They count you out at Fourhands and they count you back. If the numbers do not match they do not send anybody after you. They write it down.',
        saidBy: 'a waystation keeper, stating the policy',
        aboutId: 'region-white-stair',
        aboutName: 'Fourhands',
        accuracy: 'true',
        underneath: 'Exactly the policy, stated exactly, and the keeper is not being callous. A waystation on that road has no capacity to search and a record is the only thing it can honestly offer.',
        consequence: 'The most accurate mortality figures for the White Stair passes exist in a waystation ledger nobody has ever asked to see.',
        floorOrdinal: 0,
        regionId: 'region-white-stair',
        insiderFactionId: null
    },
    {
        id: 'rumour-mudsummer-swallows-carts',
        saying: 'Do not take a loaded cart across in the wet. It is not deep. It does not need to be deep.',
        saidBy: 'a Wide Field carter, who lost one',
        aboutId: 'region-wide-field',
        aboutName: 'Mudsummer',
        accuracy: 'true',
        underneath: 'Correct and hard-won. The saying is one of the small number in the world that is purely practical, carries no theory at all, and has never been improved on.',
        consequence: 'Wide Field carters route around a site in the wet season, which adds a day and is the reason the road bends where it does.',
        floorOrdinal: 0,
        regionId: 'region-wide-field',
        insiderFactionId: null
    },
    {
        id: 'rumour-thirdwall-had-two-walls',
        saying: 'Thirdwall, because there were two before it. Both came down. This one has not, yet, and people say yet.',
        saidBy: 'a Wide Field city gate guard',
        aboutId: 'region-wide-field',
        aboutName: 'Thirdwall',
        accuracy: 'unresolved',
        underneath: 'The name is old enough that what it counts is not established. The guard\'s reading is the popular one and there is a competing one in a city archive holding that it counts something else entirely, and neither has anything under it but a name.',
        consequence: 'A city whose founding story is a superstition about its own defences, maintained enthusiastically by the people paid to man them.',
        floorOrdinal: 0,
        regionId: 'region-wide-field',
        insiderFactionId: null
    },
    {
        id: 'rumour-veins-can-be-used-up',
        saying: 'It thins. Whatever they tell you, it thins, and the ones who tell you it does not are the ones selling access to it.',
        saidBy: 'an old cultivator who has rented on three veins',
        aboutId: null,
        aboutName: null,
        accuracy: 'true',
        underneath: 'The whole of the present age is downstream of this being true, and it is not seriously disputed by anybody who has been alive long enough to see it. What is disputed is the rate.',
        consequence: 'Cave rent on a good vein is the largest recurring expense in a cultivator\'s life and is priced by people who expect the ground to outlast the tenant, which the tenant does not believe.',
        floorOrdinal: 6,
        regionId: null,
        insiderFactionId: null
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT PEOPLE SAY ABOUT THE DEEP MATERIAL
//
// The ages, the things that are sealed, and what is above the sky. Weighted
// rare on purpose - a world where the ancient past is common talk has no
// ancient past. Almost everything in this section is wrong, and the ones that
// are right are held by people nobody sensible believes.
// ─────────────────────────────────────────────────────────────────────────

const ABOUT_THE_DEEP: readonly Rumour[] = [
    {
        id: 'rumour-the-old-people-were-stronger',
        saying: 'Everything good was made before. Nobody has built anything that lasted in living memory and nobody will. We are living in somebody\'s house.',
        saidBy: 'a stonemason who repairs what he cannot make',
        aboutId: null,
        aboutName: null,
        accuracy: 'true',
        underneath: 'The present age is late and every institution in it is sitting in something it did not build. The mason has worked this out from mortar, which is a better instrument than most of the arguments about it.',
        consequence: 'A settled provincial fatalism that is also correct, and which no institution has any interest in contradicting because the alternative claim would have to be demonstrated.',
        floorOrdinal: 0,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-sky-was-opened-once',
        saying: 'It was open. Anybody could go. Then somebody shut it and the argument since has been about who.',
        saidBy: 'a wandering preacher with a small following',
        aboutId: null,
        aboutName: null,
        accuracy: 'garbled',
        underneath: 'Whether the way up was ever open, and what closed it if it was, is an argument between serious institutions who hold incompatible readings and none of whom would recognise the preacher\'s version. The step that has gone missing is that nobody agrees it was ever open.',
        consequence: 'The preacher can fill a market square, and every institution that could correct him regards correcting him in public as the worse outcome.',
        floorOrdinal: 8,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-something-is-under-the-hall',
        saying: 'There is something under it. Not buried, sealed, and there is a difference, and the difference is that a sealed thing was put there by people who expected it to want out.',
        saidBy: 'a sect town innkeeper who has heard disciples talk',
        aboutId: null,
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'A handful of institutions have something dormant under them and the distinction the innkeeper draws is a real one. His inference about intent is his own; sealing is done for several reasons and expecting the thing to want out is only one of them.',
        consequence: 'Sects lie about whether they have one in both directions, and an outsider cannot tell a sect with something under it from a sect with nothing, which is the entire value of the ambiguity.',
        floorOrdinal: 10,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-ancestors-still-answer',
        saying: 'They talk to theirs. That is the whole difference between a great sect and ours. Not disciples, not ground. A voice.',
        saidBy: 'an outer disciple of a small sect, bitterly',
        aboutId: null,
        aboutName: null,
        accuracy: 'true_and_wrong_about_why',
        underneath: 'A small number of institutions have a line to somebody on the far side and it is the most valuable thing any of them hold. It is not the difference between a great sect and a small one - most great sects have no such thing either, and are great for the ordinary reason, which is ground.',
        consequence: 'A recurring and corrosive belief among the disciples of poor sects that the gap is unbridgeable in principle, which makes it harder to bridge in practice.',
        floorOrdinal: 12,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-nothing-comes-back-down',
        saying: 'Whatever is up there, none of it comes down. Anybody selling you something that came down is selling you a stone.',
        saidBy: 'an auction house floor clerk, off the record',
        aboutId: null,
        aboutName: null,
        accuracy: 'garbled',
        underneath: 'Nothing goes UP with a person who crosses, which is why the years before a crossing are spent divesting and why the parting gift is the most prestigious thing an institution can hold. Things do come down, rarely, and the clerk has correctly identified that most of what is offered as one is not.',
        consequence: 'The clerk\'s scepticism is the house policy that keeps the auction floor credible, and it also means a genuine item arriving without provenance is refused at the door.',
        floorOrdinal: 20,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-war-was-their-fault',
        saying: 'They started it. Everybody knows how it started and it was them, and if you ask on the other side of the line they will tell you the same sentence about us.',
        saidBy: 'an old cultivator of either tradition, aware of the symmetry',
        aboutId: null,
        aboutName: null,
        accuracy: 'unresolved',
        underneath: 'Both traditions teach an account of who started the war and both accounts are wrong in the same direction. This speaker has noticed the symmetry, which is as far as anybody outside a serious archive gets.',
        consequence: 'A live grudge across a provincial boundary, kept warm by two curricula, with no surviving record either side would accept as settling it.',
        floorOrdinal: 8,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-the-count-is-wrong',
        saying: 'The year is not the year. Somebody dropped a stretch of it and the count has been out ever since and everybody dates from the wrong place.',
        saidBy: 'a city archivist who has compared two calendars',
        aboutId: null,
        aboutName: null,
        accuracy: 'true',
        underneath: 'There is an offset between reckonings and it is a real discrepancy that the calendars themselves record. What the offset conceals is a separate question, and the archivist has found the first half of it.',
        consequence: 'An archivist with a correct and unpopular finding, which is dismissed by everybody whose property and lineage claims are dated in the reckoning he is questioning.',
        floorOrdinal: 16,
        regionId: null,
        insiderFactionId: null
    },
    {
        id: 'rumour-a-house-was-put-down',
        saying: 'There was another one. It is not that it fell. It was put down, and the ones who put it down are the ones who tell you it fell.',
        saidBy: 'a Dao house adoptee who has read too much of his own archive',
        aboutId: null,
        aboutName: null,
        accuracy: 'unresolved',
        underneath: 'More than one house is gone and the official account of at least one of them is a merger of the losers of both sides who agreed not to write down why. Whether that constitutes being put down is exactly what nobody can establish, including the surviving house.',
        consequence: 'A suspicion held inside the houses more strongly than outside them, because the people with access to the archives are the ones who can see what is missing from them.',
        floorOrdinal: 24,
        regionId: null,
        insiderFactionId: null
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

export const RUMOURS: readonly Rumour[] = [
    ...ABOUT_CULTIVATORS,
    ...ABOUT_INSTITUTIONS,
    ...ABOUT_PLACES,
    ...ABOUT_THE_DEEP
].map(r => RumourSchema.parse(r));

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
//
// Pure, allocation-cheap and index-free by design. The catalog is small enough
// that a scan costs nothing, and an index would be a second thing to keep
// correct for no measurable gain.
// ─────────────────────────────────────────────────────────────────────────

const RUMOUR_BY_ID: ReadonlyMap<string, Rumour> = new Map(RUMOURS.map(r => [r.id, r]));

export function getRumour(id: string): Rumour | undefined {
    return RUMOUR_BY_ID.get(id);
}

/**
 * Every saying attached to one catalog entry.
 *
 * This is the join the discovery channels want: `lore.ts` has already decided
 * that a speaker could say a name, and this says what they would say about it.
 * A name with no rumour attached is said flatly, which is the default and
 * should stay the common case.
 */
export function rumoursAbout(entityId: string): Rumour[] {
    return RUMOURS.filter(r => r.aboutId === entityId);
}

/**
 * Sayings about nothing nameable.
 *
 * The largest single group, and the one a speaker reaches for when they have
 * no name to hand: what everybody thinks cultivators are, what the ground
 * does, what the old people could do. These are the rows that can be said to
 * somebody who knows nothing whatever, which is where every run starts.
 */
export function unattachedRumours(): Rumour[] {
    return RUMOURS.filter(r => r.aboutId === null);
}

/**
 * What this speaker could say, gated exactly as `lore.ts` gates a name.
 *
 * Standing plus insider status, and locality is deliberately not consulted -
 * it is weight for whoever is choosing, never a filter here, because a saying
 * arriving a long way from home is the mechanism that produces most of the
 * garbled ones.
 */
export function rumoursSpeakableBy(speakerOrdinal: number, factionId?: string | null): Rumour[] {
    return RUMOURS.filter(r =>
        speakerOrdinal >= r.floorOrdinal ||
        (r.insiderFactionId !== null && r.insiderFactionId === factionId)
    );
}

/** The ones whose holder is holding something false. */
export function rumoursThatAreWrong(): Rumour[] {
    return RUMOURS.filter(r => WRONG_ACCURACIES.includes(r.accuracy));
}

/**
 * How much of the file is wrong, as a share.
 *
 * Reported rather than asserted at a fixed value: the useful property is that
 * the wrong ones dominate, and pinning an exact fraction would make every
 * addition to the catalog a test failure.
 */
export function shareOfRumoursThatAreWrong(): number {
    return rumoursThatAreWrong().length / RUMOURS.length;
}
