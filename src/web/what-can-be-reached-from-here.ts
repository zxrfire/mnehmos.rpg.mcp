/**
 * What can be acted on from where the cultivator is standing, and every name
 * each of those things answers to.
 *
 * Everything upstream of this - `a-target-can-be-a-description.ts`, the name
 * resolver, `an-act-that-is-coherent-and-stupid.ts` - answers the question
 * "given this phrase, who did they mean". None of it answers the question a
 * reader actually has, which is "what is there to mean at all". A reader that
 * has to GUESS what is nameable will guess, and the friction the design owner
 * is describing is every one of those guesses coming back as a refusal.
 *
 * ── A HOUSE IS REACHED THROUGH SOMEBODY STANDING THERE ───────────────────
 *
 * The rule that makes this more than a roster. Declaring against a house from
 * the other side of the map and declaring it in front of one of its disciples
 * are the same sentence and must not be the same event, and both fall out of
 * one list and neither is written as a rule about
 * courts or about war. A house is on this list when somebody who answers to it
 * is within arm's reach, and it is off the list otherwise. So the sentence is
 * aimed at something present or at the horizon, the difference is a lookup, and
 * what comes of each is the ordinary answer to a thing aimed at somebody versus
 * a thing aimed at nobody. `through` is who put it on the list, which is the
 * disciple who has to decide what to do about what he just heard.
 *
 * ── AND THE LIST DOES NOT MEAN "ONLY THESE" ──────────────────────────────
 *
 * The same standing rule `describeWhatIsLive` carries: this is what is at hand,
 * not what is permitted. Somebody may name a house a thousand miles off and the
 * engine will answer them honestly about it. What being ON the list changes is
 * that there is a body here to answer.
 */

import {
    WAYS_OF_NAMING_SOMEBODY,
    theWordsThisPersonAnswersTo,
    type SomebodyDescribable
} from './a-target-can-be-a-description.js';
import type { SectAlignment } from '../schema/cultivation.js';

/**
 * What kind of thing it is. Not a permission and not a verb list: what it is
 * decides what a refusal can honestly SAY, and nothing else.
 */
export type ReachKind = 'person' | 'house';

export interface WithinReach {
    readonly kind: ReachKind;
    readonly id: string;
    /** What the engine calls it. Always the first thing a reader should try. */
    readonly name: string;
    readonly alsoCalled: readonly string[];
    /**
     * Who put it within reach, for a thing that is only here through somebody.
     *
     * Null for a person, who is here on their own account.
     */
    readonly through: { readonly id: string; readonly name: string } | null;
}

/** Somebody standing here, with the one thing the roster row does not carry. */
export interface SomebodyPresent extends SomebodyDescribable {
    readonly sectName: string | null;
}

/**
 * Everything within reach, people first.
 *
 * People before houses because a house is only here through a person, and a
 * reader that has read the people has already read the grounds for the houses.
 */
export function whatCanBeReachedFromHere(input: {
    readonly present: readonly SomebodyPresent[];
    readonly observer: {
        readonly ordinal: number;
        readonly sectId: string | null;
        readonly rankIndex: number | null;
    };
    readonly alignmentOf: (sectId: string | null) => SectAlignment | null;
    readonly rankIndexOf: (sectId: string | null, rankTitle: string | null) => number | null;
    readonly tiesTo: (id: string) => readonly string[];
}): WithinReach[] {
    const people: WithinReach[] = input.present.map(who => ({
        kind: 'person' as const,
        id: who.id,
        name: who.name,
        alsoCalled: theWordsThisPersonAnswersTo({ ...input, who, candidates: input.present }),
        through: null
    }));

    // FIRST BODY WINS, and the order is the caller's. Two disciples of one
    // house put it on the list once, named for whichever of them the square
    // already puts first, because a house is one thing however many people
    // carry it.
    const houses = new Map<string, WithinReach>();
    for (const who of input.present) {
        if (who.sectId === null || who.sectName === null) continue;
        if (houses.has(who.sectId)) continue;
        houses.set(who.sectId, {
            kind: 'house',
            id: who.sectId,
            name: who.sectName,
            alsoCalled: theWaysAHouseIsNamed(who.sectName, input.alignmentOf(who.sectId)),
            through: { id: who.id, name: who.name }
        });
    }

    return [...people, ...houses.values()];
}

/**
 * Whether this thing is one of the things within reach, under any of its names.
 *
 * The one question a caller asks of this list, and the reason it is a function
 * rather than a comparison at each call site: a phrase reaches a thing under
 * the name the engine uses OR under any of the ones it also answers to, and a
 * caller checking only the first would tell somebody the Hollow Court is not
 * here while a Hollow Court disciple is standing in front of them.
 */
export function whatThePhraseReaches(
    said: string,
    reach: readonly WithinReach[]
): WithinReach | null {
    const asked = said.trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '');
    if (asked.length === 0) return null;
    for (const thing of reach) {
        const names = [thing.name, ...thing.alsoCalled]
            .map(name => name.toLowerCase().replace(/^(?:the|a|an)\s+/, ''));
        if (names.includes(asked)) return thing;
    }
    return null;
}

/**
 * The other things a house gets called, out of its own name.
 *
 * Houses in this world are named `<image> <type-noun>` - the Hollow Court, the
 * Iron Ridge - and people drop the first half constantly. Nothing here is a
 * table of nicknames: the short form is the name's own last word, so a house
 * added to the catalog tomorrow is shortened correctly without anybody writing
 * it down. The leaning is included because it is how a player refers to a house
 * whose name they never caught, and because the description resolver already
 * takes that word for people.
 */
function theWaysAHouseIsNamed(name: string, alignment: SectAlignment | null): string[] {
    const bare = name.replace(/^(?:The|the)\s+/, '');
    const words = bare.split(/\s+/);
    const out: string[] = [];
    if (words.length > 1) out.push(`the ${words[words.length - 1]}`);
    if (alignment !== null && alignment !== 'neutral') out.push(`the ${alignment} sect`);
    return out.slice(0, WAYS_OF_NAMING_SOMEBODY);
}

/**
 * Who in the square was named by words aimed at this thing.
 *
 * The whole of what makes a declaration land on somebody rather than on the
 * horizon, and it decides nothing about what they do: that is
 * `whatTheyDoAboutBeingWronged`, which already prices what somebody can do and
 * what they are willing to do, and needs only to be told it happened. So there
 * is no rule here about war, about insults, or about any verb. Words aimed at
 * somebody present are heard by them; words aimed at a house are heard by
 * whoever here answers to it; words aimed at anything else are heard by nobody,
 * which is not the same as unheard - the square still watched somebody say it,
 * and the world still holds that they did.
 */
export function whoTheWordsLandedOn(
    aimedAt: WithinReach | null,
    present: readonly SomebodyPresent[]
): SomebodyPresent[] {
    if (aimedAt === null) return [];
    if (aimedAt.kind === 'person') {
        return present.filter(who => who.id === aimedAt.id);
    }
    return present.filter(who => who.sectId === aimedAt.id);
}
