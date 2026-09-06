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
import { whatSomebodyIsLike } from './what-somebody-is-like-and-where-it-came-from.js';
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
            // The note is the specific of it where there is one. Two of these
            // cases used to return a fixed string and drop whatever had been
            // written into `note`, so a caller that set one got it silently
            // thrown away - which is worse than not accepting one.
            return activity.note.length > 0
                ? activity.note
                : 'sitting on the best of the ground and drawing on it';
        case 'out_with_a_party':
            return withNames.length === 0
                ? `out on something: ${activity.note}`
                : `out on something with ${them}`;
        case 'travelling':
            return activity.note.length > 0
                ? activity.note
                : 'going somewhere, and not stopping for long';
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
        case 'squeezing':
            return withNames.length === 0
                ? activity.note
                : `${activity.note}, and ${them} ${withNames.length === 1 ? 'is' : 'are'} the other half of it`;
    }
}

/**
 * WHETHER THIS IS SOMEBODY WHO WOULD LOOK UP.
 *
 * The design owner, on arriving somewhere: *"you typically encounter 1 person
 * (or his party if he's in one, so more than one) and that's your person you
 * talk to."*
 *
 * Which one is not a draw. A square hands you whoever is FACING OUT of it -
 * somebody at a counter, somebody putting a party together, somebody holding
 * an audience. The rest of it is people who are turned away from the door: a
 * cultivator behind a shut one, somebody sitting with a dao, somebody in the
 * middle of a fight with a beast. They are all still there, and asking who
 * else is here still finds them, but they are not who the ground gives you.
 *
 * The genre's own rule and not a convenience: the person who meets you at a
 * sect gate is the person whose business it is to be met.
 */
export function whetherTheyWouldLookUp(kind: ActivityKind): boolean {
    switch (kind) {
        case 'trade':
        case 'mustering':
        case 'teaching':
        case 'talking':
        case 'at_a_table':
        case 'squeezing':
        case 'the_work_of_their_rank':
        case 'travelling':
        case 'idle':
            return true;
        case 'their_practice':
        case 'comprehending':
        case 'mending':
        case 'at_the_shelves':
        case 'drawing_on_the_ground':
        case 'fighting_a_beast':
        case 'out_with_a_party':
        case 'their_own_business':
            return false;
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

    // WHO THEY ARE, which is not drawn here and not stored anywhere: it falls
    // out of what the world already rolled for them. See
    // `what-somebody-is-like-and-where-it-came-from.ts` for why that is the
    // opposite call from the one this file makes about activity.
    const like = whatSomebodyIsLike(npc);

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
                'taking a book off somebody and not giving it back yet',
                'hearing a petition about a resource allocation and having already decided',
                'looking over a batch of new intake and picking one out',
                'refusing somebody a thing the house could easily spare'
            ]));
        }
        // ── AND THE BOTTOM OF A HOUSE DOES THE HOUSE'S WORK ──────────────
        //
        // Measured: this branch was EMPTY, so the bottom of every ladder fell
        // through to the middle's draw and an outer disciple was as likely to
        // be mustering a party as an inner one. Which is backwards, and the
        // genre is specific about why: somebody has to grow the herbs, feed the
        // beasts, keep the array lit and stand the gate, and the people who do
        // it are the people who have not yet earned anything better. That is
        // not colour. It is the reason the pyramid is a pyramid - the bottom is
        // wide because the work at the bottom is what holds the rest of it up.
        //
        // Every one of these is a system this file's world already runs: the
        // herb rows, the beasts, the ward standing over the compound, the
        // gate. What an outer disciple is at is the maintenance of them.
        if (band === 'the_bottom') {
            if (input.roll < 0.16) {
                return bare('at_the_shelves',
                    'in the one part of the archive their token opens, which is not much of it');
            }
            if (input.roll < 0.24) {
                return bare('at_a_table', 'eating with the rest of their intake, fast, because the hour is short');
            }
            return bare('the_work_of_their_rank', pick(input.words, [
                'in the herb rows, thinning something worth more than they are paid in a year',
                'mucking out a beast pen, and not paid enough to be bitten for it',
                'walking the anchor stones of the house array with a list and a brush',
                'carrying something heavy from one end of the compound to the other',
                'sweeping a yard that was swept this morning',
                'on a gate nothing has ever come through, and watching it anyway',
                'counting a delivery in and finding it short, and deciding whether to say so',
                // WHICH END OF IT THEY ARE ON, and it is not the roll that
                // decides. Somebody who goes at things head on is the one
                // holding the practice sword; somebody who goes around is the
                // one being knocked down with it. Same yard, same hour, and the
                // difference between the two of them is a thing about them.
                like.push >= 0 ? 'holding the sword in what an inner disciple is calling sparring practice'
                    : 'being knocked down repeatedly by an inner disciple who calls it practice'
            ]));
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
        // AND WHAT AN INNER DISCIPLE DOES, which is a different job: they are
        // off the chores and onto the things that get an elder's attention,
        // which is what they are actually competing for.
        return bare('the_work_of_their_rank', pick(input.words, [
            'taking an outer disciple through a form, slowly, and enjoying being asked',
            'at a furnace, on the third attempt, with two failures cooling beside it',
            'writing up a mission nobody has agreed to pay for yet',
            'on the wall, on a watch that is a formality until it is not',
            'at something the house has asked for, carrying it rather than deciding it',
            'settling an argument between two people junior to them, badly'
        ]));
    }

    if (ground === 'somewhere_goods_move') {
        // ── A TOWN IS NOT ONLY A COUNTER ─────────────────────────────────
        //
        // Measured: every settlement in a seeded world handed a visitor
        // somebody at a stall, because this branch produced `trade` and
        // nothing else - so twelve towns read as twelve versions of the same
        // market, which is the boredom this whole file exists against. A
        // settlement has an inn in it, and people passing through it, and
        // people who live there and are not buying anything today.
        if (input.roll < 0.14) {
            return bare('at_a_table', pick(input.words, [
                'in an inn, eating, and taking their time about it',
                'drinking at the hour people drink who have nowhere to be',
                'at a table with a bowl going cold in front of them',
                'eating standing up, because the seat costs extra'
            ]));
        }
        if (input.roll < 0.22) {
            return bare('travelling', pick(input.words, [
                'passing through, and asking the road rather than the town',
                'settling with a carter and moving on the same hour',
                'waiting on a road that opens at dawn'
            ]));
        }
        if (input.roll < 0.30) {
            return bare('the_work_of_their_rank', pick(input.words, [
                'minding a stall that belongs to somebody else',
                'carrying somebody else’s goods for somebody else’s money',
                'sweeping a doorway on a street that will be dusty again by noon',
                'unloading a cart and counting it as it comes off'
            ]));
        }

        // ── AND NOT ALL AT THE SAME COUNTER ──────────────────────────────
        //
        // The first cut gave everybody at a market one of two lines, so a
        // square with three people in it printed the same clause twice in a
        // row. A market is the busiest ground in the world and the one place
        // the sameness shows worst, so the note is drawn rather than picked off
        // a boolean. What varies is which end of the trade they are.
        //
        // AND WHETHER THEY ARE LOUD ABOUT IT. A market is the one ground where
        // how much somebody plays to a room is visible from across it: the same
        // empty purse is a person haggling at volume or a person standing at
        // the edge of the square not approaching anything.
        //
        // DRAWN ON `words` AND NOT ON `roll`, which is the whole reason there
        // are two draws. `roll` chose the branch above; reusing it here ties
        // which line somebody gets to how far into the market band they fell,
        // and the people a square hands a visitor - who are picked for one end
        // of a disposition - then all say the same thing.
        return bare('trade', npc.spiritStones > 0
            ? pick(input.words, like.room >= 0 ? [
                'in the middle of a transaction and making sure it is heard',
                'arguing a price down, and enjoying it more than the saving',
                'buying something small and asking too many questions about it',
                'holding court over a stall they have no intention of buying from',
                'reading a price out loud for the benefit of the queue',
                'sending somebody back to a stall to ask again',
                'being talked into something and letting everybody watch it happen'
            ] : [
                'in the middle of a transaction, holding the money end of it',
                'paying what was asked to get it over with',
                'buying something small and not looking up while they do it',
                'waiting on somebody who said they would be here',
                'taking delivery of something already paid for',
                'checking a seal on a jar against a mark on a slip of paper',
                'walking the row twice before they buy anything at all'
            ])
            : pick(input.words, like.room >= 0 ? [
                'talking up something nobody at this counter wants',
                'telling a stallholder what the thing is really worth',
                'counting what is left and doing it twice',
                'making an offer they cannot cover and enjoying the moment before it lands',
                'working a small crowd that has not agreed to be one',
                'asking after a buyer by name, loudly, twice',
                'describing something they are selling better than it is'
            ] : [
                'looking at what is on a counter and not buying',
                'trying to sell something nobody at this counter wants',
                'counting what is left and doing it twice, quietly',
                'watching a stall rather than approaching it',
                'pricing a thing they have no intention of buying today',
                'standing where the stalls end, not going further in',
                'putting something back down and moving along the row'
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

                // ── AND SOME OF THESE ARE NOT CONVERSATIONS ──────────────
                //
                // The bottom of a house is its own society and it has its own
                // order in it, kept by people whose whole seniority is a few
                // months. Two people of one house standing together, one of
                // whom goes at things head on and one of whom goes around, and
                // the senior of the two being the one who pushes, is not a
                // chat. It is a junior being relieved of something.
                //
                // NOTHING HERE PICKS A BULLY. Both ends fall out of numbers
                // that were already true of these two people before they were
                // put on the same square - which is the whole claim of
                // `what-somebody-is-like-and-where-it-came-from.ts`, and the
                // reason this reads as two particular people rather than as a
                // scene type the world drops in at a rate.
                const senior = a.factionRankIndex >= b.factionRankIndex;
                const overAt = senior ? together[i]! : together[i + 1]!;
                const underAt = senior ? together[i + 1]! : together[i]!;
                const overIt = state.npcs[overAt]!;
                const under = state.npcs[underAt]!;
                const leans = whatSomebodyIsLike(overIt).push;
                const gives = whatSomebodyIsLike(under).push;
                if (leans > 0 && leans - gives >= WHAT_IT_TAKES_TO_LEAN_ON_SOMEBODY) {
                    state.npcs[overAt] = {
                        ...overIt,
                        activity: {
                            kind: 'squeezing',
                            note: 'explaining to somebody junior what the arrangement is here',
                            withIds: [under.id],
                            sinceDay: onDay
                        }
                    };
                    state.npcs[underAt] = {
                        ...under,
                        activity: {
                            kind: 'squeezing',
                            note: 'being told what the arrangement is here by somebody senior',
                            withIds: [overIt.id],
                            sinceDay: onDay
                        }
                    };
                    continue;
                }

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
 * How much further one of two people has to lean before it stops being a
 * conversation.
 *
 * Wide, deliberately. Most pairs of people are two people talking, and a world
 * where a third of every compound is being shaken down is as untrue as one
 * where nobody ever is.
 */
const WHAT_IT_TAKES_TO_LEAN_ON_SOMEBODY = 0.55;

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
