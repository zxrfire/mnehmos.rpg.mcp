/**
 * A target is a description, not only a name.
 *
 * The design owner, in one run of examples: *i should be able to ask WHO'S IN
 * CHARGE HERE to nobody in particular*, *"i kill the one nearest to me" (madmen
 * do that often)*, *or i kill (description) like the youngest girl? the oldest
 * man?*, *i kill members of all righteous sects/demonic sects*, and - the part
 * that decides where this lives - *and replace kill with other verb too*.
 *
 * So this is not a targeting rule for `attack`. It is what a target phrase
 * MEANS, asked once, for every verb that takes one.
 *
 * ── EVERY AXIS IS ONE THE ROSTER ALREADY CARRIES ─────────────────────────
 *
 * Nothing is invented to support a phrase. `sex`, `age`, `realmOrdinal` and
 * `sectRank` are columns; alignment is the house's own word, reached through a
 * resolver the caller supplies rather than imported here, so this module stays
 * pure and the catalog stays out of it. A phrase that would need a fact the
 * roster does not hold is not recognised, which is the honest failure: the
 * player is told the sentence did not resolve rather than handed somebody the
 * engine guessed at.
 *
 * ── AND IT MUST NOT SWALLOW A NAME ───────────────────────────────────────
 *
 * A description is recognised only when EVERY word in it is one of these
 * words. "the youngest girl" is a description; "the youngest Jiang" is not, and
 * falls through to the name resolver where it belongs. That is the same
 * anchoring rule `acts-over-a-set.ts` uses and it is the whole safety property:
 * a partial match here would quietly retarget a sentence that named somebody.
 */

import type { SectAlignment } from '../schema/cultivation.js';
import { REALM_TIERS } from '../engine/cultivation/realms.js';

/** Which end of an ordering the phrase asks for. */
export type WhichEnd =
    | 'nearest'
    | 'youngest'
    | 'oldest'
    | 'strongest'
    | 'weakest';

export interface ADescription {
    /** The ordering, or null where the phrase only narrows the field. */
    readonly end: WhichEnd | null;
    readonly sex: 'male' | 'female' | null;
    /** A rank word, singular, matched against `sectRank`. */
    readonly rank: string | null;
    /**
     * Where they stand relative to the speaker on their house's own ladder.
     *
     * The design owner: *people call people by title a lot in xianxia, not just
     * by name (though the elder probably has a name)*. Half the titles in the
     * genre are not ranks at all - senior brother, junior sister - they are a
     * position relative to whoever is speaking, and there is no way to answer
     * them from a rank word alone.
     */
    readonly standing: 'above' | 'below' | null;
    /** True where the title only means anything inside the speaker's own house. */
    readonly sameHouse: boolean;
    /**
     * A tie the world already holds between the speaker and them.
     *
     * *uncle, sister, etc* - kinship words are how people are addressed here,
     * and half of them are martial kinship rather than blood. Both come back as
     * a `RelationshipKind`, because the world holds one set of ties and this
     * must not grow a second vocabulary for the same edges.
     */
    readonly tie: string | null;
    /** The leaning of the house they answer to. */
    readonly alignment: SectAlignment | null;
    /**
     * A major realm, said by its own name.
     *
     * The design owner: *or like "you, void refinement cultivator"*. A realm is
     * the first thing anybody in this setting says about a stranger, so it is
     * the description the player is likeliest to reach for, and it is the one
     * axis here that needs a range rather than a value - the tier's own
     * ordinal window, read off the ladder.
     */
    readonly realmKey: string | null;
    /** The phrase as typed, for the report. */
    readonly word: string;
}

/** Somebody a description could pick out. The roster columns and nothing else. */
export interface SomebodyDescribable {
    readonly id: string;
    readonly name: string;
    readonly sex: string | null;
    readonly age: number;
    readonly realmOrdinal: number;
    readonly sectRank: string | null;
    readonly sectId: string | null;
}

const ORDERINGS: Readonly<Record<string, WhichEnd>> = Object.freeze({
    nearest: 'nearest', closest: 'nearest',
    youngest: 'youngest', newest: 'youngest',
    oldest: 'oldest', eldest: 'oldest',
    strongest: 'strongest', deepest: 'strongest', highest: 'strongest',
    mightiest: 'strongest', greatest: 'strongest',
    weakest: 'weakest', lowest: 'weakest', shallowest: 'weakest', frailest: 'weakest'
});

const FEMALE = new Set([
    'girl', 'girls', 'woman', 'women', 'lady', 'ladies', 'female', 'females',
    'daughter', 'daughters', 'maiden', 'maidens', 'sister', 'sisters'
]);

const MALE = new Set([
    'boy', 'boys', 'man', 'men', 'lad', 'lads', 'male', 'males', 'gentleman',
    'gentlemen', 'son', 'sons', 'fellow', 'fellows', 'brother', 'brothers'
]);

const ALIGNMENTS: Readonly<Record<string, SectAlignment>> = Object.freeze({
    righteous: 'righteous', orthodox: 'righteous', upright: 'righteous',
    demonic: 'demonic', devilish: 'demonic', heretical: 'demonic',
    unorthodox: 'demonic', crooked: 'demonic',
    neutral: 'neutral'
});

const RANKS = new Set([
    'elder', 'elders', 'disciple', 'disciples', 'master', 'masters',
    'warden', 'wardens', 'head', 'heads', 'patriarch', 'patriarchs',
    'servant', 'servants', 'guard', 'guards', 'attendant', 'attendants'
]);

/**
 * The titles people are actually addressed by, and what each one asks for.
 *
 * The design owner: *saying elder is very common*, and *people call people by
 * title a lot in xianxia, not just by name (though the elder probably has a
 * name)*. A title is not a politeness on top of a name here, it is usually the
 * whole address, so a target resolver that only reads names cannot answer most
 * of the sentences somebody would type.
 *
 * Taken out of the phrase whole, before the word loop, because every one of
 * these is two words and the loop reads one at a time. `elder`, `master` and
 * the rest of the bare rank words are not here - they are ranks a house
 * actually writes down, and `RANKS` matches them against `sectRank`.
 */
const TITLES: Readonly<Record<string, Partial<{
    standing: 'above' | 'below';
    sameHouse: boolean;
    sex: 'male' | 'female';
    tie: string;
    rank: string;
}>>> = Object.freeze({
    'senior brother': { standing: 'above', sameHouse: true, sex: 'male' },
    'shixiong': { standing: 'above', sameHouse: true, sex: 'male' },
    'senior sister': { standing: 'above', sameHouse: true, sex: 'female' },
    'shijie': { standing: 'above', sameHouse: true, sex: 'female' },
    'junior brother': { standing: 'below', sameHouse: true, sex: 'male' },
    'shidi': { standing: 'below', sameHouse: true, sex: 'male' },
    'junior sister': { standing: 'below', sameHouse: true, sex: 'female' },
    'shimei': { standing: 'below', sameHouse: true, sex: 'female' },
    // A martial uncle stands a generation up the same house. The blood word is
    // the same word, and where the speaker has no house it falls to the tie.
    'martial uncle': { standing: 'above', sameHouse: true, sex: 'male' },
    'shishu': { standing: 'above', sameHouse: true, sex: 'male' },
    'uncle': { standing: 'above', sameHouse: true, sex: 'male', tie: 'kin' },
    'martial aunt': { standing: 'above', sameHouse: true, sex: 'female' },
    'shigu': { standing: 'above', sameHouse: true, sex: 'female' },
    'aunt': { standing: 'above', sameHouse: true, sex: 'female', tie: 'kin' },
    'shifu': { tie: 'master' },
    'my master': { tie: 'master' },
    'my disciple': { tie: 'disciple' },
    'sect master': { rank: 'master' },
    'young master': { sex: 'male' },
    'young mistress': { sex: 'female' },
    // The ordinary address between strangers who are both cultivators. It
    // narrows nothing and is recognised so that it does not read as a name.
    'fellow daoist': {},
    'senior': { standing: 'above' },
    'junior': { standing: 'below' }
});

/** Words that carry nothing, and are allowed anywhere in a description. */
const FILLER = new Set([
    'the', 'that', 'this', 'a', 'an', 'some', 'any', 'of', 'to', 'me', 'us',
    'here', 'nearby', 'about', 'around', 'present', 'in', 'room', 'square',
    'front', 'standing', 'one', 'ones', 'person', 'people', 'someone', 'somebody',
    'anyone', 'anybody', 'cultivator', 'cultivators', 'sect', 'sects', 'other',
    'others', 'from', 'who', 'is', 'are', 'most', 'and',
    // A vocative, and the commonest opening of a xianxia address: *you, void
    // refinement cultivator*. Not the third-person pronouns - "her" and "them"
    // are anaphors, they mean whoever was last dealt with, and the resolver
    // that owns that question is the one place they may be answered.
    'you'
]);

/**
 * What a target phrase describes, or null where it does not describe anything.
 *
 * Null is the ordinary answer. Most targets are names, and a name has to reach
 * the name resolver untouched.
 */
export function theDescriptionThisIs(query: string): ADescription | null {
    // Punctuation goes everywhere rather than only at the end: a vocative
    // carries a comma inside it - *you, void refinement cultivator*.
    let rest = query.trim().toLowerCase().replace(/[.,!?;:]+/g, ' ');

    // The realm goes first and is taken out whole, because every realm name is
    // two words and the loop below reads one at a time. `Immortal` is left to
    // the loop's unknown-word rule on purpose: it is an ordinary adjective in
    // this setting and would take phrases that are not about the ladder.
    let realmKey: string | null = null;
    for (const tier of REALM_TIERS) {
        if (tier.name.split(' ').length < 2) continue;
        const at = rest.indexOf(tier.name.toLowerCase());
        if (at < 0) continue;
        realmKey = tier.key;
        rest = `${rest.slice(0, at)} ${rest.slice(at + tier.name.length)}`;
        break;
    }

    let end: WhichEnd | null = null;
    let sex: 'male' | 'female' | null = null;
    let rank: string | null = null;
    let alignment: SectAlignment | null = null;
    let standing: 'above' | 'below' | null = null;
    let sameHouse = false;
    let tie: string | null = null;
    let carried = realmKey === null ? 0 : 1;

    // Titles, longest first, so "senior brother" is never read as "senior".
    for (const title of Object.keys(TITLES).sort((a, b) => b.length - a.length)) {
        const at = rest.indexOf(title);
        if (at < 0) continue;
        const asks = TITLES[title]!;
        standing = asks.standing ?? standing;
        sameHouse = asks.sameHouse ?? sameHouse;
        sex = asks.sex ?? sex;
        tie = asks.tie ?? tie;
        rank = asks.rank ?? rank;
        carried++;
        rest = `${rest.slice(0, at)} ${rest.slice(at + title.length)}`;
    }

    const words = rest.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0 && carried === 0) return null;

    for (const word of words) {
        if (ORDERINGS[word] !== undefined) { end = ORDERINGS[word]; carried++; continue; }
        if (FEMALE.has(word)) { sex = 'female'; carried++; continue; }
        if (MALE.has(word)) { sex = 'male'; carried++; continue; }
        if (ALIGNMENTS[word] !== undefined) { alignment = ALIGNMENTS[word]; carried++; continue; }
        if (RANKS.has(word)) { rank = word.replace(/s$/, ''); carried++; continue; }
        if (FILLER.has(word)) continue;
        // A word this does not know. The phrase is not a description, and
        // whatever it is belongs to the resolver that reads names.
        return null;
    }

    return carried === 0
        ? null
        : { end, sex, rank, alignment, realmKey, standing, sameHouse, tie, word: query.trim() };
}

/**
 * Everybody the description fits, in the order it asks for.
 *
 * The narrowing is applied first and the ordering second, so "the youngest
 * girl" is the youngest OF THE GIRLS and never the youngest person who happens
 * to be one. An empty array means the description fits nobody standing here,
 * which is a real answer and not a failure to parse.
 *
 * `alignmentOf` is a lookup the caller owns. An id it cannot place comes back
 * null, and null never satisfies an alignment the phrase asked for.
 */
export function whoTheDescriptionFits(input: {
    readonly description: ADescription;
    readonly candidates: readonly SomebodyDescribable[];
    /** The person doing the looking: for `nearest`, and for every title. */
    readonly observer: {
        readonly ordinal: number;
        readonly sectId: string | null;
        /** Their own rung on their house's ladder, or null for no house. */
        readonly rankIndex: number | null;
    };
    readonly alignmentOf: (sectId: string | null) => SectAlignment | null;
    /** Where a rank title sits on a house's ladder. Null where it is not one. */
    readonly rankIndexOf: (sectId: string | null, rankTitle: string | null) => number | null;
    /** Every tie the world holds from the observer to this person. */
    readonly tiesTo: (id: string) => readonly string[];
}): SomebodyDescribable[] {
    const what = input.description;
    const me = input.observer;

    const fits = input.candidates.filter(who => {
        if (what.sex !== null && (who.sex ?? '').toLowerCase() !== what.sex) return false;
        if (what.rank !== null
            && !(who.sectRank ?? '').toLowerCase().includes(what.rank)) return false;
        if (what.alignment !== null
            && input.alignmentOf(who.sectId) !== what.alignment) return false;
        if (what.realmKey !== null) {
            const tier = REALM_TIERS.find(row => row.key === what.realmKey);
            if (!tier) return false;
            if (who.realmOrdinal < tier.ordinalStart
                || who.realmOrdinal > tier.ordinalEnd) return false;
        }
        // A title with two meanings is satisfied by EITHER. "Uncle" is a blood
        // tie the world holds and it is also a martial generation inside a
        // house, and somebody typing it means whichever of the two is standing
        // in front of them.
        if (what.tie !== null && input.tiesTo(who.id).includes(what.tie)) return true;
        const onlyMeantTheTie = what.tie !== null
            && !what.sameHouse && what.standing === null;
        if (onlyMeantTheTie) return false;

        if (what.sameHouse && (me.sectId === null || who.sectId !== me.sectId)) return false;
        if (what.standing !== null) {
            // Inside a house it is the house's ladder. Outside one there is no
            // ladder to read, and the only ordering both of them can see is the
            // one everybody in this world can see.
            const onTheHouseLadder = what.sameHouse && me.rankIndex !== null;
            const mine = onTheHouseLadder ? me.rankIndex! : me.ordinal;
            const theirs = onTheHouseLadder
                ? input.rankIndexOf(who.sectId, who.sectRank)
                : who.realmOrdinal;
            if (theirs === null) return false;
            if (what.standing === 'above' && theirs <= mine) return false;
            if (what.standing === 'below' && theirs >= mine) return false;
        }
        return true;
    });

    // The tiebreak runs to the id in every branch, so the same square answers
    // the same way in every world. There is no distance in this world model, and
    // `nearest` is the reading `whoTheNearestFaceIs` already takes: the person
    // standing closest to your own height.
    const byId = (a: SomebodyDescribable, b: SomebodyDescribable) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

    switch (what.end) {
        case 'nearest':
            return fits.sort((a, b) =>
                Math.abs(a.realmOrdinal - me.ordinal)
                - Math.abs(b.realmOrdinal - me.ordinal) || byId(a, b));
        case 'youngest':
            return fits.sort((a, b) => a.age - b.age || byId(a, b));
        case 'oldest':
            return fits.sort((a, b) => b.age - a.age || byId(a, b));
        case 'strongest':
            return fits.sort((a, b) => b.realmOrdinal - a.realmOrdinal || byId(a, b));
        case 'weakest':
            return fits.sort((a, b) => a.realmOrdinal - b.realmOrdinal || byId(a, b));
        default:
            return fits.sort(byId);
    }
}
