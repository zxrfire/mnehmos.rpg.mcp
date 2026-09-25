/**
 * A kinship word said to somebody - "Grandmother, ...", "Father, ..." - reaches
 * whoever of your household is standing here, by the tie and not by age.
 *
 * Played: "Grandmother, where would I find the Tranquil Oasis Sect?", said to
 * the woman who raised the player, came back "Nobody by that name". The owner:
 * kinship words are about relationship, not age, and the one who raised you is
 * father or mother. A word that does not fit the tie still reaches them; the
 * misnaming is stated, and it is theirs to react to.
 */

import type { Sex } from '../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';
import { whatAHouseholdTieMakesThem } from './who-a-life-like-this-grew-up-knowing.js';

const A_KINSHIP_WORD =
    /^(?:my\s+|dear\s+|honou?red\s+|respected\s+)?(?:elder\s+|older\s+|big\s+|little\s+|younger\s+)?(grandfather|grandmother|grandpa|grandma|granny|grandad|granddad|father|mother|dad|daddy|mum|mom|mama|papa|pa|ma|brother|sister|sis|auntie|aunt|uncle)$/i;

const MALE = new Set(['grandfather', 'grandpa', 'grandad', 'granddad', 'father', 'dad', 'daddy', 'papa', 'pa', 'brother', 'uncle']);
const OF_ONE_GENERATION = new Set(['brother', 'sister', 'sis']);
/** The word the engine itself would use, where the typed one is a form of it. */
const THE_PLAIN_WORD: Readonly<Record<string, string>> = {
    dad: 'father', daddy: 'father', papa: 'father', pa: 'father',
    mum: 'mother', mom: 'mother', mama: 'mother', ma: 'mother', sis: 'sister'
};

/**
 * The household tie, read from the world's rows either way round and from what
 * the player was left knowing about them ("is your mother", "raised you").
 */
export function theHouseholdTie(
    theirTiesToThePlayer: readonly { kind: string }[],
    playersTiesToThem: readonly { kind: string }[],
    whatYouKnowOfThem: string | null
): 'parent' | 'kin' | null {
    if (playersTiesToThem.some(tie => tie.kind === 'parent')
        || theirTiesToThePlayer.some(tie => tie.kind === 'child')) return 'parent';
    if (playersTiesToThem.some(tie => tie.kind === 'kin')
        || theirTiesToThePlayer.some(tie => tie.kind === 'kin')) return 'kin';
    const said = whatYouKnowOfThem ?? '';
    if (/\bis your (?:father|mother)\b|\braised you\b/.test(said)) return 'parent';
    if (/\bis your (?:brother|sister)\b/.test(said)) return 'kin';
    return null;
}

export interface SomebodyStandingHere {
    id: string;
    name: string;
    sex: Sex;
}

export interface TheKinThisWordMeans {
    id: string;
    name: string;
    /** The word said does not fit the tie: stated plainly, for them to react to. */
    misnamed: string | null;
}

/**
 * Who of the player's household standing here a kinship word means, or null
 * where it is not a kinship word or none of them is here. The closest fit by
 * tie then by sex; a poor fit still reaches somebody of the household.
 */
export function theKinThisWordMeans(
    said: string | undefined,
    /** The household tie the player holds to this person, or null. */
    tieOf: (id: string) => 'parent' | 'kin' | null,
    present: readonly SomebodyStandingHere[]
): TheKinThisWordMeans | null {
    const hit = A_KINSHIP_WORD.exec((said ?? '').trim());
    if (!hit) return null;
    const word = hit[1]!.toLowerCase();
    const household = present.flatMap(row => {
        const tie = tieOf(row.id);
        return tie ? [{ ...row, tie }] : [];
    });
    if (household.length === 0) return null;

    const wantTie = OF_ONE_GENERATION.has(word) ? 'kin' : 'parent';
    const wantSex: Sex = MALE.has(word) ? 'male' : 'female';
    const score = (one: typeof household[number]) =>
        (one.tie === wantTie ? 2 : 0) + (one.sex === wantSex ? 1 : 0);
    const best = [...household].sort((a, b) => score(b) - score(a))[0]!;

    const theirWord = whatAHouseholdTieMakesThem(best.tie, best.sex);
    const fits = theirWord !== null && (THE_PLAIN_WORD[word] ?? word) === theirWord;
    return {
        id: best.id,
        name: best.name,
        misnamed: fits || theirWord === null
            ? null
            : `You called ${best.name} "${hit[0]!.trim()}"; ${best.name} is your ${theirWord}.`
    };
}
