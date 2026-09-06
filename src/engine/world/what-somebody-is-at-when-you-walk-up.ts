/**
 * WHAT SOMEBODY IS AT WHEN YOU WALK UP.
 *
 * The design owner: *"they ought to all be doing something. (or doing nothing
 * if that's their thing but that's specific not general.)"*, *"this needs to
 * work for all the NPCs, so the world is not boring"*.
 *
 * Measured before this: every one of the four hundred and forty-two people in a
 * seeded world had `occupation: 'unknown'` and an empty `goals` array. Ten
 * people on the Azure Cloud Pavilion's own ground, from an outer disciple to
 * the Grand Sword Elder, and the world had the same thing to say about all of
 * them, which was nothing.
 *
 * ── STORED, NOT DERIVED, AND THE OWNER SAID WHY ──────────────────────────
 *
 * The first cut derived an activity from the roster. *"Deriving it may not keep
 * it consistent"* - and it does not: a derivation is the same every time you
 * look, so nothing ever changes, and two people in one conversation can be
 * re-derived into disagreeing about whether it is happening. So it is a field,
 * seeded when the world opens and moved by whatever moves it: *"you seed
 * activity and it changes obviously as they do something else."*
 *
 * This file writes the OPENING activity and the LINE for each kind. It does not
 * own the sequence.
 *
 * ── AND THE SEQUENCE EMERGES RATHER THAN BEING SCRIPTED ──────────────────
 *
 * *"All of this should emerge from the design."* The owner's worked chain -
 * *"on one turn (or maybe many) the outer sect disciple is being taught by an
 * elder [...] once that's done, he goes out and takes a task and is recruiting
 * a group to go out [...] he finishes recruiting and is mid expedition with his
 * party [...] he went into a ruin and he found something he can't use and wants
 * to sell"* - is five activities in a row, and every one of them is a system
 * this repo already has:
 *
 *   being taught       `whoWouldTeach`, and the house's own curriculum
 *   taking a task      `duties.ts`, which already prices and posts them
 *   recruiting         `why-a-house-puts-a-party-on-the-road.ts` is the reason
 *   the expedition     `who-goes-out-for-a-house-and-what-comes-back.ts`
 *   selling the find   `readWhatIsOnOfferHere`, which already makes a seller
 *
 * So nothing here schedules a life. The activity is the VISIBLE FACE of those
 * systems, and the sequence falls out of them the way the owner asked: each of
 * them sets it as a side effect of doing what it already does. What this file
 * guarantees is only that nobody is ever at nothing by default.
 *
 * ── IT NEED NOT AGREE WITH EVERYTHING ────────────────────────────────────
 *
 * *"It's okay if activity disagrees too."* Two people in a square are at two
 * things and are not a single coherent report. What must agree is the inside of
 * one activity: everybody in a conversation names everybody else, which is why
 * `withIds` exists and why this is a record rather than a string.
 */

import { forStream } from '../cultivation/rng.js';
import type { ActivityKind, NpcActivity, NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/**
 * The ground, as far as what there is to do on it is concerned.
 *
 * Location kinds the world actually uses, collapsed to the ones that change
 * what somebody would be at. Anything else is open country, which is most of
 * the map and is the honest answer for it.
 */
export type GroundUnderThem =
    | 'a_house_compound'
    /**
     * A room somebody shut themselves in to work.
     *
     * Its own ground and not part of the compound, because what a chamber is
     * FOR is the opposite of what the rest of a compound is for: nobody is in
     * one to run an errand or be corrected. Somebody in a cultivation room is
     * at the one thing the room exists for, and `seclusion-verbs.ts` is the
     * whole machine for it on the player's side.
     */
    | 'a_cultivation_room'
    | 'somewhere_goods_move'
    | 'ground_worth_working'
    | 'a_road'
    | 'open_country';

export function groundUnderThem(kind: string | null | undefined): GroundUnderThem {
    switch (kind) {
        case 'chamber':
            return 'a_cultivation_room';
        case 'sect_seat':
        case 'precinct':
        case 'hall':
        case 'vault':
            return 'a_house_compound';
        case 'settlement':
            return 'somewhere_goods_move';
        case 'vein':
        case 'secret_realm':
            return 'ground_worth_working';
        case 'region':
            return 'a_road';
        default:
            return 'open_country';
    }
}

/**
 * How many people a cultivation room holds, and what a second one costs.
 *
 * The design owner: *"those are limited to 1 person using it at a time don't
 * forget"*, then *"i mean you might fit 2, for dual cultivation, but having
 * someone in there drops the qi by 50%."*
 *
 * A plain capacity, the way a car has five seats, and hardcoded as one. Two is
 * the wall; usually it is one, because sharing halves what each of them draws.
 *
 * WHICH MAKES THE SECOND SEAT A THING WITH A PRICE. The owner: *"it also
 * doesn't mean you HAVE to be dual cultivating [...] maybe you sell your half
 * of your room for cash."* A pair working an art that needs two is one reason
 * to double up - `dual_cultivation` and `requiresPeople: 2` already say which
 * arts those are - and the other is that somebody paid you for the space. Both
 * fall out of the halving rather than needing a rule: what you are giving up is
 * exactly half your qi, so what you charge is whatever that is worth to you,
 * and the engine already knows how to trade.
 *
 * It is also one honest answer to a square holding a single person: most
 * chambers hold exactly one because that is what one is worth.
 */
export const A_ROOM_HOLDS = 2;

/**
 * What each of them draws when a room is shared. Halved, and it is not a
 * penalty for crowding - it is one room's worth of qi divided by the people in
 * it, which is why the figure is exactly a half and not a tuned number.
 */
export const A_SHARED_ROOM_GIVES = 0.5;

/** What somebody in this room actually draws, as a multiplier. */
export function whatASharedRoomGives(occupants: number): number {
    return Math.max(1, Math.round(occupants)) > 1 ? A_SHARED_ROOM_GIVES : 1;
}

/** Where on a house's ladder somebody stands, as three bands. */
export type WhereOnTheLadder = 'the_bottom' | 'the_middle' | 'the_top';

export function whereOnTheLadder(rankIndex: number, rungs: number): WhereOnTheLadder {
    if (rungs <= 1) return 'the_middle';
    const share = Math.max(0, Math.min(rungs - 1, rankIndex)) / (rungs - 1);
    if (share >= 0.66) return 'the_top';
    return share <= 0.2 ? 'the_bottom' : 'the_middle';
}

/**
 * The clause a square prints, in the third person with no name in it.
 *
 * One line per kind and nothing branching anywhere else, which is what makes
 * the kind set worth being closed: a fifteenth activity is a row in the type
 * and a line here.
 */
export function whatThatLooksLike(activity: NpcActivity, withNames: readonly string[]): string {
    const them = withNames.length === 0
        ? 'somebody'
        : withNames.length === 1
            ? withNames[0]!
            : `${withNames.slice(0, -1).join(', ')} and ${withNames[withNames.length - 1]!}`;

    switch (activity.kind) {
        case 'their_own_business':
            return `about something of their own: ${activity.note}`;
        case 'mending':
            return `sitting over what is torn: ${activity.note}`;
        case 'the_work_of_their_rank':
            return activity.note;
        case 'teaching':
            return withNames.length === 0
                ? activity.note
                : `correcting ${them}, and not gently`;
        case 'talking':
            return withNames.length === 0
                ? activity.note
                : `mid-conversation with ${them}`;
        case 'at_the_shelves':
            return `at the shelves, going along them: ${activity.note}`;
        case 'mustering':
            return withNames.length === 0
                ? `putting a party together: ${activity.note}`
                : `putting a party together, and ${them} have said yes`;
        case 'trade':
            return activity.note;
        case 'drawing_on_the_ground':
            return `sitting on the best of the ground and drawing on it`;
        case 'out_with_a_party':
            return withNames.length === 0
                ? `out on something: ${activity.note}`
                : `out on something with ${them}`;
        case 'travelling':
            return 'going somewhere, and not stopping for long';
        case 'comprehending':
            return `sitting with a dao rather than an art: ${activity.note}`;
        case 'their_practice':
            return activity.note;
        case 'at_a_table':
            return withNames.length === 0
                ? activity.note
                : `${activity.note}, with ${them}`;
        case 'fighting_a_beast':
            return activity.note;
        case 'idle':
            // Specific and never a default. See `ActivityKind`.
            return activity.note;
    }
}

/**
 * The activity somebody opens the world at.
 *
 * Deterministic off their own id, so a world reseeded from one seed opens the
 * same way, and so two people standing in the same place are not all at the
 * same thing.
 */
export function whatTheyOpenAt(input: {
    npc: NpcRecord;
    groundKind: string | null;
    rungsInTheirHouse: number;
    onDay: number;
    /** 0..1, drawn by the caller off the world seed and this person's id. */
    roll: number;
    /**
     * A SECOND independent draw, for which words rather than which activity.
     *
     * Measured: with one roll doing both jobs, two people at the same counter
     * printed the same clause, because the same number that put them both at
     * trade also picked them both the same line out of it. Variety in the words
     * has to be uncorrelated with the choice of what they are at.
     */
    words: number;
}): NpcActivity {
    const { npc } = input;
    const bare = (kind: ActivityKind, note: string): NpcActivity =>
        ({ kind, note, withIds: [], sinceDay: input.onDay });

    // A TORN BODY FIRST. Everything costs more until the channels close, so it
    // is what somebody is at whatever else was true of them.
    if (npc.cultivation.untreatedInjuries > 0) {
        return bare('mending', npc.cultivation.untreatedInjuries > 1
            ? 'more than one of them, and none closing on its own'
            : 'one that has not closed');
    }

    const ground = groundUnderThem(input.groundKind);

    // ── A ROOM SOMEBODY SHUT THEMSELVES IN ───────────────────────────────
    //
    // One person at a time, which is what a cultivation room IS: the door is
    // the point, and two people in one is not a busier room, it is a room
    // nobody could have been using. `ONE_AT_A_TIME` is the placement rule and
    // this is what the one person in it is doing.
    if (ground === 'a_cultivation_room') {
        return input.roll < 0.75
            ? bare('their_practice', pick(input.words, [
                'behind a closed door, and not to be interrupted',
                'behind a door that has been shut for longer than anybody expected',
                'in the room and past the hour they booked it for'
            ]))
            : bare('comprehending', pick(input.words, [
                'behind a closed door, at something slower than an art',
                'sitting in the dark with the lamp out on purpose'
            ]));
    }

    if (ground === 'a_house_compound' && npc.factionId !== null) {
        const band = whereOnTheLadder(npc.factionRankIndex, input.rungsInTheirHouse);
        if (band === 'the_top') {
            return bare('teaching', pick(input.words, [
                'holding an audience nobody enjoys',
                'watching somebody run a form and saying nothing, which is worse',
                'taking a book off somebody and not giving it back yet'
            ]));
        }
        // The bottom of a house does its work; the middle divides between the
        // shelves and the work, because that is what a house is for.
        if (band === 'the_bottom') {
    
        }
        if (input.roll < 0.3) {
            return bare('at_the_shelves', pick(input.words, [
                'after a form they have been told they are ready for',
                'putting a volume back in the wrong place on purpose',
                'copying something out because the copy is cheaper than the book'
            ]));
        }
        if (input.roll < 0.5) {
            return bare('mustering', pick(input.words, [
                'a posting nobody senior wanted',
                'a beast contract that needs four and has two',
                'an errand into ground that closed last season'
            ]));
        }
        if (input.roll < 0.62) {
            return bare('at_a_table', pick(input.words, [
                'eating, and not hurrying about it',
                'drinking, and further into it than the hour justifies'
            ]));
        }
        return bare('the_work_of_their_rank',
            'at something the house has asked for, carrying it rather than deciding it');
    }

    if (ground === 'somewhere_goods_move') {
        // ── AND NOT ALL AT THE SAME COUNTER ──────────────────────────────
        //
        // The first cut gave everybody at a market one of two lines, so a
        // square with three people in it printed the same clause twice in a
        // row. A market is the busiest ground in the world and the one place
        // the sameness shows worst, so the note is drawn rather than picked off
        // a boolean. Everything here is trade; what varies is which end of it.
        return bare('trade', npc.spiritStones > 0
            ? pick(input.roll, [
                'in the middle of a transaction, holding the money end of it',
                'arguing a price down, and enjoying it more than the saving',
                'buying something small and asking too many questions about it',
                'waiting on somebody who said they would be here'
            ])
            : pick(input.roll, [
                'looking at what is on a counter and not buying',
                'trying to sell something nobody at this counter wants',
                'counting what is left and doing it twice',
                'watching a stall rather than approaching it'
            ]));
    }

    if (ground === 'ground_worth_working') {
        if (input.roll < 0.62) return bare('drawing_on_the_ground', '');
        if (input.roll < 0.82) {
            return bare('comprehending', 'on ground that is worth sitting on for it');
        }
        // GOOD GROUND HAS THINGS ON IT. The owner: *"or fighting a spirit beast
        // (and winning or losing)"* - and the beasts are drawn to exactly the
        // ground worth working, which is why anybody has to fight for it.
        return bare('fighting_a_beast', pick(input.words, [
            'in the middle of a fight with something that came out of the rocks, and winning it',
            'losing a fight with something that was here before they were',
            'backing away from something they have decided not to fight after all'
        ]));
    }

    if (ground === 'a_road') {
        return input.roll < 0.85
            ? bare('travelling', '')
            : bare('fighting_a_beast', 'in a fight on open road with something that hunts it');
    }

    // ── AND THE ROAD EVERYBODY IS ON ─────────────────────────────────────
    //
    // Not a shrug: a cultivator with nothing else to do is cultivating, which is
    // the one thing everybody in this world is at when they are at nothing else.
    // What they hold decides whether it is worth anything.
    const art = npc.cultivation.techniqueIds[0] ?? null;
    if (art === null) {
        return bare('their_practice', 'sitting, breathing, and getting nothing out of it');
    }
    if (input.roll < 0.7) {
        return bare('their_practice', pick(input.words, [
            'at their practice, and not looking up for it',
            'running the same form over and over and getting angrier about it',
            'sitting badly, and knowing it'
        ]));
    }
    if (input.roll < 0.85) return bare('comprehending', 'further off the road than the road goes');
    return bare('at_a_table', 'eating something they cooked badly over a fire they built well');
}

/**
 * Give everybody in the world something to be at.
 *
 * Called last in the seeder, because it reads where people ended up standing
 * and what they ended up holding. Deterministic off the world seed and each
 * person's own id, so a world reseeded opens the same way, and two people on
 * one square are not at the same thing for want of a different draw.
 *
 * ── AND SOME OF THEM ARE AT IT WITH EACH OTHER ───────────────────────────
 *
 * The owner: *"like a sect brother might be talking to a sect sister."* Two
 * people of one house on one square, neither of them behind a door and neither
 * of them senior enough to be holding an audience, are talking - to each other,
 * named on both records, so the scene reads the same whichever of them the
 * player walked up to.
 *
 * Pairs are made ONCE per square and never overlap, because a person is at one
 * thing at a time. Everybody the pairing does not reach keeps the activity they
 * opened with, which is why nobody ends at nothing.
 */
export function setWhatEverybodyIsAt(state: WorldState, onDay: number): void {
    const kindOf = new Map(state.locations.map(l => [l.id, l.kind as string]));
    const rungsOf = new Map(state.factions.map(f => [f.id, f.ranks.length]));

    // ── WHAT EACH OF THEM OPENS AT ───────────────────────────────────────
    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at]!;
        if (npc.status !== 'alive') continue;
        state.npcs[at] = {
            ...npc,
            activity: whatTheyOpenAt({
                npc,
                groundKind: npc.locationId === null ? null : kindOf.get(npc.locationId) ?? null,
                rungsInTheirHouse: npc.factionId === null ? 0 : rungsOf.get(npc.factionId) ?? 0,
                onDay,
                roll: forStream(state.seed, 'what-they-are-at', npc.id).next(),
                words: forStream(state.seed, 'in-what-words', npc.id).next()
            })
        };
    }

    // ── AND WHO IS AT IT WITH SOMEBODY ───────────────────────────────────
    const bySquare = new Map<string, number[]>();
    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at]!;
        if (npc.status !== 'alive' || npc.locationId === null) continue;
        const ground = groundUnderThem(kindOf.get(npc.locationId));
        // Never in a room built for one, and never on the road: a conversation
        // needs somewhere to stand and somebody who is not behind a door.
        if (ground === 'a_cultivation_room' || ground === 'a_road') continue;
        const rows = bySquare.get(npc.locationId) ?? [];
        rows.push(at);
        bySquare.set(npc.locationId, rows);
    }

    for (const [locationId, rows] of bySquare) {
        const rng = forStream(state.seed, 'who-is-talking', locationId);
        // Of one house, so a conversation has something behind it, and in the
        // order the roster gives so the pairing is stable.
        const byHouse = new Map<string, number[]>();
        for (const at of rows) {
            const house = state.npcs[at]!.factionId;
            if (house === null) continue;
            const held = byHouse.get(house) ?? [];
            held.push(at);
            byHouse.set(house, held);
        }
        for (const [, together] of byHouse) {
            for (let i = 0; i + 1 < together.length; i += 2) {
                // Not everybody, and not nobody. Two thirds of the pairs a
                // square offers actually happen, so a compound reads as people
                // rather than as a phone bank.
                if (rng.next() > 0.66) continue;
                const a = state.npcs[together[i]!]!;
                const b = state.npcs[together[i + 1]!]!;
                // Whoever is already at something that takes them elsewhere
                // stays at it. An errand does not stop for a chat.
                if (a.activity?.kind === 'mustering' || b.activity?.kind === 'mustering') continue;
                if (a.activity?.kind === 'teaching' || b.activity?.kind === 'teaching') continue;
                const note = 'about something neither of them will repeat afterwards';
                state.npcs[together[i]!] = {
                    ...a,
                    activity: { kind: 'talking', note, withIds: [b.id], sinceDay: onDay }
                };
                state.npcs[together[i + 1]!] = {
                    ...b,
                    activity: { kind: 'talking', note, withIds: [a.id], sinceDay: onDay }
                };
            }
        }
    }
}

/**
 * One of several, off a roll already drawn for this person.
 *
 * Variety without a second draw and without a table: the roll is deterministic
 * off the world seed and their own id, so the same person is always at the same
 * thing and two people on one square are not.
 */
function pick(roll: number, lines: readonly string[]): string {
    const at = Math.min(lines.length - 1, Math.floor(Math.max(0, roll) * lines.length));
    return lines[at]!;
}
