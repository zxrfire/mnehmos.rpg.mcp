/**
 * WHAT SAYING YES WOULD COST THE PERSON BEING ASKED.
 *
 * The half of a request the engine has to decide before anybody rolls
 * anything. `asking.md` states the rule this file exists to enforce:
 *
 *   > Asking a gate guard for a name and asking the same guard to leave the
 *   > gate unwatched are the same sentence with the same charm behind it, and
 *   > they are not remotely the same attempt.
 *
 * `AskWeight` is where that lands, and until now the only thing filling it in
 * was a regex over the player's own sentence. That is fine for a courtesy and
 * badly wrong for a book: whether teaching somebody an art is an afternoon of
 * your time or the end of your standing in your own house is a fact about the
 * BOOK and the HOUSE, not about how the sentence was phrased.
 *
 * ── NOTHING HERE IS NEW MACHINERY ────────────────────────────────────────
 *
 * Every judgement below is read off something that already decides the same
 * question for NPCs, which is the whole point - `AGENTS.md` records that a rule
 * binding NPCs and not the player is the commonest defect in this repo, and
 * teaching is one of the systems it names:
 *
 *   noHouseCanCallItTheirs  whether an art is anybody's property at all. Not a
 *                        fact about height, and not `isCommonlyHeld`, which
 *                        answers whether a stall stocks one - a fact about how
 *                        many houses hold it, and the only one of the two that
 *                        can be asked about a sword form.
 *   betrayalOfSelling    the four-rung scale the world already prices a leaked
 *                        book on, from "an ordinary way for a poor cultivator
 *                        to eat" to "unforgivable and permanent".
 *   carriesTo            how far this teacher could actually walk this student,
 *                        which is their own rung and the book's teachable end,
 *                        whichever is lower.
 *   teachersOf           the five people in the world who are worth more than
 *                        the shelf they stand next to, and what each of them
 *                        wants for it - never money alone.
 *
 * Take those away and there is no teaching system left over, which is the test
 * `AGENTS.md` sets for whether a piece of lore is bespoke.
 *
 * ── AND NOTHING HERE BANS ANYTHING ───────────────────────────────────────
 *
 * A request that names what it wants is always put, however badly it is going
 * to go: asking a Nascent Soul elder to hand a Qi Condensation nobody their
 * house's own canon is available, is priced at `a_betrayal`, and fails at odds
 * the player can see. That is the difference between the two mistakes
 * `AGENTS.md` names - banning it, and quietly making it cheap.
 *
 * What the fields below settle is which of four things happened to a request
 * that named NOTHING, because the played defect was the engine emitting one and
 * the prose implying another:
 *
 *   refusal   they cannot (no such art, no road to hand on) or they will not.
 *             The second stands even when they are carrying arts - willingness
 *             is a decision and not an inventory check.
 *   askBack   they are willing and want to know which. A question, with the
 *             arts on offer in a fixed order and a price on it.
 *
 * A refusal always names what would work instead.
 *
 * ── THE OTHER DIRECTION IS A GAP, NOT A DECISION ─────────────────────────
 *
 * A player can be taught and cannot teach. "I teach her what I know" and "I
 * show her the form" each reached `unclear` 6 times out of 6 over 744 played
 * turns, and the reason is not the reader: there is no verb for handing a road
 * on, no handler behind one, and nothing anywhere in `src/` that writes an art
 * onto another person from the played side. `taught_technique` has been a
 * `FavorCause` since the ledger was written and has no producer - the same
 * signature `shielded_crossing` carried until `standing-guard.ts` gave it an
 * act.
 *
 * The READ inverts for free and is the reason this is worth recording rather
 * than merely noting: `TheOneAsking` and `TheOneBeingAsked` are symmetric, so
 * `whatTheyWouldTeachYou(player, them)` already answers which of the player's
 * arts are theirs to volunteer to this particular person, filtered by the same
 * house rule. What is missing is only the act - the span, the art written onto
 * the student, and the deed - which is the shape `standGuard` already runs for
 * the other giving mechanic.
 *
 * Written down rather than half-built. An ask-back with nothing behind it
 * points a player at an affordance that does not exist, which is the failure
 * `gap-routes.ts` keeps its own `NO_VERB_CARRIES_THESE` list to avoid.
 *
 * Pure. Catalogs in, sentences out. No repository, no I/O, no RNG.
 */

import type { AskWeight } from '../engine/social-leverage/index.js';
import {
    betrayalOfSelling,
    isCommonlyHeld,
    noHouseCanCallItTheirs,
    manualsOf,
    shelfReach,
    whoseArt
} from '../engine/world/manuals.js';
import { carriesTo, getTechnique, teachersOf } from '../data/cultivation/techniques.js';
import { getSect, getSectsTeaching } from '../data/cultivation/sects.js';
import { rankName } from '../engine/cultivation/realms.js';
import { theRung } from './facts.js';
import {
    theAskInWords,
    theGapInWords
} from './saying-what-an-ask-cost-and-how-likely-it-was.js';
import type { RequestKind } from './what-a-request-asks-and-of-whom.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/** The person doing the asking, as the sheet holds them. */
export interface TheOneAsking {
    name: string;
    ordinal: number;
    /** Their own house, when they serve one. */
    factionId: string | null;
    /** Art ids already on the sheet. An art they hold cannot be asked for. */
    holds: readonly string[];
    /**
     * Where they sit on their own house's rungs, when they are on a roll.
     *
     * Read only by `shelfReach`, which is the house's own rule for how far up
     * its shelf a member of a rank may reach - and so for whether one of that
     * house's books is a thing one of its people would volunteer.
     */
    rankIndex?: number | null;
}

/** The person being asked, as the roster and the world hold them. */
export interface TheOneBeingAsked {
    id: string;
    name: string;
    ordinal: number;
    factionId: string | null;
    /**
     * Art ids they can actually use, from the world row or the cultivator row.
     *
     * This is the field that decides most of it, and an empty one is a real
     * answer rather than missing data: plenty of people are carrying nothing
     * anybody would want to be taught.
     */
    holds: readonly string[];
    /**
     * Their id in `members.ts`, when the roster row came from the catalog.
     *
     * Only used to look them up in `LIVING_TRANSMISSIONS`, which is the five
     * people in the world who can walk somebody down a road no shelf holds.
     */
    memberId?: string | null;
}

export interface RequestCosting {
    /** What the resolver prices resistance and duration off. */
    ask: AskWeight;
    /** Narratable. Every line is read off a catalog or a row. */
    lines: string[];
    /** Inspector only. */
    structure: string[];
    /** The art this request settles on, when the ask is a teaching. */
    techniqueId: string | null;
    /**
     * Set only when the request cannot be PUT. Never disapproval, and always
     * carrying what would work instead.
     */
    refusal: { headline: string; prose: string; structure: string } | null;
    /**
     * Set when the ask is coherent and underspecified and they are willing: the
     * engine's own question, for the narrator to put in their mouth.
     *
     * A separate field from {@link refusal} because they are separate events
     * and the played defect was the two being confused. The engine declined and
     * the prose asked *"Teach you what?"* - a question nobody had asked, which
     * nothing would have answered, since no list had been printed for an answer
     * to point into.
     */
    askBack: TheQuestionPutBack | null;
}

/**
 * What somebody asks back when the request did not say which road.
 */
export interface TheQuestionPutBack {
    headline: string;
    prose: string;
    structure: string;
    /**
     * The arts on offer, in the order they are to be printed. An ordinal in the
     * player's next sentence is counted against this order.
     */
    offered: readonly { id: string; name: string }[];
    /** What they would want for it. Never empty: a price is always one answer. */
    terms: string;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT AN ART WOULD COST THEM TO HAND OVER
// ─────────────────────────────────────────────────────────────────────────

/**
 * The four rungs `betrayalOfSelling` already prices, as what it costs the
 * person to say yes.
 *
 * TEACHING AN ART AND SELLING ITS BOOK ARE THE SAME EXPOSURE. `manuals.md` is
 * explicit that what a house loses is the art being OUT - "once the top of a
 * house's shelf is out, no amount of killing you puts it back" - and it does
 * not become less out because it left through somebody's mouth instead of
 * somebody's hands. So one scale answers both, and there is no second table
 * here to drift from the first.
 *
 *   0  nobody's book. What it costs them is their afternoons.
 *   1  somebody else's house's art, and they are not of that house. Awkward,
 *      survivable, and against their interest if anybody works it out.
 *   2  their OWN house's working manual. The betrayal proper.
 *   3  the top of a shelf. Unforgivable and permanent.
 */
const WHAT_THE_LEAK_COSTS: Readonly<Record<0 | 1 | 2 | 3, AskWeight>> = {
    0: 'a_real_favour',
    1: 'against_their_interest',
    2: 'a_betrayal',
    3: 'a_betrayal'
};

/** What the four rungs read like to somebody watching it happen. */
function whyItCostsThat(rung: 0 | 1 | 2 | 3, teacherName: string, owner: string | null): string {
    switch (rung) {
        case 0:
            return `Nobody owns it. Every house, league and hedge-teacher in the province has `
                + `copied it, so what ${teacherName} would be spending is their afternoons and `
                + `nothing else.`;
        case 1:
            return `It is ${owner ?? 'somebody'}'s art and ${teacherName} is not theirs, which `
                + `makes this awkward rather than fatal - for as long as nobody who can `
                + `recognise it on sight is watching you practise.`;
        case 2:
            return `It is ${owner ?? 'their house'}'s working manual and ${teacherName} is one `
                + `of theirs. A shelf is what a house has instead of a wall, and handing a piece `
                + `of it to somebody outside is not a favour with a price - it is the thing a `
                + `house never forgives.`;
        case 3:
            return `It is the top of ${owner ?? 'their house'}'s shelf. Once that is out it is `
                + `out, and no amount of anything afterwards puts it back. Nothing you are `
                + `carrying is on the same scale as what you are asking them to lose.`;
    }
}

/**
 * Arts this person holds that the player does not, ordered by how far each
 * would carry them.
 *
 * Nothing is filtered on whether the player could OPEN it. `manuals.md` is
 * blunt that there are two gates and only one of them is the teacher's -
 * "rank says what the house will give you; the manual's own entry requirement
 * says what you can open, and being favoured does not lift it" - so a book
 * above the player's rung stays on this list and is refused later, by
 * `handleLearn`, in the terms `handleLearn` owns.
 */
export function whatTheyCouldTeach(
    asked: TheOneBeingAsked,
    asking: TheOneAsking
): { id: string; name: string; cap: number | null }[] {
    const held = new Set(asking.holds);
    const out: { id: string; name: string; cap: number | null }[] = [];
    const seen = new Set<string>();
    const consider = asked.holds;
    for (const id of consider) {
        if (held.has(id) || seen.has(id)) continue;
        seen.add(id);
        const art = getTechnique(id);
        if (!art) continue;
        out.push({ id: art.id, name: art.name, cap: art.cap ?? null });
    }
    return out.sort((a, b) => (b.cap ?? 0) - (a.cap ?? 0) || a.id.localeCompare(b.id));
}

/**
 * Arts they would put in THIS asker's hands, which is not the set they know.
 *
 * A master who holds five may offer two, and the two are decided by what the
 * leak would cost them and by the house's own rule about who may read what -
 * both already written down and read here rather than restated:
 *
 *   rung 0, 1  nobody's book, or somebody else's house's. Theirs to volunteer.
 *   rung 2     their own house's working manual. Volunteered only to somebody
 *              on that roll, and only as far up the shelf as `shelfReach` lets
 *              that person's rank read.
 *   rung 3     the top of a shelf. Never volunteered.
 *
 * Nothing here BANS anything. An art off this list can still be asked for by
 * name and is priced as the betrayal it is; what the list decides is what they
 * would bring up themselves.
 */
export function whatTheyWouldTeachYou(
    asked: TheOneBeingAsked,
    asking: TheOneAsking
): { id: string; name: string; cap: number | null }[] {
    return whatTheyCouldTeach(asked, asking).filter(art => {
        const owners = whoseArt(art.id);
        const ownerId = owners.includes(asked.factionId ?? '')
            ? asked.factionId
            : (owners[0] ?? null);
        const rung = betrayalOfSelling({ factionId: asked.factionId }, art.id, ownerId);
        if (rung === 3) return false;
        if (rung !== 2) return true;

        if (!ownerId || asking.factionId !== ownerId) return false;
        const shelf = manualsOf(ownerId);
        const at = shelf.findIndex(m => m.id === art.id);
        // Off the shelf entirely - a fighting art the house teaches - so the
        // shelf's own rule has nothing to say and being on the roll is the whole
        // of it.
        if (at < 0) return true;
        const ranks = getSect(ownerId)?.ranks.length ?? 1;
        return at < shelfReach(asking.rankIndex ?? -1, ranks, shelf.length);
    });
}

/**
 * What they would want for it, which is a condition and not a refusal.
 *
 * Read off what the world already holds about them, in order of how much it is
 * about this particular person: their own open want that this asker could
 * reach, then the price a living transmission is on record as asking, then the
 * honest answer that a price is a fact about which road and no road has been
 * named.
 */
function whatTheyWouldWantForIt(
    asked: TheOneBeingAsked,
    offered: readonly { id: string }[],
    theyWant: string | null
): string {
    if (theyWant) {
        return `${asked.name} is already after something this cultivator could reach: `
            + `${theyWant}. That is what there is to trade with.`;
    }
    for (const art of offered) {
        const mine = teachersOf(art.id).find(t => t.memberId === asked.memberId);
        if (mine) return `What ${asked.name} wants for it: ${mine.wants}`;
    }
    return `${asked.name} has named no price. What one road costs is not what another costs, `
        + `so there is nothing to settle until there is a road to settle it over.`;
}

/**
 * Being taught one art by one person.
 *
 * Four answers, and the whole job of this function is deciding WHICH ONE
 * happened rather than emitting one and letting prose imply another. That was
 * the played defect: the engine declined and the narration asked a question.
 *
 *   CANNOT    there is no road here to hand on, or the name was not an art.
 *   WILL NOT  they are carrying roads and none is one they would pass to this
 *             asker. A decision, and it stands even though they have arts.
 *   ASKS BACK they are willing, and the sentence did not say which road.
 *   A PRICE   what they would want for it, carried on the question rather than
 *             standing in for a refusal.
 */
function costOfTeaching(
    asking: TheOneAsking,
    asked: TheOneBeingAsked,
    techniqueId: string | null,
    namedButUnresolved: string,
    theyWant: string | null
): RequestCosting {
    const couldTeach = whatTheyCouldTeach(asked, asking);
    const wouldTeach = whatTheyWouldTeachYou(asked, asking);
    // WHAT THEY WOULD TEACH, not what they hold. Naming the whole of somebody's
    // repertoire as things that could have been asked for is both wrong - a
    // house's top canon was never on the table - and the engine reading its own
    // columns aloud.
    const theirShelf = wouldTeach.length > 0
        ? `What ${asked.name} would teach: `
          + `${wouldTeach.slice(0, 4).map(a => a.name).join(', ')}.`
        : couldTeach.length > 0
            // Still a route, and the only one left: naming an art outright is a
            // sentence the player can say and this module still prices.
            ? `Nothing ${asked.name} is carrying is theirs to volunteer. A name said outright `
              + `is the only way in, and it is a larger thing to ask than this was.`
            : '';

    // ── AND IT GOES ON `lines`, OR ONLY THE FALLBACK EVER SAYS IT ────────
    //
    // `composeNarrationUser` sends `lines` alone, so a shelf named only in
    // `refusal.prose` is a sentence a model narrator can replace. Played against
    // ollama: the engine said one art could have been asked for, and the prose
    // came back *"The name goes nowhere. She does not correct you, nor does she
    // offer a technique."* A count is not a name.
    const shelfLines = theirShelf.length > 0 ? [theirShelf] : [];

    // ── THEY ARE CARRYING NOTHING YOU HAVE NOT GOT ───────────────────────
    if (couldTeach.length === 0 && !techniqueId) {
        return {
            ask: 'a_real_favour',
            lines: shelfLines,
            structure: [
                `${asked.name} holds ${asked.holds.length} art`
                + `${asked.holds.length === 1 ? '' : 's'} and the asker already carries every one `
                + `of them, so there is no road here to be handed on.`
            ],
            techniqueId: null,
            refusal: {
                headline: `${asked.name} has nothing to teach you.`,
                prose:
                    `They hear you out. Whatever they practise, they practise on their own and it `
                    + `is not written anywhere you could be walked through - or you are already `
                    + `carrying it. Being taught needs somebody holding a road they can hand on, `
                    + `and standing above you is not the same fact as holding one.`,
                structure:
                    `Refused before the resolver, so no day was spent: ${asked.name} is `
                    + `carrying ${asked.holds.length} art`
                    + `${asked.holds.length === 1 ? '' : 's'} and the asker already has `
                    + `${asking.holds.length} of their own, leaving no road here that could be `
                    + `handed over.`
            },
            askBack: null
        };
    }

    // ── AN ART WAS NAMED AND IT IS NOT AN ART ────────────────────────────
    if (!techniqueId && namedButUnresolved.length >= 2) {
        return {
            ask: 'a_real_favour',
            lines: shelfLines,
            structure: [
                `"${namedButUnresolved}" matched nothing in the technique catalog, so there is `
                + `no art for the request to be about. ${wouldTeach.length} art`
                + `${wouldTeach.length === 1 ? '' : 's'} they would teach could have been named `
                + `instead.`
            ],
            techniqueId: null,
            refusal: {
                headline: `No art called ${namedButUnresolved}.`,
                prose:
                    `You say the name and it goes nowhere. It is not a method anybody was ever `
                    + `taught, or not by that name. ${theirShelf}`,
                structure:
                    `Refused before the resolver, so no day was spent: "${namedButUnresolved}" `
                    + `is not an art anybody was ever taught. ${wouldTeach.length} art`
                    + `${wouldTeach.length === 1 ? '' : 's'} they would teach could have been `
                    + `asked for.`
            },
            askBack: null
        };
    }

    // ── THEY HOLD ROADS AND WOULD PASS NONE OF THEM TO THIS ASKER ────────
    //
    // A different event from having nothing to teach, and it must not be
    // dressed up as a question: nothing would answer it.
    if (!techniqueId && wouldTeach.length === 0) {
        return {
            ask: 'a_real_favour',
            lines: [],
            structure: [
                `${couldTeach.length} art${couldTeach.length === 1 ? ' is' : 's are'} new to the `
                + `asker and ${couldTeach.length === 1 ? 'it is' : 'none of them is'} one `
                + `${asked.name} would volunteer, so nothing was put forward to choose between.`
            ],
            techniqueId: null,
            refusal: {
                headline: `${asked.name} will not teach you.`,
                prose:
                    `They hear you out and they will not. What they are carrying is not nothing `
                    + `and none of it is theirs to hand to somebody standing where you are - a `
                    + `road stays inside the house that owns it until the house says otherwise. `
                    + `Naming one yourself is still a sentence you can say, and it is a larger `
                    + `thing to ask than this was.`,
                structure:
                    `Refused before the resolver, so no day was spent: ${asked.name} holds `
                    + `${couldTeach.length} road${couldTeach.length === 1 ? '' : 's'} the asker `
                    + `does not and would volunteer none of them. An art named outright is still `
                    + `priced and still put.`
            },
            askBack: null
        };
    }

    // ── NOTHING WAS NAMED, AND THEY WOULD TEACH MORE THAN ONE ────────────
    //
    // One candidate is not a choice and the sentence is unambiguous, so it is
    // taken. Several is a real question, and answering it with a guess would
    // spend a season on a book the player did not ask for.
    let chosen = techniqueId;
    if (!chosen) {
        if (wouldTeach.length === 1) {
            chosen = wouldTeach[0].id;
        } else {
            const terms = whatTheyWouldWantForIt(asked, wouldTeach, theyWant);
            const wantsToKnow = `${asked.name} wants to know which of them.`;
            return {
                ask: 'a_real_favour',
                lines: [theirShelf, wantsToKnow, terms],
                structure: [
                    `${wouldTeach.length} arts ${asked.name} would teach are new to the asker and `
                    + `the sentence named none of them, so the ask goes back as a question `
                    + `rather than a refusal. No day was spent.`
                ],
                techniqueId: null,
                refusal: null,
                askBack: {
                    headline: `${asked.name} asks which art.`,
                    prose: `${theirShelf} ${wantsToKnow} ${terms}`,
                    structure:
                        `${wouldTeach.length} arts were put forward, in this order: `
                        + `${wouldTeach.map(a => a.name).join(', ')}.`,
                    offered: wouldTeach.map(a => ({ id: a.id, name: a.name })),
                    terms
                }
            };
        }
    }

    const art = getTechnique(chosen);
    if (!art) {
        return {
            ask: 'a_real_favour',
            lines: shelfLines,
            structure: [
                `The art settled on, ${chosen}, is not in the technique catalog at all, so `
                + `nothing can be priced against it.`
            ],
            techniqueId: null,
            refusal: {
                headline: 'No art by that name.',
                prose: `The name goes nowhere. ${theirShelf}`,
                structure:
                    `Refused before the resolver, so no day was spent: ${chosen} is not a row `
                    + `in the technique catalog.`
            },
            askBack: null
        };
    }

    // ── THEY DO NOT HOLD IT ──────────────────────────────────────────────
    if (!asked.holds.includes(art.id)) {
        const houses = getSectsTeaching(art.id);
        const living = asked.memberId ? teachersOf(art.id) : [];
        const whoDoes = houses.length > 0
            ? `${houses.length === 1 ? 'One house' : `${houses.length} houses`} in the world `
              + `teach${houses.length === 1 ? 'es' : ''} it, which is a thing you find out by `
              + `asking people rather than by being handed the list.`
            : isCommonlyHeld(art.id)
                ? 'It is common enough that a stall sells a copy next to the cooking pots.'
                : 'Nobody teaches it off a shelf anywhere. Whoever has it, dug it up.';
        return {
            ask: 'a_real_favour',
            lines: shelfLines,
            structure: [
                `${asked.name} does not hold ${art.name}, so there is nobody here to walk the `
                + `asker down it. ${houses.length} house`
                + `${houses.length === 1 ? '' : 's'} in the world teach it, and `
                + `${living.length === 0
                    ? 'nobody carries it as a living transmission'
                    : `${living.length} person${living.length === 1 ? '' : 's'} carries it as a `
                      + 'living transmission the shelves do not'}.`
            ],
            techniqueId: null,
            refusal: {
                headline: `${asked.name} does not have it.`,
                prose:
                    `They know the name - most people at their rung would - and that is the whole `
                    + `of what they have of it. Nobody can walk you down a road they have not `
                    + `walked. ${whoDoes} ${theirShelf}`,
                structure:
                    `Refused before the resolver, so no day was spent: the art is not one of the `
                    + `${asked.holds.length} ${asked.holds.length === 1 ? 'road' : 'roads'} `
                    + `${asked.name} is carrying.`
            },
            askBack: null
        };
    }

    // ── AND WHAT HANDING IT OVER WOULD COST THEM ─────────────────────────
    const owners = whoseArt(art.id);
    const ownerId = owners.includes(asked.factionId ?? '')
        ? asked.factionId
        : (owners[0] ?? null);
    const rung = betrayalOfSelling({ factionId: asked.factionId }, art.id, ownerId);
    const ownerName = ownerId ? getSect(ownerId)?.name ?? null : null;

    const lines = [
        `${asked.name} holds ${art.name}. ${whyItCostsThat(rung, asked.name, ownerName)}`
    ];

    // How far they could actually carry you, which is their own rung and the
    // book's teachable end, whichever is lower. A teacher at or below you is
    // still a teacher of the ART and is not a road any further up.
    const reach = carriesTo(asked.ordinal, art.id);
    if (reach !== null) {
        lines.push(
            reach > asking.ordinal
                ? `They have stood at ${rankName(reach)} on it, so that is as far as they could `
                  + `take you.`
                : `They have not stood any further up it than you are now, so what you would get `
                  + `is the art and not a road past where you already are.`
        );
    }

    // The player's own house teaching it is the cheapest route to the same
    // book, and saying so costs nothing - the membership row is theirs.
    if (asking.factionId && getSect(asking.factionId)?.teaches.includes(art.id)) {
        lines.push(
            `Your own house teaches it, which is the cheaper way to the same book: a shelf `
            + `reached by rank costs contribution and not a favour.`
        );
    }

    return {
        ask: WHAT_THE_LEAK_COSTS[rung],
        lines,
        structure: [
            `${art.name} would leave ${asked.name}'s hands at rung ${rung} of the four the world `
            + `prices a leaked book on: `
            // `noHouseCanCallItTheirs` and NOT `isCommonlyHeld`, which answers
            // whether a stall stocks a thing. Reading the market predicate here
            // made the line contradict the rung beside it: rung 1 was being
            // explained as *no house can call it theirs*, on a sword form one
            // house teaches.
            + `${noHouseCanCallItTheirs(art.id)
                ? 'it is held widely enough that no house can call it theirs'
                : ownerName === null
                    ? 'it is not commonly held and no house on record owns it'
                    : ownerId === asked.factionId
                        ? `it is ${ownerName}'s and they are one of ${ownerName}'s`
                        : `it is ${ownerName}'s and they are not`}`
            + `${ownerId && manualsOf(ownerId).at(-1)?.id === art.id
                ? ', and it sits at the top of that shelf'
                : ''}. `
            + `That makes the request ${theAskInWords(WHAT_THE_LEAK_COSTS[rung])}. `
            + `${reach === null
                ? 'The book states no teachable end.'
                : `Teaching could carry the asker as far as ${theRung(reach)}, being the `
                  + `lower of the book's teachable end and ${theRung(asked.ordinal)}, `
                  + 'which is where the teacher has stood.'}`
        ],
        techniqueId: art.id,
        refusal: null,
        askBack: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BEING PUT IN FRONT OF SOMEBODY
// ─────────────────────────────────────────────────────────────────────────

/**
 * An introduction, which is the cheapest thing in this game and the one the
 * whole teacher read ends on.
 *
 * `whoWouldTeach` closes with *"You have no name to ask for, which is the whole
 * of what is stopping you"*, and until this existed there was no verb that
 * turned that sentence into a name. `AskWeight`'s own definition puts an
 * introduction at `a_courtesy` - "a name, a direction, an introduction; costs
 * them nothing" - and that is the whole pricing.
 *
 * The one thing it can fail on is coherence: nobody can introduce you to
 * somebody they have never met.
 */
function costOfIntroduction(
    asked: TheOneBeingAsked,
    toMeet: { id: string; name: string; factionId: string | null; here: boolean } | null,
    namedButUnresolved: string
): RequestCosting {
    if (!toMeet) {
        return {
            ask: 'a_courtesy',
            lines: [],
            structure: [
                `"${namedButUnresolved}" resolved to nobody the asker holds a record for, so `
                + `there is no third party for an introduction to be to.`
            ],
            techniqueId: null,
            refusal: {
                headline: namedButUnresolved.length >= 2
                    ? `You cannot ask for ${namedButUnresolved} by name.`
                    : 'Introduced to whom?',
                prose: namedButUnresolved.length >= 2
                    ? `The name is in your mouth and there is nothing behind it - you have never `
                      + `been told who that is, and asking to be introduced to somebody you `
                      + `cannot place is asking for nothing. Names arrive by being said in front `
                      + `of you. Ask ${asked.name} what they know instead, and see whose name `
                      + `comes out of it.`
                    : `${asked.name} waits for a name. An introduction is to somebody, and you `
                      + `have not said who.`,
                structure:
                    `Refused before the resolver, so no day was spent: the person to be `
                    + `introduced to resolved to nobody.`
            },
            askBack: null
        };
    }

    const sameHouse = toMeet.factionId !== null && toMeet.factionId === asked.factionId;
    if (!sameHouse && !toMeet.here) {
        return {
            ask: 'a_courtesy',
            lines: [],
            structure: [
                `${asked.name} serves ${asked.factionId ?? 'nobody'} and ${toMeet.name} serves `
                + `${toMeet.factionId ?? 'nobody'}, and the two are not standing in the same `
                + `place, so there is no line along which an introduction could run.`
            ],
            techniqueId: null,
            refusal: {
                headline: `${asked.name} cannot reach them either.`,
                prose:
                    `They turn the name over and hand it back. Whoever ${toMeet.name} is, they are `
                    + `not somebody ${asked.name} serves beside or drinks with, and a word from a `
                    + `stranger is worth less than no word at all. An introduction runs along a `
                    + `line somebody is already standing on: their own house, or somebody `
                    + `standing in the same square.`,
                structure:
                    'Refused before the resolver, so no day was spent: the person being asked '
                    + 'has no reach to the person being asked about.'
            },
            askBack: null
        };
    }

    return {
        ask: 'a_courtesy',
        lines: [
            sameHouse
                ? `${toMeet.name} is on the same roll as ${asked.name}, so this costs them a `
                  + `sentence in a corridor and whatever it does to their own standing if you `
                  + `turn out badly.`
                : `${toMeet.name} is standing here too, and ${asked.name} can put a name to them, `
                  + `which is the whole of what an introduction is.`
        ],
        structure: [
            `${asked.name} could put ${toMeet.name} in front of the asker `
            + `${sameHouse
                ? 'because the two of them are on the same roll'
                : 'because the two of them are standing in the same place'}, which costs them `
            + 'a sentence and their own standing if the asker turns out badly.'
        ],
        techniqueId: null,
        refusal: null,
        askBack: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BEING TAKEN ON
// ─────────────────────────────────────────────────────────────────────────

/**
 * The courtesy that asks for nothing, which is the only thing in the game a
 * cultivator with nothing at all can spend.
 *
 * `asking.md`: *"What you have done for someone counts for more than either. A
 * carter you bought a drink for last month talks more freely than an official
 * ever will, and not because he likes you - because he has no position to
 * protect and you are now someone he knows. Small, cheap, repeated things
 * work: a round, a gift, a favour, turning up twice. This is the cheapest lever
 * in the game and it is available to a cultivator with nothing."*
 *
 * Every clause of that is load-bearing here. It costs a day and nothing else,
 * because the moment it costs stones it stops being available to somebody with
 * nothing. It cannot be refused into a grudge, because nothing was asked. And
 * it is a WALL against an official and an open door beside somebody at your own
 * altitude - not by a rule about officials, but because `regardFor`'s standing
 * term is the dominant one and a courtesy has almost no resistance of its own
 * to hide behind.
 */
function costOfACourtesy(asking: TheOneAsking, asked: TheOneBeingAsked): RequestCosting {
    const gap = asked.ordinal - asking.ordinal;
    return {
        ask: 'a_courtesy',
        lines: [
            gap >= 5
                ? `You are asking for nothing, which is the only thing somebody at `
                  + `${rankName(asked.ordinal)} has no reason to refuse and every reason not to `
                  + `notice. What is between you is not suspicion. It is that there is nothing `
                  + `you could do for them that they would feel.`
                : `You want nothing out of it, which is the whole of what makes it worth `
                  + `anything. It costs you a day and no stones at all - and it is the only `
                  + `thing that moves somebody who does not know you.`
        ],
        structure: [
            `Asking for nothing is ${theGapInWords(asked.ordinal, asking.ordinal)}, and it is `
            + `priced as ${theAskInWords('a_courtesy')}. It costs one day and no spirit stones, `
            + `which is what keeps it available to somebody carrying nothing.`
        ],
        techniqueId: null,
        refusal: null,
        askBack: null
    };
}

/**
 * Discipleship: the person rather than the art.
 *
 * `manuals.md` names this as one of the three shapes a house's admission takes
 * and the most demanding of them - *"a teacher and no book at all: an inner
 * disciple will teach you, if you can win their favour"* - and it is the only
 * one where progress runs through goodwill rather than an object you hold.
 *
 * Never refused for being presumptuous. Somebody at or below your own rung
 * agreeing to be your master is a perfectly available thing to ask for and buys
 * nothing, because `guidanceMultiplier` is exactly 1 when the guide is not
 * above the guided - the request prices itself and no rule is needed.
 */
function costOfDiscipleship(asking: TheOneAsking, asked: TheOneBeingAsked): RequestCosting {
    const gap = asked.ordinal - asking.ordinal;
    return {
        ask: 'a_real_favour',
        lines: [
            gap > 0
                ? `You are asking for their years, which is the one thing nobody at ${rankName(asked.ordinal)} `
                  + `has spare. A student is decades of somebody's attention and their name on `
                  + `whatever you turn out to be.`
                : `They do not stand above you. Somebody can agree to this and it buys you `
                  + `nothing at all: guidance is priced on the gap between the guide and the `
                  + `guided, and there is no gap.`
        ],
        structure: [
            `Being taken on is ${theGapInWords(asked.ordinal, asking.ordinal)}, and it is priced `
            + `as ${theAskInWords('a_real_favour')} - decades of somebody's attention and their `
            + `name on whatever the student turns out to be.`
        ],
        techniqueId: null,
        refusal: null,
        askBack: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

export interface RequestToPrice {
    kind: Extract<RequestKind, 'teaching' | 'introduction' | 'discipleship' | 'nothing'>;
    asking: TheOneAsking;
    asked: TheOneBeingAsked;
    /** The art, when one resolved. */
    techniqueId?: string | null;
    /** The third party, when one resolved. */
    toMeet?: { id: string; name: string; factionId: string | null; here: boolean } | null;
    /** What the player typed for the object, resolved or not. */
    namedButUnresolved?: string;
    /**
     * An open want of theirs this asker could reach, when there is one.
     *
     * `whatTheyWantThatYouCouldReach` is the source, read by the caller because
     * it takes a repository and this module does not. Carried here so that a
     * question the engine asks can arrive with a price on it.
     */
    theyWant?: string | null;
}

export function whatItWouldCostThem(request: RequestToPrice): RequestCosting {
    const named = request.namedButUnresolved ?? '';
    switch (request.kind) {
        case 'teaching':
            return costOfTeaching(
                request.asking, request.asked, request.techniqueId ?? null, named,
                request.theyWant ?? null
            );
        case 'introduction':
            return costOfIntroduction(request.asked, request.toMeet ?? null, named);
        case 'discipleship':
            return costOfDiscipleship(request.asking, request.asked);
        case 'nothing':
            return costOfACourtesy(request.asking, request.asked);
    }
}
