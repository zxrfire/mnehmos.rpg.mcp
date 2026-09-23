/**
 * The two things concealment means in this genre, and both were unreachable.
 *
 * Measured: `I hide` reached nothing, `I conceal my aura` reached nothing, and
 * `I hide my cultivation` reached `status` - a character sheet, handed to
 * somebody who had just said they were putting their weight away. That last one
 * is the softening AGENTS.md names as the failure that cannot be recovered
 * downstream.
 *
 * ── NEITHER OF THEM IS A NEW RULE ────────────────────────────────────────
 *
 * HIDING YOURSELF is answered by `noticesThatTheyAreThere`: two ordinals and
 * whether the looker already knows your face. It is asymmetric on purpose -
 * standing higher notices more people and nobody is hidden by being beneath -
 * and a known face wins outright at any height, which is the owner's ruling
 * written into that file. So this verb derives, turn by turn, who in this room
 * would still place you and why. There is no hidden-ness stat and there must
 * not be one: the answer changes when the room does, exactly as the demand on a
 * patch of ground does.
 *
 * HIDING YOUR CULTIVATION is answered by `whatTheyCanPlaceAbout`, which wraps
 * `concealmentHolds` and `apparentOrdinal` - the bands' own machinery, written
 * against the owner's ruling about the hidden expert in the nondescript robe.
 * What it buys is what that read already says a lower reading buys: nothing of
 * what you are is weighed against the person in front of you. What it costs is
 * that somebody at or above your real rung looks straight through it, and this
 * says who and by how much rather than hedging.
 *
 * ── THE ONE THING THAT IS NEW, AND IT IS ONE BIT ─────────────────────────
 *
 * {@link FLAG_WEIGHT_PUT_AWAY}. `what-you-are-not-showing.ts` reads a
 * concealment off the SENTENCE, per act, and its header argues for that: *"a
 * concealment is a thing you are DOING while you say something, not a hat"*.
 * That is right for a manner attached to an act and wrong for the thing the
 * genre is actually about - the cultivator who walks into a town reading as a
 * mortal, and goes on reading as one while they buy rice and ask directions.
 *
 * So the declaration can now stand: saying it sets the bit, saying you stop
 * clears it, and the bit is folded into the SAME predicate the per-sentence
 * declaration feeds - `theyAreNotShowingWhatTheyAre` - so nothing downstream
 * grows a second way of asking. No second realm number is stored anywhere. The
 * apparent rung is still computed by `apparentOrdinal` at the moment somebody
 * looks, which is the only place it can be right.
 */

import { realmIndexOf } from '../engine/cultivation/realms.js';
import { noticesThatTheyAreThere } from '../engine/social/presence-recognition.js';
import { whatTheyCanPlaceAbout } from '../engine/social/what-they-can-place-about-you.js';
import type { Cultivator } from '../schema/cultivation.js';
import { clearFlag, readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, observable, type EngineFacts } from './facts.js';
import { FLAG_WEIGHT_PUT_AWAY } from './flag-keys.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** The three things a player can say about being seen. */
export type ConcealIntent = 'self' | 'cultivation' | 'show';

/** Whether this cultivator's weight is put away and standing that way. */
export function theirWeightIsPutAway(
    db: GameService['db'],
    cultivatorId: string
): boolean {
    return readFlag(db, cultivatorId, FLAG_WEIGHT_PUT_AWAY) !== null;
}

/** Nothing moved and no day passed, but something was written. */
/**
 * What the player reads, and what the operator reads, in their own channels.
 *
 * The same argument position that put the engine's account of itself in front
 * of the player in the carry file, and for the same reason:
 * `factsForToolResult` takes PROSE third and this file handed it the structure.
 * Measured: "I hide my cultivation" answered with FLAG_WEIGHT_PUT_AWAY and the
 * name of the function that folds it. The channels are named here so the
 * position cannot be got wrong again.
 */
function saidAndNoted(lines: readonly string[], structure: string): EngineFacts {
    return observable(lines[0] ?? '', [...lines], lines.join('\n'), [structure]);
}

function done(name: string, action: 'conceal', facts: EngineFacts, summary: string): Execution {
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{ name, action, summary, ok: true }]
    };
}

/** Everybody standing here, with what this cultivator knows of each. */
function whoIsLooking(
    game: GameService,
    cultivator: Cultivator
): { id: string; name: string; realmOrdinal: number; known: boolean }[] {
    return game.present(cultivator).map(row => ({
        id: row.id,
        name: row.name,
        realmOrdinal: row.realmOrdinal,
        // A face they have stood in front of before. `noticesThatTheyAreThere`
        // takes this as the thing that wins outright, and it is asked from the
        // LOOKER's side: whether THEY know the player, not the reverse.
        known: game.knowledge.isAwareOf(row.id, 'cultivator', cultivator.id)
    }));
}

/**
 * Getting yourself out of sight, which is a read of the room.
 */
export function whoWouldStillFindYou(
    game: GameService,
    cultivator: Cultivator
): Execution {
    const looking = whoIsLooking(game, cultivator);
    if (looking.length === 0) {
        const line = 'There is nobody here to be out of sight of. You are already the only '
            + 'person on this ground.';
        return done('engine.hide', 'conceal', saidAndNoted([line],
            'conceal/self: nobody present. Nothing was written and no day passed.'),
            'Nobody present to hide from.');
    }

    const stillFind = looking.filter(who => noticesThatTheyAreThere({
        theirOrdinal: cultivator.realmOrdinal,
        yourOrdinal: who.realmOrdinal,
        known: who.known
    }));
    const lost = looking.length - stillFind.length;

    const why = (who: { name: string; realmOrdinal: number; known: boolean }): string =>
        who.known
            ? `${who.name} has stood in front of you before`
            : `${who.name} stands ${Math.abs(realmIndexOf(who.realmOrdinal)
                - realmIndexOf(cultivator.realmOrdinal))} realms above you`;

    const line = stillFind.length === 0
        ? `You put yourself out of sight. None of the ${looking.length} here would place you.`
        : `You put yourself out of sight, and it does not hold against everybody: `
            + `${stillFind.map(why).join(', ')}. `
            + (lost > 0
                ? `The other ${lost} here would not find you.`
                : 'Nobody here would fail to.');

    return done('engine.hide', 'conceal',
        saidAndNoted([line],
            `conceal/self: ${looking.length} present, ${stillFind.length} would still place `
            + `this cultivator (${stillFind.map(w => `${w.id}${w.known ? ' known' : ''}`).join(', ') || 'none'}). `
            + 'Derived from noticesThatTheyAreThere per looker. Nothing was written and no day passed.'),
        `${stillFind.length} of ${looking.length} would still place them.`);
}

/**
 * Putting your weight away, and who looks through it.
 */
export function theyPutTheirWeightAway(
    game: GameService,
    cultivator: Cultivator
): Execution {
    if (theirWeightIsPutAway(game.db, cultivator.id)) {
        return refused('engine.conceal', 'conceal', factsForRefusal(
            'You are already carrying nothing that says what you are.',
            'Your weight is already put away, and stays that way until you say otherwise.',
            'conceal/cultivation: FLAG_WEIGHT_PUT_AWAY already set. Nothing written, no day passed.'
        ));
    }
    writeFlag(game.db, cultivator.id, FLAG_WEIGHT_PUT_AWAY, 'yes');

    const looking = whoIsLooking(game, cultivator);
    // WHO LOOKS THROUGH IT, AND BY HOW MUCH. `whatTheyCanPlaceAbout` is the one
    // answer, and it is asked per looker because that is the only unit it has:
    // a concealment holds against one person and fails against the next in the
    // same room.
    const through = looking.filter(who => whatTheyCanPlaceAbout({
        theirOrdinal: cultivator.realmOrdinal,
        readerOrdinal: who.realmOrdinal,
        keepingItToThemselves: true,
        hasDealtWithThemBefore: who.known
    }).theyCanBePlaced);

    const by = (who: { name: string; realmOrdinal: number; known: boolean }): string =>
        who.known
            ? `${who.name}, who has dealt with you before`
            : `${who.name}, ${realmIndexOf(who.realmOrdinal) - realmIndexOf(cultivator.realmOrdinal)} `
                + 'realms over you';

    const lines = [
        'Your weight is put away. You carry nothing that says what you are, and it stays that '
        + 'way until you say otherwise.'
    ];
    if (looking.length > 0) {
        lines.push(through.length === 0
            ? `None of the ${looking.length} standing here is placed high enough to look `
                + 'through it.'
            : `It does not hold against ${by(through[0]!)}`
                + (through.length > 1
                    ? `, or against ${through.slice(1).map(by).join(', ')}.`
                    : '.'));
    }

    return done('engine.conceal', 'conceal',
        saidAndNoted(lines,
            'conceal/cultivation: FLAG_WEIGHT_PUT_AWAY set. Folded into '
            + '`theyAreNotShowingWhatTheyAre` with the per-sentence declaration, which is what '
            + `the face reads consult. ${through.length} of ${looking.length} present see `
            + `through it by whatTheyCanPlaceAbout. No second rung is stored: apparentOrdinal `
            + 'is computed when somebody looks.'),
        `${cultivator.id} put their weight away; ${through.length} of ${looking.length} see through it.`);
}

/**
 * Carrying it openly again.
 */
export function theyShowWhatTheyAre(
    game: GameService,
    cultivator: Cultivator
): Execution {
    if (!theirWeightIsPutAway(game.db, cultivator.id)) {
        return refused('engine.show', 'conceal', factsForRefusal(
            'You were not hiding anything.',
            'Your weight is already on you for anybody to read. In this world a cultivator '
            + 'carries it unless they put it away.',
            'conceal/show: FLAG_WEIGHT_PUT_AWAY was not set. Nothing written, no day passed.'
        ));
    }
    clearFlag(game.db, cultivator.id, FLAG_WEIGHT_PUT_AWAY);
    const line = 'Your weight is on you again, and anybody here can read what you are.';
    return done('engine.show', 'conceal',
        saidAndNoted([line], 'conceal/show: FLAG_WEIGHT_PUT_AWAY cleared.'),
        `${cultivator.id} is carrying their weight openly again.`);
}
