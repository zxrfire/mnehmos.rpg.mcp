/**
 * What it costs to go further than an agreed bout allowed.
 *
 * THE RULING THIS FILE EXISTS TO SATISFY
 * --------------------------------------
 * AGENTS.md, *Agency: do not ban it, and do not soften it*: **"Kill somebody
 * during an agreed bout and you will obviously face consequences."** Nothing
 * stops you. The engine does not reach in and prevent it, and it does not
 * quietly make the bout unable to kill - the blows landed as blows land, and
 * every one of them was minted by the same resolver a killing uses.
 *
 * So this file touches no damage, no wound, no outcome and no death. By the
 * time it is called, all four are already decided and written down. What it
 * decides is the only thing an agreement was ever able to change:
 *
 *     THE WOUND WAS IDENTICAL. THE MEANING WAS NOT.
 *
 * Two people crossing hands by arrangement and two people trying to end each
 * other produce the same torn meridian and a different bill, and the whole of
 * the difference is here, downstream, in who holds an account about it
 * afterwards and how heavy it is.
 *
 * WHY AN ARRANGED BOUT IS THE WORST PLACE IN THE WORLD TO KILL SOMEBODY
 * --------------------------------------------------------------------
 * Not because a rule says so. Because of three facts that are true of an
 * arrangement and are not true of a fight nobody agreed to, and each of them
 * costs the actor something:
 *
 *   THEY CAME TO YOU        An agreed bout is a thing two people arranged, so
 *                           the dead one's people already know who they went to
 *                           meet. `who-was-there-when-it-happened.ts` bounds
 *                           what an engine may claim about bystanders in a
 *                           market town; it has nothing to bound here, because
 *                           the actor is named by the arrangement rather than
 *                           by a witness. This is why an empty courtyard is no
 *                           protection, and why the body-on-the-low-road line
 *                           the world's own killing template carries has no
 *                           counterpart in this file.
 *   THEY WERE NOT DEFENDING The loser was not resisting an attack. They were
 *   ANYTHING                doing a thing disciples do, which their house
 *                           encourages and generally pays for.
 *   YOU SAID YOU WOULD NOT  A house that watches one of its own killed in a
 *                           friendly bout has been told something about the
 *                           person who did it that no duel could have told it.
 *
 * Everything below is those three facts priced, and nothing else is in here.
 *
 * WHAT THIS DOES NOT WRITE, AND MUST NOT
 * --------------------------------------
 * `seedObligations` in `cultivation/combat.ts` already writes the record the
 * LOSER holds, keyed on the outcome alone, and it stays exactly as it is. This
 * file writes the record the loser's PEOPLE hold, which did not exist at all -
 * and for a killing could not, because the resolver's own comment is right that
 * *the dead hold nothing*, so a killing seeded no obligation of any kind and
 * fell out of the ledger entirely.
 *
 * Two writers, two records, no overlap: theirs is the loser's account, this is
 * the house's. Neither recalculates the other, which keeps `grudges.ts`'s rule
 * that severity is written down once and never adjusted afterwards.
 *
 * Pure. No state, no rolls, no I/O, no ladder. Same inputs, same answer.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { ConfrontationOutcome } from '../cultivation/combat.js';
import type {
    GrudgeCause,
    InheritanceRelation,
    ObligationInput,
    Severity
} from '../social/grudges.js';
import type { DayIndex } from '../social/common.js';
import { severityWithHouse } from './what-a-house-will-do-about-it.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE TWO OF THEM SAID IT WAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The terms, and the closed set is the whole point.
 *
 * `src/web/actions.ts` states the rule this obeys: *"`intent` is a free-ish
 * label, and it is safe precisely because NOTHING in the engine branches on it
 * to decide an outcome."* So the parser does not hand a word down here. It
 * recognises the ask and sets one of two values, the way it already sets
 * `Approach.leverage` for a bribe, and this file reads the value rather than
 * anybody's sentence.
 *
 * `open` is the absence of an arrangement, not a declaration of hostility. Two
 * people who fell into a fight and two people who arranged a killing are both
 * `open`, because neither of them promised the other anything.
 */
export type BoutTerms = 'agreed' | 'open';

/**
 * How far past the agreement it actually went.
 *
 * Derived from the outcome the resolver returned and the death the survival
 * layer recorded, and derived rather than passed in so that two callers cannot
 * answer it differently.
 */
export type HowFarPastIt =
    /** Inside what was agreed. Somebody yielded, somebody broke off, nobody is ruined. */
    | 'kept'
    /** They walked away carrying something that will not close. */
    | 'ruined'
    /** They did not walk away. */
    | 'killed';

export interface WhatTheBoutCameTo {
    terms: BoutTerms;
    /** What the resolver said happened. Read, never adjusted. */
    outcome: ConfrontationOutcome;
    /**
     * Whether the loser is dead.
     *
     * Decided by `survival.ts` and reported here as a finished fact. This file
     * has no opinion about it and no way to cause it - the resolver's own
     * `finished` flag is explicitly not a death, and asking a second question
     * about a body is the drift the whole engine is built to prevent.
     */
    loserDied: boolean;
    /**
     * How many people could see it, beyond the two of them.
     *
     * It does NOT decide whether the actor is named - the arrangement does that
     * on its own. It decides how far the fact travels on the day, which is the
     * difference between a house hearing it from a member and a house hearing
     * it from the province.
     */
    witnesses: number;
    /** The loser's house, where they had one. */
    theirHouse: HouseStanding | null;
    /**
     * The loser's people, in inheritance order, for when the loser is dead.
     *
     * ── WHY THIS FIELD EXISTS, MEASURED ──────────────────────────────────
     *
     * Without it this file said, in its own words, *"they answered to nobody,
     * so there is nobody to answer to"*, and returned no account for anybody
     * killed outside a ranked house. Played: a cultivator killed two people in
     * front of eight witnesses and `obligations` held **zero rows**, while the
     * world's own report of the same event named an heir on the way past
     * (`heir=npc-232`). So there WAS somebody to answer to, and the only reason
     * nothing was written is that nobody had told this function about them.
     *
     * `whatADeedLeaves` has always been the module that routes this, and its
     * own table says what happens: *heavy, and they have people - their family
     * carries it at the same weight.* Its field for it is
     * `principalCannotHoldIt`, and this is that field, arriving where the bout
     * is priced so that the severity is still decided exactly once.
     *
     * Empty or absent means the loser genuinely has nobody, which stays a real
     * answer and stays the cheapest killing in the world - a fact about who
     * they were rather than a discount to whoever did it.
     *
     * Only read when the loser DIED. Somebody who was ruined and lived holds
     * their own record from the resolver, and whether their brothers should
     * hold one too is a separate ruling this file does not make in passing.
     */
    theirPeople?: readonly { id: string; relation: InheritanceRelation }[];
}

/** What a house is, for the purpose of deciding what it does about a member. */
export interface HouseStanding {
    alignment: SectAlignment | null;
    /**
     * Whether this was somebody the house has anything invested in.
     *
     * Copied from `whenItIsDoneToOneOfOurs`, and for the same reason it gives:
     * a house has an interest in the people it has spent something on and very
     * little in the people it pays by the season.
     */
    ranked: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT FOLLOWS
// ─────────────────────────────────────────────────────────────────────────

/** The record somebody else opens, ready for `createGrudge`. */
export interface AccountOpened {
    kind: 'grudge' | 'blood_feud';
    cause: GrudgeCause;
    severity: Severity;
    /** Plain words for the ledger. The narrator never parses it. */
    description: string;
    /** Free handles, so this is findable as what it was rather than as a fight. */
    tags: readonly string[];
}

/**
 * One party who opens {@link WhatFollows.against}.
 *
 * `house` for the loser's house; otherwise the ledger's own
 * {@link InheritanceRelation}, so a record opened here and a record carried by
 * `inheritOnDeath` describe the same kind of connection in the same word.
 */
export interface TheyOpenIt {
    id: string;
    as: 'house' | InheritanceRelation;
}

export interface WhatFollows {
    howFar: HowFarPastIt;
    /**
     * Whether an agreement was broken. False for every `open` bout, however
     * badly it ended: a duel that kills is a killing and not a betrayal.
     */
    brokenPromise: boolean;
    /** What the loser's side opens, or null when there is nobody to open it. */
    against: AccountOpened | null;
    /**
     * Everybody who opens it, at that one weight. Empty exactly when `against`
     * is null.
     *
     * A list rather than a single holder because a killing can reach two kinds
     * of party at once - the house that had something invested in them, and the
     * people they left - and `grudges.ts` is explicit that inheritance does not
     * discount: the brother holds what the brother holds. Nothing here weights
     * anybody differently for being one or the other.
     */
    heldBy: readonly TheyOpenIt[];
    /**
     * Standing the actor's OWN house takes off them, as a raw figure for
     * `spendStanding` to run through the house's own arithmetic. Zero when the
     * house has nothing to say.
     */
    ownHouseCost: number;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

/**
 * The scale, in one table, with agreed terms one full step above open ones.
 *
 * `severityWithHouse` composes this with whatever the house's own involvement
 * imposes, so severity is still decided exactly once and in one place - the
 * rule `grudges.ts` sets and the reason that helper exists at all.
 *
 * The floor for an open bout is not zero. Somebody's house losing a member to a
 * duel is still an account; it is simply an account about a fight, and a fight
 * is a thing that happens between cultivators. What it is not is an account
 * about a promise.
 */
const WHAT_IT_IS_WORTH: Readonly<Record<
    Exclude<HowFarPastIt, 'kept'>, Record<BoutTerms, Severity>
>> = {
    ruined: { open: 'serious', agreed: 'grave' },
    killed: { open: 'grave', agreed: 'unforgivable' }
} as const;

/**
 * A killing under agreed terms is the one case that opens between LINES.
 *
 * `grudges.ts` keeps `blood_feud` as its own kind rather than as a severe
 * grudge because it is held between lines, expected to be inherited, and known
 * to everyone involved to be running. All three are true of this and of nothing
 * else in this file: an arrangement makes the actor known, a house that has
 * been told this about somebody does not stop telling it, and there is nobody
 * left to settle it with.
 */
function kindOf(howFar: HowFarPastIt, terms: BoutTerms): 'grudge' | 'blood_feud' {
    return howFar === 'killed' && terms === 'agreed' ? 'blood_feud' : 'grudge';
}

/**
 * What the actor's own house takes off them.
 *
 * A raw standing figure, because `spendStanding` is emphatic that the caller
 * supplies the raw figure and says where it came from while the house's own
 * arithmetic - the discount a personal following buys, the floor - stays in one
 * place. Nothing here invents a curve.
 *
 * Zero under open terms at every rung, and that is deliberate rather than
 * lenient. A house does not dock a member for winning a duel; winning duels is
 * most of what it wants from them. What it docks them for is arranging a
 * friendly bout and returning from it alone.
 */
const OWN_HOUSE_COST: Readonly<Record<HowFarPastIt, number>> = {
    kept: 0,
    ruined: 12,
    killed: 30
} as const;

/**
 * How much of that the room adds.
 *
 * Small on purpose, and capped, because the arrangement has already named the
 * actor and witnesses cannot name them twice. What a crowd changes is how
 * quickly the house has to have a position on it, which is a real cost and a
 * secondary one.
 */
const PER_WITNESS = 2;
const WITNESSES_PRICED_AT_MOST = 6;

/**
 * Read what the bout came to, and say what follows from it.
 *
 * The order is the order of the argument: what actually happened to the loser,
 * then whether a promise was broken, then who holds what, then what the actor's
 * own people make of it.
 */
export function whatFollowsFromTheBout(input: WhatTheBoutCameTo): WhatFollows {
    const howFar = howFarPastIt(input);
    const brokenPromise = input.terms === 'agreed' && howFar !== 'kept';

    if (howFar === 'kept') {
        return {
            howFar,
            brokenPromise: false,
            against: null,
            heldBy: [],
            ownHouseCost: 0,
            note:
                input.terms === 'agreed'
                    ? 'The bout stayed inside what was agreed. Both of them are worse than they '
                      + 'were and neither of them is owed anything for it.'
                    : 'An ordinary confrontation, resolved. Whatever the loser holds about it is '
                      + 'the resolver\'s own record and is not this one.'
        };
    }

    const personal = WHAT_IT_IS_WORTH[howFar][input.terms];
    const house = input.theirHouse;
    const houseIsAParty = Boolean(house && house.alignment !== null && house.ranked);

    // ── WHO IS LEFT TO HOLD IT ───────────────────────────────────────────
    //
    // Two kinds of party and they are independent: the house that had something
    // invested in them, and the people they left. A killing can reach both, one
    // or neither, and only the last of those three is nothing.
    //
    // The people are read ONLY where the loser is dead, because that is the
    // whole of what they are answering: the dead hold nothing, so an account
    // that would have been theirs has nowhere else to go. Somebody ruined and
    // living already holds their own, from the resolver.
    const theirPeople = howFar === 'killed' ? (input.theirPeople ?? []) : [];
    const heldBy: TheyOpenIt[] = [
        ...theirPeople.map(person => ({ id: person.id, as: person.relation })),
        ...(houseIsAParty && house ? [{ id: HOUSE, as: 'house' as const }] : [])
    ];

    // Genuinely nobody. The loser's own account still stands where they lived -
    // the resolver wrote it - and where they are dead it does not, which is
    // what makes killing somebody with no house and no people the cheapest
    // version of this in the world. That is a fact about who they were, not a
    // discount to whoever did it.
    if (heldBy.length === 0) {
        return {
            howFar,
            brokenPromise,
            against: null,
            heldBy: [],
            ownHouseCost: ownHouseCost(howFar, input),
            note: !house || house.alignment === null
                ? 'They answered to nobody and left nobody, so there is nobody to answer to. '
                  + 'Nothing was opened on their side.'
                : 'Not somebody their house had anything invested in, and nobody of their own '
                  + 'is left. It stays between the two of them, and one of them is in no '
                  + 'position to pursue it.'
        };
    }

    // The house's own reading, where there is a house. Where there is not, the
    // weight is the table's and nothing composes with it - which is correct
    // rather than lenient: `severityWithHouse` raises a floor an institution
    // imposes, and a family imposes none. What the brother holds is exactly
    // what the deed was worth.
    const verdict = houseIsAParty && house
        ? whatTheirHouseMakesOfIt(house.alignment as SectAlignment, brokenPromise)
        : null;
    const severity = verdict
        ? severityWithHouse(personal, verdict.severityFloor)
        : personal;

    return {
        howFar,
        brokenPromise,
        against: {
            kind: kindOf(howFar, input.terms),
            // `killed_kin` is the ledger's own word for a death somebody is
            // answerable for, and it is what makes this findable beside every
            // other killing in the world rather than only beside fights.
            cause: howFar === 'killed' ? 'killed_kin' : 'crippled',
            severity,
            description: accountOf(input, howFar),
            tags: brokenPromise
                ? ['bout', 'agreed', howFar, ...(input.witnesses > 0 ? ['witnessed'] : [])]
                : ['bout', 'open', howFar, ...(input.witnesses > 0 ? ['witnessed'] : [])]
        },
        heldBy,
        ownHouseCost: ownHouseCost(howFar, input),
        note: verdict
            ? verdict.note
            : 'Their house is not a party to it and their people are. What one person held is '
              + 'held by the ones they left, at the weight it was worth, and it is inherited '
              + 'from there like everything else in that ledger.'
    };
}

/**
 * The stand-in id for the loser's house on {@link WhatFollows.heldBy}.
 *
 * This file has never seen an id and does not start now: it is handed
 * alignment and investment, not a name. The caller knows which house it asked
 * about and substitutes it, exactly as it already did when there was only one
 * holder to write.
 */
export const HOUSE = 'their-house';

/**
 * What actually happened to the loser, in this file's three words.
 *
 * `body_destroyed` is not a death and is not treated as one: the resolver is
 * explicit that the person can still be in the world and that *anyone who walks
 * away believing this was a killing is wrong, and will find out*. Reading it as
 * a killing here would put that wrong belief into the ledger as a fact, which
 * is precisely the drift the ledger's `fromBelief` flag exists to keep out.
 */
function howFarPastIt(input: WhatTheBoutCameTo): HowFarPastIt {
    if (input.loserDied) return 'killed';
    if (input.outcome === 'crippled' || input.outcome === 'body_destroyed') return 'ruined';
    return 'kept';
}

function ownHouseCost(howFar: HowFarPastIt, input: WhatTheBoutCameTo): number {
    if (input.terms !== 'agreed') return 0;
    const seen = Math.min(input.witnesses, WITNESSES_PRICED_AT_MOST);
    return OWN_HOUSE_COST[howFar] + seen * PER_WITNESS;
}

/**
 * What their house does about it, once it knows.
 *
 * The shape is `whenItIsDoneToOneOfOurs` and the split is the same one, because
 * the split is a fact about the houses rather than about the injury: a
 * righteous house makes one member's account into the house's, a demonic house
 * prices what the member's death revealed about the member, and a neutral house
 * writes down what it is now holding. Take the alignment column away and this
 * function has nothing to say, which is the test AGENTS.md sets.
 *
 * Where it DEPARTS from that function is the demonic answer, and only when a
 * promise was broken. A demonic house declining to avenge somebody who was
 * outmanoeuvred is a house making a judgement about that member's competence.
 * It has no such judgement available about a member who was killed after being
 * told the blades were blunted - there was nothing there to be better at - so
 * what it holds is an ordinary account against the person who did it. The house
 * is still not sentimental about it; it is simply owed something.
 */
function whatTheirHouseMakesOfIt(
    alignment: SectAlignment,
    brokenPromise: boolean
): { severityFloor: Severity | null; note: string } {
    switch (alignment) {
        case 'righteous':
            return {
                severityFloor: brokenPromise ? 'grave' : 'serious',
                note: brokenPromise
                    ? 'The house takes it up, and it takes it up as a broken word rather than as '
                      + 'a fight. What was one person\'s account is the house\'s, and the name is '
                      + 'written down somewhere it will be read again.'
                    : 'The house takes it up. Their people fight and sometimes lose, and it is '
                      + 'still written down.'
            };
        case 'demonic':
            return {
                severityFloor: brokenPromise ? 'serious' : null,
                note: brokenPromise
                    ? 'The house is not grieving and it is not letting it go either. Somebody it '
                      + 'paid for is gone and the person who did it gave their word first, which '
                      + 'is a thing the house now holds rather than a thing it feels.'
                    : 'The house prices what happened rather than avenging it. Somebody who lost '
                      + 'a fight has said something about themselves.'
            };
        default:
            return {
                severityFloor: brokenPromise ? 'serious' : null,
                note: brokenPromise
                    ? 'The house does not take a side. It writes down what was agreed, what was '
                      + 'done instead, and who did it, and that is a thing it now holds.'
                    : 'The house writes down that it lost somebody and to whom. Nothing further.'
            };
    }
}

/**
 * The account, in plain words, for the ledger.
 *
 * It states the terms first, because the terms are the content: a reader three
 * generations later inherits this sentence and nothing else, and *"they had
 * agreed it was a bout"* is the entire reason the record is as heavy as it is.
 */
function accountOf(input: WhatTheBoutCameTo, howFar: HowFarPastIt): string {
    const seen = input.witnesses > 0
        ? ` ${input.witnesses} ${input.witnesses === 1 ? 'person was' : 'people were'} standing there.`
        : ' Nobody else was standing there, and it makes no difference: they knew who they had '
          + 'gone to meet.';

    if (input.terms === 'agreed') {
        return howFar === 'killed'
            ? `They agreed to a bout and one of them did not walk away from it.${seen}`
            : `They agreed to a bout and one of them came out of it carrying something that will `
              + `not close.${seen}`;
    }
    return howFar === 'killed'
        ? `Killed in a confrontation neither of them pretended was friendly.${
            input.witnesses > 0 ? seen : ''}`
        : `Ruined in a confrontation neither of them pretended was friendly.${
            input.witnesses > 0 ? seen : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROWS IT OPENS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rows {@link WhatFollows.against} becomes, ready for the ledger.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS IS HERE AND NOT IN EACH CALLER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on a war death leaving nothing where a played killing left
 * a grudge:
 *
 *   > this is bespoke. a war death is still a grudge. fix it.
 *
 * And it was bespoke for a reason worth naming, because it is the shape the
 * defect always takes here: **the two callers each assembled the rows
 * themselves, so only the one somebody had got round to writing had any.** The
 * played path built a row from `against` inline; `war-melee.ts` never did, so a
 * world could fight for five hundred years and the ledger would not contain one
 * of its dead. A fact that means different things depending on which code path
 * produced it is the definition of the thing AGENTS.md forbids.
 *
 * So the assembly moves here, beside the decision it renders, and both callers
 * hand it the same `WhatFollows`. A war death and a killing in a square are the
 * same event to every line below this one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING NEW IS DECIDED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Not the severity - `whatFollowsFromTheBout` decided it once, off
 * `WHAT_IT_IS_WORTH`, and `grudges.ts` requires exactly that. Not the kind, not
 * the cause, and not who holds it: `heldBy` already named every party. This
 * substitutes the house id it was never given, writes the descriptions, and
 * tags each row with how its holder comes to be holding it.
 *
 * A war is `terms: 'open'` and needs no special case to be so - this file's own
 * definition is that *open is the absence of an arrangement, not a declaration
 * of hostility*, and two houses at war have promised each other nothing.
 */
export interface AFightsParties {
    /** The person who went too far. The subject of every row. */
    actor: { id: string; name: string };
    /** The person it was done to. */
    loser: { id: string; name: string };
    /** The loser's house, where `heldBy` named one. */
    houseId: string | null;
    houseName: string | null;
}

export function theAccountsAFightOpens(input: {
    followed: WhatFollows;
    parties: AFightsParties;
    onDay: DayIndex;
    /**
     * The world's own fact for the fight, so a reader in forty years can get
     * from the claim to the event and back.
     */
    triggeringEventId?: string | null;
    /**
     * Who can put a name to it. Omit and everybody `heldBy` names can.
     *
     * ── THE SEAM FOR THE TELLING, LEFT OPEN DELIBERATELY ─────────────────
     *
     * AGENTS.md: *a fact reaches a person, and reaching them is an event* -
     * telling a man who killed his brother creates the grudge, because the deed
     * was already true and what was missing was somebody who could act on it.
     * This is the field that expresses it, and it is the same field
     * `Deed.knownTo` already is in `what-a-deed-leaves.ts`: a party who is not
     * on the list opens no account, because a grudge is held against somebody
     * and they have no name to put on it.
     *
     * It is left defaulting to *everybody named knows* rather than gated shut,
     * and the reason is measured rather than lazy: a pitched battle between two
     * houses is the least deniable event in this world. Both houses know
     * exactly who they lost and the survivors walked home. Gating it now, with
     * nothing yet writing the telling, would produce a world at war in which
     * nobody holds anything - the field-nothing-writes defect, arrived at while
     * fixing a different one.
     *
     * Where it bites is the QUIET killing, and that is what this field is for
     * when the telling layer lands: pass the people who were actually there and
     * the kin two provinces away open nothing until somebody carries the news.
     */
    knownTo?: readonly string[];
}): ObligationInput[] {
    const { followed, parties } = input;
    if (!followed.against || followed.heldBy.length === 0) return [];

    const knows = (id: string): boolean =>
        input.knownTo === undefined || input.knownTo.includes(id);

    const rows: ObligationInput[] = [];
    for (const holder of followed.heldBy) {
        const isTheHouse = holder.as === 'house';
        const holderId = isTheHouse ? parties.houseId : holder.id;
        if (!holderId || !knows(holderId)) continue;
        rows.push({
            kind: followed.against.kind,
            holderId,
            subjectId: parties.actor.id,
            cause: followed.against.cause,
            // Decided once, upstream. Not adjusted per holder, on `grudges.ts`'s
            // own rule that inheritance does not discount: the brother holds
            // what the brother holds.
            severity: followed.against.severity,
            onDay: input.onDay,
            triggeringEventId: input.triggeringEventId ?? null,
            description:
                `${followed.against.description} `
                + (isTheHouse
                    ? `${parties.loser.name} was ${parties.houseName ?? 'the house'}'s, and `
                      + `${parties.actor.name} is the name on it.`
                    : `${parties.loser.name} was theirs, and ${parties.actor.name} is the `
                      + 'name on it.'),
            participants: [parties.actor.id, parties.loser.id],
            tags: [
                ...followed.against.tags,
                // How this party comes to be holding it, in the ledger's own
                // word for the connection, so a reader can tell the
                // institution's row from the family's without guessing.
                isTheHouse ? 'institutional' : `carried:${holder.as}`
            ]
        });
    }
    return rows;
}
