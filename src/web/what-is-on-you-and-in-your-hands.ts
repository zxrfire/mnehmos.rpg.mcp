/**
 * What is on your body and what is in your hands: the `carry` verb.
 *
 * Two ordinary acts that had no verb at all. Measured on the plain-sentence
 * sweep: `I put on the robes`, `I wear the robes`, `I draw my sword` and `I
 * drop the sword`, every one of them reached nothing.
 *
 * ── THE ROBES ARE NOT A NEW RULE ─────────────────────────────────────────
 *
 * The owner's ruling about walking into a house you do not belong to is that
 * you break in, and that either you blend in as a disciple or you are thrown
 * out. Blending in is the robes, and the engine has read them since the lamp
 * file was written: `wearsTheRobesOf` answers off the POSSESSIONS, and
 * `howTheirPeopleSeeYourFace` hands `inTheRobes` to the face read that the gate
 * and the lecture hall both use.
 *
 * So possession IS wearing, by that file's own design, and the design is
 * deliberate: *"A robe or a token in somebody else's hands is the seam the lamp
 * file keeps open on purpose - a genuine tag in the wrong hands still reads as
 * the house's."* A `worn` bit of my own would be a second opinion about a
 * question that file already answers, and it would answer it one way for the
 * player and another for everybody else in the world.
 *
 * What was missing was a way to SAY it and be told what it buys. That is what
 * `wear` is: a read, priced at nothing, that states whose robes are on the
 * player, that the house's people read them as one of its own because of it,
 * and the one thing that undoes it - the token, which is the proof a robe is
 * not.
 *
 * Taking them off is the act with a consequence, and it is the only write on
 * that side: the robes leave the player's hands onto the ground where they
 * stand, and the house's people read them as a stranger from that moment.
 *
 * ── AND THE BLADE ────────────────────────────────────────────────────────
 *
 * A blade out of its sheath is a fact about a body that the engine had no place
 * for, so it gets the machinery every other such fact uses: a flag.
 * {@link FLAG_BLADE_IN_HAND} holds what was drawn and the turn it was drawn on.
 *
 * IT IS READ, AND BY SOMETHING THAT ALREADY EXISTED. `attack` takes an
 * `opening` of `open` or `from_concealment`, and the resolver gives a concealed
 * opening the ambush edge and takes the target's first swing away. Somebody
 * standing in front of you with their sword already out is not ambushing
 * anybody, so a drawn blade closes that opening - one existing parameter, one
 * existing consequence, and no new opinion about what a drawn blade is worth.
 */

import {
    THE_RUNG_A_HOUSE_ISSUES_AT,
    tokenIdFor
} from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import {
    holdsTheTokenOf,
    wearsTheRobesOf
} from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { clearFlag, readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, observable, type EngineFacts } from './facts.js';
import { FLAG_BLADE_IN_HAND } from './flag-keys.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** The five things a player can say about what is on them. */
export type CarryIntent = 'wear' | 'take_off' | 'draw' | 'put_away' | 'drop' | 'show';

/**
 * What the player reads, and what the operator reads, in their own channels.
 *
 * ── THE DEFECT THIS EXISTS TO HAVE FIXED ─────────────────────────────────
 *
 * `factsForToolResult(headline, lines, prose)` takes PROSE third, and this file
 * was handing it the structure string. So every successful answer here printed
 * the engine's account of itself to the player - *"carry/draw:
 * FLAG_BLADE_IN_HAND = "my sword" on turn 0. Read by attack..."* - and left the
 * operator's channel empty. Two faults from one argument position.
 *
 * It reaches the player on three live paths, not one: no provider configured,
 * the provider unavailable, and - the one that matters - the narration
 * discarded for contradicting the engine, where the fallback the player is
 * shown is `facts.prose`.
 *
 * So the channels are filled by name here and never positionally again.
 */
function saidAndNoted(lines: readonly string[], structure: string): EngineFacts {
    return observable(lines[0] ?? '', [...lines], lines.join('\n'), [structure]);
}

/** Done, and no day passed. Not `freeAction`, which says nothing changed. */
function done(name: string, facts: EngineFacts, summary: string): Execution {
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{ name, action: 'carry', summary, ok: true }]
    };
}

/** What is in this cultivator's hand, or null. The ONE read of the flag. */
export function whatIsInTheirHand(
    db: GameService['db'],
    cultivatorId: string
): { what: string; onTurn: number } | null {
    const noted = readFlag(db, cultivatorId, FLAG_BLADE_IN_HAND);
    if (noted === null) return null;
    const at = noted.lastIndexOf(':');
    const turn = at < 0 ? Number.NaN : Number.parseInt(noted.slice(at + 1), 10);
    return {
        what: at < 0 ? noted : noted.slice(0, at),
        onTurn: Number.isFinite(turn) ? turn : 0
    };
}

/** Every set of robes this cultivator is holding, and whose they are. */
export function theRobesOnThem(
    world: WorldState,
    cultivatorId: string
): { row: ObjectRecord; houseId: string; houseName: string }[] {
    return world.objects
        .filter(o => o.possessorId === cultivatorId && o.tags.includes('uniform'))
        // A robe with no owner is not any house's robe, whatever it is made of,
        // and it is the owner that `wearsTheRobesOf` matches on.
        .flatMap(o => (o.ownerId === null
            ? []
            : [{ row: o, houseId: o.ownerId, houseName: o.ownerName }]));
}

/** Where a set of robes comes from, said once and used by both refusals. */
const WHERE_ROBES_COME_FROM =
    'A house hands its robes to its own, at its seat, once they are on the roll and standing '
    + 'inside its walls. The other way to be holding a set is to take one off somebody who was.';

/**
 * Putting robes on, which is a read: whose they are, and what that buys.
 */
export function whatWearingThemBuys(
    game: GameService,
    cultivator: Cultivator,
    named: string | undefined
): Execution {
    const world = game.atHand;
    const on = world === null || world === undefined ? [] : theRobesOnThem(world, cultivator.id);
    if (world === null || world === undefined || on.length === 0) {
        return refused('engine.wear', 'carry', factsForRefusal(
            named === undefined ? 'You have no robes.' : `You have no ${named}.`,
            `You are not holding any house's robes. ${WHERE_ROBES_COME_FROM}`,
            'carry/wear: no object tagged `uniform` with this cultivator as possessor. '
            + 'Nothing was written and no day passed.'
        ));
    }

    const lines: string[] = [];
    const structure: string[] = [];
    for (const { houseId, houseName, row } of on) {
        // THE TOKEN IS THE PROOF AND THE ROBE IS NOT, which is the lamp file's
        // own line and the whole shape of the seam: a robe reads at a distance
        // and does not survive being asked.
        const token = holdsTheTokenOf(world.objects, cultivator.id, houseId);
        lines.push(
            `You are in the robes of ${houseName}. Its people read you as one of its own on sight`
            + (token
                ? ', and you carry its token, so being asked changes nothing.'
                : ', and you carry no token of it, so the first one of them who asks you for '
                    + 'one has you.')
        );
        structure.push(
            `carry/wear: ${row.id}, owned by ${houseId}, possessor ${cultivator.id}. `
            + `wearsTheRobesOf -> ${wearsTheRobesOf(world.objects, cultivator.id, houseId)}; `
            + `holdsTheTokenOf -> ${token}. Read by howTheirPeopleSeeYourFace as \`inTheRobes\`. `
            + 'Nothing written and no day passed.'
        );
    }
    return done(
        'engine.wear',
        saidAndNoted(lines, structure.join(' ')),
        structure.join(' ')
    );
}

/**
 * Taking them off, which is the act: the house's people read the player as a
 * stranger from this moment.
 */
export function theyTakeTheRobesOff(
    game: GameService,
    cultivator: Cultivator,
    named: string | undefined
): Execution {
    const world = game.atHand;
    const on = world === null || world === undefined ? [] : theRobesOnThem(world, cultivator.id);
    if (world === null || world === undefined || on.length === 0) {
        return refused('engine.takeOff', 'carry', factsForRefusal(
            named === undefined ? 'You have no robes on.' : `You have no ${named} on.`,
            `You are not in any house's robes. ${WHERE_ROBES_COME_FROM}`,
            'carry/take_off: no object tagged `uniform` with this cultivator as possessor. '
            + 'Nothing was written and no day passed.'
        ));
    }
    const put = on[0]!;
    const at = world.objects.findIndex(o => o.id === put.row.id);
    if (at >= 0) {
        // Out of their hands and onto the ground they are standing on. Not
        // destroyed: a genuine set of robes can be picked up again, which is
        // how a player comes by one that was never theirs.
        world.objects[at] = {
            ...world.objects[at]!,
            possessorId: null,
            locationId: game.worldPlaceOf(cultivator) ?? world.objects[at]!.locationId
        };
    }
    const line = `The robes of ${put.houseName} are off you. Its people read you as a stranger `
        + 'again.';
    return done(
        'engine.takeOff',
        saidAndNoted([line],
            `carry/take_off: ${put.row.id} possessor cleared, left at `
            + `${game.worldPlaceOf(cultivator) ?? 'where they stand'}. `
            + `wearsTheRobesOf(${put.houseId}) -> false.`),
        `${put.row.id} off ${cultivator.id}; no longer reads as ${put.houseId}'s.`
    );
}

/**
 * The blade out, away, or onto the ground.
 *
 * All three write the same fact and none of them spends a day. What a drawn
 * blade costs is paid where it is read: an opening that cannot be a concealed
 * one while it stands.
 */
export function whatTheirHandsDo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    intent: 'draw' | 'put_away' | 'drop',
    named: string | undefined
): Execution {
    const held = whatIsInTheirHand(game.db, cultivator.id);

    if (intent === 'draw') {
        if (held !== null) {
            return refused('engine.draw', 'carry', factsForRefusal(
                `${held.what} is already out.`,
                `You are already standing with ${held.what} in your hand.`,
                `carry/draw: FLAG_BLADE_IN_HAND already holds "${held.what}" from turn `
                + `${held.onTurn}. Nothing written and no day passed.`
            ));
        }
        const what = named ?? 'your blade';
        writeFlag(game.db, cultivator.id, FLAG_BLADE_IN_HAND, `${what.slice(0, 40)}:${run.turn}`);
        // THE PLAYER'S OWN WORDS, MID-SENTENCE. Capitalising them to open a
        // sentence produced *"My sword is in your hand"* - the engine saying
        // `my` about the player's blade, because what it echoed back was the
        // possessive they typed. Putting the phrase where it was said keeps
        // their words and drops the clash.
        const line = `You have ${what} in your hand, and anybody standing here can see it. `
            + 'Nobody is ambushed by somebody who is already holding a blade.';
        return done(
            'engine.draw',
            saidAndNoted([line],
                `carry/draw: FLAG_BLADE_IN_HAND = "${what}" on turn ${run.turn}. Read by attack, `
                + 'which cannot open from concealment while it stands.'),
            `${cultivator.id} drew ${what} on turn ${run.turn}.`
        );
    }

    if (held === null) {
        return refused(
            intent === 'drop' ? 'engine.drop' : 'engine.putAway',
            'carry',
            factsForRefusal(
                'Your hands are empty.',
                'You have nothing out to put down. Drawing puts it in your hand, and it stays '
                + 'there until you put it away or let it go.',
                `carry/${intent}: FLAG_BLADE_IN_HAND is empty. Nothing written and no day passed.`
            )
        );
    }
    clearFlag(game.db, cultivator.id, FLAG_BLADE_IN_HAND);
    const line = intent === 'drop'
        ? `${held.what} is on the ground at your feet, and everybody here watched you let it go.`
        : `${held.what} is away. Nothing about you is drawn.`;
    return done(
        intent === 'drop' ? 'engine.drop' : 'engine.putAway',
        saidAndNoted([line],
            `carry/${intent}: FLAG_BLADE_IN_HAND cleared (held "${held.what}" since turn `
            + `${held.onTurn}).`),
        `${cultivator.id} ${intent === 'drop' ? 'dropped' : 'put away'} ${held.what}.`
    );
}

