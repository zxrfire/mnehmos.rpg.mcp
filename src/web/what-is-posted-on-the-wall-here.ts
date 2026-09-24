/**
 * Reading the wall: the player's side of a recruiting bill.
 *
 * The engine half is
 * `engine/world/houses-that-have-to-advertise-for-disciples.ts`, which decides
 * which houses are reduced to putting up paper and what a given wall is
 * carrying today. This is the layer that knows the three things that one
 * cannot: which place the free-text `Cultivator.location` actually is, what the
 * shipped catalog holds, and where the knowledge rows go.
 *
 * ── Why it is not a new discovery mechanism ──────────────────────────────
 *
 * It is the same one. A bill goes through `KnowledgeGate.learnIfNew` at
 * `placed` with `read` provenance, alongside hearsay, travellers, ruins and
 * archives. There is no flag that skips the gate, nothing is granted at a
 * stage a source cannot carry, and a house already known at `placed` or better
 * writes nothing and is not announced - so a wall the player has read before
 * goes quiet on its own without anything remembering that they read it.
 *
 * ── Why it is free ───────────────────────────────────────────────────────
 *
 * Looking at a wall costs nothing anywhere in the world and it should not cost
 * anything here. The price is downstream, at the door, where it always was:
 * the bill states a bar, and the bar is real.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import { whoTheHouseHasLostTrackOf } from '../engine/world/who-a-house-has-lost-track-of.js';
import { SECTS } from '../data/cultivation/sects.js';
import { demonicStandingOf } from '../data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import { provinceForFaction } from '../data/cultivation/regions.js';
// Moved to the engine, because the world's own intake reads the same walls a
// player does. Re-exported so every caller that read them here still does.
import {
    openDoorsInTheWorld,
    postingGroundOf,
    provinceOfPlace
} from '../engine/world/the-doors-and-walls-a-house-takes-people-at.js';
export { openDoorsInTheWorld, postingGroundOf, provinceOfPlace };
import {
    noticesOnTheWall,
    whatANoticeGrants,
    WHAT_THE_PAPER_GIVES_AWAY,
    THE_SAME_TELL_AGAIN,
    type HouseWithSomethingToSay,
    type Notice,
    type RecruitingBill,
    type TheAsk
} from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    reasonsOpenTo,
    type HouseAsItStands
} from '../engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import type { AtStake } from '../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {
    theOnesNobodyCanFind,
    whatTheHallSays,
    whoHasALampBurningIn
} from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import type { KnowledgeGate } from './knowledge.js';

/**
 * WHAT A REASON A HOUSE ALREADY HAS PUTS ON A PUBLIC WALL.
 *
 * Read off `atStake`, which is the reason's own statement of what is on the
 * line, so a new row in `why-a-house-puts-a-party-on-the-road.ts` gets an
 * outward notice or does not without anything here being edited. There is no
 * branch on a reason's id anywhere in this file and there must not be one.
 *
 * The rule, in one line: **a house hires a stranger for work where nothing but
 * stones is at stake, and sends its own wherever its standing, its grant or its
 * face is.** A tribute run and a marriage party carry the house; somebody it
 * met on a wall cannot carry either. Ground is the third answer - a house that
 * holds ground does not hire the province to defend it, it TELLS the province
 * what is moving, which is a warning and asks nothing of anybody.
 */
const WHAT_A_REASON_PUTS_ON_A_WALL: Record<AtStake, TheAsk['kind'] | null> = {
    stones: 'work',
    the_ground_itself: 'warning',
    standing_with_a_house: null,
    the_grant: null,
    nothing_but_the_party: null
};

/**
 * Every house that has something to say to somebody who is not its own.
 *
 * NOT THE RECRUITMENT FIELD. `openDoorsInTheWorld` is the bottom of the field
 * and is right for an intake; this is every house in the catalog, because the
 * thing being answered is not "who would have me" but "what is here". A house
 * that would never admit anybody still wants bone at mortal grade.
 *
 * READ OFF THE CATALOG, like the rest of this file. `HouseAsItStands` is
 * satisfied from the same columns `openDoorsInTheWorld` uses, with `standing`
 * empty - which is not a simplification: a freshly seeded world sets
 * `standing: {}` on every faction and grows it by simulation, so the catalog
 * and a new world answer that predicate identically. A house whose standing has
 * since moved wants the world's copy, and the world is not reachable from this
 * layer; `whoEachHouseIsLookingFor` below is where that seam is, and it takes
 * the world as an argument for exactly this reason.
 *
 * AND THREE PREDICATES THE CATALOG CANNOT ANSWER, two of which cost something.
 * `a_counterpart`, `forbidden_ground` and `a_find` all read the world rather
 * than the catalog, and all three are left unset here.
 *
 *   a_counterpart      costs nothing. A visit and a friendly competition both
 *                      stake `standing_with_a_house`, which
 *                      {@link WHAT_A_REASON_PUTS_ON_A_WALL} already puts on no
 *                      wall: they are not a stranger's business.
 *   forbidden_ground   IS a gap, written down rather than licensed. It stakes
 *                      `the_ground_itself`, so it is a `warning`, and a town
 *                      wall in a province where the ground has turned ought to
 *                      carry one. It does not, because the warning is a fact
 *                      about the world and this layer holds no world. The route
 *                      is `alsoAsking`, which exists for exactly this seam.
 *   a_find             the same gap, and the same route.
 *                      `aFindThisHouseCouldSendFor` is the one reading of it
 *                      and it takes location records and a house's roll: which
 *                      ruins stand, which are still shut, which province each
 *                      is in and who has been to one are all world facts, and
 *                      the catalog holds no location row and no roll at all. So
 *                      this layer genuinely cannot answer it - it is left false
 *                      for that reason and not because a house never has one.
 *                      It stakes `stones`, so it is `work`, and a town wall in
 *                      a province where a house is opening something ought to
 *                      carry the hiring notice.
 */
export function housesWithSomethingToSay(
    alsoAsking: ReadonlyMap<string, readonly TheAsk[]> = new Map()
): HouseWithSomethingToSay[] {
    return SECTS.map(sect => {
        const standing: HouseAsItStands = {
            id: sect.id,
            name: sect.name,
            holdsGround: provinceForFaction(sect.id) != null,
            standing: {},
            hasAFind: false
        };
        const asks: TheAsk[] = [];
        for (const reason of reasonsOpenTo(standing)) {
            const kind = WHAT_A_REASON_PUTS_ON_A_WALL[reason.atStake];
            if (kind === 'work') {
                asks.push({
                    kind,
                    what: reason.what,
                    days: reason.days,
                    hands: reason.hands
                });
            } else if (kind === 'warning') {
                asks.push({ kind, what: reason.what });
            }
        }
        asks.push(...(alsoAsking.get(sect.id) ?? []));
        return {
            id: sect.id,
            name: sect.name,
            provinceId: provinceForFaction(sect.id)?.id ?? null,
            postsInPublic: demonicStandingOf(sect.id) === undefined,
            asks
        };
    });
}

/**
 * Who each house is looking for, off its own hall of lamps.
 *
 * THE ONE ASK THAT NEEDS THE WORLD AND NOT THE CATALOG. A missing disciple is a
 * fact about the roll as it stands today, so this takes the world rather than
 * deriving it, and a caller with no world gets an empty map and a wall with no
 * missing-person notices on it - which is correct rather than convenient: with
 * no world there is no roll and nobody has gone anywhere.
 *
 * The gate is the lamp in the hall. `whatTheHallSays` reads only people a
 * lamp burns for, so a house that never lit one for somebody posts no search
 * for them: it does not know one of its own is gone.
 */
export function whoEachHouseIsLookingFor(
    world: WorldState | null | undefined
): Map<string, readonly TheAsk[]> {
    const out = new Map<string, readonly TheAsk[]>();
    if (!world) return out;

    const byHouse = new Map<string, typeof world.npcs>();
    for (const npc of world.npcs) {
        if (!npc.factionId) continue;
        const held = byHouse.get(npc.factionId);
        if (held) held.push(npc);
        else byHouse.set(npc.factionId, [npc]);
    }

    // WHAT THE HOUSE DOES NOT KNOW, and not a clock on the person: somebody is
    // unseen by their house exactly when the house has lost track of them
    // (`who-a-house-has-lost-track-of.ts`), whether or not they are still on its
    // roll.
    const byIdInTheWorld = new Map(world.npcs.map(n => [n.id, n] as const));
    for (const house of world.factions) {
        const lost = whoTheHouseHasLostTrackOf(house);
        if (lost.length === 0) continue;
        const members = byHouse.get(house.id) ?? [];
        for (const one of lost) {
            const npc = byIdInTheWorld.get(one.personId);
            if (npc && !members.includes(npc)) members.push(npc);
        }
        byHouse.set(house.id, members);
    }

    for (const [houseId, members] of byHouse) {
        const lit = whoHasALampBurningIn(world.objects, houseId);
        const house = world.factions.find(f => f.id === houseId);
        const lostSince = new Map((house ? whoTheHouseHasLostTrackOf(house) : []).map(x => [x.personId, x.sinceDay] as const));
        const looking = theOnesNobodyCanFind(whatTheHallSays({
            roll: members.map(npc => ({
                memberId: npc.id,
                memberName: npc.name,
                theyHaveALamp: lit.has(npc.id),
                holderIsAlive: npc.status === 'alive',
                daysSinceAnybodySawThem: lostSince.has(npc.id)
                    ? Math.max(0, world.currentDay - lostSince.get(npc.id)!)
                    : 0
            }))
        }));
        if (looking.length === 0) continue;
        out.set(houseId, looking.map(row => ({
            kind: 'missing' as const,
            who: row.memberName,
            unseenForDays: row.unseenForDays
        })));
    }
    return out;
}

export interface WallReading {
    bills: RecruitingBill[];
    /**
     * Everything on the wall, intakes included, of every kind.
     *
     * `bills` is kept beside it and is the INTAKES ONLY, because the callers
     * that read it are answering a different question - what dated invitation
     * is open here, what can `the intake` point at. A missing-person notice is
     * neither, and a caller that started treating one as a door would be
     * offering the player an intake that does not exist.
     */
    notices: Notice[];
    /**
     * Every bill on the wall, worded. What somebody who went and looked sees.
     *
     * Engine-authored; nothing in it is invented and nothing in it names
     * anything the reader does not now hold a record for.
     */
    lines: string[];
    /**
     * Only the bills that put a name into this player's world just now.
     *
     * The split exists because the two callers want different halves. Looking
     * round a town every day for a season must not reprint the same two
     * posters, so ambient noticing takes this; asking deliberately what is
     * posted takes {@link WallReading.lines}, because somebody who walked over
     * to the wall gets the whole wall whether or not they knew the names.
     */
    newLines: string[];
    /** Houses whose names genuinely entered this player's world just now. */
    learned: string[];
}

/**
 * Read whatever is nailed up where this cultivator is standing.
 *
 * Writes the grants and hands back what the narrator may say. Returns an empty
 * reading rather than a refusal when there is no wall, because "there is
 * nothing posted here" is a fact about the place and the caller decides
 * whether it is worth a sentence.
 */
export function readTheWall(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    run: Run,
    /**
     * What each house is asking after that only the world knows, from
     * {@link whoEachHouseIsLookingFor}. Absent everywhere the caller holds no
     * world, and a wall with no searches on it is the honest reading then.
     */
    alsoAsking: ReadonlyMap<string, readonly TheAsk[]> = new Map()
): WallReading {
    const placeName = (cultivator.location ?? '').trim();
    const onDay = Math.floor(run.elapsedDays);
    const wall = {
        field: openDoorsInTheWorld(),
        placeName,
        ground: postingGroundOf(placeName),
        placeProvinceId: provinceOfPlace(placeName),
        onDay,
        seed: run.seed
    };
    const notices = noticesOnTheWall({
        ...wall,
        speaking: housesWithSomethingToSay(alsoAsking)
    });
    const bills = notices.flatMap(notice => notice.bill ?? []);

    const learned: string[] = [];
    const lines: string[] = [];
    const newLines: string[] = [];
    // The reading is said in full the first time its kind appears on this wall
    // and shortened after that. Tracked separately for the two lists, because
    // a caller may render either one on its own and neither may be missing the
    // full reading for a kind it contains.
    const saidInFull = new Set<string>();
    const saidInFullAmongTheNew = new Set<string>();
    // An intake's tell has a written short form, because three of them on one
    // wall is the ordinary case and the third must not restate the second. The
    // other kinds say what reading them does not buy once per wall and then
    // stop, which is the same rule with no second sentence to write.
    const readingFor = (notice: Notice, said: Set<string>): string => {
        const key = notice.bill ? notice.bill.why : notice.kind;
        const full = !said.has(key);
        said.add(key);
        if (!notice.bill) return full ? notice.andWhatItIsNot : '';
        return full
            ? WHAT_THE_PAPER_GIVES_AWAY[notice.bill.why]
            : THE_SAME_TELL_AGAIN[notice.bill.why];
    };
    const worded = (notice: Notice, said: Set<string>): string =>
        `${notice.saying} ${readingFor(notice, said)}`.trim();

    for (const notice of notices) {
        const isNew = knowledge.learnIfNew({
            holderId: cultivator.id,
            onDay,
            ...whatANoticeGrants(notice)
        });
        lines.push(worded(notice, saidInFull));
        if (!isNew) continue;
        learned.push(notice.houseName);
        newLines.push(worded(notice, saidInFullAmongTheNew));
    }

    return { bills, notices, lines, newLines, learned };
}

/**
 * The house a `the intake` points at, read off the wall in front of the player.
 *
 * Returns undefined for anything that is not a paper reference, and for a wall
 * holding none or holding more than one - a phrase with two things to point at
 * points at neither, which is the ruling `whichOfTheNamedThings` keeps.
 */
export function theWallAnswersThis(
    target: string | undefined,
    wall: () => { bills: readonly { houseName: string }[] }
): string | undefined {
    return whichHouseThePaperMeans(target, wall).house;
}

/**
 * The same read, with the candidates kept when it could not settle.
 *
 * A player who says `the intake` at a wall holding two of them is owed the two
 * names rather than a catalogue of every house in the province: the phrase
 * pointed somewhere, and saying where it could have pointed is what lets them
 * finish the sentence. The same shape `sayingItCouldHaveMeantAnyOfThese` keeps
 * for a demonstrative.
 */
export function whichHouseThePaperMeans(
    target: string | undefined,
    wall: () => { bills: readonly { houseName: string }[] }
): {
    house: string | undefined;
    couldHaveBeen: readonly string[];
    /**
     * Whether the phrase was pointing at paper at all.
     *
     * FOUND BY PLAYING, on the turn after the opening started stating the
     * dated intakes. `i go to the intake` against a wall holding two of them
     * settled on neither - which is right - and then reached `resolveSect`
     * with the literal words `the intake`, which came back as *"you have said
     * a name and it is not one anybody has said to you"*. The engine had
     * printed both houses on the screen above.
     *
     * `couldHaveBeen` cannot carry this: it is empty both for a phrase that
     * was never a reference and for a reference against a bare wall, and the
     * caller has to tell those apart to know whether the words are a name.
     */
    wasAPaperReference: boolean;
} {
    const said = (target ?? '').trim().toLowerCase();
    if (!/^(?:the|that|this)\s+(?:intake|notice|bill|poster|posting)$/.test(said)) {
        return { house: undefined, couldHaveBeen: [], wasAPaperReference: false };
    }
    const names = [...new Set(wall().bills.map(bill => bill.houseName))];
    return names.length === 1
        ? { house: names[0], couldHaveBeen: names, wasAPaperReference: true }
        : { house: undefined, couldHaveBeen: names, wasAPaperReference: true };
}
