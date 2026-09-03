/**
 * Rogue cultivators: the unaffiliated, who are most of the player's peers and
 * who barely existed in this catalog until now.
 *
 * The world has sects, houses and mortals. It did not have the class of people
 * in between: nobody's disciple, nobody's problem, and the ones actually
 * opening the sealed places the rest of the economy resells. This file gives
 * them a trade list, a bounty market, a supply chain, an auction circuit and a
 * set of customs, all denominated in the mortal economy of `mortal-world.ts`.
 *
 * THE THROUGH-LINE
 * ----------------
 * Being unaffiliated is freedom and precarity at once, and both halves are
 * literal:
 *
 *   no stipend            a sect's outer chores pay 400 cash a month plus
 *                         ground, which is the part that matters
 *   no protection         nobody stands over your crossing, and nobody stands
 *                         at a toll gate for you either
 *   no library            no SHELF, and no queue to stand in for one. A house
 *                         teaches its own on a schedule; outside it there is no
 *                         schedule and nothing you can join
 *   no arbitration        inside the pyramid a dispute goes upward and gets
 *                         ruled on badly and late; outside it, a disagreement
 *                         is settled immediately by whoever is stronger
 *   nobody to complain to which is the whole of it
 *
 * WHAT IS SCARCE IS THE TEACHER, NOT THE PERMISSION
 * ---------------------------------------------------
 * Read the list above as a description of the market and not as a law. There
 * ARE unaffiliated cultivators high on the ladder - `ROGUE_STANDING` exists to
 * say what a province calls one - and nothing about being unaffiliated stops
 * such a person teaching whoever they like. They answer to nobody, which is
 * the point of them.
 *
 * So the difficulty is finding one and being worth their hours, not being
 * permitted. AGENTS.md: a rule modelled as an impossibility throws away the
 * rare event that makes the ordinary case worth having. The ordinary case is
 * that there is nothing to join and nobody owes you an afternoon. The rare
 * one is a person who could, and might.
 *
 * And: no quotas, no obligations, no elder with a use for you, and nobody who
 * can call you back. Some chose it. Most did not, and `WHY_UNAFFILIATED`
 * records the actual distribution rather than the flattering one.
 *
 * MESHING, NOT DUPLICATING
 * ------------------------
 * `OCCUPATIONS` in `mortal-world.ts` is the wage table and stays the wage
 * table. Every trade here points at the occupation ids it is done under and
 * adds only what is different about doing it with no faction behind you:
 * who pays, what is deducted, and what happens when it goes wrong. Where a
 * contract is underwritten off a faction rank table, the unbacked rate is
 * `UNBACKED_DEDUCTION` below the listed wage - computed by
 * `unbackedMonthlyFor`, never written down twice.
 *
 * Nobody here is flagged important, and nothing here is a shortcut into a
 * sect's library.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { STARTING_SPIRIT_STONES } from '../../schema/cultivation.js';
import { PLACE } from './place-names.js';
import {
    CASH_PER_STONE,
    OccupationSchema,
    getOccupation,
    getPrice,
    stonesToCash
} from './mortal-world.js';

// ─────────────────────────────────────────────────────────────────────────
// THE COST OF HAVING NOBODY BEHIND YOU
// ─────────────────────────────────────────────────────────────────────────

/**
 * The cut taken off any contract priced from a faction rank table when the
 * cultivator cannot be looked up in one.
 *
 * A quarter, and it is not a penalty anybody is embarrassed about: the
 * underwriter is pricing the fact that if the escort walks off at the ford
 * there is no institution to complain to. Piece work - heads culled, herbs
 * delivered, stone weight sorted - is not affected, because the goods are the
 * proof and nobody needs a name.
 */
export const UNBACKED_DEDUCTION = 0.25;

/** Occupations paid off a rank table, and therefore discounted for the sectless. */
export const UNDERWRITTEN_OCCUPATION_IDS: readonly string[] = [
    'job-escort',
    'job-formation-hand',
    'job-courier'
];

/** What the listed wage actually pays a cultivator with no faction behind them. */
export function unbackedMonthlyFor(occupationId: string): number | undefined {
    const job = getOccupation(occupationId);
    if (!job) return undefined;
    const rate = UNDERWRITTEN_OCCUPATION_IDS.includes(occupationId)
        ? 1 - UNBACKED_DEDUCTION
        : 1;
    return Math.round(job.cashPerMonth * rate);
}

export const UNBACKED = {
    lacks: [
        {
            what: 'A stipend',
            cost: 'Outer disciple chores pay 400 cash a month and access to sect ground. The stipend is not the point and everybody knows it: the ground is, and it cannot be rented at that price anywhere.'
        },
        {
            what: 'Protection at a crossing',
            cost: 'The single most valuable thing a sect provides. A rogue crosses alone, in a cave nobody was told about, and takes the price of advancement at whatever the unmodified odds happen to be.'
        },
        {
            what: 'A library',
            cost: 'No teacher above the basics at any price a rogue can pay. What is buyable on the road is what somebody dug up, and it is priced at what a desperate person will pay.'
        },
        {
            what: 'Arbitration',
            cost: 'A Ledger bench will hear anybody, for a fee that exceeds most of what is being disputed. Below that fee a disagreement is settled by whoever is stronger, on the spot.'
        },
        {
            what: 'Anybody to complain to',
            cost: 'A backed disciple who is robbed is an incident somebody must answer for. A rogue who is robbed is a rogue who was robbed.'
        },
        {
            what: 'A route upward',
            cost: 'Selection into a parent institution happens through a sect. There is no queue an unaffiliated cultivator can stand in, however good they are.'
        }
    ],
    has: [
        'No quotas, no contribution points, and no elder with a use for them',
        'The whole of what they dig, minus what the buyer can be argued down to',
        'The ability to leave a province in an afternoon, owing nothing to anybody in it',
        'No obligation to be anywhere when a sect war starts'
    ],
    theHonestSummary:
        'Freedom and precarity are the same fact seen from two sides, and which side a particular rogue emphasises tells you mostly about how their last year went.'
} as const;

/** Why they are unaffiliated. The distribution, not the flattering version. */
/**
 * What the world calls a rogue who got high, and why it needs a word at all.
 *
 * Being unaffiliated is ordinary - roughly a quarter of everybody alive carries
 * no house, measured, and at the bottom of the ladder nobody remarks on it.
 * What is not ordinary is getting FAR while unaffiliated, and the reason is in
 * this file already: no house means no stipend, no elder, no shelf and above
 * all no access to materials, which are purchasable and sourceable and require
 * backing to source. Anybody can climb the bottom of the ladder alone. Almost
 * nobody sources what the upper ladder costs alone.
 *
 * So the bands below are not honours anyone confers. They are what a province
 * starts calling somebody once its usual explanation - "they must be somebody's"
 * - has been checked and found to be false. The naming happens TO them.
 *
 * Above Void Refinement the word turns wary rather than admiring, and that is
 * the point of having it. An unbacked cultivator at that height has no house to
 * restrain them and, more to the point, no house to answer for them: there is
 * nobody to send a letter to, nobody to hold responsible, and nothing to take
 * away. Every institution in the province finds that alarming, and none of them
 * can do anything about it, which is precisely why they need a name for it.
 */
export interface RogueStanding {
    /** Lowest ordinal at which the province starts using the word. */
    fromOrdinal: number;
    /** What they get called. Never self-chosen. */
    called: string;
    /** Why the world reaches for a word here rather than earlier. */
    because: string;
}

export const ROGUE_STANDING: readonly RogueStanding[] = [
    {
        fromOrdinal: 0,
        called: 'nobody in particular',
        because:
            'Most of the unbacked are here, most of them stay here, and a province that '
            + 'named them all would be naming a quarter of itself.'
    },
    {
        fromOrdinal: 13,
        called: 'a loose cultivator',
        because:
            'Far enough that somebody has bought a manual and lived long enough to use it. '
            + 'The word is descriptive and slightly dismissive: loose as in unattached, and '
            + 'as in not answerable.'
    },
    {
        fromOrdinal: 21,
        called: 'a wandering senior',
        because:
            'The point at which a house would have to be polite. Nascent Soul is where '
            + 'strangers start being addressed as senior whether or not anybody knows who '
            + 'they are, and where the province stops assuming somebody is a runaway '
            + 'disciple and starts wondering.'
    },
    {
        fromOrdinal: 29,
        called: 'a solitary',
        because:
            'Void Refinement without a house is the thing that is not supposed to happen, '
            + 'because it cannot be done on a book alone. Anybody standing here got the '
            + 'materials some other way, and the province would very much like to know '
            + 'which way, and cannot ask.'
    },
    {
        fromOrdinal: 37,
        called: 'an unowned peak',
        because:
            'The word is about property, not respect. Every other cultivator at this height '
            + 'belongs to somebody - a patriarch, a court elder, an ancestor under a hall - and '
            + 'is therefore an address you can write to and a thing that can be taken away. '
            + 'This one is not, and the whole province has to live beside it.'
    }
];

/**
 * What this province would call an unbacked cultivator of this height.
 *
 * Backed cultivators are not in scope: somebody with a house is described by
 * their house, which is the entire social function of having one.
 */
export function whatTheyCallARogue(ordinal: number): RogueStanding {
    let best = ROGUE_STANDING[0];
    for (const band of ROGUE_STANDING) {
        if (ordinal >= band.fromOrdinal) best = band;
    }
    return best;
}

export const WhyUnaffiliatedSchema = z.object({
    id: z.string(),
    reason: z.string().min(1),
    share: z.enum(['most', 'many', 'some', 'a few']),
    note: z.string().min(50)
});
export type WhyUnaffiliated = z.infer<typeof WhyUnaffiliatedSchema>;

export const WHY_UNAFFILIATED: readonly WhyUnaffiliated[] = [
    { id: 'why-refused', reason: 'Refused at admission', share: 'most', note: 'Turned away at a gate, usually for root quality, sometimes for age, occasionally for a name somebody recognised. The commonest origin by a wide margin and the least talked about.' },
    { id: 'why-too-far', reason: 'Born too far from a gate', share: 'many', note: 'Admission seasons happen where sects are. A hamlet three provinces out produces cultivators who learn from a bought manual and never once stand in a queue.' },
    { id: 'why-expelled', reason: 'Thrown out', share: 'some', note: 'For insubordination, for a theft, for losing an argument with the wrong elder, or for being inconvenient during a succession. The reason given is rarely the reason.' },
    { id: 'why-sect-gone', reason: 'The sect stopped existing', share: 'some', note: 'Absorbed, burned out, or simply not renewed by its patron. The disciples are not redistributed; they are outside the gate on a Tuesday with whatever they were carrying.' },
    { id: 'why-cannot-pay', reason: 'Could not pay the entry', share: 'some', note: 'Several sects charge to be assessed. The fee is small by their standards and is a wall to somebody living on culling contracts.' },
    { id: 'why-record', reason: 'A record that follows them', share: 'a few', note: 'A Held Names entry, a Ledger judgement, a grave-reading conviction. Gates are where registers are read, so a bad register means no gate.' },
    { id: 'why-chose', reason: 'Chose it, and means it', share: 'a few', note: 'A genuine minority. Some of them are proud of it and say so, and are respected for it in a slightly pitying way that they are entirely aware of.' }
];

// ─────────────────────────────────────────────────────────────────────────
// TRADES
// What a sectless cultivator can actually be paid for, pointed at the
// occupations it is done under.
// ─────────────────────────────────────────────────────────────────────────

export const RoguePaySchema = z.object({
    /** How the money arrives, which decides the whole shape of the life. */
    basis: z.enum(['monthly', 'per_job', 'share', 'per_head']),
    /** Typical figure in cash. The stone figure is this over CASH_PER_STONE. */
    cash: z.number().int().min(1),
    note: z.string().min(40)
});
export type RoguePay = z.infer<typeof RoguePaySchema>;

export const RogueTradeSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    minOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Occupation ids in `OCCUPATIONS` this trade is done under. May be empty. */
    occupationIds: z.array(z.string()),
    pay: RoguePaySchema,
    risk: OccupationSchema.shape.risk,
    /** Who is actually holding the purse. */
    whoPays: z.string().min(40),
    /** What it costs to do this with nobody behind you. */
    unbackedCost: z.string().min(40),
    /** Losses, stated plainly, where the trade has a rate worth quoting. */
    deathRate: z.string().min(20).nullable(),
    /** Faction ids named in the entry. */
    factionIds: z.array(z.string())
});
export type RogueTrade = z.infer<typeof RogueTradeSchema>;

export const ROGUE_TRADES: readonly RogueTrade[] = [
    {
        id: 'rogue-ruin-diver',
        name: 'Ruin-diver',
        minOrdinal: 4,
        occupationIds: ['job-gleaner'],
        pay: {
            basis: 'share',
            cash: 9_000,
            note: 'Ninety stones is a good share off a successful dive, and a crew of five gets three or four dives a year out of a site worth entering. The median diver\'s year is worse than a culling contract; their best year is a decade of one.'
        },
        risk: 'lethal',
        whoPays: 'Nobody. A diver is paid by what comes out, sold at the barrow yard or the kerb, and the buyer sets the price knowing precisely how much the seller needs to eat this month.',
        unbackedCost: 'A Company crew has rules, a manifest and somebody who comes looking. An independent crew has an agreement made at the mouth of the shaft, which is exactly as durable as the people who made it.',
        deathRate: 'About one independent diver in four does not see the year out, against roughly one Company gleaner in nine a season on comparable ground. The Company is not safer; it is more selective about which holes.',
        factionIds: ['sect-gleaners-company', 'sect-hollow-bell-wanderers']
    },
    {
        id: 'rogue-grave-reader',
        name: 'Grave-reader',
        minOrdinal: 4,
        occupationIds: [],
        pay: {
            basis: 'per_job',
            cash: 4_000,
            note: 'Forty stones for a body worth finding, and nothing at all for the eleven that were not. The occasional pouch changes a life, which is the entire reason anybody does it.'
        },
        risk: 'lethal',
        whoPays: 'The Pavilion buys dug goods from anybody and asks nothing about the hole. A dealer buys the same goods for less and asks even less.',
        unbackedCost: 'Sects keep records of where their people fell, families remember, and a few of the richest sites are baited. A rogue caught reading a sect\'s grave has no institution to be handed back to.',
        deathRate: 'Nobody counts. Grave-readers who are counted are the ones somebody came looking for.',
        factionIds: ['sect-thousand-treasure-pavilion', 'sect-bone-lantern-cult']
    },
    {
        id: 'rogue-bounty-taker',
        name: 'Bounty-taker',
        minOrdinal: 3,
        occupationIds: ['job-beast-culler'],
        pay: {
            basis: 'per_head',
            cash: 300,
            note: 'Three hundred cash a head on a village contract, which is where the culling wage in the occupation table comes from: four heads a month is an ordinary month.'
        },
        risk: 'high',
        whoPays: 'Village headmen, the Weir Office, a sect with a specific problem, and, at the bad end, a broker holding somebody\'s private grudge.',
        unbackedCost: 'Nothing on beast work: the head is the proof and nobody needs a name. Everything on person-work, where a rogue is the party most easily disowned by whoever posted it.',
        deathRate: 'The standard living for an unaffiliated Qi Condensation cultivator, and the standard way one dies at twenty-six.',
        factionIds: ['sect-weir-office', 'sect-verdant-spring-hall']
    },
    {
        id: 'rogue-escort',
        name: 'Escort for hire',
        minOrdinal: 5,
        occupationIds: ['job-escort', 'job-caravan-guard'],
        pay: {
            basis: 'monthly',
            cash: 1_500,
            note: 'The listed escort wage less the unbacked deduction. Use `unbackedMonthlyFor` rather than this figure: the table moves and this note will not.'
        },
        risk: 'high',
        whoPays: 'The Consortium underwrites the contract and prices it off its own rank table. Merchants hire under that price directly when they think they can get away with it.',
        unbackedCost: 'A quarter off the rate, plus a bond on high-value cargo that a backed escort is not asked for. The bond is returned. The bond is also most of a starting purse.',
        deathRate: null,
        factionIds: ['sect-stonewright-consortium']
    },
    {
        id: 'rogue-mercenary-crew',
        name: 'Standing mercenary crew',
        minOrdinal: 5,
        occupationIds: ['job-escort', 'job-beast-culler'],
        pay: {
            basis: 'per_job',
            cash: 12_000,
            note: 'A hundred and twenty stones for a crew of four to six on a season-long engagement, split by shares and out of which the crew feeds itself.'
        },
        risk: 'high',
        whoPays: 'Sects that need bodies for something they would rather not have disciples seen doing, and unbacked sects that need a border held and have nobody to hold it.',
        unbackedCost: 'A crew is hired precisely because it is deniable, which means it is deniable. Every crew that has worked a border dispute knows a crew that was left holding one.',
        deathRate: null,
        factionIds: ['sect-storm-tyrant-court', 'sect-standing-grove']
    },
    {
        id: 'rogue-formation-hand',
        name: 'Hired formation hand',
        minOrdinal: 8,
        occupationIds: ['job-formation-hand'],
        pay: {
            basis: 'monthly',
            cash: 1_125,
            note: 'The listed formation-hand wage less the unbacked deduction, and the steadiest cash in this file. Impossible in the Quiet Marches, where formations do not run.'
        },
        risk: 'moderate',
        whoPays: 'Any sect maintaining a compound it did not build, which is all of them. Node work is endless and no institution has enough hands for it.',
        unbackedCost: 'A hired hand holds nodes and is never shown the diagram. Twenty years of this teaches somebody a great deal about one compound and nothing transferable, which is the arrangement working as intended.',
        deathRate: null,
        factionIds: ['sect-azure-cloud-pavilion', 'sect-verdant-spring-hall']
    },
    {
        id: 'rogue-seclusion-watch',
        name: 'Seclusion watch',
        minOrdinal: 2,
        occupationIds: ['job-cave-sitter'],
        pay: {
            basis: 'monthly',
            cash: 800,
            note: 'The cave-sitting rate, because it is the same job with the tenant still inside. Paid in advance, monthly, by somebody who will not be able to check.'
        },
        risk: 'low',
        whoPays: 'A cultivator going into seclusion for a sub-rank push who has no sect brothers to sit outside the door.',
        unbackedCost: 'The most trusted work a stranger can be given and the least verifiable. Nobody sensible hires a watch they have not known for a decade, which is why the rate never rises.',
        deathRate: null,
        factionIds: []
    },
    {
        id: 'rogue-dealer',
        name: 'Itinerant dealer',
        minOrdinal: 2,
        occupationIds: ['job-placer-runner'],
        pay: {
            basis: 'monthly',
            cash: 2_200,
            note: 'Good money by the standards of this file, out of which comes stock, a mule and being robbed about once every three years.'
        },
        risk: 'moderate',
        whoPays: 'The customer, in cash or stones, at whatever the road will bear. See `DEALER_MARKUP` for what the road bears.',
        unbackedCost: 'No guild seal means no recourse when the stock is fake, in either direction: the dealer cannot prove the pill is real and the buyer cannot prove it was not.',
        deathRate: null,
        factionIds: ['sect-cinnabar-crucible-guild', 'sect-thousand-treasure-pavilion']
    },
    {
        id: 'rogue-auction-runner',
        name: 'Auction runner',
        minOrdinal: 4,
        occupationIds: ['job-courier'],
        pay: {
            basis: 'per_job',
            cash: 900,
            note: 'Nine stones to carry a lot, a bid or a payment between a consignor and a floor, and to have been visibly unimportant the entire way.'
        },
        risk: 'moderate',
        whoPays: 'Consignors who do not want to be seen at the preview, and buyers who do not want the floor to know who bought.',
        unbackedCost: 'A runner carrying a lot is the most robbable object on the border road, and the Pavilion\'s floor peace stops at its own door and says so in the charter.',
        deathRate: null,
        factionIds: ['sect-thousand-treasure-pavilion', 'house-measured-span']
    },
    {
        id: 'rogue-herb-runner',
        name: 'Guarded-ground herb runner',
        minOrdinal: 6,
        occupationIds: ['job-dangerous-herb-gathering', 'job-herb-picker'],
        pay: {
            basis: 'monthly',
            cash: 1_800,
            note: 'Four times a picker\'s wage, for ground where something is living, and the Guild buys at a fixed rate and does not haggle.'
        },
        risk: 'high',
        whoPays: 'The Cinnabar Crucible Guild at a posted rate, and alchemists off the books at better than the posted rate for anything they do not want logged.',
        unbackedCost: 'No sect claim on the ground means gathering on somebody else\'s, which is tolerated until a bad season and then is not.',
        deathRate: 'About one gatherer in twenty a year, which the Guild publishes and considers acceptable.',
        factionIds: ['sect-cinnabar-crucible-guild', 'sect-verdant-spring-hall']
    }
];

// ─────────────────────────────────────────────────────────────────────────
// BOUNTIES
// Who posts, who honours, and what goes wrong.
// ─────────────────────────────────────────────────────────────────────────

export const BountySchema = z.object({
    id: z.string(),
    what: z.string().min(30),
    /** Faction id, or null where the poster is a village, a family or a broker. */
    posterFactionId: z.string().nullable(),
    posterNote: z.string().min(30),
    /** Typical purse in cash. Divide by CASH_PER_STONE for stones. */
    purseCash: z.number().int().min(1),
    /** What has to be produced to be paid. */
    evidence: z.string().min(20),
    honoured: z.enum(['reliably', 'usually', 'if_witnessed', 'rarely']),
    /** The part a first-time taker does not know. */
    catch: z.string().min(40)
});
export type Bounty = z.infer<typeof BountySchema>;

export const BOUNTIES: readonly Bounty[] = [
    {
        id: 'bounty-village-head',
        what: 'A beast taking livestock inside the fence line',
        posterFactionId: null,
        posterNote: 'A village headman, out of the common fund, agreed at a market-day meeting nobody enjoyed.',
        purseCash: 300,
        evidence: 'The head, or enough of it.',
        honoured: 'reliably',
        catch: 'It is honoured because the village has to live with whoever comes next. It is also the whole common fund, and they will ask you to take part of it in food.'
    },
    {
        id: 'bounty-standing-yard',
        what: 'A standing purse on whatever keeps taking the sorting yard\'s dogs',
        posterFactionId: 'sect-gleaners-company',
        posterNote: 'The Hollowmarket factor, renewed every season for eleven years without ever being claimed.',
        purseCash: 2_000,
        evidence: 'The animal, and the dogs stopping.',
        honoured: 'reliably',
        catch: 'Four takers have gone out for it. Two came back with nothing and two did not come back, and the purse has been raised twice on that basis.'
    },
    {
        id: 'bounty-weir-grant',
        what: 'Clearing a burn-edge chamber before a grant is issued over it',
        posterFactionId: 'sect-weir-office',
        posterNote: 'The Weir Office at Kettle, posted at the grant queue, paid out of the grant fee before the grant exists.',
        purseCash: 8_000,
        evidence: 'A Warden walks it afterwards and signs.',
        honoured: 'reliably',
        catch: 'Paid in grant days at the assay rate rather than cash, which is worth more and cannot be eaten. Marches takers regard this as normal and Low Fall visitors do not.'
    },
    {
        id: 'bounty-consortium-road',
        what: 'A stretch of the border road cleared and kept clear for a season',
        posterFactionId: 'sect-stonewright-consortium',
        posterNote: 'Posted by the assay hall, underwritten against the convoy insurance table, and settled thirty days after the season closes.',
        purseCash: 30_000,
        evidence: 'Convoy losses on that stretch, measured against the table.',
        honoured: 'reliably',
        catch: 'Thirty days is thirty days, deductions are taken for anything lost during the season, and the Consortium has never once failed to pay or once paid early.'
    },
    {
        id: 'bounty-sect-specimen',
        what: 'A named spirit beast wanted alive, or a specific herb-eater wanted dead',
        posterFactionId: 'sect-verdant-spring-hall',
        posterNote: 'Posted at the gate at admission season, when there are the most desperate cultivators standing in front of it.',
        purseCash: 6_000,
        evidence: 'Delivery, and the Hall\'s own examination.',
        honoured: 'usually',
        catch: 'Paid in pills at sect prices, which is better than the cash figure and is not cash. A taker who needs rent this month is negotiating from a bad position and the Hall knows it.'
    },
    {
        id: 'bounty-ledger-judgement',
        what: 'Recovery of a judgement debt the debtor has declined to settle',
        posterFactionId: 'house-ninefold-ledger',
        posterNote: 'A bench on circuit, which posts the judgement and never the method.',
        purseCash: 5_000,
        evidence: 'The debt, recovered, and handed to the bench rather than kept.',
        honoured: 'reliably',
        catch: 'The Ledger honours the purse to the cash and will not tell you what the debtor is protected by. That is not withholding; the bench genuinely does not consider it part of the posting.'
    },
    {
        id: 'bounty-broker-grudge',
        what: 'A named person, posted through a broker who will not say by whom',
        posterFactionId: null,
        posterNote: 'A broker at a market town, taking a fifth, and holding the purse in escrow for exactly as long as it suits him.',
        purseCash: 20_000,
        evidence: 'A token the broker described in advance and can later claim not to recognise.',
        honoured: 'rarely',
        catch: 'This is how a sectless cultivator ends up standing over a body with no payer, no witness, and a Held Names entry against their name inside the month.'
    },
    {
        id: 'bounty-crew-recovery',
        what: 'Bringing out the pouch and manifest of a crew that did not come back',
        posterFactionId: 'sect-gleaners-company',
        posterNote: 'The Company, which posts these itself and pays them itself, and considers the practice load-bearing.',
        purseCash: 3_000,
        evidence: 'The pouch, checked against the manifest in front of you.',
        honoured: 'reliably',
        catch: 'Checked against the manifest means checked. A short pouch is not a dispute; it is the end of your working relationship with the only reliable buyer in the region.'
    },
    {
        id: 'bounty-held-names',
        what: 'An unregistered cultivator, wanted at the gate for the register',
        posterFactionId: 'house-held-names',
        posterNote: 'Posted at nine city gates as a standing rate, in the same notice as the registration fee.',
        purseCash: 1_200,
        evidence: 'The person, at the gate, upright.',
        honoured: 'reliably',
        catch: 'Legal, small, reliable, and despised by everybody the taker is going to want to drink with afterwards. Most rogues will not take it twice.'
    },
    {
        id: 'bounty-lantern-cult',
        what: 'Bodies, or the location of a fresh one, no questions in either direction',
        posterFactionId: 'sect-bone-lantern-cult',
        posterNote: 'Not posted anywhere. Mentioned to corpse carriers, and to diggers who look like they are having a bad season.',
        purseCash: 10_000,
        evidence: 'Delivery, at a place they name on the day.',
        honoured: 'reliably',
        catch: 'They pay well, immediately, and in full, and they take an interest in the seller afterwards that the seller did not agree to and cannot end.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// SUPPLY
// Where a sectless cultivator actually buys a pill, and what that costs.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the road adds to a catalog price, by kind of good.
 *
 * The multiplier is against the price the same object carries over a counter in
 * a market town or at a sect gate. It buys three things a counter does not
 * charge for: the goods being where the buyer is, the seller having carried the
 * risk of getting them there, and no register recording the sale. `fakeRate` is
 * the share of road stock that is not what it says it is, and it is the reason
 * the markup is survivable rather than absurd.
 */
export const DEALER_MARKUP: Record<
    'medicine' | 'manual' | 'material' | 'talisman' | 'stones',
    { multiplier: number; fakeRate: string; note: string }
> = {
    medicine: {
        multiplier: 1.5,
        fakeRate: 'About one road pill in five is not what the wrapper says, and about one in twenty is actively dangerous.',
        note: 'A Minor Healing Pill over a counter is twenty stones. On the road it is thirty, and the buyer has no way to tell until they need it.'
    },
    manual: {
        multiplier: 2.5,
        fakeRate: 'Perhaps a third of road manuals are copies of copies with a line missing, and the missing line is not marked.',
        note: 'Priced at what a cultivator with no teacher will pay, which is everything they have. Nobody who can get a manual through a sect buys one on a road.'
    },
    material: {
        multiplier: 1.2,
        fakeRate: 'Low. Materials are weighable and a cheat is obvious at the assay hall, so the trade is comparatively honest.',
        note: 'The dealer\'s margin here is transport and the buyer\'s alternative is a four-day walk.'
    },
    talisman: {
        multiplier: 1.8,
        fakeRate: 'About one in four is spent and will do nothing, which cannot be established without spending it.',
        note: 'The classic road purchase: cheap enough to risk, expensive enough to hurt, and unverifiable by construction.'
    },
    stones: {
        multiplier: 1.1,
        fakeRate: 'Not fake. Shaved, cut short, or assayed generously, which a Consortium hall will detect and a ford changer will not.',
        note: 'The Consortium sets the rate, so nobody makes money on stones. They make it on the weighing.'
    }
};

/** Road price for a catalog price id, in cash. Never a second economy. */
export function roadPrice(priceId: string, kind: keyof typeof DEALER_MARKUP): number | undefined {
    const price = getPrice(priceId);
    if (!price) return undefined;
    return Math.round(price.cash * DEALER_MARKUP[kind].multiplier);
}

export const DealerSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** What they move. */
    deals: z.array(z.enum(['medicine', 'manual', 'material', 'talisman', 'stones'])).min(1),
    /** Buys, sells, or both. A buyer-only is a fence and should say so. */
    side: z.enum(['sells', 'buys', 'both']),
    regionId: z.string(),
    places: z.array(z.string().min(3)).min(1),
    trust: z.enum(['sound', 'mixed', 'bad']),
    stock: z.string().min(40),
    /** The thing a first-time customer does not know. */
    catch: z.string().min(40),
    factionIds: z.array(z.string())
});
export type Dealer = z.infer<typeof DealerSchema>;

export const DEALERS: readonly Dealer[] = [
    {
        id: 'dealer-circuit-peddler',
        name: 'Circuit peddler',
        deals: ['medicine', 'talisman', 'material'],
        side: 'sells',
        regionId: 'region-low-fall',
        places: [PLACE.SCARWATER, PLACE.NINE_PEAKS],
        trust: 'mixed',
        stock: 'A mule, a fixed loop of eleven villages walked twice a year, and whatever the last market town had cheap.',
        catch: 'He will be back in six months, which is the only guarantee on offer and is genuinely worth something. It is also six months.',
        factionIds: []
    },
    {
        id: 'dealer-guild-castoff',
        name: 'Guild cast-off with real stock',
        deals: ['medicine'],
        side: 'sells',
        regionId: 'region-low-fall',
        places: [PLACE.LOW_FALL, PLACE.SCARWATER],
        trust: 'sound',
        stock: 'Genuine refinements, made by somebody who spent nine years on a bellows and was never let near a cauldron officially.',
        catch: 'No guild seal, so the pills are real and unprovable. Anybody caught reselling them into a sect town is the Guild\'s problem and then his.',
        factionIds: ['sect-cinnabar-crucible-guild']
    },
    {
        id: 'dealer-ford-widow',
        name: 'The ford stall',
        deals: ['medicine', 'material'],
        side: 'both',
        regionId: 'region-low-fall',
        places: [PLACE.SCARWATER],
        trust: 'sound',
        stock: 'Her husband\'s stock, sold down over nine years, plus what she buys off diggers coming out of the Marches at a price they accept because it is cash today.',
        catch: 'The good half of the stock went first. What is left is the part nobody wanted in year one and she will tell you that if you ask.',
        factionIds: ['sect-clear-river-alliance']
    },
    {
        id: 'dealer-barrow-buyer',
        name: 'Barrow-yard buyer',
        deals: ['material', 'manual'],
        side: 'buys',
        regionId: 'region-quiet-marches',
        places: [PLACE.HOLLOWMARKET, PLACE.KETTLE],
        trust: 'mixed',
        stock: 'Buys by weight, sorts, and sells onward to the Low Fall at four times what he paid, which is public knowledge and changes nothing.',
        catch: 'He is the only buyer within four days\' walk and everybody selling to him knows the onward price. That is the trade, and the resentment is part of the price.',
        factionIds: ['sect-gleaners-company']
    },
    {
        id: 'dealer-off-book-appraiser',
        name: 'Off-book appraiser',
        deals: ['manual', 'material', 'talisman'],
        side: 'both',
        regionId: 'region-low-fall',
        places: [PLACE.LOW_FALL],
        trust: 'mixed',
        stock: 'Nothing. He values what you are holding, for cash, in a back room, and knows exactly which floor would take it and at what reserve.',
        catch: 'His valuations are honest and his other customer is the Pavilion. Twice a year something he valued turns up in a catalogue before the owner meant to sell it.',
        factionIds: ['sect-thousand-treasure-pavilion']
    },
    {
        id: 'dealer-ford-changer',
        name: 'Ford changer',
        deals: ['stones'],
        side: 'both',
        regionId: 'region-low-fall',
        places: [PLACE.SCARWATER, PLACE.SWEPTGROUND],
        trust: 'bad',
        stock: 'Cash for stones and stones for cash, at a rate that is always a little worse than the market-town rate and always defensible.',
        catch: 'The rate is fine. The weighing is not, and a Consortium assay hall four days away would find it, which is four days away.',
        factionIds: ['sect-stonewright-consortium']
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE AUCTION CIRCUIT
// Mentioned in the encounter tables and never populated. Populated.
// ─────────────────────────────────────────────────────────────────────────

export const AuctionVenueSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** Who runs it, or null where nobody does and that is the point. */
    runByFactionId: z.string().nullable(),
    regionId: z.string(),
    places: z.array(z.string().min(3)).min(1),
    cadence: z.string().min(15),
    /** Refundable bond to stand on the floor, in spirit stones. */
    entryBondStones: z.number().int().min(0),
    /** What is actually guaranteed, and where the guarantee stops. */
    protections: z.array(z.string().min(30)).min(1),
    whatSells: z.string().min(40),
    /** What a sectless cultivator can expect here, plainly. */
    sectlessNote: z.string().min(60)
});
export type AuctionVenue = z.infer<typeof AuctionVenueSchema>;

export const AUCTION_VENUES: readonly AuctionVenue[] = [
    {
        id: 'auction-low-fall-floor',
        name: 'The public floor at Low Fall',
        runByFactionId: 'sect-thousand-treasure-pavilion',
        regionId: 'region-low-fall',
        places: [PLACE.LOW_FALL],
        cadence: 'Quarterly, with a preview two days before, and the preview has not been open to the public in eight years.',
        entryBondStones: 20,
        protections: [
            'Floor peace inside the hall, enforced by the Pavilion, and stopping at its own door in writing',
            'A catalogue, which is a statement of what the lot is and never of where it came from',
            'Oath witnessing available for large lots, at the oath-hall rate, arranged before the sale rather than after',
            'Registration at the door, which is a protection for the Pavilion and a record for everybody else'
        ],
        whatSells: 'Dug goods, mostly: manuals in grades nobody teaches, materials, spent artifacts, and about four lots a year that a sect sends somebody to stop.',
        sectlessNote: 'A rogue with twenty stones can stand on this floor and bid on anything unreserved, which is a real and unusual openness. What they cannot do is bid on a reserved lot, and the reserved lots are the reason anybody came.'
    },
    {
        id: 'auction-low-fall-reserved',
        name: 'The reserved floor',
        runByFactionId: 'sect-thousand-treasure-pavilion',
        regionId: 'region-low-fall',
        places: [PLACE.LOW_FALL],
        cadence: 'The same day, after the public floor closes, in a room off it.',
        entryBondStones: 300,
        protections: [
            'A named guarantor or a faction seal, without which the bond is not accepted at any size',
            'Settlement through the Pavilion rather than between the parties, which is what the guarantor is guaranteeing',
            'No catalogue leaves the room, and the Pavilion has never published a reserved-floor result'
        ],
        whatSells: 'Heaven-grade and above, and anything the Pavilion has been told to place quietly.',
        sectlessNote: 'A sectless cultivator can be in this room only as somebody\'s agent, and being somebody\'s agent means somebody knows what you carried out of it.'
    },
    {
        id: 'auction-scarwater-kerb',
        name: 'The Scarwater kerb',
        runByFactionId: null,
        regionId: 'region-low-fall',
        places: [PLACE.SCARWATER],
        cadence: 'The evening after the Pavilion\'s factor has taken his pick, on the street, until it is dark.',
        entryBondStones: 0,
        protections: [
            'None whatsoever, stated openly by everybody present and understood as the price of no bond'
        ],
        whatSells: 'Whatever the factor declined, sold fast by people who need cash before they walk back to the Marches.',
        sectlessNote: 'This is where most sectless cultivators actually sell, and where most of them are robbed. The robbery happens on the road out rather than at the kerb, which everybody knows and nobody has solved.'
    },
    {
        id: 'auction-kettle-yard',
        name: 'The Kettle assay yard disposal',
        runByFactionId: 'sect-weir-office',
        regionId: 'region-quiet-marches',
        places: [PLACE.KETTLE],
        cadence: 'Once a season, when forfeited grants and unclaimed salvage are cleared.',
        entryBondStones: 5,
        protections: [
            'The Office runs the sale and takes the money, which makes it orderly and not impartial',
            'Every lot is assayed first, and the assay is published with the lot'
        ],
        whatSells: 'Forfeited grant days, the tools of people who did not come back, and salvage nobody claimed inside the year.',
        sectlessNote: 'The cheapest way into the Marches economy and the only auction in the world where a lot is routinely paid for in grant days rather than stones.'
    },
    {
        id: 'auction-hollowmarket-manifest',
        name: 'The Hollowmarket manifest sale',
        runByFactionId: 'sect-gleaners-company',
        regionId: 'region-quiet-marches',
        places: [PLACE.HOLLOWMARKET],
        cadence: 'Whenever the sorting yard is full, which is about every six weeks.',
        entryBondStones: 0,
        protections: [
            'The manifest, which is the Company\'s own record and is the only warranty offered',
            'Weight is checked in front of the buyer, and disputes are settled by reweighing and nothing else'
        ],
        whatSells: 'Salvage by weight, in lots too large for an individual, to dealers who will break them up.',
        sectlessNote: 'Buyers here are dealers rather than cultivators. A rogue is on the selling side, is offered the yard rate, and takes it because the alternative is carrying it four days to Kettle.'
    }
];

/** What the circuit will and will not let an unaffiliated cultivator do. */
export const AUCTION_ACCESS = {
    canBid: [
        'Any unreserved lot on a public floor, on posting the bond, which is the openness the Pavilion is genuinely proud of',
        'Anything at a kerb, a yard sale or a manifest sale, where there is no floor and therefore no rule',
        'Mortal and earth-grade goods generally, which is most of what a rogue could pay for in any case'
    ],
    cannotBid: [
        'Reserved lots, which require a named guarantor or a faction seal that a rogue by definition does not have',
        'Anything catalogued above heaven grade, which is sent to the Pavilion\'s parent court before the floor ever sees it',
        'Any lot the Consortium has flagged pending assay, which cannot be released to an unregistered buyer at all'
    ],
    theWayAround: [
        'Bid as somebody\'s agent, which works and means that somebody knows exactly what you are holding',
        'Buy the guarantee: a Bound Word bond can stand in for a faction seal, and is priced against the penalty clause rather than the lot',
        'Buy it afterwards from whoever did win it, at a markup, which is a large part of what the kerb is for'
    ],
    theRealConstraint:
        'The bond is not the barrier. A rogue who can afford a heaven-grade lot can afford the bond ten times over, and the number of rogues who can afford a heaven-grade lot is very close to none. The circuit is open to them because their exclusion would cost the Pavilion nothing and their inclusion costs it nothing either.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMS
// Unwritten, unenforced, and kept anyway, because the alternative is that
// nobody can work with anybody.
// ─────────────────────────────────────────────────────────────────────────

export const RoadCustomSchema = z.object({
    id: z.string(),
    custom: z.string().min(40),
    keptBy: z.string().min(20),
    /** What breaking it costs. Never a punishment; always a consequence. */
    breakingIt: z.string().min(40)
});
export type RoadCustom = z.infer<typeof RoadCustomSchema>;

export const ROAD_CUSTOMS: readonly RoadCustom[] = [
    {
        id: 'custom-tell-one-person',
        custom: 'Before going into a hole you tell one person the mouth and the day you are due out. Not a sect, not a register: one person, by name.',
        keptBy: 'Every diver who has been doing it more than two seasons.',
        breakingIt: 'Nothing happens, until it does, and then nobody comes and nobody knows they should have. The people who do not keep this custom are not argued with; they are simply the ones nobody looks for.'
    },
    {
        id: 'custom-shares',
        custom: 'Equal shares to everyone who went in, one extra share to whoever brought the site, and a dead hand\'s share goes to whoever carried their pouch out.',
        keptBy: 'Independent crews, copied off the Company manifest rule and kept because it settles the argument before it starts.',
        breakingIt: 'A crew that shorts a share does not get another crew. The Marches is small and the sorting yard is one yard.'
    },
    {
        id: 'custom-dead-pouch',
        custom: 'A dead cultivator\'s pouch goes to the person they named, if they named one, and is carried out whether or not there is anything in it.',
        keptBy: 'Diggers, road crews and about half of grave-readers, who are quite clear that the custom applies to their own dead and not to anyone else\'s.',
        breakingIt: 'A Ledger bench will hear the case for a fee larger than most pouches, which is exactly why the custom exists and is kept without one.'
    },
    {
        id: 'custom-not-naming-a-site',
        custom: 'You do not name a site you have not finished with, in a room with strangers in it.',
        keptBy: 'Anybody who has lost one that way.',
        breakingIt: 'Somebody is at the mouth of it before you are, and there is nothing to appeal to, because a hole is not property until something has been taken out of it and even then only barely.'
    },
    {
        id: 'custom-the-bell',
        custom: 'A bell hung at a crossroads means members of the league passed within the month, and is left alone by everybody including people who owe them money.',
        keptBy: 'The Hollow Bell Wanderers, and honoured well outside them.',
        breakingIt: 'Taking a bell down is the cheapest way to be known by a league that has no mountain, no rules and five ranks, all of which travel.'
    },
    {
        id: 'custom-two-days',
        custom: 'A recovered manual is not sold for two days, so the sect that lost it can post its notice first.',
        keptBy: 'Fences and off-book appraisers, out of self-interest rather than honour.',
        breakingIt: 'Selling inside two days is how a fence learns who you are, and how a sect learns the same thing about a fortnight later.'
    },
    {
        id: 'custom-crossings-owed',
        custom: 'A ferry debt is counted in crossings rather than cash and is honoured across the whole river, by any ferryman, for years.',
        keptBy: 'The Clear River Fordhall, and by every rogue who has ever needed to be on the other bank at night.',
        breakingIt: 'There is no penalty. There is simply a long river with one organisation on it, and a memory that is longer than the debt.'
    },
    {
        id: 'custom-no-questions',
        custom: 'Nobody asks about the hole. Not the buyer, not the appraiser, not the other people in the queue.',
        keptBy: 'The whole salvage trade, and formalised by the Pavilion, which buys dug goods from anybody and asks nothing.',
        breakingIt: 'Asking is not dangerous. It marks the asker as somebody who has not sold anything before, which is worth about a fifth off the next price they are offered.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const TRADE_BY_ID: ReadonlyMap<string, RogueTrade> = new Map(ROGUE_TRADES.map(t => [t.id, t]));
const BOUNTY_BY_ID: ReadonlyMap<string, Bounty> = new Map(BOUNTIES.map(b => [b.id, b]));
const DEALER_BY_ID: ReadonlyMap<string, Dealer> = new Map(DEALERS.map(d => [d.id, d]));
const VENUE_BY_ID: ReadonlyMap<string, AuctionVenue> = new Map(AUCTION_VENUES.map(v => [v.id, v]));

export function getRogueTrade(id: string): RogueTrade | undefined {
    return TRADE_BY_ID.get(id);
}

export function getBounty(id: string): Bounty | undefined {
    return BOUNTY_BY_ID.get(id);
}

export function getDealer(id: string): Dealer | undefined {
    return DEALER_BY_ID.get(id);
}

export function getAuctionVenue(id: string): AuctionVenue | undefined {
    return VENUE_BY_ID.get(id);
}

/** What a rogue at this ordinal can take. The answer at 0 to 6 is the point. */
export function tradesForOrdinal(ordinal: number): RogueTrade[] {
    return ROGUE_TRADES.filter(t => t.minOrdinal <= ordinal);
}

/** Bounties by how reliably the purse actually arrives. */
export function bountiesHonoured(level: Bounty['honoured']): Bounty[] {
    return BOUNTIES.filter(b => b.honoured === level);
}

/** Who posts work in a given faction's name. */
export function bountiesFrom(factionId: string): Bounty[] {
    return BOUNTIES.filter(b => b.posterFactionId === factionId);
}

/** Venues a cultivator with the starting purse can actually stand on. */
export function venuesAffordableWith(stones: number = STARTING_SPIRIT_STONES): AuctionVenue[] {
    return AUCTION_VENUES.filter(v => v.entryBondStones <= stones);
}

/** Dealers working a region, and which side of the counter they are on. */
export function dealersIn(regionId: string, side?: Dealer['side']): Dealer[] {
    return DEALERS.filter(d => d.regionId === regionId && (side === undefined || d.side === side));
}

/**
 * The entry bond in cash, for comparison with a wage rather than a purse.
 * Twenty stones is two thousand cash, which is a month and a bit of the escort
 * work that would pay for it.
 */
export function bondInCash(venueId: string): number | undefined {
    const venue = VENUE_BY_ID.get(venueId);
    if (!venue) return undefined;
    return stonesToCash(venue.entryBondStones);
}

/** Months of a given trade's pay to cover a catalog price at road markup. */
export function monthsToAffordOnTheRoad(
    priceId: string,
    kind: keyof typeof DEALER_MARKUP,
    occupationId: string
): number | undefined {
    const cost = roadPrice(priceId, kind);
    const monthly = unbackedMonthlyFor(occupationId);
    if (cost === undefined || monthly === undefined || monthly <= 0) return undefined;
    return Number((cost / monthly).toFixed(1));
}

/** Re-exported so a caller never has to reach for a second conversion rate. */
export { CASH_PER_STONE };
