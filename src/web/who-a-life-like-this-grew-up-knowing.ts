/**
 * THE PEOPLE A CULTIVATOR ALREADY KNOWS ON THE DAY THE RUN OPENS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "you aren't dropped as a nobody, you have presumably grown up in the area
 *   you are in. you at least know SOMETHING to start. some names, some local
 *   areas, at a minimum."
 *
 * The blank slate was never neutrality. It was a person with no past, which is
 * a thing the rest of this setting does not otherwise permit: everybody in the
 * world has a birth, a place, a history and ties, and the player alone arrived
 * from nowhere at twenty with no one who had ever said their name.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It does not weaken the gate. `docs/world/houses/discovery.md` is intact and so is
 * the refusal that enforces it - a name nobody has said in front of you is
 * still a name you cannot use. What changes is only WHICH names have been said,
 * and the answer is the one the fiction already implies: the people on the road
 * you grew up on.
 *
 * Three properties keep it honest.
 *
 *   ORDINARY PEOPLE, NEAR YOUR OWN HEIGHT. Candidates are world NPCs standing
 *   at the birthplace, and a childhood does not put a farm child in a room with
 *   somebody twenty rungs up. `A_CHILDHOOD_REACHES` is the ceiling on the gap,
 *   and it is the only thing an origin buys here - on top of the floor every
 *   childhood has whatever it was born into, which is your own realm. See
 *   `aChildhoodCouldHaveContained` for the measurement that established the
 *   difference between those two sentences.
 *
 *   IT SCALES WITH ORIGIN, AND BUYS INPUTS RATHER THAN RANK. `origin.md`'s own
 *   rule. A better birth knows MORE PEOPLE and knows people who stand HIGHER,
 *   which is exactly the advantage that makes surviving the climb likelier and
 *   is not a rung on anything.
 *
 *   NOTHING IS GRANTED BUT ACQUAINTANCE. No standing, no favour owed, no
 *   membership and no relationship row. These are knowledge records at the
 *   stance somebody has for a face they have known since before either of them
 *   was anybody, and everything past that - whether the person will do anything
 *   for you - is the social layer's to decide, on the day you ask.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { getOrigin, type OriginTierKey } from '../engine/cultivation/origin.js';
import { FOUNDATION_ORDINAL, realmForOrdinal } from '../engine/cultivation/realms.js';
import { isBelowTheLid } from '../engine/world/layers.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { NpcRecord, RelationshipKind } from '../engine/world/npc-state.js';
import { theFamilyThisLifeOpensWith } from './the-family-a-life-opens-with.js';
import { worldLocationFor } from './entities.js';

/**
 * How many faces a childhood in each band leaves behind.
 *
 * Banded on `placement.reach`, which is the one number the origin table already
 * uses for how far a family's word carries. A farm knows three people worth
 * naming; a house's child grew up being introduced to everybody who came
 * through, which is most of the advantage of being one.
 *
 * The floor is deliberately not zero. The ruling is "at a minimum, some names",
 * and a run that opens with nobody is the state this module exists to end.
 */
export const FACES_A_CHILDHOOD_LEAVES: readonly { reach: number; faces: number }[] = [
    { reach: 0, faces: 3 },
    { reach: 12, faces: 4 },
    { reach: 20, faces: 5 },
    { reach: 29, faces: 6 },
    { reach: 38, faces: 8 }
];

/**
 * How far above a child a childhood acquaintance can stand.
 *
 * The gap, in rungs, between the player at ordinal 0 and the tallest person
 * they could plausibly have grown up around. A farm child knows the carter and
 * the man who mends the wall; they did not grow up being spoken to by anybody
 * at Foundation Establishment, and a seeder that handed them one would be
 * handing over an introduction that is supposed to cost something.
 *
 * This is the whole of what a good birth buys in this module, and it is the
 * setting's own thesis rather than an exception to it: an origin buys inputs
 * and never rank. Knowing somebody higher up is an input. It is not a rung, it
 * confers no admission, and the person may still refuse you.
 */
export const A_CHILDHOOD_REACHES: readonly { reach: number; rungs: number }[] = [
    { reach: 0, rungs: 6 },
    { reach: 12, rungs: 10 },
    { reach: 20, rungs: 14 },
    { reach: 29, rungs: 20 },
    { reach: 38, rungs: 26 }
];

/**
 * And the reach every childhood has whatever it was born into: your own realm.
 *
 * THE MEASUREMENT THIS CLOSES. The module shipped with the rung table above as
 * the only door, and the table was written against a mental picture of a
 * village rather than against the villages the world actually seeds. Twelve
 * fresh worlds, the same run seed, the same birthplace, counting who was
 * standing in it:
 *
 *     npcsAt=6   ordinals 10,9,7,11,12,10        knew 0
 *     npcsAt=4   ordinals 7,9,10,12              knew 0
 *     npcsAt=5   ordinals 10,8,5,9,7             knew 1
 *     npcsAt=13  ordinals 10,7,3,10,0,9,7,12,9,...  knew 3
 *
 * The birthplace was never empty. Every single body in it was a Qi Condensation
 * cultivator - the same realm the player is born into, in the same hamlet - and
 * a thin_county birth reaches six rungs, so on the worlds whose village happened
 * to be seeded at Layers 7 to 12 the child grew up knowing nobody. That is not
 * the rule this table was written to express. It was written to keep a farm
 * child out of a room with somebody at Foundation Establishment, and it was
 * keeping them out of a room with the woman at the end of their own street.
 *
 * So the floor is the REALM rather than the rung. A realm is the unit this
 * setting already uses for who is level with whom - it is what decides who can
 * strike whom, what a lifespan is, and what a person is - and everybody inside
 * one is somebody a childhood can plausibly have contained. Layer 12 and Layer 0
 * are both Qi Condensation, both mortal-lived, both a village's own people. The
 * rung table keeps its whole job, which is how far ABOVE your own realm a good
 * birth reaches, and that is still the only thing an origin buys here.
 *
 * Note what this does NOT do. It does not hand anybody a name from a realm
 * above them: a farm child in a hamlet of Void Tribulation cultivators still
 * knows none of them, and `facesFromHome` still answers with an empty list
 * rather than with somebody out of reach. The widening is sideways, not up.
 *
 * @param childOrdinal where the person whose childhood this was stands
 * @param theirOrdinal where the candidate stands
 * @param rungs what this birth's reach buys, from the table above
 */
export function aChildhoodCouldHaveContained(
    childOrdinal: number,
    theirOrdinal: number,
    rungs: number
): boolean {
    if (theirOrdinal - childOrdinal <= rungs) return true;
    return realmForOrdinal(theirOrdinal).name === realmForOrdinal(childOrdinal).name;
}

/**
 * How somebody comes to have been a fixture since before anybody was anybody.
 *
 * Provenance for the record, in the same register as every other `sourceNote`
 * in the knowledge table. Deliberately says nothing about family structure,
 * obligation or affection - the engine models none of those, and a note that
 * asserted one would be the prose layer inventing a system.
 *
 * AND NONE OF THEM NAMES THE HOLDER. The recap prints these verbatim to the
 * person holding them, so `since before either of them was anybody` called the
 * player `them` in a line about somebody they grew up with. Five of the six
 * were already subjectless, which is the register these are written in.
 */
const HOW_YOU_KNOW_THEM: readonly string[] = [
    'Grew up on the same road.',
    'Has been at the far end of that street since before either was anybody.',
    'Worked the same ground in the same seasons.',
    'One of the faces that was always at the well.',
    'Known by sight and by name since childhood, and by nothing else.',
    'The two families have been in each other\'s way for as long as either remembers.'
];

/**
 * What a household tie is, said to the person holding it.
 *
 * THE KIND COMES FROM THE MACHINERY AND THE WORDS DO NOT, and that is not a
 * second opinion about family. `bindNewbornToHousehold` writes its own notes -
 * `Raised them.`, `Same household.` - about the holder, in the third person,
 * for a record nothing used to read aloud. This channel is read aloud TO the
 * holder, so `Raised them.` under a parent's name would tell a player that
 * somebody raised somebody else. That is what
 * `an-account-of-your-own-life-is-addressed-to-you` is about, and the register
 * every other note in this file is written in: no subject at all.
 */
const WHAT_A_HOUSEHOLD_TIE_IS: Readonly<Record<string, string>> = Object.freeze({
    parent: 'Family. Did the raising.',
    kin: 'Family. Grew up under the same roof.'
});

/**
 * The killing behind a death, where the world wrote one.
 *
 * The killer's own id and name, UNGATED - this module reads the world and has
 * no knowledge table to ask. Whether the holder may hear the name is a question
 * about the holder, and the caller answers it: see `AFaceFromBeforeTheRun`,
 * whose field is shaped differently on purpose so that handing this straight
 * through does not typecheck.
 */
export interface AKillingBehindAFace {
    killerId: string;
    killerName: string;
    /**
     * Whether the world priced the deed, which is the only sense in which a
     * killing here is OPEN.
     *
     * Nothing in the world marks a wrong settled, so there is no better
     * question to ask. A priced deed is what `whoIsStillCarriedFor` keeps the
     * victim's row for and what `whatATellingLandsOn` looks for before it will
     * let anybody open an account, so this is the same field both of those read
     * rather than a third opinion about which killings count.
     */
    anAccountWasOpened: boolean;
}

/** One person a life like this starts already able to name. */
export interface FaceFromHome {
    id: string;
    name: string;
    /** Their standing, for the caller that wants to report the band. */
    realmOrdinal: number;
    sourceNote: string;
    statement: string;
    /**
     * The household tie the world records, or null for somebody who is only a
     * face from the same street. What makes a parent read as a parent rather
     * than as another neighbour.
     */
    tie: RelationshipKind | null;
    /**
     * Where the world has them standing, read on the day the run opens.
     *
     * Deliberately NOT folded into `statement`. A statement is written once to
     * the knowledge table and quoted back verbatim years later, so a location
     * inside one is a second copy of `npc.locationId` that goes stale the first
     * time the person walks anywhere. Where somebody is is a read, and every
     * caller that wants it does the read.
     *
     * Null where the world holds no place for them at all, which the opening
     * says rather than invents around.
     */
    whereTheyAre: { id: string; name: string } | null;
    /**
     * Null while they are alive.
     *
     * A place is where to go and find somebody, and for somebody who is dead
     * there is nowhere to go - so the opening says the ending instead of the
     * address. Reachable through a widowed household: `bindNewbornToHousehold`
     * takes the second parent off a spouse tie whether or not that spouse is
     * still standing, which is how a life is told it lost one.
     */
    diedYearsAgo: number | null;
    /**
     * The killing this life could have been told about, or null.
     *
     * Read off the world's own record rather than kept here. Somebody killed is
     * a different sentence from somebody dead, and until this was asked the
     * opening printed `Dead these 12 years.` over a wrong the world was still
     * carrying an open account for. `anAccountWasOpened` is always true on a
     * face for the reason {@link theKillingThisLifeCouldHaveBeenToldAbout}
     * gives - a killing nobody opened an account for is not one anybody was
     * told - and it stays on the shape because that read hands the same record
     * back ungated.
     */
    killedBy: AKillingBehindAFace | null;
    /**
     * True where this face is a name and no claim - a mortal household. The
     * opening says who they are and stops, because nothing tracks a mortal and
     * a whereabouts nobody maintains is a lie with a delay on it.
     */
    aMentionOnly: boolean;
}

export interface HomeFacesInput {
    world: WorldState;
    cultivator: Cultivator;
    /** The birth tier. Falls back to the thinnest, which grants the least. */
    origin: OriginTierKey;
    /** The run seed. The draw must be reproducible from it like everything else. */
    seed: string;
}

/**
 * Who this cultivator grew up around, drawn off the live world.
 *
 * The candidates are real rows standing in a real place, so every name this
 * hands back resolves through `resolveCultivator` the moment the player types
 * it - which is the point. A seeded list of catalog notables would have given
 * them names they could say and nobody they could reach.
 *
 * Empty is a legitimate answer and is now a narrow one: a birthplace the world
 * has no location for, or a whole neighbourhood in which every living body
 * stands a realm above the child and outside what the birth reaches. What it
 * must not be, and was, is the ORDINARY case - see
 * `aChildhoodCouldHaveContained` for the twelve worlds that showed a village
 * full of the child's own realm-mates coming back as nobody.
 */
export function facesFromHome(input: HomeFacesInput): FaceFromHome[] {
    const { world, cultivator, origin, seed } = input;

    const here = worldLocationFor(world, cultivator.location);
    if (!here) return [];

    const reach = getOrigin(origin).placement.reach;
    const wanted = bandFor(FACES_A_CHILDHOOD_LEAVES, reach, f => f.faces);
    const rungs = bandFor(A_CHILDHOOD_REACHES, reach, r => r.rungs);

    // ONE READ DECIDES BOTH WHO IS A FACE AND WHAT IS SAID ABOUT THEM.
    //
    // A FACE NEED NOT STILL BE STANDING. This asked `status === 'alive'` and
    // nothing else, so the only dead person who could ever reach the opening was
    // a parent - the household inherits a spouse whether or not that spouse is
    // still standing, and the street had no such door. Measured before the
    // change: of 30,000 births on 120 worlds, 1,819 opened in a settlement where
    // an open killing's victim was standing and 4 heard about it.
    //
    // `couldParent` asks `isHere` for itself, so admitting the killed here does
    // not put a corpse in the household draw.
    const toldAbout = (npc: NpcRecord): AKillingBehindAFace | null =>
        theKillingThisLifeCouldHaveBeenToldAbout(
            world, npc, world.currentDay, cultivator.age);

    const stillStandingOrKilledInTheseYears = (npc: NpcRecord): boolean =>
        npc.status === 'alive' || toldAbout(npc) !== null;

    const eligible = (npcs: readonly NpcRecord[]): NpcRecord[] => npcs
        .filter(npc => npc.id !== cultivator.id)
        .filter(npc => isBelowTheLid(npc) && stillStandingOrKilledInTheseYears(npc))
        .filter(npc => aChildhoodCouldHaveContained(
            cultivator.realmOrdinal, npc.cultivation.realmOrdinal, rungs))
        // Nearest in standing first, then by id. The neighbour before the
        // notable: somebody far above you was not in your kitchen, and if the
        // ceiling above lets one through they are still the last one picked.
        .sort((a, b) =>
            Math.abs(a.cultivation.realmOrdinal - cultivator.realmOrdinal)
            - Math.abs(b.cultivation.realmOrdinal - cultivator.realmOrdinal)
            || (a.id < b.id ? -1 : 1));

    // NOT `npcsAt`, AND THAT IS THE WHOLE OF WHY THE STREET HAD NO DOOR. That
    // read answers who is STANDING somewhere and filters the dead out before
    // anything here sees them, which is right for a square and wrong for a
    // childhood: the question is who this life grew up around, and a killing
    // inside those years does not unmake that. Everything the reader below
    // needs is in `stillStandingOrKilledInTheseYears`, where it can be argued
    // with; reading the roster directly is what lets it be asked at all.
    const atHome = eligible(world.npcs.filter(npc => npc.locationId === here.id));

    // THE HOUSEHOLD FIRST, because a sixteen-year-old has one and until now the
    // player alone did not. Bound through `bindNewbornToHousehold`, the world's
    // own answer to who a newborn is to whom; only KIN, on the design owner's
    // ruling - a master is the road the game is about and a rival is earned.
    //
    // Outside the `wanted` budget rather than inside it. That table is keyed on
    // `placement.reach`, which is how far a FAMILY'S word carries, so it counts
    // people the family's name reached and never the family.
    const house = getOrigin(origin).familyHouse;
    const kin = theFamilyThisLifeOpensWith({
        world,
        cultivator,
        candidates: atHome,
        seed,
        bornToCultivators: house !== null && house.standingFrom >= FOUNDATION_ORDINAL
    })
        // A MENTION THE WORLD IS ABOUT TO FORGET IS NOT A NAME.
        //
        // `theOtherChildrenOf` already drops a dead mortal on the design
        // owner's ruling - *"if sibling dies as a mortal, drop. if dies as a
        // cultivator, mark as dead in entities. this is true for everyone"* -
        // and the second parent reaches a mention through a different read, so
        // the same test is applied to them here rather than restated there.
        //
        // Derived rather than copied: `aMentionOnly` already carries the two
        // other terms `theWorldForgetsTheMortalDead` asks about - below
        // Foundation, and nobody the catalog wrote - so what is left is whether
        // a priced deed is keeping the row, which is what `toldAbout` reads.
        // A dead mortal with no account open is deleted on the world's next
        // pass, and naming them hands the player a name that stops resolving.
        .filter(one => !(one.aMentionOnly
            && one.npc.status !== 'alive'
            && toldAbout(one.npc) === null));
    const kinIds = new Set(kin.map(one => one.npc.id));

    // AND IF THE HAMLET ITSELF IS EMPTY, THE AREA AROUND IT.
    //
    // The ruling says "the area you are in", not "the building you were born
    // in", and the world models an area: a settlement hangs off a parent, and
    // the places that hang off the same parent are the two days' walk somebody
    // grew up inside. A child from a holding of four houses knew the people at
    // the next holding, and a world that seeds their own hamlet empty has not
    // made them a stranger to the valley.
    //
    // Deliberately ONE face rather than `wanted`. The next holding over is a
    // name; it is not a childhood, and handing over three of them would be
    // paying out the full draw for the accident of where the seeder put people.
    const notKin = (npcs: readonly NpcRecord[]) => npcs.filter(npc => !kinIds.has(npc.id));
    const draw = atHome.length > 0
        ? notKin(atHome).slice(0, wanted)
        : notKin(eligible(theSamePartOfTheWorld(world, here))).slice(0, 1);

    // Dealt, not rolled. An independent draw per face put the same note under
    // two different names, which reads as a broken template rather than as two
    // neighbours - harmless while these lived in a column nobody printed side
    // by side, wrong once the opening said them as a list. A repeat is only
    // possible past the table's sixth face, which only the richest births
    // reach.
    const rng = forStream(seed, 'childhood', here.id);
    const notes = [...HOW_YOU_KNOW_THEM];
    for (let i = notes.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [notes[i], notes[j]] = [notes[j], notes[i]];
    }
    const placeOf = new Map(world.locations.map(l => [l.id, l]));
    const day = world.currentDay;
    return [
        ...kin.map(one => toFace(
            one.npc, toldAbout(one.npc), WHAT_A_HOUSEHOLD_TIE_IS[one.kind], placeOf, one.kind,
            day, one.aMentionOnly)),
        ...draw.map((npc, at) =>
            toFace(npc, toldAbout(npc), notes[at % notes.length], placeOf, null, day))
    ];
}

/**
 * The wrong behind a death, where the world is holding one.
 *
 * ASKED HERE RATHER THAN AIMED AT THE PLAYER. `seedTheWrongsStillOpen` runs at
 * world creation, when nobody is playing, and it must stay that way - a seeder
 * that reached for a player's household would be the dependency inverted, and
 * the world arranging itself around somebody who does not exist yet. So the
 * overlap is found from this end: the wrong is there on its own, and the
 * opening merely notices that the victim is somebody this life knew. Nothing is
 * written, nothing is reseeded, and the answer is a lookup.
 *
 * Read off the deed's own actors, and off the ROLES rather than off `kind` or
 * `endNote`. `killer` and `victim` are what all three writers in
 * `src/engine/world/` put on a killing - the world-opening wrong, a
 * confrontation, and the yearly pass - and the yearly one files its row as
 * `grudge_opened` rather than `death`, so a filter on the kind would have
 * covered two of the three and looked like it covered all of them.
 */
function whoEndedThem(world: WorldState, npc: NpcRecord): AKillingBehindAFace | null {
    if (npc.status === 'alive' || npc.historyFactIds.length === 0) return null;
    const onTheirRecord = new Set(npc.historyFactIds);
    // Newest first. A person dies once, and where more than one row names them
    // as the victim the last one written is the one that stuck.
    for (let i = world.history.facts.length - 1; i >= 0; i--) {
        const fact = world.history.facts[i];
        if (!onTheirRecord.has(fact.id)) continue;
        if (!fact.actors.some(who => who.id === npc.id && who.role === 'victim')) continue;
        const killer = fact.actors.find(who => who.role === 'killer');
        if (killer) {
            return {
                killerId: killer.id,
                killerName: killer.name,
                anAccountWasOpened: 'deedWeight' in fact.data
            };
        }
    }
    return null;
}

/**
 * A killing this life could have been told about, or null.
 *
 * THE RULE IS THAT YOU KNOW WHAT YOU WERE TOLD, and it is the ordinary rule
 * rather than a special case for anybody. The design owner, asked what a mortal
 * whose father was murdered ten years ago hears: *if he knows then it counts
 * otherwise he doesn't know what happened to his parents and that's fine.* Both
 * halves are the design. A life that opens without it is a legitimate and common
 * opening, and a path that always told them would be the same defect as one that
 * never did.
 *
 * TWO CONDITIONS, AND NEITHER IS A NUMBER CHOSEN HERE.
 *
 *   THE ACCOUNT IS OPEN. A priced deed, which is the same field the telling
 *   layer and the mortal sweep read. A killing nobody ever opened an account for
 *   is a fact about the world that nobody is carrying, `whatATellingLandsOn`
 *   will not write a row about it, and `whoIsStillCarriedFor` does not keep the
 *   victim over the mortal sweep - so there is often not even a row left to be
 *   told about. Measured when only the seeder priced anything: on 13 pinned
 *   worlds run 25 years, every one of the 22 killed second parents a mortal
 *   household holds came through a path that opened no account, so the honest
 *   answer for all 22 was that nobody told them.
 *
 *   THAT WAS THE WORLD NOT PRICING ITS OWN KILLINGS, not this condition being
 *   strict, and the two passes that produce them now price the ones somebody is
 *   left to carry. Same instrument, same 13 worlds, 1,950 births: 0 lives
 *   opened knowing about a killing, and 181 do. Every one of the 181 is
 *   something the world DID - at 25 years the wrongs it was born holding are
 *   all older than a sixteen-year-old and none of them can reach a childhood,
 *   which is why the before figure is zero rather than the 45 the same births
 *   give at world open.
 *
 *   IT HAPPENED INSIDE THIS LIFE'S OWN YEARS. Nobody grew up around somebody
 *   who was already dead, so the bound is the age the run opens at. The wrongs
 *   pass dates its killings across a span wider than a childhood, so this is
 *   load-bearing rather than a formality: about half of them fall before a
 *   sixteen-year-old was born.
 *
 * ASKED FOR EVERY FACE AND NOT ONLY FOR THE STREET. It used to gate admission
 * to the street draw only, so a killed parent the household inherited said
 * `Killed` whatever the world was or was not holding - one rule for a neighbour
 * and none for a parent. Now the same answer decides both whether a dead face is
 * a face at all and whether the line says a killing, and a death the world holds
 * no account for reads as what it is: `Dead these 11 years.`
 *
 * WHAT THIS DELIBERATELY DOES NOT ASK is whether the killing is still being
 * repeated where this life stands. `whatOneOfTheWorldsOwnPeopleKnows` answers
 * exactly that and it was measured here first: asked at every settlement in 13
 * worlds about every killing those worlds hold, it answered that it could be
 * told 1,998 times out of 1,998. A grave killing clears every province, so a
 * check on circulation is a check that is always true, and the thing that
 * actually decides whether this life heard is WHO ITS CHILDHOOD CONTAINED -
 * which is the draw above, not a second gate.
 */
function theKillingThisLifeCouldHaveBeenToldAbout(
    world: WorldState,
    npc: NpcRecord,
    onDay: number,
    age: number
): AKillingBehindAFace | null {
    const killing = whoEndedThem(world, npc);
    if (killing === null || !killing.anAccountWasOpened) return null;
    if (onDay - (npc.diedOnDay ?? 0) > age * DAYS_PER_YEAR) return null;
    return killing;
}

/**
 * Everybody standing in the places that share this one's parent, and in the
 * parent itself. A top-level place has no such neighbourhood and answers with
 * nobody rather than with the whole world.
 */
function theSamePartOfTheWorld(world: WorldState, here: LocationRecord): NpcRecord[] {
    const parentId = here.parentId;
    if (parentId === null) return [];
    const around = new Set(
        world.locations
            .filter(l => l.id !== here.id && (l.parentId === parentId || l.id === parentId))
            .map(l => l.id)
    );
    return world.npcs.filter(npc => npc.locationId !== null && around.has(npc.locationId));
}

function toFace(
    npc: NpcRecord,
    killedBy: AKillingBehindAFace | null,
    sourceNote: string,
    placeOf: ReadonlyMap<string, LocationRecord>,
    tie: RelationshipKind | null,
    onDay: number,
    aMentionOnly = false
): FaceFromHome {
    const standing = aMentionOnly || npc.locationId === null
        ? undefined
        : placeOf.get(npc.locationId);
    return {
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        sourceNote,
        tie,
        aMentionOnly,
        diedYearsAgo: npc.status === 'alive'
            ? null
            : Math.max(0, Math.floor((onDay - (npc.diedOnDay ?? onDay)) / DAYS_PER_YEAR)),
        killedBy,
        whereTheyAre: standing ? { id: standing.id, name: standing.name } : null,
        // What the holder ends up carrying. For a neighbour: a face and a name,
        // and the explicit statement that it is nothing more than that, because
        // it is not. For kin the disclaimer would be false - a household is
        // exactly the thing that is owed something - so it says the tie instead
        // and still promises nothing about what anybody will do.
        statement: tie === null
            ? `${npc.name} is from home. Knowing them is not the same as being owed anything `
              + 'by them.'
            : tie === 'parent'
                ? `${npc.name} is family, and did the raising.`
                : `${npc.name} is family, and grew up under the same roof.`
    };
}

/** The highest band this reach qualifies for. */
function bandFor<T extends { reach: number }>(
    table: readonly T[],
    reach: number,
    read: (row: T) => number
): number {
    let out = read(table[0]);
    for (const row of table) {
        if (reach >= row.reach) out = read(row);
    }
    return out;
}
