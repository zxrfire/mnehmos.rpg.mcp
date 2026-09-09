/**
 * What is out on loan in this world, and who lent it.
 *
 * Two lenders, and the design owner named the second one: *"and don't forget,
 * PEOPLE lend too. Like you might lend your treasure to a junior brother or
 * sister."* A house lending out of its stores and a senior handing their own
 * blade to a junior are the same act with a different party on one side, and
 * they differ in exactly the way that matters: a thing lent by a house is owed
 * back to an institution, and a thing lent by a person is owed back to
 * somebody who will be standing there.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `what-a-house-keeps-in-its-treasury.ts` was written because a house held
 * stones and no THINGS, and its header names the three cases that had nothing
 * to operate on: *"lending a disciple a furnace, bestowing something on
 * somebody who earned it, and being robbed of anything that mattered"*. The
 * treasuries landed. **Nothing ever lent anything out of them.**
 *
 * Measured on three seeded worlds before this: of 415 people, 28 to 31 carried
 * an object owned by somebody else, and every single one of them was a `token`
 * - the identity plate every member of a house wears, from
 * `a-house-knows-its-own-by-a-plate-and-a-token.ts`. A plate is not a loan. So
 * the honest count of people in this world carrying something a house lent them
 * was **zero**, in every world, always.
 *
 * That matters because of what it costs the setting. The design owner, asking
 * for the register the game was missing: *"a senior brother monologue about how
 * nice his borrowed sword is"*. The promising disciple carrying the house's
 * good blade is one of the stock figures of the genre, and the terms are the
 * whole of why he is interesting: it is his while he is useful, and the house
 * can take it back.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES NOT DO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No new table and no new field. `ownerId` and `possessorId` have been separate
 * columns on the possessions table since it was written, for exactly this, and
 * a loan is the state where they disagree. Nothing here records that a loan
 * "happened" beyond the object saying who has it, because that is what a loan
 * is.
 *
 * And it stays rare on purpose. Two per house at the outside, one per person,
 * only out of what is worth tracking, and only to somebody the lender has a
 * reason to hand it to - so most people carry nothing that is not theirs, and
 * the one who does is worth a sentence.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE CHAIN SAYS IT WAS LENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * MEASURED, and it was a defect in the first cut of this file: writing
 * `possessorId` by object spread moved the thing and said nothing about why,
 * so `whoseThisIs` returned `unaccounted_for` for 199 of 199 carried objects in
 * a seeded world and `lent_by_their_house` - a state
 * `a-house-holds-its-own.ts` documents at length - was unreachable in a fresh
 * world. The engine could not tell a borrowed sword from a stolen one.
 *
 * `whoseThisIs` reads the provenance chain and its own header says why: *"a
 * field would have to be maintained by every code path that ever moves a
 * thing, and the one that forgot would quietly turn a theft into a loan."* This
 * file was the one that forgot. So a loan is applied through
 * `transferPossession` with `how: 'lent'`, and `applyTheLoans` below is the
 * only way to write one.
 */

import { forStream } from '../cultivation/rng.js';

/** At most this many of a house's tracked things are out on loan at once. */
export const WHAT_A_HOUSE_WILL_HAVE_OUT = 2;

/**
 * A thing a house owns and does not have in a room, because somebody is
 * carrying it.
 */
export interface ALoanSomebodyHasMade {
    objectId: string;
    /** Who is holding it. They do not own it and are not told they might. */
    toNpcId: string;
    /** Their name, for the provenance chain, which stores both. */
    toName: string;
    /**
     * WHO IT IS OWED BACK TO, in a word.
     *
     * A house wants its cauldron back through whoever keeps the roll. A senior
     * wants their blade back in person, and is somebody the junior will have to
     * look at. Same mechanism, different weight, and the reading in
     * `what-somebody-here-is-chewing-on.ts` says which.
     */
    from: 'a house' | 'a person';
    /** The lender, for the note on the chain. */
    fromName: string;
}

interface AThingAHouseOwns {
    id: string;
    kind: string;
    significance: string;
    ownerId: string | null;
    possessorId: string | null;
}

interface SomebodyOnARoll {
    id: string;
    name: string;
    factionId: string | null;
    factionRankIndex: number;
    status: string;
    tags: readonly string[];
    cultivation: { realmOrdinal: number };
    relationships: readonly { targetId: string; kind: string }[];
}

/**
 * WHO A HOUSE WOULD HAND IT TO, in order.
 *
 * The house's own pick first, because that is what being picked means and the
 * world already writes the tag. Then depth, because a house does not lend its
 * good cauldron to somebody who cannot use it. Ties break on id so two worlds
 * built from one seed agree.
 */
function whoWouldBeTrustedWithIt(
    members: readonly SomebodyOnARoll[]
): readonly SomebodyOnARoll[] {
    return [...members].sort((a, b) => {
        const picked = Number(b.tags.includes('chosen')) - Number(a.tags.includes('chosen'));
        if (picked !== 0) return picked;
        const deeper = b.cultivation.realmOrdinal - a.cultivation.realmOrdinal;
        if (deeper !== 0) return deeper;
        return a.id < b.id ? -1 : 1;
    });
}

/**
 * WHAT IS WORTH LENDING, which is not everything a house owns.
 *
 * A lot of fired clay cauldrons is `mundane` and nobody tracks whose the third
 * one is, so lending one is not an event. A token is an identity plate and
 * every member has one already. What is left is the tracked half of the
 * treasury, which is the half a house would notice the absence of.
 */
function whatIsWorthLending(
    things: readonly AThingAHouseOwns[], houseId: string
): readonly AThingAHouseOwns[] {
    return things
        .filter(thing =>
            thing.ownerId === houseId
            && thing.possessorId === null
            && thing.kind !== 'token'
            && thing.significance !== 'mundane')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Every loan the houses of a world have outstanding.
 *
 * Pure: it decides, and the caller writes `possessorId`. Its own named RNG
 * stream, so nothing already drawn in any seeded world moves.
 */
export function whatEachHouseHasOutOnLoan(state: {
    seed?: string;
    factions: readonly { id: string; name?: string; dissolvedOnDay: number | null }[];
    npcs: readonly SomebodyOnARoll[];
    objects: readonly AThingAHouseOwns[];
}): ALoanSomebodyHasMade[] {
    const loans: ALoanSomebodyHasMade[] = [];
    const byHouse = new Map<string, SomebodyOnARoll[]>();
    for (const npc of state.npcs) {
        if (npc.factionId === null || npc.status !== 'alive') continue;
        const roll = byHouse.get(npc.factionId) ?? [];
        roll.push(npc);
        byHouse.set(npc.factionId, roll);
    }

    for (const house of [...state.factions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (house.dissolvedOnDay !== null) continue;
        const members = byHouse.get(house.id) ?? [];
        if (members.length === 0) continue;

        const lendable = whatIsWorthLending(state.objects, house.id);
        if (lendable.length === 0) continue;

        // Not every house has something out. A house with one good cauldron
        // and a use for it keeps the cauldron, and the draw is what decides -
        // otherwise every house in every world lends the same number of things
        // and the world reads like a table again.
        const draw = forStream(house.id, 'a-house-lends-what-it-owns');
        const outAtOnce = Math.min(
            lendable.length,
            members.length,
            Math.floor(draw.next() * (WHAT_A_HOUSE_WILL_HAVE_OUT + 1))
        );
        if (outAtOnce <= 0) continue;

        const trusted = whoWouldBeTrustedWithIt(members);
        for (let at = 0; at < outAtOnce; at++) {
            loans.push({
                objectId: lendable[at].id,
                toNpcId: trusted[at].id,
                toName: trusted[at].name,
                from: 'a house',
                fromName: house.name ?? 'their house'
            });
        }
    }
    return loans;
}

/**
 * THE TIES THAT PUT SOMEBODY BELOW YOU, held by the senior.
 *
 * The world's tie rows are one-directional and the kind says which end holds
 * it. A `master` row is held by the STUDENT and points up; the teacher's half
 * is `disciple` and points down. Same for `patron` (held by the one who took
 * somebody in) against `client`, and `child` against `parent`.
 *
 * So these three are the whole of "somebody junior to me that I know", read
 * from the senior's own row, which is the person doing the lending.
 */
const A_TIE_TO_SOMEBODY_JUNIOR: ReadonlySet<string> = new Set([
    'disciple', 'patron', 'child'
]);

/**
 * WHAT PEOPLE HAVE LENT TO THEIR OWN JUNIORS.
 *
 * The owner: *"you might lend your treasure to a junior brother or sister."*
 *
 * A person can only lend what is actually theirs, which is why this pass has to
 * run after anything that gives somebody a thing of their own; before that
 * existed, no NPC in a seeded world owned anything at all and this returned an
 * empty list every time.
 *
 * Who counts as a junior, in order: somebody they hold a downward tie to, which
 * is a named relationship the world already wrote and the strongest form of
 * this; failing that, somebody on the same roll standing lower on it, which is
 * the junior brother or sister of the phrase. Never somebody outside the house
 * and never somebody above them, because that is not what lending down is.
 */
export function whatPeopleHaveLentToTheirJuniors(state: {
    npcs: readonly SomebodyOnARoll[];
    objects: readonly AThingAHouseOwns[];
}): ALoanSomebodyHasMade[] {
    const loans: ALoanSomebodyHasMade[] = [];
    const alive = new Map<string, SomebodyOnARoll>();
    for (const npc of state.npcs) {
        if (npc.status === 'alive') alive.set(npc.id, npc);
    }

    // What each person owns outright and nobody is carrying. Sorted so one
    // seed always lends the same thing.
    const theirOwn = new Map<string, AThingAHouseOwns[]>();
    for (const thing of [...state.objects].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (thing.ownerId === null) continue;
        // A thing they own and are holding themselves is exactly what gets
        // handed down: a bestowed treasure sits in its owner's hands, so
        // requiring an unheld object found nothing to lend on every seed.
        // What is excluded is a thing already out with somebody else.
        if (thing.possessorId !== null && thing.possessorId !== thing.ownerId) continue;
        if (thing.kind === 'token' || thing.significance === 'mundane') continue;
        if (!alive.has(thing.ownerId)) continue;
        const held = theirOwn.get(thing.ownerId) ?? [];
        held.push(thing);
        theirOwn.set(thing.ownerId, held);
    }

    const spokenFor = new Set<string>();
    for (const ownerId of [...theirOwn.keys()].sort()) {
        const lender = alive.get(ownerId);
        const lendable = theirOwn.get(ownerId) ?? [];
        if (lender === undefined || lendable.length === 0) continue;

        const junior = whoTheyWouldLendItTo(lender, alive, spokenFor);
        if (junior === null) continue;

        // Not everybody who could lend does. A treasure kept is the ordinary
        // case and a treasure handed down is the one worth a sentence.
        const draw = forStream(lender.id, 'somebody-lends-to-a-junior');
        if (draw.next() > WHETHER_THEY_HAND_IT_DOWN) continue;

        spokenFor.add(junior.id);
        loans.push({
            objectId: lendable[0].id,
            toNpcId: junior.id,
            toName: junior.name,
            from: 'a person',
            fromName: lender.name
        });
    }
    return loans;
}

/** How often somebody who could hand a thing down actually does. */
export const WHETHER_THEY_HAND_IT_DOWN = 0.35;

/**
 * Who a person would put their own treasure in the hands of.
 *
 * A named downward tie first, because the world wrote it and it is a real
 * relationship rather than a coincidence of rank. Then the same roll, lower
 * down, which is the junior brother or sister the phrase names. Ties break on
 * id so one seed always chooses the same person.
 */
function whoTheyWouldLendItTo(
    lender: SomebodyOnARoll,
    alive: ReadonlyMap<string, SomebodyOnARoll>,
    spokenFor: ReadonlySet<string>
): SomebodyOnARoll | null {
    const free = (person: SomebodyOnARoll | undefined): person is SomebodyOnARoll =>
        person !== undefined && person.id !== lender.id && !spokenFor.has(person.id);

    const bound = [...lender.relationships]
        .filter(tie => A_TIE_TO_SOMEBODY_JUNIOR.has(tie.kind))
        .map(tie => alive.get(tie.targetId))
        .filter(free)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (bound.length > 0) return bound[0];

    if (lender.factionId === null) return null;
    const underThem = [...alive.values()]
        .filter(person => free(person)
            && person.factionId === lender.factionId
            && person.factionRankIndex < lender.factionRankIndex)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    return underThem[0] ?? null;
}

/**
 * WRITE THE LOANS, SAYING THEY WERE LOANS.
 *
 * The only supported way to apply what the two passes above decided, and the
 * reason it exists is measured. The first cut moved the thing with an object
 * spread:
 *
 *     { ...object, possessorId: lent.get(object.id) }
 *
 * which is correct about where the thing is and silent about why. `whoseThisIs`
 * reads the provenance chain, so every one of the 199 carried objects in a
 * seeded world came back `unaccounted_for`, and `lent_by_their_house` could not
 * occur. A borrowed sword and a stolen one were the same row.
 *
 * `transferPossession` writes the link. That is the whole of the fix, and the
 * reason `possessions.ts` keeps the chain rather than a field is stated in
 * `whoseThisIs`'s own header: the code path that forgets quietly turns a theft
 * into a loan. This was that path.
 */
export function applyTheLoans<T extends AThingAHouseOwns>(
    objects: readonly T[],
    loans: readonly ALoanSomebodyHasMade[],
    lend: (object: T, to: ALoanSomebodyHasMade) => T
): T[] {
    if (loans.length === 0) return [...objects];
    const byObject = new Map(loans.map(loan => [loan.objectId, loan]));
    return objects.map(object => {
        const loan = byObject.get(object.id);
        return loan === undefined ? object : lend(object, loan);
    });
}

/** The note a loan leaves on the chain, in the words the record keeps. */
export function whyTheyHaveIt(loan: ALoanSomebodyHasMade): string {
    return loan.from === 'a house'
        ? `Lent by ${loan.fromName}, and owed back to the house.`
        : `Lent by ${loan.fromName}, and owed back to them.`;
}
