/**
 * Three questions, pooled across seeds, about deeds in a world that is running.
 *
 *   1. WHAT THE WORLD ALREADY PRODUCES. How many killings does an ordinary
 *      span throw up, and what fraction of them are done to somebody a house
 *      has anything invested in? That is the population the escalation layer
 *      has to work on, and if it is empty the layer is theory.
 *   2. WHERE THE ESCALATION LANDS. Run each of those killings through
 *      `whatADeedLeaves` and count how far it reaches - the two of them, their
 *      people, the houses - split by WHO DID IT, which is the design owner's
 *      claim and the thing worth measuring.
 *   3. DOES A DEATH REACH THE PLAYER. Deaths near where a cultivator is
 *      standing, and how many of them the digest actually hands them. If the
 *      answer is none, the "somebody dies in front of you" situation cannot
 *      occur and nothing downstream of it matters.
 *
 * Pooled over seeds throughout, per AGENTS.md: a single seed is not a
 * measurement, and both arms of any comparison are sampled on the same side.
 *
 *   npx tsx scripts/probe-what-a-deed-leaves-in-a-seeded-world.ts
 */

import { getFaction, getNpc, type WorldState } from '../src/engine/world/world-state.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { buildPlayerDigest, simpleAccess } from '../src/engine/world/digest.js';
import {
    whatADeedLeaves,
    type Party,
    type Reach
} from '../src/engine/social-leverage/what-a-deed-leaves.js';
import { whatTheySay } from '../src/engine/world/what-people-are-saying.js';
import { refiningOrdinalFor } from '../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';

const SEEDS = Number(process.env.SEEDS ?? 8);
const YEARS = Number(process.env.YEARS ?? 40);
const DAY = 365;

interface Tally {
    killings: number;
    victimRanked: number;
    byNobody: number;
    byAHouseMember: number;
    reachedTwoOfThem: number;
    reachedTheirPeople: number;
    reachedTheHouses: number;
    betweenHouses: number;
    willDescend: number;
    shamesWritten: number;
    shamesCommon: number;
    // The good half, run through the identical function.
    kindnessesReachedAHouse: number;
    kindnessesTotal: number;
    // Question three.
    deathsNearTheCultivator: number;
    deathsInTheDigest: number;
    rumoursHeard: number;
    rumoursAboutADeed: number;
    digestLines: number;
    unheard: number;
    // Question four: where does the LEGITIMATE material come from.
    deathsTotal: number;
    diedOfAge: number;
    diedOfAgeHigh: number;
    diedOtherwiseHigh: number;
}

const total: Tally = {
    killings: 0, victimRanked: 0, byNobody: 0, byAHouseMember: 0,
    reachedTwoOfThem: 0, reachedTheirPeople: 0, reachedTheHouses: 0,
    betweenHouses: 0, willDescend: 0, shamesWritten: 0, shamesCommon: 0,
    kindnessesReachedAHouse: 0, kindnessesTotal: 0,
    deathsNearTheCultivator: 0, deathsInTheDigest: 0,
    rumoursHeard: 0, rumoursAboutADeed: 0, digestLines: 0, unheard: 0,
    deathsTotal: 0, diedOfAge: 0, diedOfAgeHigh: 0, diedOtherwiseHigh: 0
};

/**
 * The rung above which a body is top-band material.
 *
 * `who-can-refine-a-grade-of-medicine.ts` pins heaven grade to Void Refinement,
 * and that module is the authority - this is only the ordinal it names, read
 * back so the probe does not restate a ladder.
 */
const HEAVEN_BAND = refiningOrdinalFor('heaven');

/** A person, as the deed layer wants them, read off the world's own record. */
function partyOf(state: WorldState, id: string): Party | null {
    const npc = getNpc(state, id);
    if (!npc) return null;
    const house = npc.factionId ? getFaction(state, npc.factionId) : null;
    return {
        id: npc.id,
        name: npc.name,
        houseId: npc.factionId ?? null,
        houseName: house?.name ?? null,
        alignment: (house?.alignment as Party['alignment']) ?? null,
        // The world's own statement of whether the house has anything invested
        // in them. A named rank is what `whenItIsDoneToOneOfOurs` asks for and
        // the world stores it as an index into the house's rank list.
        ranked: npc.factionRankIndex !== null && npc.factionRankIndex !== undefined,
        kin: npc.relationships
            .filter(r => ['child', 'parent', 'sibling', 'spouse'].includes(r.kind))
            .slice(0, 3)
            .map(r => ({ id: r.targetId, relation: 'clan' as const }))
    };
}

/**
 * How far the wronged side can get at the actor.
 *
 * Derived here, in the caller, which is where the ladder belongs: an actor with
 * no house answers to nobody; one whose house the wronged house already deals
 * with is answerable; one standing far enough above everybody involved is not
 * reachable by anything the house has. The consequence layer never sees a rung.
 */
function reachOf(state: WorldState, actor: Party, subject: Party): Reach {
    if (actor.houseId === null) {
        const npc = getNpc(state, actor.id);
        const them = getNpc(state, subject.id);
        const gap = (npc?.cultivation.realmOrdinal ?? 0) - (them?.cultivation.realmOrdinal ?? 0);
        return gap >= 12 ? 'beyond' : 'unbacked';
    }
    return 'answerable';
}

const catalog = await loadCultivationCatalog();

for (let s = 0; s < SEEDS; s++) {
    const state = seedWorld({
        seed: `deeds-${s}`, catalog, presentYear: 1000, population: 600
    }).state;
    const startDay = state.currentDay;

    // Somebody standing somewhere ordinary, to ask question three of.
    const standingAt = state.locations.find(l => l.layer === 'mortal' && l.kind === 'settlement')
        ?? state.locations[0];
    const observer = { id: `probe-${s}`, bornOnDay: startDay - 20 * DAY };

    const result = advanceWorldForPlay(state, {
        days: YEARS * DAY,
        access: simpleAccess({ locationId: standingAt?.id ?? null, factionId: null }),
        observer,
        stopOnInterrupt: false
    });

    // ── 1 AND 2: WHAT THE WORLD PRODUCED, AND WHERE IT LANDS ────────────
    for (const fact of result.events) {
        if (fact.kind !== 'grudge_opened') continue;
        const killer = fact.actors.find(a => a.role === 'killer');
        const victim = fact.actors.find(a => a.role === 'victim');
        if (!killer || !victim) continue;

        const actor = partyOf(state, killer.id);
        const subject = partyOf(state, victim.id);
        if (!actor || !subject) continue;

        total.killings++;
        if (subject.ranked && subject.houseId) total.victimRanked++;
        if (actor.houseId === null) total.byNobody++; else total.byAHouseMember++;

        const reach = reachOf(state, actor, subject);
        const left = whatADeedLeaves({
            deed: {
                cause: 'killed_kin',
                paidBy: 'subject',
                cost: 1,
                irreversible: true,
                onDay: fact.day,
                description: fact.summary,
                witnesses: fact.witnessIds.length
            },
            actor,
            subject,
            reach,
            // The dead hold nothing. Their people hold it from day one.
            principalCannotHoldIt: true
        });

        if (left.reached === 'the two of them') total.reachedTwoOfThem++;
        else if (left.reached === 'their people') total.reachedTheirPeople++;
        else if (left.reached === 'the houses') total.reachedTheHouses++;

        // The owner's case: which houses it is between depends on who did it.
        if (left.opens.some(o =>
            o.holderId === subject.houseId && o.subjectId === actor.houseId)) {
            total.betweenHouses++;
        }
        if (left.willDescend) total.willDescend++;
        if (left.shame) {
            total.shamesWritten++;
            if (left.shame.common) total.shamesCommon++;
        }

        // ── AND THE SAME EVENT WITH THE SIGN FLIPPED ────────────────────
        //
        // The honourable door, priced by the identical function. Nothing about
        // this branch is special-cased: it is the same two people, the same
        // day, `paidBy` the other way round.
        const returned = whatADeedLeaves({
            deed: {
                cause: 'returned_their_dead',
                paidBy: 'actor',
                cost: 0.5,
                onDay: fact.day,
                description: `Brought ${subject.name} home.`
            },
            actor: { ...actor, id: `finder-${s}`, name: 'a nobody', houseId: null, houseName: null,
                alignment: null, ranked: false },
            subject
        });
        total.kindnessesTotal++;
        if (returned.reached === 'the houses') total.kindnessesReachedAHouse++;
    }

    // ── 3: DID A DEATH REACH THE PERSON STANDING THERE ──────────────────
    for (const handoff of result.deaths) {
        const npc = getNpc(state, handoff.deceasedId);
        if (!npc) continue;
        if (standingAt && npc.locationId === standingAt.id) total.deathsNearTheCultivator++;

        // ── 4: WHERE THE LEGITIMATE MATERIAL COMES FROM ─────────────────
        //
        // An intact, uncontested, top-grade body is produced by exactly one
        // path: somebody high dying of age, at home, with people to inherit
        // them. Everything else at that height either leaves nothing, is
        // contested, or is never found. If this number is large, something
        // about the ladder is not doing what the design thinks.
        total.deathsTotal++;
        const ofAge = npc.endNote.includes('old age');
        const high = npc.cultivation.realmOrdinal >= HEAVEN_BAND;
        if (ofAge) total.diedOfAge++;
        if (ofAge && high) total.diedOfAgeHigh++;
        if (!ofAge && high) total.diedOtherwiseHigh++;
    }
    const digest = result.digest ?? buildPlayerDigest(state, {
        access: simpleAccess({ locationId: standingAt?.id ?? null, factionId: null }),
        observer,
        fromDay: startDay,
        toDay: state.currentDay
    });
    // `lines`, not `items`. Reading the wrong field gave 0 across every seed on
    // the first pass and looked exactly like a finding - AGENTS.md, *read state,
    // not prose*, and the harness is wrong far more often than the engine.
    for (const line of digest?.lines ?? []) {
        if (line.kind === 'death' || line.kind === 'grudge_opened') {
            total.deathsInTheDigest += line.occurrences;
        }
    }
    total.digestLines += digest?.lines.length ?? 0;
    total.unheard += digest?.unheard ?? 0;

    // What a person standing in that market would actually be told.
    const said = whatTheySay(state, {
        id: observer.id, name: 'the probe', realmOrdinal: 2,
        regionId: standingAt?.parentId ?? null, factionId: null
    }, state.currentDay);
    total.rumoursHeard += said.length;
    total.rumoursAboutADeed += said.filter(r => {
        const fact = r.factId ? state.history.facts.find(f => f.id === r.factId) : null;
        return fact?.kind === 'grudge_opened' || fact?.kind === 'betrayal' || fact?.kind === 'death';
    }).length;
}

const pct = (n: number, d: number) => d === 0 ? '  n/a' : `${((n / d) * 100).toFixed(0).padStart(4)}%`;

console.log(`\nPooled over ${SEEDS} seeds, ${YEARS} years each.\n`);
console.log('1. WHAT THE WORLD PRODUCES');
console.log(`   killings                       ${total.killings}`);
console.log(`   victim was ranked in a house   ${total.victimRanked}  ${pct(total.victimRanked, total.killings)}`);
console.log(`   done by somebody with no house ${total.byNobody}  ${pct(total.byNobody, total.killings)}`);
console.log(`   done by a house member         ${total.byAHouseMember}  ${pct(total.byAHouseMember, total.killings)}`);
console.log('\n2. WHERE THE ESCALATION LANDS');
console.log(`   stayed between the two of them ${total.reachedTwoOfThem}  ${pct(total.reachedTwoOfThem, total.killings)}`);
console.log(`   reached their people           ${total.reachedTheirPeople}  ${pct(total.reachedTheirPeople, total.killings)}`);
console.log(`   reached the houses             ${total.reachedTheHouses}  ${pct(total.reachedTheHouses, total.killings)}`);
console.log(`   named a HOUSE as the subject   ${total.betweenHouses}  ${pct(total.betweenHouses, total.killings)}`);
console.log(`   written to descend             ${total.willDescend}  ${pct(total.willDescend, total.killings)}`);
console.log(`   shame on the actor             ${total.shamesWritten}  (common: ${total.shamesCommon})`);
console.log('\n   THE SAME FUNCTION, POINTED THE OTHER WAY');
console.log(`   returning the body reached a house ${total.kindnessesReachedAHouse}  ${pct(total.kindnessesReachedAHouse, total.kindnessesTotal)}`);
console.log('\n3. DOES A DEATH REACH SOMEBODY STANDING THERE');
console.log(`   deaths at the cultivator's own location ${total.deathsNearTheCultivator}`);
console.log(`   deaths/killings the digest handed over  ${total.deathsInTheDigest}`);
console.log(`   digest lines in total                  ${total.digestLines}`);
console.log(`   world events that reached them by no channel at all ${total.unheard}`);
console.log(`   rumours a market would repeat           ${total.rumoursHeard}`);
console.log(`   of those, about a killing or a betrayal ${total.rumoursAboutADeed}`);
console.log(`
4. WHERE LEGITIMATE TOP-GRADE REMAINS COME FROM (heaven band = ordinal ${HEAVEN_BAND}+)`);
console.log(`   deaths in the span                     ${total.deathsTotal}`);
console.log(`   of old age, at any rung                ${total.diedOfAge}  ${pct(total.diedOfAge, total.deathsTotal)}`);
console.log(`   of old age, at the heaven band or above ${total.diedOfAgeHigh}  ${pct(total.diedOfAgeHigh, total.deathsTotal)}`);
console.log(`   otherwise, at the heaven band or above  ${total.diedOtherwiseHigh}`);
console.log();
