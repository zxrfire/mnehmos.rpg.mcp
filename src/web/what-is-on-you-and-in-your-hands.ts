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
 * A drawn blade is the held state of a weapon, like anything else in a hand: "weapons would use
 * held state too, it's not bespoke". Drawing takes a free hand, and a player holding two things
 * is told what they are holding, so the question of which to put down is theirs. See
 * `what-somebody-fights-with.ts`.
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
import { hadAs, isHeld, isWorn, WHAT_TWO_HANDS_HOLD, type ObjectRecord } from '../engine/world/possessions.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { isAWeapon, theBladeInTheirHand } from '../engine/world/what-somebody-fights-with.js';
import { together, whatTheirThingsTake } from '../engine/world/what-somebody-is-carrying-takes.js';
import { changeInto, isAGarment, whatTheyHaveOn } from '../engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, observable, type EngineFacts } from './facts.js';
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

/** The blade in this cultivator's hand, or null. The one read of a drawn weapon. */
export function whatIsInTheirHand(
    objects: readonly ObjectRecord[],
    cultivatorId: string
): { what: string } | null {
    const blade = theBladeInTheirHand(objects, cultivatorId);
    return blade === null ? null : { what: blade.name };
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

/** Words for a weapon that do not name one in particular: "my blade" means the best one. */
const ANY_WEAPON = /\b(?:blade|sword|sabre|saber|dagger|spear|weapon|steel)s?\b/i;

/** The thing of theirs a sentence names, among `rows`, or the first when it names nothing in particular. */
function theOneNamed(rows: readonly ObjectRecord[], named: string | undefined): ObjectRecord | null {
    if (rows.length === 0) return null;
    const said = (named ?? '').toLowerCase().replace(/^(?:my|the|a|an|his|her|their)\s+/, '').trim();
    if (said.length === 0 || ANY_WEAPON.test(said)) return rows[0]!;
    const words = said.split(/\s+/).filter(word => word.length > 2);
    return rows.find(row => words.some(word => row.name.toLowerCase().includes(word))) ?? null;
}

/** Nothing to do, and said as what is true of their hands. */
function refusedInHand(intent: 'draw' | 'put_away' | 'drop', headline: string, prose: string, structure: string): Execution {
    return refused(
        intent === 'draw' ? 'engine.draw' : intent === 'drop' ? 'engine.drop' : 'engine.putAway',
        'carry',
        factsForRefusal(headline, prose, `carry/${intent}: ${structure} Nothing written and no day passed.`)
    );
}

/**
 * The blade out, away, or onto the ground, and anything else held, put away or put down.
 *
 * None of them spends a day. What a drawn blade costs is paid where it is read: an opening that
 * cannot be a concealed one while it stands.
 */
export function whatTheirHandsDo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    intent: 'draw' | 'put_away' | 'drop',
    named: string | undefined
): Execution {
    const world = game.atHand;
    const objects = world?.objects ?? [];
    const mine = objects.filter(o => o.possessorId === cultivator.id);
    const inHand = mine.filter(o => isHeld(o))
        .sort((a, b) => Number(isAWeapon(b)) - Number(isAWeapon(a)) || (b.power ?? 0) - (a.power ?? 0));

    if (intent === 'draw') {
        const weapons = mine.filter(isAWeapon).sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
        const blade = theOneNamed(weapons, named);
        if (world === null || world === undefined || blade === null) {
            return refusedInHand(intent, `You have no ${named?.replace(/^(?:my|the)\s+/i, '') ?? 'blade'}.`,
                'Nothing you carry is a blade to draw.', 'no weapon with this cultivator as possessor matched.');
        }
        if (isHeld(blade)) {
            return refusedInHand(intent, `${blade.name} is already out.`,
                `You are already standing with ${blade.name} in your hand.`, `${blade.id} is already held.`);
        }
        // A FREE HAND, or the question of what to put down is the player's. The owner: if you try,
        // the narrator plays "which should I drop".
        if (inHand.length >= WHAT_TWO_HANDS_HOLD) {
            const names = inHand.map(o => o.name).join(' and ');
            return refusedInHand(intent, 'Your hands are full.',
                `Your hands are full: ${names}. One of them has to go down before ${blade.name} comes out.`,
                `both hands hold something (${inHand.map(o => o.id).join(', ')}).`);
        }
        const at = world.objects.findIndex(o => o.id === blade.id);
        world.objects[at] = hadAs(blade, 'held');
        game.theWorldMoved();
        const line = `You have ${blade.name} in your hand, and anybody standing here can see it. `
            + 'Nobody is ambushed by somebody who is already holding a blade.';
        return done('engine.draw', saidAndNoted([line],
            `carry/draw: ${blade.id} held on turn ${run.turn}. Read by attack, which cannot open from `
            + 'concealment while it stands, and by the face a house reads.'),
            `${cultivator.id} drew ${blade.name} on turn ${run.turn}.`);
    }

    const thing = theOneNamed(inHand, named);
    if (world === null || world === undefined || thing === null) {
        return refusedInHand(intent, 'Your hands are empty.',
            'You have nothing out to put down. Drawing puts it in your hand, and it stays there '
            + 'until you put it away or let it go.', 'nothing held matched.');
    }
    const at = world.objects.findIndex(o => o.id === thing.id);
    if (intent === 'put_away') {
        // Away is the inventory, and a thing that did not fit there when it was taken still does not.
        const carrying = together(
            whatAllOfThatTakes(everythingInThePouch(game.db, cultivator.id)),
            whatTheirThingsTake(world.objects, cultivator.id)
        );
        if (carrying.volume + thing.volume > whatABodyCanCarry(cultivator.realmOrdinal).volume) {
            return refusedInHand(intent, `${thing.name} will not go in your pack.`,
                `${thing.name} will not go in your pack. It stays in your hand until you let it go.`,
                `${thing.id} does not fit in the inventory.`);
        }
        world.objects[at] = hadAs(thing, 'inventory');
    } else {
        world.objects[at] = {
            ...hadAs(thing, 'inventory'),
            possessorId: null,
            locationId: game.worldPlaceOf(cultivator) ?? thing.locationId
        };
    }
    game.theWorldMoved();
    const line = intent === 'drop'
        ? `${thing.name} is on the ground at your feet, and everybody here watched you let it go.`
        : `${thing.name} is away. ${theBladeInTheirHand(world.objects, cultivator.id) === null ? 'Nothing about you is drawn.' : ''}`.trim();
    return done(
        intent === 'drop' ? 'engine.drop' : 'engine.putAway',
        saidAndNoted([line], `carry/${intent}: ${thing.id} ${intent === 'drop' ? 'put down where they stand' : 'into the inventory'}.`),
        `${cultivator.id} ${intent === 'drop' ? 'dropped' : 'put away'} ${thing.name}.`
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
