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
 * The `refusal` field is only ever set where the request cannot be PUT - no
 * such art, they have never heard of the person you want to meet, they hold
 * nothing you could take. Those are incoherence, not disapproval, and every one
 * of them names what would work instead. A request that CAN be put is always
 * put, however badly it is going to go: asking a Nascent Soul elder to hand a
 * Qi Condensation nobody their house's own canon is available, is priced at
 * `a_betrayal`, and fails at odds the player can see. That is the difference
 * between the two mistakes `AGENTS.md` names - banning it, and quietly making
 * it cheap.
 *
 * Pure. Catalogs in, sentences out. No repository, no I/O, no RNG.
 */

import type { AskWeight } from '../engine/social-leverage/index.js';
import {
    betrayalOfSelling,
    isCommonlyHeld,
    noHouseCanCallItTheirs,
    manualsOf,
    whoseArt
} from '../engine/world/manuals.js';
import { carriesTo, getTechnique, teachersOf } from '../data/cultivation/techniques.js';
import { getSect, getSectsTeaching } from '../data/cultivation/sects.js';
import { rankName } from '../engine/cultivation/realms.js';
import { rungAndOrdinal } from './facts.js';
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
 * Being taught one art by one person.
 *
 * Three questions in order, and the order matters because each one makes the
 * next meaningful: is there such an art, do they hold it, and what would
 * handing it over cost them.
 */
function costOfTeaching(
    asking: TheOneAsking,
    asked: TheOneBeingAsked,
    techniqueId: string | null,
    namedButUnresolved: string
): RequestCosting {
    const couldTeach = whatTheyCouldTeach(asked, asking);
    const theirShelf = couldTeach.length > 0
        ? `What ${asked.name} is actually carrying that you are not: `
          + `${couldTeach.slice(0, 4).map(a => a.name).join(', ')}.`
        : '';

    // ── AND IT GOES ON `lines`, OR ONLY THE FALLBACK EVER SAYS IT ────────
    //
    // Every refusal below names the shelf in `refusal.prose` and nowhere else,
    // and `composeNarrationUser` sends `lines` alone - so a model narrator
    // replaces the one sentence that tells the player what to do next. Played,
    // against ollama, asking somebody for a method by a description rather than
    // a name:
    //
    //   engine   1 art they are carrying could have been asked for.
    //   prose    "The name goes nowhere. She does not correct you, nor does she
    //            offer a technique..."
    //
    // The player is told there is exactly one thing they could have asked for
    // and not told what it is. AGENTS.md: a refusal names a route - and a count
    // is not a name. Empty when they hold nothing new, which is the branch
    // where there is genuinely no route to name.
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
            }
        };
    }

    // ── AN ART WAS NAMED AND IT IS NOT AN ART ────────────────────────────
    if (!techniqueId && namedButUnresolved.length >= 2) {
        return {
            ask: 'a_real_favour',
            lines: shelfLines,
            structure: [
                `"${namedButUnresolved}" matched nothing in the technique catalog, so there is `
                + `no art for the request to be about. ${couldTeach.length} art`
                + `${couldTeach.length === 1 ? '' : 's'} they hold could have been named instead.`
            ],
            techniqueId: null,
            refusal: {
                headline: `No art called ${namedButUnresolved}.`,
                prose:
                    `You say the name and it goes nowhere. It is not a method anybody was ever `
                    + `taught, or not by that name. ${theirShelf}`,
                structure:
                    `Refused before the resolver, so no day was spent: "${namedButUnresolved}" `
                    + `is not an art anybody was ever taught. ${couldTeach.length} art`
                    + `${couldTeach.length === 1 ? '' : 's'} they are carrying could have been `
                    + `asked for.`
            }
        };
    }

    // ── NOTHING WAS NAMED, AND THEY HOLD MORE THAN ONE ───────────────────
    //
    // One candidate is not a choice and the sentence is unambiguous, so it is
    // taken. Several is a real question, and answering it with a guess would
    // spend a season on a book the player did not ask for.
    let chosen = techniqueId;
    if (!chosen) {
        if (couldTeach.length === 1) {
            chosen = couldTeach[0].id;
        } else {
            return {
                ask: 'a_real_favour',
                lines: shelfLines,
                structure: [
                    `${couldTeach.length} arts they hold are new to the asker and the sentence `
                    + `named none of them, so which road is being asked for is undecided.`
                ],
                techniqueId: null,
                refusal: {
                    headline: 'Taught what?',
                    prose:
                        `${asked.name} waits for you to say which, and it is a fair thing to wait `
                        + `for - what somebody is carrying is not one road. ${theirShelf} Name `
                        + `one.`,
                    structure:
                        `Refused before the resolver, so no day was spent: `
                        + `${couldTeach.length} arts were available to ask for and the sentence `
                        + `named none. They are `
                        + `${couldTeach.map(a => a.name).join(', ')}.`
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
            }
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
            }
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
                : `Teaching could carry the asker as far as ${rungAndOrdinal(reach)}, being the `
                  + `lower of the book's teachable end and ${rungAndOrdinal(asked.ordinal)}, `
                  + 'which is where the teacher has stood.'}`
        ],
        techniqueId: art.id,
        refusal: null
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
            }
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
            }
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
        refusal: null
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
        refusal: null
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
        refusal: null
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
}

export function whatItWouldCostThem(request: RequestToPrice): RequestCosting {
    const named = request.namedButUnresolved ?? '';
    switch (request.kind) {
        case 'teaching':
            return costOfTeaching(
                request.asking, request.asked, request.techniqueId ?? null, named
            );
        case 'introduction':
            return costOfIntroduction(request.asked, request.toMeet ?? null, named);
        case 'discipleship':
            return costOfDiscipleship(request.asking, request.asked);
        case 'nothing':
            return costOfACourtesy(request.asking, request.asked);
    }
}
