/**
 * WHAT A HOUSE KEEPS IN ITS TREASURY.
 *
 * `a-house-holds-its-own.ts` gave every house a balance and an empty list of
 * things. So a treasury was a number, and everything a treasury is FOR -
 * lending a disciple a furnace, bestowing a sword, being robbed of something
 * that matters - had nothing to operate on.
 *
 * IT IS ALL ONE NOUN. A first cut kept pills and manuals out on the grounds
 * that both have their own systems; that was rejected, and rightly, because
 * those systems answer a different question. `readWhatIsOnOfferHere` says what
 * a counter will sell and the shelves say what a hall will teach; neither says
 * what a house OWNS. A house's medicine is not for sale and not on a shelf, and
 * it is what a war chest is.
 *
 * So every kind goes in on one line and the line is grade:
 * `howMuchAGradeIsWorthTracking` decides counted or tracked for a pill exactly
 * as for a furnace. Nothing below knows what a pill is.
 *
 * STRENGTH DECIDES THE REST, off `sectThreat(id).acting` - the same number
 * `seedHouseWards` rates a compound's ward on. A treasury and a wall are two
 * readings of one standing, so a repriced house moves in both rather than
 * drifting into a rich house behind a thin wall.
 *
 * AND THE ROOM FALLS OUT OF THE ROW. Tracked things are in the treasury,
 * whatever they are, because the treasury is the room with one of each thing in
 * it; counted things are wherever that kind is used. That is the honest reason
 * a house's best sword and its four hundred spears are not in the same place -
 * one is a thing you sign for and the others are a rack by the door.
 *
 * A DEFAULT AND NOT A LAW: where a thing sits when nothing has happened to it.
 * Anything lent, taken down or carried is somewhere else, and `possessorId`
 * already says so.
 *
 * AND ONE LEDGER. Measured: a version that wrote the room onto `tags` at
 * seeding came back a third filed and the rest UNFILED, because the ward over a
 * compound and the manuals other systems placed were house property this
 * seeder never touched. The room is derived from `kind` and `significance`, so
 * it answers for rows this file never wrote.
 *
 * AND WHERE A THING IS IS NOT WHOSE IT IS. Three fields, three independent
 * facts: `ownerId` whose it is, `possessorId` who is carrying it, `locationId`
 * where it is when nobody is. A sword left in a furnace room is still yours.
 */

import { getFactionCharacter } from '../../data/cultivation/faction-character.js';
import { getPillsByGrade } from '../../data/cultivation/pills.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { SECTS, sectThreat } from '../../data/cultivation/sects.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    howMuchACauldronIsWorthTracking,
    whatACauldronIsWorthInAFight
} from '../cultivation/what-you-refine-in.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import {
    howMuchAGradeIsWorthTracking,
    keptAs,
    makeObject,
    makeResourceLot,
    type ObjectKind,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';
import { purposeOf, type RoomPurpose } from './architecture.js';
import {
    couldCutAWayOut,
    cutATalisman,
    type WhatIsInTheSlip
} from './a-talisman-is-one-act-somebody-already-paid-for.js';
import {
    WHERE_THE_PLATES_HANG,
    carriesATokenAt,
    issueTo,
    thisHouseCanIssue
} from './a-house-knows-its-own-by-a-plate-and-a-token.js';
import type { WorldState } from './world-state.js';

/**
 * The standing at which a house can keep the next grade of furnace.
 *
 * Not a budget. A house cannot keep what nobody in it can work: an earth-grade
 * cauldron in a hill sect with nobody past Qi Condensation is an ornament, and
 * a treasury full of ornaments is the diorama this file exists against. The
 * gate is therefore the SAME rung `who-can-refine-a-grade-of-medicine.ts` sets
 * for working the grade at all, read against what the house can actually field.
 */
export function bestFurnaceAHouseCouldKeep(acting: number): TechniqueGrade {
    if (acting >= refiningOrdinalFor('heaven')) return 'heaven';
    if (acting >= refiningOrdinalFor('earth')) return 'earth';
    return 'mortal';
}

/**
 * How many clay cauldrons a house of this standing has in a cupboard.
 *
 * Counted, and the number is a rough function of how many people it has to
 * equip rather than of how rich it is. A great house does not stop needing the
 * cheap ones - it has more people at the bottom of the ladder, not fewer.
 */
export function howManyPlainCauldrons(acting: number): number {
    return Math.max(4, Math.round(acting * 1.5));
}

/**
 * Fill every house's treasury, and return the rows to file.
 *
 * NOTHING IS DRAWN. What a house keeps is a function of the house - its
 * standing, its founding, and how long since it had a peak - so there is no
 * RNG here at all and no stream name to keep. Two houses of the same standing
 * hold the same shape of treasury, which is correct: what makes one different
 * from another is what has HAPPENED to it since, and that is the world sim's
 * job rather than a draw at seeding.
 *
 * Called from the seeder alongside `seedHouseWards`, and idempotent by id: a
 * house's furnace is `furnace-<id>` and running twice replaces rather than
 * duplicates.
 */
export function seedTreasuries(state: WorldState): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const today = Math.floor(state.currentDay);

    // THE ROOMS ARE REAL PLACES, so a thing goes in one rather than being
    // filed against the compound as a whole. A seeded world has seven hundred
    // of them under the compounds, laid out by `architecture.ts`, and putting a
    // house's clay cauldrons in its furnace room is what gives anybody a reason
    // to walk to a furnace room.
    const roomsOf = new Map<string, Map<RoomPurpose, string>>();
    for (const location of state.locations) {
        const purpose = purposeOf(location);
        if (purpose === null) continue;
        const seat = seatAbove(state, location);
        if (seat === null) continue;
        const held = roomsOf.get(seat) ?? new Map<RoomPurpose, string>();
        if (!held.has(purpose)) held.set(purpose, location.id);
        roomsOf.set(seat, held);
    }

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const acting = sectThreat(house.id)?.acting ?? 0;
        if (acting <= 0) continue;

        const name = SECTS.find(s => s.id === house.id)?.name ?? house.name;
        const seat = house.seatLocationId;
        const rooms = seat === null ? undefined : roomsOf.get(seat);
        // The room where there is one, and the compound where the house has no
        // room of that purpose - a hill sect with no archive still owns books.
        const roomFor = (purpose: RoomPurpose | null): string | null =>
            (purpose === null ? null : rooms?.get(purpose) ?? null) ?? seat;

        // ── THE COUNTED HALF ─────────────────────────────────────────────
        //
        // One lot with a number on it. Nobody asks whose the third clay pot
        // is, which is exactly what `mundane` means.
        const plain = makeResourceLot({
            id: `cauldrons-plain-${house.id}`,
            resource: 'fired clay cauldrons',
            quantity: howManyPlainCauldrons(acting),
            source: `the ${name} stores`,
            acquiredOnDay: house.foundedOnDay ?? 0,
            holderId: null,
            holderName: name,
            how: 'crafted',
            // The one word that puts it on the counted side of the line.
            significance: 'mundane'
        });
        plain.ownerId = house.id;
        plain.ownerName = name;
        plain.locationId = roomFor(whereInTheHouseItSits('other', 'mundane', ['cauldron']));
        plain.description =
            'The cauldrons a house hands out without writing anything down. They crack, they '
            + 'get replaced, and nobody has ever asked which one they were given.';
        plain.tags = ['cauldron'];
        out.push(plain);

        // ── AND THE TRACKED HALF ─────────────────────────────────────────
        //
        // One row with a history, and only where the house could actually work
        // it. A house that cannot field anybody past the rung has the clay and
        // nothing else, which is the honest shape of a poor sect.
        const grade = bestFurnaceAHouseCouldKeep(acting);
        if (grade !== 'mortal') {
            const sinceThePeak = getFactionCharacter(house.id)?.production.yearsSinceLastPeak ?? 0;
            out.push(makeObject({
                id: `furnace-${house.id}`,
                name: `the ${name} furnace`,
                kind: 'artifact',
                significance: howMuchACauldronIsWorthTracking(grade),
                description:
                    `The furnace the ${name} halls refine in, which is one furnace and not a `
                    + 'cupboard of them. Who is standing at it on a given day is a question the '
                    + 'house answers, and changes its mind about.',
                // NOBODY HOLDS IT UNTIL SOMEBODY IS LENT IT, and a house is
                // not somebody: a thing in a store is carried by NULL and is
                // in a room, which is what `whereThisThingActuallyIs` reports.
                // A person's id in this field is a thing somebody took out.
                possessorId: null,
                ownerId: house.id,
                ownerName: name,
                // A CAULDRON IS A TREASURE AND NOT ONLY A TOOL, and it is a
                // finished artifact, so it stands somewhere on the ladder like
                // every other one. A house's furnace is exactly the object
                // people go to war over and hide behind. See
                // `whatACauldronIsWorthInAFight`.
                power: whatACauldronIsWorthInAFight(grade),
                locationId: roomFor(
                    whereInTheHouseItSits('artifact', howMuchACauldronIsWorthTracking(grade), ['cauldron'])
                ),
                tags: ['cauldron', 'defensive', `grade:${grade}`],
                data: {
                    grade,
                    // How long it has been the house's, which is what makes
                    // losing one worse than the price of another.
                    heldSinceDay: Math.max(
                        house.foundedOnDay ?? 0,
                        today - Math.round(Math.max(0, sinceThePeak) * 365)
                    )
                }
            }));
        }

        // ── AND THE SAME LINE OVER EVERY OTHER NOUN ──────────────────────
        //
        // Nothing below knows what a pill is or what a manual is. Each reaches
        // it as a thing with a GRADE, and one call decides how much of a record
        // it deserves - so a house's healing pills are a stack with a number on
        // it and its heaven-grade dose is a row with a history, for the same
        // reason and by the same call.
        out.push(...whatElseTheHouseKeeps(house.id, name, roomFor, acting, today));

        // ── AND WHO IT KNOWS BY NAME ─────────────────────────────────────
        //
        // A plate on the wall for every disciple and a token in their hand.
        // `docs/world/houses/trust.md` has carried the whole design under its
        // own heading since it was written and NOTHING in the engine ever made
        // one - `'token'` was a value of `ObjectKind` that nothing produced.
        //
        // Issued from the rung a house starts putting its name on somebody,
        // which is the first rung that is a disciple rather than a servant.
        //
        // AND ONLY WHERE THE HOUSE CAN CUT THEM. A plate is a Foundation
        // craft, so a house with nobody at that rung has none at all - no roll
        // it can read, no notice when one of its own dies, and no token its
        // members can prove themselves with. That is a real difference between
        // a house and a gathering of people, and it needed no rule of its own.
        const onTheRoll = state.npcs
            .filter(npc => npc.factionId === house.id && npc.status === 'alive')
            .map(npc => npc.cultivation.realmOrdinal);
        if (!thisHouseCanIssue(onTheRoll)) continue;

        const plateRoom = roomFor(WHERE_THE_PLATES_HANG);
        for (const member of state.npcs) {
            if (member.factionId !== house.id) continue;
            if (member.status !== 'alive') continue;
            if (!carriesATokenAt(member.factionRankIndex)) continue;
            const issued = issueTo({
                memberId: member.id,
                memberName: member.name,
                houseId: house.id,
                houseName: name,
                plateRoomId: plateRoom,
                onDay: today
            });
            out.push(issued.token, issued.plate);
        }
    }

    return out;
}

/**
 * The rest of a treasury: what the house dispenses, and what it teaches out of.
 *
 * ONE LOOP OVER TWO CATALOGS AND NO BRANCH ON WHICH. A pill and a manual both
 * reach here as `{ id, name, grade }`, which is every field the counted/tracked
 * decision needs. A third catalog that wants to be in a treasury joins the list
 * above and changes nothing below it.
 */
function whatElseTheHouseKeeps(
    houseId: string,
    houseName: string,
    roomFor: (purpose: RoomPurpose | null) => string | null,
    acting: number,
    today: number
): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const ceiling = bestFurnaceAHouseCouldKeep(acting);
    const wanted: {
        id: string;
        name: string;
        grade: TechniqueGrade;
        kind: 'pill' | 'manual';
    }[] = [];

    // WHAT IT DISPENSES, up to what it could field somebody to use. A hill sect
    // holding a heaven-grade dose nobody in it could survive taking is the
    // ornament problem again.
    for (const grade of GRADES_A_HOUSE_STOCKS) {
        if (refiningOrdinalFor(grade) > refiningOrdinalFor(ceiling)) continue;
        for (const pill of getPillsByGrade(grade).slice(0, HOW_MANY_KINDS_OF_EACH)) {
            wanted.push({ id: pill.id, name: pill.name, grade, kind: 'pill' });
        }
    }

    // AND WHAT IT TEACHES OUT OF, which the catalog already states. So a house
    // holds copies of exactly the arts it is known for and of nothing it is not.
    for (const artId of SECTS.find(s => s.id === houseId)?.teaches ?? []) {
        const art = getTechnique(artId);
        if (art === undefined) continue;
        wanted.push({ id: art.id, name: art.name, grade: art.grade, kind: 'manual' });
    }

    // AND THE SLIPS, which are what a house actually hands somebody before it
    // sends them anywhere. A talisman is one act already paid for - a strike at
    // the maker's strength, or a way out for somebody who could never fold - so
    // stocking them is the same decision as stocking medicine and is made off
    // the same ceiling. Mortal ones are counted; anything better is one of it.
    for (const grade of GRADES_A_HOUSE_STOCKS) {
        if (refiningOrdinalFor(grade) > refiningOrdinalFor(ceiling)) continue;
        for (const what of WHAT_A_HOUSE_KEEPS_SLIPS_FOR) {
            // AND A HOUSE THAT CANNOT FOLD KEEPS NO DEPARTURE SLIPS. Measured
            // before this guard: seeded escape slips spanned ordinals 14..44,
            // so every house under `FOLD_FLOOR_ORDINAL` was sitting on paper
            // that carries zero distance - a way out that is not one. The
            // predicate that refuses them already existed and nothing called
            // it.
            if (what === 'a_way_out' && !couldCutAWayOut(acting)) continue;
            out.push(aStockOfSlips({
                houseId,
                houseName,
                grade,
                what,
                acting,
                today,
                roomFor
            }));
        }
    }

    for (const thing of wanted) {
        const significance = howMuchAGradeIsWorthTracking(thing.grade);
        const rowId = `treasury-${houseId}-${thing.id}`;
        if (keptAs(significance) === 'counted') {
            // A stack, and repayable in kind - which is the whole of why a
            // borrowed pill can be given back as a different pill.
            const lot = makeResourceLot({
                id: rowId,
                resource: thing.name,
                quantity: howManyOfACommonThing(acting),
                source: `the ${houseName} stores`,
                acquiredOnDay: today,
                holderId: null,
                holderName: houseName,
                how: 'crafted',
                significance
            });
            lot.ownerId = houseId;
            lot.ownerName = houseName;
            lot.locationId = roomFor(whereInTheHouseItSits(thing.kind, significance));
            lot.tags = [thing.kind, `grade:${thing.grade}`];
            out.push(lot);
            continue;
        }
        // One of it, and giving back a different one is not giving it back.
        out.push(makeObject({
            id: rowId,
            name: thing.name,
            kind: thing.kind,
            significance,
            description:
                `Held by ${houseName}, and held rather than stocked: there is one of these and `
                + 'the house knows where it is.',
            possessorId: null,
            ownerId: houseId,
            ownerName: houseName,
            power: null,
            locationId: roomFor(whereInTheHouseItSits(thing.kind, significance)),
            tags: [thing.kind, `grade:${thing.grade}`],
            data: { grade: thing.grade, sourceId: thing.id }
        }));
    }

    return out;
}

/**
 * The two things a house bothers keeping slips for.
 *
 * Both, always, because they answer the two questions a house has about
 * somebody it is sending out: can they hurt what they meet, and can they get
 * home. A house that stocked only one of them would be making a statement.
 */
const WHAT_A_HOUSE_KEEPS_SLIPS_FOR: readonly WhatIsInTheSlip[] = ['a_strike', 'a_way_out'];

/**
 * A house's stock of one kind of slip at one grade.
 *
 * The maker is the house's own best hand, which is what `acting` is - so a hill
 * sect's escape slips carry a hill sect's reach, and a court's carry a court's.
 * Nothing here decides who may cut one; `couldCutATalisman` does, off the same
 * table that decides it for medicine.
 */
function aStockOfSlips(input: {
    houseId: string;
    houseName: string;
    grade: TechniqueGrade;
    what: WhatIsInTheSlip;
    acting: number;
    today: number;
    roomFor: (purpose: RoomPurpose | null) => string | null;
}): ObjectRecord {
    const slip = cutATalisman({
        id: `treasury-${input.houseId}-talisman-${input.what}-${input.grade}`,
        name: `${input.grade}-grade ${input.what === 'a_strike' ? 'strike' : 'departure'} talisman`,
        grade: input.grade,
        what: input.what,
        crafterId: null,
        crafterOrdinal: input.acting,
        onDay: input.today,
        ownerId: input.houseId,
        ownerName: input.houseName
    });
    return {
        ...slip,
        locationId: input.roomFor(whereInTheHouseItSits(slip.kind, slip.significance, slip.tags)),
        data: {
            ...slip.data,
            // A counted stack of slips is repayable in kind; a tracked one is
            // the only one the house has. `keptAs` already draws that line.
            quantity: keptAs(slip.significance) === 'counted'
                ? howManyOfACommonThing(input.acting)
                : 1
        }
    };
}

/**
 * WHICH ROOM OF A HOUSE A THING SITS IN.
 *
 * The design owner: *"these fall out of the 4th layer in terms of places in the
 * map, the rooms."*
 *
 * They do, and a first cut here did not: it declared its own six-value list of
 * rooms, which was a second vocabulary for a thing the map already has. Every
 * one of those rooms already exists as a `RoomPurpose` in `architecture.ts` -
 * `treasury`, `archive`, `alchemy_hall`, `furnace_room`, `workshop` - laid out
 * as real `hall`, `vault` and `chamber` locations under a compound's precincts,
 * with a depth, an obviousness, a capacity and a seal on each. So this returns
 * one of THOSE, and a thing's room is a place on the map somebody can walk to
 * rather than a label.
 *
 * ── AND IT IS DERIVED, WHICH IS WHY IT IS RIGHT ABOUT ROWS IT NEVER WROTE ──
 *
 * *"All of that is tracked under sect ownership - IT DOES HAVE A LEDGER. It's
 * just in different places."*
 *
 * Measured, with a version that wrote the room onto `tags` at seeding: a
 * house's rows came back a third filed and the rest UNFILED, because the ward
 * over its compound and the manuals other systems had already placed were house
 * property this seeder never touched. Two ledgers, and the newer one only knew
 * its own rows.
 *
 * So nothing is written. This is a pure read over `kind` and `significance`,
 * which every object in the world already carries, so it answers for a row this
 * file wrote, a row the ward seeder wrote, and a row nobody has written yet.
 * One ledger - `state.objects` filtered by `ownerId` - and the room is a
 * question you ask it.
 *
 * ── A DEFAULT AND NOT A LAW ──────────────────────────────────────────────
 *
 * *"Good ones in the treasury (for elders to lend, you'd imagine, for example.
 * NON EXHAUSTIVE, NOT STRICT)."*
 *
 * This is where the HOUSE would put a thing, and it is not where the thing is.
 * The owner: *"where an object is needs to be tracked. I should be able to
 * leave my sword in the pill refining room. Or any item, really. And it still
 * belongs to me, it's just there."*
 *
 * Which is three independent facts and the row already has three fields for
 * them: `ownerId` is whose it is, `possessorId` is who is carrying it, and
 * `locationId` is where it is when nobody is. A sword left in a furnace room is
 * an owner who has not changed, a possessor of null, and a location that is a
 * room - and no part of that needs this function's opinion. Ask
 * `whereThisThingActuallyIs` for where a thing IS; ask this only for where a
 * house files one it has never moved.
 */
export function whereInTheHouseItSits(
    kind: ObjectKind,
    significance: ObjectSignificance,
    tags: readonly string[] = []
): RoomPurpose | null {
    // Cut into the ground and never carried, so it is not in a room at all.
    // `formation` means exactly that - see `possessions.ts`.
    if (kind === 'formation' || kind === 'territory') return null;

    // ONE OF IT, AND THE HOUSE KNOWS WHERE IT IS. Whatever it is: the owner's
    // *"some weapons are in the treasury (the best ones)"* and *"the valuable
    // books in the treasury"* are the same sentence about two nouns, which is
    // why this is decided before anything looks at what the thing is.
    if (keptAs(significance) === 'tracked') return 'treasury';

    // Otherwise it lives where that kind of thing is USED. *"The counted ones
    // in the armory"*, *"shitty cauldrons in the furnace area"*, *"shitty books
    // in the library."*
    if (tags.includes('cauldron')) return 'furnace_room';
    switch (kind) {
        case 'pill':
            return 'alchemy_hall';
        case 'manual':
            return 'scripture_pavilion';
        case 'artifact':
        case 'key':
        case 'token':
            return 'workshop';
        default:
            return 'tribute_room';
    }
}

/**
 * The grades a house keeps medicine in at all.
 *
 * Immortal and chaos are not on it, and that is not a budget decision. Nothing
 * below the Lid makes one and no process adds another, so a dose down here is a
 * thing that CAME from somewhere - sent down, or dug out of a sealed site - and
 * the systems that place those own it. Seeding one into every house in the
 * world would make the finite thing routine, which is the one property it has.
 */
const GRADES_A_HOUSE_STOCKS: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven'];

/** How many distinct formulas of a grade a house bothers keeping. */
const HOW_MANY_KINDS_OF_EACH = 3;

/** How deep a stack of an ordinary thing goes, off what the house is. */
function howManyOfACommonThing(acting: number): number {
    return Math.max(5, Math.round(acting * 2));
}

/**
 * What this house holds, read off the one possessions table.
 *
 * A FILTER AND NOT A STORED LIST. `WhatAHouseHolds.holds` is a shape for
 * answering the question, not a field anybody writes: the moment a house's
 * inventory is kept in two places, the copy is what goes stale the first time
 * something is lent out, sold or walked off with. `ownerId` is already the
 * answer and it is already maintained by every path that moves a thing.
 *
 * Owned and not held: a furnace a disciple has been lent is still the house's,
 * and still in this list. Which is the point of `whoseThisIs` reading two
 * fields rather than one.
 */
export function whatThisHouseHolds(
    objects: readonly ObjectRecord[],
    factionId: string
): ObjectRecord[] {
    return objects.filter(row => row.ownerId === factionId);
}

/**
 * Everything a house owns, sorted into the rooms it is in.
 *
 * THE READ THE LEDGER OWES. *"It's just in different places"* - so the answer
 * to *what does this house have* is a list per room, which is the way a
 * quartermaster, a thief and a disciple asking to borrow something all want it.
 *
 * The owner, on why this matters beyond bookkeeping: *"that gives NPCs a reason
 * to go to diff areas."* A compound whose rooms hold nothing is a compound
 * nobody has an errand in.
 *
 * Keyed on `RoomPurpose` and null for the things that stand in the ground.
 * Derived every time and cached nowhere, which is why it is right about rows
 * this file never wrote.
 */
export function whatIsInEachRoom(
    objects: readonly ObjectRecord[],
    factionId: string
): Map<RoomPurpose | null, ObjectRecord[]> {
    const rooms = new Map<RoomPurpose | null, ObjectRecord[]>();
    for (const row of whatThisHouseHolds(objects, factionId)) {
        const room = whereInTheHouseItSits(row.kind, row.significance, row.tags);
        const held = rooms.get(room) ?? [];
        held.push(row);
        rooms.set(room, held);
    }
    return rooms;
}

/**
 * WHERE A THING ACTUALLY IS, which is not the same question as whose it is.
 *
 * The design owner: *"where an object is needs to be tracked. I should be able
 * to leave my sword in the pill refining room. Or any item, really. And it
 * still belongs to me, it's just there."*
 *
 * Three fields, three facts, and none of them implies another:
 *
 *   `ownerId`      whose it is. A sword left in somebody else's furnace room
 *                  is still yours, and this does not move when it does.
 *   `possessorId`  who is carrying it. Null is a real answer and the whole
 *                  point of this one: a thing put down is held by nobody.
 *   `locationId`   where it is when nobody is holding it. A room, and rooms
 *                  are real map locations - 706 of them in a seeded world.
 *
 * WHAT THIS RETURNS IS NEVER A GUESS. Somebody is carrying it, or it is in a
 * named place, or the world genuinely does not know where it is - which is a
 * state things get into and is the one this used to hide by falling back on
 * where the thing would have been filed.
 */
export type WhereAThingIs =
    | { at: 'on_somebody'; personId: string }
    | { at: 'in_a_place'; locationId: string; room: RoomPurpose | null }
    | { at: 'nobody_knows' };

export function whereThisThingActuallyIs(
    object: Pick<ObjectRecord, 'possessorId' | 'locationId'>,
    /** The world's locations, for naming the room a location is. */
    roomOf: (locationId: string) => RoomPurpose | null = () => null
): WhereAThingIs {
    if (object.possessorId !== null) {
        return { at: 'on_somebody', personId: object.possessorId };
    }
    if (object.locationId !== null) {
        return {
            at: 'in_a_place',
            locationId: object.locationId,
            room: roomOf(object.locationId)
        };
    }
    return { at: 'nobody_knows' };
}

/**
 * The compound a room is under, walking up as far as a seat.
 *
 * Rooms hang off precincts and precincts off the seat, so a room is two links
 * down and not one. Bounded rather than recursive-until-null: a cycle in the
 * parent chain would otherwise hang the seeder, and no location is more than a
 * few links from its region.
 */
function seatAbove(state: WorldState, from: { id: string; parentId: string | null }): string | null {
    let at: string | null = from.parentId;
    for (let hops = 0; hops < HOW_FAR_UP_A_ROOM_SITS && at !== null; hops++) {
        const parent = state.locations.find(l => l.id === at);
        if (parent === undefined) return null;
        if (parent.kind === 'sect_seat') return parent.id;
        at = parent.parentId;
    }
    return null;
}

/** Room, precinct, seat. Three links is the whole of a compound. */
const HOW_FAR_UP_A_ROOM_SITS = 3;
