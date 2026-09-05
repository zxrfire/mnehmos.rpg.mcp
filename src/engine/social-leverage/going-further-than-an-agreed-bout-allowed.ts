/**
 * What it costs to go further than an agreed bout allowed. AGENTS.md: *"Kill
 * somebody during an agreed bout and you will obviously face consequences."*
 * Nothing stops you, and the bout is never quietly made unable to kill.
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
import { NO_NAME_ON_IT, NO_NAME_TAG } from '../social/accounts-with-no-name.js';

/**
 * The terms, as a closed set the parser sets rather than a word it hands down -
 * nothing in the engine may branch on `intent`.
 */
export type BoutTerms = 'agreed' | 'open';

/**
 * How far past the agreement it went. DERIVED here rather than passed in, so two
 * callers cannot answer it differently.
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
     * Whether the loser is dead. Decided by `survival.ts` and reported here as a
     * finished fact. Do not ask a second question about the body.
     */
    loserDied: boolean;
    /**
     * How many people could see it. Does NOT decide whether the actor is named -
     * the arrangement does that on its own. It decides how far the fact travels
     * on the day.
     */
    witnesses: number;
    /** The loser's house, where they had one. */
    theirHouse: HouseStanding | null;
    /**
     * The loser's people, for when the loser is dead.
     */
    theirPeople?: readonly { id: string; relation: InheritanceRelation }[];
}

/** What a house is, for deciding what it does about a member. */
export interface HouseStanding {
    alignment: SectAlignment | null;
    /** Whether this was somebody the house has anything invested in. */
    ranked: boolean;
}

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

/** One party who opens {@link WhatFollows.against}. */
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
     * Everybody who opens it, at ONE weight. A list because a killing can reach
     * the house and the people they left at once, and inheritance does not
     * discount: the brother holds what the brother holds.
     */
    heldBy: readonly TheyOpenIt[];
    /**
     * Standing the actor's OWN house takes off them, RAW - `spendStanding` owns
     * the curve, the following discount and the floor. Do not shape it here.
     */
    ownHouseCost: number;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

/**
 * The scale, in one table, with agreed terms one full step above open ones. The
 * floor for an open bout is not zero: a house losing a member to a duel is still
 * an account, just not an account about a promise.
 */
const WHAT_IT_IS_WORTH: Readonly<Record<
    Exclude<HowFarPastIt, 'kept'>, Record<BoutTerms, Severity>
>> = {
    ruined: { open: 'serious', agreed: 'grave' },
    killed: { open: 'grave', agreed: 'unforgivable' }
} as const;

/**
 * A killing under agreed terms is the one case that opens between LINES. All
 * three of `blood_feud`'s conditions hold and hold nowhere else here: the
 * arrangement names the actor, the house does not stop telling it, and there is
 * nobody left to settle it with.
 */
function kindOf(howFar: HowFarPastIt, terms: BoutTerms): 'grudge' | 'blood_feud' {
    return howFar === 'killed' && terms === 'agreed' ? 'blood_feud' : 'grudge';
}

/**
 * What the actor's own house takes off them. ZERO under open terms at every
 * rung, deliberately: a house does not dock a member for winning a duel, it
 * docks them for arranging a friendly bout and returning from it alone.
 */
const OWN_HOUSE_COST: Readonly<Record<HowFarPastIt, number>> = {
    kept: 0,
    ruined: 12,
    killed: 30
} as const;

/**
 * How much of that the room adds. Small and capped: the arrangement has already
 * named the actor, so witnesses cannot name them twice. What a crowd changes is
 * how quickly the house has to have a position on it.
 */
const PER_WITNESS = 2;
const WITNESSES_PRICED_AT_MOST = 6;

/** Read what the bout came to, and say what follows from it. */
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

    // The people are read ONLY where the loser is dead: the dead hold nothing,
    // so an account that would have been theirs has nowhere else to go.
    // Somebody ruined and living already holds their own, from the resolver.
    const theirPeople = howFar === 'killed' ? (input.theirPeople ?? []) : [];
    const heldBy: TheyOpenIt[] = [
        ...theirPeople.map(person => ({ id: person.id, as: person.relation })),
        ...(houseIsAParty && house ? [{ id: HOUSE, as: 'house' as const }] : [])
    ];

    // Genuinely nobody, which makes killing somebody with no house and no people
    // the cheapest version of this. A fact about who they were, not a discount.
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

    // With no house the weight is the table's and nothing composes with it:
    // `severityWithHouse` raises a floor an INSTITUTION imposes, and a family
    // imposes none.
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
            // `killed_kin` makes this findable beside every other killing in the
            // world rather than only beside fights.
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
 * The stand-in id for the loser's house. THIS FILE HAS NEVER SEEN AN ID and
 * does not start now: it is handed alignment and investment, not a name.
 */
export const HOUSE = 'their-house';

/**
 * What actually happened to the loser.
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
 * What their house does about it, once it knows. The shape is
 * `whenItIsDoneToOneOfOurs`; take the alignment column away and this has nothing to
 * say, which is AGENTS.md's test.
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
 * The account, in plain words. States the TERMS first: a reader three
 * generations later inherits this sentence and nothing else, and "they had
 * agreed it was a bout" is the whole reason the record is as heavy as it is.
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

/**
 * The rows {@link WhatFollows.against} becomes, ready for the ledger.
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
    /** The world's own fact for the fight, so a reader can get back to the event. */
    triggeringEventId?: string | null;
    /**
     * Who can put a NAME to it. Omit and everybody `heldBy` names can.
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
        if (!holderId) continue;
        // Not "do they hold anything" but "can they put a name to it".
        const named = knows(holderId);
        rows.push({
            kind: followed.against.kind,
            holderId,
            subjectId: named ? parties.actor.id : NO_NAME_ON_IT,
            cause: followed.against.cause,
            // Decided once, upstream. NOT adjusted per holder: inheritance does
            // not discount.
            severity: followed.against.severity,
            onDay: input.onDay,
            triggeringEventId: input.triggeringEventId ?? null,
            description:
                `${followed.against.description} `
                + (isTheHouse
                    ? `${parties.loser.name} was ${parties.houseName ?? 'the house'}'s, and `
                      + (named
                          ? `${parties.actor.name} is the name on it.`
                          : 'nobody has put a name to it.')
                    : `${parties.loser.name} was theirs, and `
                      + (named
                          ? `${parties.actor.name} is the name on it.`
                          : 'nobody has put a name to it.')),
            // Do not add the actor to a row that cannot name them: it would put
            // the answer in the record and make the account findable from the
            // very person its holder cannot identify.
            participants: named
                ? [parties.actor.id, parties.loser.id]
                : [parties.loser.id],
            tags: [
                ...followed.against.tags,
                // So a reader can tell the institution's row from the family's.
                isTheHouse ? 'institutional' : `carried:${holder.as}`,
                ...(named ? [] : [NO_NAME_TAG])
            ]
        });
    }
    return rows;
}
