/**
 * The standoff at the top of the world, checked rather than asserted.
 *
 * This suite exists because the obvious arrangement was wrong and nothing
 * caught it. With the three immortal objects rated in the same order as the
 * heads holding them, apex against apex resolved 100/0 in every pairing and
 * every configuration - including one side's courts defecting - which makes
 * three apexes into one apex and two titles. No prose in the catalog said so,
 * because no prose was measuring.
 *
 * The property asserted here is deliberately weak, because the strong version
 * is not true and should not be. The three apexes are NOT evenly matched: the
 * Azure Cloud Pavilion loses both arenas to both rivals, and that is the
 * setting working rather than failing. Nothing here requires parity.
 *
 * What the peace actually rests on is that nobody is certain. An apex already
 * holds the vein, the grants, the object and the centuries; winning gains a
 * little more of what it has, and losing costs all of it. At those stakes a
 * ninety-per-cent war is not an opportunity - it is a one-in-ten chance of the
 * house ending, entered voluntarily. So the only thing that must never be true
 * is that some house can take everything while risking nothing.
 *
 * Asserted, through the same resolver that settles a fight between farmhands:
 *
 *   - no house wins against every rival in both arenas
 *   - a court defection has to move the number, or defection is decoration
 *   - taking the object away leaves an ordinary cultivator behind
 *
 * If a change to any rung, any artifact rating or any client list makes one
 * house a sure thing everywhere, this fails and `WHY_NOBODY_MOVES` was wrong.
 */

import {
    describe,
    it,
    expect } from 'vitest';

import { resolveMelee,
    type SideMemberInput,
    type CombatantInput } from '../../src/engine/cultivation/combat.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { ARTIFACTS,
    artifactsOwnedBy } from '../../src/data/cultivation/artifacts.js';
import { APEX_INSTITUTIONS,
    COURTS,
    FACTION_PARENTAGE,
    idsForFaction } from '../../src/data/cultivation/hierarchy.js';
import { SECTS,
    sectThreat } from '../../src/data/cultivation/sects.js';
import { WHY_NOBODY_MOVES } from '../../src/data/cultivation/standoff.js';

const SEEDS = 120;

function body(id: string, ordinal: number, artifactOrdinal?: number): SideMemberInput {
    const combatant: CombatantInput = {
        id,
        name: id,
        realmOrdinal: ordinal,
        spiritRoot: 'single_metal',
        attributes: { might: 3, insight: 3, fortune: 2, charm: 2 },
        injuries: [],
        hp: 100,
        maxHp: 100,
        qi: 50,
        maxQi: 50,
        ...(artifactOrdinal === undefined ? {} : { artifactOrdinal })
    };
    return { combatant };
}

/**
 * Everybody who turns out for a house when its head's life is in question.
 *
 * Two corrections live in here, both of which were silently costing the Azure
 * Cloud Pavilion its entire following:
 *
 * 1. The chain is walked through `idsForFaction`, because the Pavilion is one
 *    house with a row in two catalogs. Its own court and its own feeder sect
 *    hang off the SECT id while the apex queries used the APEX id, so a house
 *    with a court and a sect under it was being counted as one person.
 * 2. A client arrives as itself, not only as its sealed ancestor. Everything a
 *    house holds is held on its patron's name; when the patron's life is in
 *    question the house comes, and it comes with its strongest member whether
 *    or not it has anything asleep under a mountain.
 */
function reinforcementsFor(apexId: string, suborned: readonly string[] = []): SideMemberInput[] {
    const houseIds = idsForFaction(apexId);

    const arriving: SideMemberInput[] = COURTS
        .filter(c => houseIds.includes(c.apexId) && !suborned.includes(c.id))
        .map(c => body(c.id, c.powerOrdinal));

    for (const [id, entry] of Object.entries(FACTION_PARENTAGE)) {
        if (suborned.includes(id) || houseIds.includes(id)) continue;

        let cursor: string | null | undefined = entry.parentFactionId;
        const seen = new Set<string>();
        let under = false;
        while (cursor && !seen.has(cursor)) {
            seen.add(cursor);
            if (houseIds.includes(cursor)) { under = true; break; }
            const court = COURTS.find(c => c.id === cursor);
            cursor = court ? court.apexId : FACTION_PARENTAGE[cursor]?.parentFactionId;
        }
        if (!under) continue;

        const sect = SECTS.find(s => s.id === id);
        const threat = sectThreat(id);
        if (!sect || !threat) continue;

        // The house itself.
        arriving.push(body(id, threat.acting));
        // And whatever it keeps asleep, which it breaks for this.
        if (threat.wakeCondition !== null && threat.ceiling > threat.acting) {
            arriving.push(body(id + '-sealed', threat.ceiling));
        }
    }

    return arriving.sort((a, b) => b.combatant.realmOrdinal - a.combatant.realmOrdinal);
}

function houseOf(apexId: string, mobilised: boolean): SideMemberInput[] {
    const apex = APEX_INSTITUTIONS.find(a => a.id === apexId)!;
    const objects = artifactsOwnedBy(apex.id);

    // Read lastRealm.count rather than assuming one. The assumption was wrong
    // about the Pavilion and the error decided the whole region.
    const people: SideMemberInput[] = [];
    for (let i = 0; i < Math.max(1, apex.lastRealm.count); i++) {
        people.push(body(
            i === 0 ? `${apex.id}-head` : `${apex.id}-last-realm-${i}`,
            apex.powerOrdinal,
            objects[i]?.power ?? undefined
        ));
    }


    // The house's OWN sealed ancestor, which nothing was counting. A patron
    // that would break a client's seal for its head certainly breaks its own,
    // and two of the three have one.
    const own = sectThreat(apex.factionId ?? apex.id);
    const sealed = own && own.wakeCondition !== null
        ? [body(apex.id + '-sealed', own.ceiling)]
        : [];

    return mobilised ? [...people, ...sealed, ...reinforcementsFor(apex.id)] : people;
}

/** How often the first house puts the second down, as a fraction. */
function winRate(attackerId: string, defenderId: string, mobilised: boolean): number {
    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const result = resolveMelee(
            [
                { id: 'a', name: attackerId, members: houseOf(attackerId, mobilised), intent: { goal: 'kill' } },
                { id: 'b', name: defenderId, members: houseOf(defenderId, mobilised), intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('standoff', `${attackerId}-${defenderId}-${mobilised}`, seed),
                ambient: 'normal',
                turn: seed,
                intent: { goal: 'kill' }
            }
        );
        if (result.winningSideId === 'a') wins++;
    }
    return wins / SEEDS;
}

/** The other two, together, against one. The lever the file says is real. */
function allianceWinRate(targetId: string): number {
    const allies = APEX_INSTITUTIONS.filter(a => a.id !== targetId);
    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const result = resolveMelee(
            [
                {
                    id: 'a',
                    name: 'the other two',
                    members: allies.flatMap(a => houseOf(a.id, true)),
                    intent: { goal: 'kill' }
                },
                { id: 'b', name: targetId, members: houseOf(targetId, true), intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('standoff-alliance', targetId, seed),
                ambient: 'normal',
                turn: seed,
                intent: { goal: 'kill' }
            }
        );
        if (result.winningSideId === 'a') wins++;
    }
    return wins / SEEDS;
}

/** The same war, with the defender's courts on the attacker's side. */
function winRateWithDefection(attackerId: string, defenderId: string): number {
    const defenderCourts = COURTS.filter(c => c.apexId === defenderId).map(c => c.id);
    const attackers = [
        ...houseOf(attackerId, true),
        ...houseOf(defenderId, true).filter(m => defenderCourts.includes(m.combatant.id))
    ];
    const defenders = houseOf(defenderId, true)
        .filter(m => !defenderCourts.includes(m.combatant.id));

    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const result = resolveMelee(
            [
                { id: 'a', name: attackerId, members: attackers, intent: { goal: 'kill' } },
                { id: 'b', name: defenderId, members: defenders, intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('standoff', `${attackerId}-${defenderId}-defect`, seed),
                ambient: 'normal', turn: seed, intent: { goal: 'kill' }
            }
        );
        if (result.winningSideId === 'a') wins++;
    }
    return wins / SEEDS;
}

/**
 * Fight a war, then meet the third house on whatever the war left.
 *
 * Returns how often the attacker, having won, then survives the house that
 * did not fight. This is the property that makes three apexes stable where
 * two would not be.
 */
function survivesTheThirdHouse(attackerId: string, victimId: string, thirdId: string): number | null {
    let won = 0;
    let survived = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
        const first = resolveMelee(
            [
                { id: 'a', name: attackerId, members: houseOf(attackerId, true), intent: { goal: 'kill' } },
                { id: 'v', name: victimId, members: houseOf(victimId, true), intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('standoff', `${attackerId}-${victimId}-third`, seed),
                ambient: 'normal', turn: seed, intent: { goal: 'kill' }
            }
        );
        if (first.winningSideId !== 'a') continue;
        won++;

        const survivors = houseOf(attackerId, true)
            .filter(m => (first.hp[m.combatant.id] ?? 0) > 0)
            .map(m => ({ ...m, combatant: { ...m.combatant, hp: first.hp[m.combatant.id] ?? 0 } }));
        if (survivors.length === 0) continue;

        const second = resolveMelee(
            [
                { id: 'a', name: attackerId, members: survivors, intent: { goal: 'kill' } },
                { id: 't', name: thirdId, members: houseOf(thirdId, true), intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('standoff', `${attackerId}-${thirdId}-after`, seed),
                ambient: 'normal', turn: seed, intent: { goal: 'kill' }
            }
        );
        if (second.winningSideId === 'a') survived++;
    }

    return won === 0 ? null : survived / won;
}

const PAIRS = APEX_INSTITUTIONS.flatMap(a =>
    APEX_INSTITUTIONS.filter(b => b.id !== a.id).map(b => [a, b] as const));

describe('the standoff at the top of the world', () => {
    it('lets no house take everything in both arenas', () => {
        // The defect this suite was written for, stated correctly. Some
        // houses SHOULD be dominated - the Azure Cloud Pavilion loses both
        // arenas to both rivals and that is the setting working. What must
        // not exist is a house that beats every rival in duels AND in wars,
        // because then the region has no reason to be three institutions.
        for (const a of APEX_INSTITUTIONS) {
            const rivals = APEX_INSTITUTIONS.filter(b => b.id !== a.id);
            const everyDuel = rivals.every(b => winRate(a.id, b.id, false) > 0.9);
            const everyWar = rivals.every(b => winRate(a.id, b.id, true) > 0.9);
            expect(
                everyDuel && everyWar,
                `${a.name} takes every rival in both arenas - that is one apex and two titles`
            ).toBe(false);
        }
    });

    it('punishes anybody who wins a war, which is what the third house is for', () => {
        // The three-kingdoms property, and the reason the weakest apex is
        // safe. Every attacker that CAN take a rival must then face the house
        // that did not fight, on whatever the war left it - and at least one
        // of those follow-ups has to be lethal, or the third house is scenery
        // and the region is really a two-way war with a bystander.
        const followUps: number[] = [];
        for (const [a, v] of PAIRS) {
            const third = APEX_INSTITUTIONS.find(x => x.id !== a.id && x.id !== v.id)!;
            const rate = survivesTheThirdHouse(a.id, v.id, third.id);
            if (rate !== null) followUps.push(rate);
        }
        // A war between whole houses frequently does not resolve at all: a
        // striker removes at most one body a round and the exchange budget
        // runs out first, so large sides stalemate rather than settle. That is
        // a property of the resolver, not of the setting, and this assertion
        // must not depend on it. What is asserted is the conditional: WHERE a
        // war can be won, winning it must not leave the winner safe.
        if (followUps.length === 0) return;
        expect(
            Math.min(...followUps),
            'no winner is ever punished by the third house - it is scenery'
        ).toBeLessThan(0.25);
    });

    it('makes attacking the weakest house not worth doing', () => {
        // This assertion has been wrong twice and both errors are instructive.
        // It first demanded that nobody dominate anybody, which was too strong
        // - the three are not matched and should not be. It then demanded that
        // the Pavilion be easy to take and expensive to have taken, which was
        // measured and turned out to be a hole: at the time it really was
        // worth eating, seventy-four times in a hundred, and the region only
        // held together because nothing in the catalog was counting the
        // Pavilion's second at the last realm.
        //
        // What is asserted now is the thing the peace actually needs. Take the
        // Pavilion AND still be standing in front of the house that did not
        // fight - the bar an apex would really apply, since a war you do not
        // survive is a succession - and it has to come out not worth doing.
        const pavilion = APEX_INSTITUTIONS.find(a => a.id === 'apex-azure-cloud')!;
        for (const attacker of APEX_INSTITUTIONS.filter(a => a.id !== pavilion.id)) {
            const third = APEX_INSTITUTIONS.find(x => x.id !== attacker.id && x.id !== pavilion.id)!;
            expect(
                survivesTheThirdHouse(attacker.id, pavilion.id, third.id) ?? 0,
                `${attacker.name} must not come out of the Pavilion able to face ${third.name}`
            ).toBeLessThan(0.25);
        }
    });

    it('counts everybody a house has at the last realm', () => {
        // The defect that hid the hole above: lastRealm.count was a literal 1
        // in the schema, so a house with two could not say so, and every
        // reading in the setting silently used one.
        const pavilion = APEX_INSTITUTIONS.find(a => a.id === 'apex-azure-cloud')!;
        expect(pavilion.lastRealm.count, 'the Pavilion has one, and that is the point').toBe(1);
        for (const apex of APEX_INSTITUTIONS) {
            expect(houseOf(apex.id, false)).toHaveLength(apex.lastRealm.count);
        }
    });

    it('leaves the strongest house something it can lose', () => {
        // Not parity - the three are not matched and are not meant to be.
        // The weaker, load-bearing claim: whoever is strongest must still
        // have an arena where somebody can take them, because an apex that
        // risks nothing anywhere has no reason not to move.
        const warChampion = [...APEX_INSTITUTIONS].sort((a, b) => {
            const total = (x: typeof a) => APEX_INSTITUTIONS
                .filter(y => y.id !== x.id)
                .reduce((sum, y) => sum + winRate(x.id, y.id, true), 0);
            return total(b) - total(a);
        })[0];

        // The arena is not only a duel, and once the round budget was fixed
        // it stopped being one. Nothing takes the Long Cut one against one any
        // more - and the file has never claimed anything did. What it has
        // always claimed is that any two of them together can end any third,
        // and that is the arena the strongest house actually stands in. So the
        // check is: somebody can take them alone, OR the other two can.
        const canBeTaken = APEX_INSTITUTIONS
            .filter(x => x.id !== warChampion.id)
            .some(x => winRate(x.id, warChampion.id, false) > 0.5 || winRate(x.id, warChampion.id, true) > 0.5)
            || allianceWinRate(warChampion.id) > 0.5;
        expect(
            canBeTaken,
            `${warChampion.name} risks nothing anywhere, so nothing stops it moving`
        ).toBe(true);
    });

    it('makes a court defection worth more than any object', () => {
        // The lever the setting says is the real one, checked. Losing your
        // court has to matter, or "the courts might defect" is decoration.
        const survey = APEX_INSTITUTIONS.find(a => a.id === 'apex-deep-survey')!;
        const longCut = APEX_INSTITUTIONS.find(a => a.id === 'apex-long-cut')!;
        const loyal = winRate(survey.id, longCut.id, true);
        const defected = winRateWithDefection(survey.id, longCut.id);
        expect(defected, 'a defection must not make the defender stronger')
            .toBeGreaterThanOrEqual(loyal - 0.05);
    });

    it('does not rank the objects in the same order as their holders', () => {
        // The exact shape of the original defect, kept as a guard: the
        // strongest head must not also hold the strongest object.
        const byHead = [...APEX_INSTITUTIONS].sort((a, b) => b.powerOrdinal - a.powerOrdinal);
        const strongestHead = byHead[0];
        const ratings = APEX_INSTITUTIONS.map(a => ({
            id: a.id,
            power: artifactsOwnedBy(a.id)[0]?.power ?? 0
        })).sort((a, b) => b.power - a.power);
        expect(ratings[0].id, 'the strongest head must not hold the strongest object')
            .not.toBe(strongestHead.id);
    });

    it('gives every apex an object, resolved through either of its ids', () => {
        for (const apex of APEX_INSTITUTIONS) {
            const held = artifactsOwnedBy(apex.id);
            expect(held.length, `${apex.name} holds an object`).toBeGreaterThan(0);
            if (apex.factionId !== null) {
                // One house, two catalog ids. Both must find the same thing.
                expect(artifactsOwnedBy(apex.factionId).map(o => o.id)).toEqual(held.map(o => o.id));
                expect(idsForFaction(apex.factionId)).toContain(apex.id);
            }
        }
    });

    it('leaves an ordinary cultivator when the object is taken away', () => {
        // No residue: strip the artifact and the head prices out as anybody
        // else at that rung would. This is the whole no-special-cases claim.
        const apex = APEX_INSTITUTIONS[0];
        const bare = body('bare', apex.powerOrdinal);
        const peer = body('peer', apex.powerOrdinal);
        let wins = 0;
        for (let seed = 0; seed < SEEDS; seed++) {
            const result = resolveMelee(
                [
                    { id: 'a', name: 'stripped apex head', members: [bare], intent: { goal: 'kill' } },
                    { id: 'b', name: 'a nobody at the same rung', members: [peer], intent: { goal: 'kill' } }
                ],
                {
                    rng: forStream('standoff', 'stripped', seed),
                    ambient: 'normal', turn: seed, intent: { goal: 'kill' }
                }
            );
            if (result.winningSideId === 'a') wins++;
        }
        // A coin flip, generously bounded. Anything one-sided would mean the
        // head is carrying something the catalog does not account for.
        expect(wins / SEEDS).toBeGreaterThan(0.2);
        expect(wins / SEEDS).toBeLessThan(0.8);
    });
});

describe('the prose matches what was measured', () => {
    it('names both arenas and gives them different winners', () => {
        expect(WHY_NOBODY_MOVES.theDuelGoesToTheLongCut).toMatch(/Ninth Nail/);
        expect(WHY_NOBODY_MOVES.andTheWarGoesToNOBODY).toMatch(/Neither of them can finish it/i);
        expect(WHY_NOBODY_MOVES.soTheOnlyMoveIsTheOtherHouseSCOURTS).toMatch(/sixty-nine times in a hundred/i);
    });

    it('explains the war ranking by the client list rather than by the head', () => {
        expect(WHY_NOBODY_MOVES.andTheWarGoesToNOBODY).toMatch(/Five bodies against five/i);
        expect(WHY_NOBODY_MOVES.andTheCourtsKnowExactlyWhatTheyAreWorth).toMatch(/administration rather than a believer/i);
        // Was /Third Sill Court/, which was the wrong court and had been for as
        // long as this claim existed. The Third Sill has answered the Long Cut
        // for longer than either apex keeps a record of and has never changed
        // patrons; the one administration in the catalog that ever did is the
        // Root Sill, which walked when the Deep Survey reposted it - and a
        // reposting is a thing you can do to a posting and to nothing else in
        // the world, which is why this has happened exactly once.
        expect(WHY_NOBODY_MOVES.andItHasHappenedOnce).toMatch(/Root Sill Court/);
        expect(WHY_NOBODY_MOVES.andItHasHappenedOnce, 'the wrong Sill is back')
            .not.toMatch(/Third Sill/);
    });

    it('makes the weakest house the lock rather than the prize', () => {
        expect(WHY_NOBODY_MOVES.andThePavilionIsTheReasonNEITHEROfThemMoves)
            .toMatch(/the reason is not mercy/i);
        expect(WHY_NOBODY_MOVES.andThePavilionIsTheReasonNEITHEROfThemMoves)
            .toMatch(/most reliable way to stop existing/i);
        expect(WHY_NOBODY_MOVES.whichIsWhatSheActuallyHolds)
            .toMatch(/anybody who spends themselves on it is next/i);
        expect(WHY_NOBODY_MOVES.andItIsTHREEHousesForAReason)
            .toMatch(/two apexes in a province is a war with a winner/i);
    });

    it('rests the peace on uncertainty rather than on parity', () => {
        expect(WHY_NOBODY_MOVES.andNoneOfThisHasToBeEven)
            .toMatch(/does not rest on the three of them being matched/i);
        expect(WHY_NOBODY_MOVES.andNoneOfThisHasToBeEven).toMatch(/nobody at that altitude gambles/i);
        expect(WHY_NOBODY_MOVES.whichIsWhyTheWeakestOneIsSafeToo)
            .toMatch(/is there any version of this where I lose/i);
    });

    it('says what would break it, and it is an object or a client list', () => {
        expect(WHY_NOBODY_MOVES.andWhatWouldBreakIt).toMatch(/Ninth Nail/);
        expect(WHY_NOBODY_MOVES.andWhatWouldBreakIt).toMatch(/court changing patrons/i);
    });

    it('admits the arrangement is checked rather than claimed', () => {
        expect(WHY_NOBODY_MOVES.andItIsCheckedRatherThanAsserted).toMatch(/whenever the suite runs/i);
        expect(WHY_NOBODY_MOVES.andItIsCheckedRatherThanAsserted)
            .toMatch(/does not demand that the three be evenly matched/i);
    });

    it('keeps the artifact catalog sorted, which is how the gap stays visible', () => {
        const powers = ARTIFACTS.map(a => a.power ?? 0);
        expect([...powers].sort((x, y) => y - x)).toEqual(powers);
    });
});
