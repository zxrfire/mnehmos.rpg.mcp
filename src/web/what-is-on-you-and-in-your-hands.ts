/**
 * What is on your body and what is in your hands: the `carry` verb.
 *
 * Two ordinary acts that had no verb at all. Measured on the plain-sentence
 * sweep: `I put on the robes`, `I wear the robes`, `I draw my sword` and `I
 * drop the sword`, every one of them reached nothing.
 *
 * ── WORN, HELD, INVENTORY ────────────────────────────────────────────────
 *
 * The owner: "so 3 states: held, worn and inventory", clothes are "an equipment/item", and one
 * outfit at a time: "if they did wear plain clothes they'd unequip the sect robes". So `wear` is
 * an act: it changes the player into the thing named, and whatever they had on goes into their
 * inventory (`changeInto`). A house hands its robes over and does not dress anybody: "they give
 * you the item and YOU change". `take_off` puts a thing in the inventory, not on the ground.
 *
 * The robes are still read where they always were: `wearsTheRobesOf`, which now asks whether they
 * are ON, feeds `howTheirPeopleSeeYourFace`, the face read the gate and the lecture hall use. A
 * set in the pack reads as nobody's disciple. The token is still the proof a robe is not.
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
import { holdsTheTokenOf } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { hadAs, isWorn, type ObjectRecord } from '../engine/world/possessions.js';
import { changeInto, isAGarment, whatTheyHaveOn } from '../engine/world/what-somebody-stands-up-in.js';
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

/** Every set of robes this cultivator has, on them or in their pack, and whose they are. */
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

/** A sentence that named robes, and one that named plain clothes. */
const NAMES_ROBES = /\brobes?\b|\buniform\b/;
const NAMES_CLOTHES = /\bclothes\b|\bclothing\b/;

/**
 * The garment the player meant, among what they have. Robes when they said robes, their plain
 * clothes when they said clothes, and otherwise the first that fits `wanted`, robes first.
 */
function theGarmentMeant(
    objects: readonly ObjectRecord[],
    cultivatorId: string,
    named: string | undefined,
    wanted: (object: ObjectRecord) => boolean
): ObjectRecord | null {
    const theirs = objects.filter(o => o.possessorId === cultivatorId && isAGarment(o) && wanted(o))
        .sort((a, b) => Number(b.tags.includes('uniform')) - Number(a.tags.includes('uniform')));
    const said = (named ?? '').toLowerCase();
    const robes = NAMES_ROBES.test(said);
    const clothes = NAMES_CLOTHES.test(said);
    return theirs.find(o => (robes ? o.tags.includes('uniform') : clothes ? !o.tags.includes('uniform') : true))
        ?? null;
}

/** What a house's people make of the robes on somebody, or nothing for plain clothes. */
function whatTheRobesBuy(world: WorldState, cultivatorId: string, row: ObjectRecord): string | null {
    if (!row.tags.includes('uniform') || row.ownerId === null) return null;
    // THE TOKEN IS THE PROOF AND THE ROBE IS NOT, which is the lamp file's own line and the
    // whole shape of the seam: a robe reads at a distance and does not survive being asked.
    const token = holdsTheTokenOf(world.objects, cultivatorId, row.ownerId);
    return `The people of ${row.ownerName} read you as one of their own on sight`
        + (token
            ? ', and you carry its token, so being asked changes nothing.'
            : ', and you carry no token of it, so the first one of them who asks you for one has you.');
}

/**
 * Putting something on: the act. The player changes into it, and whatever they had on goes into
 * their inventory. Already on, it is the read it always was.
 */
export function whatWearingThemBuys(
    game: GameService,
    cultivator: Cultivator,
    named: string | undefined
): Execution {
    const world = game.atHand;
    const row = world ? theGarmentMeant(world.objects, cultivator.id, named, () => true) : null;
    if (world === null || world === undefined || row === null) {
        const askedForRobes = named === undefined || NAMES_ROBES.test(named.toLowerCase());
        return refused('engine.wear', 'carry', factsForRefusal(
            named === undefined ? 'You have no robes.' : `You have no ${named}.`,
            askedForRobes ? `You are not holding any house's robes. ${WHERE_ROBES_COME_FROM}` : `You have no ${named}.`,
            'carry/wear: no garment with this cultivator as possessor matched. Nothing was written and no day passed.'
        ));
    }
    const already = isWorn(row);
    const cameOff = already ? [] : changeInto(world.objects, cultivator.id, row.id);
    if (!already) game.theWorldMoved();
    const buys = whatTheRobesBuy(world, cultivator.id, row);
    const lines = [
        (already ? `You are already in ${row.name}.` : `You change into ${row.name}.`)
        + (cameOff.length > 0 ? ` Your ${cameOff.map(o => o.name).join(' and ')} go into your pack.` : ''),
        ...(buys === null ? [] : [buys])
    ];
    const structure = `carry/wear: ${row.id} worn${already ? ' already' : ''}; off into the inventory: `
        + `${cameOff.map(o => o.id).join(', ') || 'nothing'}. wearsTheRobesOf reads it as ON.`;
    return done('engine.wear', saidAndNoted(lines, structure), structure);
}

/**
 * Taking something off: into the inventory, not onto the ground. The robes read as a stranger's
 * from this moment.
 */
export function theyTakeTheRobesOff(
    game: GameService,
    cultivator: Cultivator,
    named: string | undefined
): Execution {
    const world = game.atHand;
    const row = world ? theGarmentMeant(world.objects, cultivator.id, named, isWorn) : null;
    if (world === null || world === undefined || row === null) {
        return refused('engine.takeOff', 'carry', factsForRefusal(
            named === undefined ? 'You have no robes on.' : `You have no ${named} on.`,
            named === undefined || NAMES_ROBES.test(named.toLowerCase())
                ? `You are not in any house's robes. ${WHERE_ROBES_COME_FROM}`
                : `You have no ${named} on.`,
            'carry/take_off: nothing worn with this cultivator as possessor matched. Nothing was written and no day passed.'
        ));
    }
    const at = world.objects.findIndex(o => o.id === row.id);
    if (at >= 0) world.objects[at] = hadAs(world.objects[at]!, 'inventory');
    game.theWorldMoved();
    const nothingOn = whatTheyHaveOn(world.objects, cultivator.id).length === 0;
    const line = `${row.name} ${/s$/.test(row.name) ? 'are' : 'is'} off you and in your pack.`
        + (row.tags.includes('uniform') ? ` The people of ${row.ownerName} read you as a stranger again.` : '')
        + (nothingOn ? ' You have nothing on.' : '');
    return done(
        'engine.takeOff',
        saidAndNoted([line], `carry/take_off: ${row.id} worn -> inventory. wearsTheRobesOf(${row.ownerId}) -> false.`),
        `${row.id} off ${cultivator.id}, into the inventory.`
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

/**
 * Offering proof of what you are, which is the token and never the robe.
 *
 * ── WHY THIS ONE MATTERS MORE THAN IT LOOKS ──────────────────────────────
 *
 * The owner's ruling about walking into a house you do not belong to turns on
 * exactly this: you break in, and either you blend in as a disciple or you are
 * thrown out. The robe does the blending - it reads at a distance - and the
 * TOKEN is what a robe is not, which is the proof. `a-recruit-is-given-their-
 * lamp-at-the-house.ts` says it outright: *"Proof of nothing: a robe can be
 * taken off a line. The token is the proof."*
 *
 * So a player who says this at a gate is doing the one thing that settles the
 * question, and the gate already reads `holdsTheTokenOf`. Nothing new is
 * decided here - this is the sentence that reaches that read.
 *
 * ── AND THE HALF WITH NO TOKEN IN IT ─────────────────────────────────────
 *
 * The interesting one. Somebody with nothing to show is told what that means
 * rather than that their sentence failed: whose robes they are standing in, if
 * any, and that the robes hold until the first person asks - which is the whole
 * shape of the intruder ruling, said to the player at the moment they were
 * about to find out the hard way.
 */
export function whatTheirTokenProves(
    game: GameService,
    cultivator: Cultivator
): Execution {
    const world = game.atHand;
    const held = world === null || world === undefined
        ? []
        : world.objects.filter(o =>
            o.possessorId === cultivator.id
            && o.id === tokenIdFor(cultivator.id)
            && o.ownerId !== null);
    const robes = world === null || world === undefined
        ? []
        : theRobesOnThem(world, cultivator.id);

    if (held.length === 0) {
        // AND THE RUNG, WHICH IS THE NUMBER THIS REFUSAL WAS MISSING.
        // `THE_RUNG_A_HOUSE_ISSUES_AT` is where a house starts putting its name
        // on somebody, and it is the whole answer to "why have I not got one" -
        // a refusal that says a token would settle this and does not say what
        // it takes to carry one is half an answer.
        const rung = `A house cuts one at rank ${THE_RUNG_A_HOUSE_ISSUES_AT} and above, the first `
            + 'rung that is a disciple rather than a hanger-on, and only where somebody in it '
            + 'stands high enough to light the lamp that goes with it.';
        const line = robes.length === 0
            ? 'You have nothing to show. No house has cut you a token, and you are in nobody\'s '
                + `robes, so there is nothing about you that says what you are. ${rung}`
            : `You have nothing to show. You are in the robes of ${robes[0]!.houseName} and `
                + 'carry no token of it: the robes hold at a distance and do not survive being '
                + `asked, and being asked is what this was. ${rung}`;
        return refused('engine.showToken', 'carry', factsForRefusal(
            'You carry no token.',
            line,
            `carry/show: no object ${tokenIdFor(cultivator.id)} possessed by this cultivator. `
            + `Robes on: ${robes.map(r => r.houseId).join(', ') || 'none'}. `
            + 'holdsTheTokenOf would answer false for every house. Nothing written, no day passed.'
        ));
    }

    const lines = held.map(token =>
        `You show the token of ${token.ownerName}. It was cut for you and it answers for you: `
        + 'anybody of that house who reads it knows what you are without being told.');
    return done(
        'engine.showToken',
        saidAndNoted(lines,
            `carry/show: ${held.map(t => `${t.id} owned by ${t.ownerId}`).join('; ')}. `
            + 'This is what `holdsTheTokenOf` reads at a gate. Nothing written, no day passed.'),
        `${cultivator.id} showed ${held.length} token(s).`
    );
}
