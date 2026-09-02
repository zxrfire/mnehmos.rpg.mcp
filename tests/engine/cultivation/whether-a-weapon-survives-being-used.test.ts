/**
 * A weapon's grade decides whether it survives being used.
 *
 * The claims under test are the design's, in the order they bind: realm is an
 * absolute gate on unmaking, ability decides inside it, a weapon of your own
 * grade is fit, one far under the rung it is swung into is not, and the
 * distribution nobody wrote a rule for falls out of those.
 */

import { describe, it, expect } from 'vitest';
import {
    CERTAIN_ABOVE_REALMS,
    FIT_WITHIN_REALMS,
    FRAGMENTS_AT_OR_ABOVE,
    REALM_POWER_STEP,
    canUnmake,
    realmsBetween,
    resolveWeaponAgainstBody,
    weaponExposure
} from '../../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import {
    assessPower,
    combatPowerForOrdinal,
    resolveConfrontation,
    weaponAgainst,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { pillBandOrdinal } from '../../../src/engine/cultivation/breakthrough.js';
import { MAX_ORDINAL, OBJECT_CEILING_BELOW_THE_LID } from '../../../src/engine/cultivation/realms.js';
import { makeObject, ruin, isRuined, shardPower } from '../../../src/engine/world/possessions.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

const makeRNG = (seed: number | string) => forStream(String(seed), 'weapon-test');

const AMBIENT = { ambient: 'normal' as const };

function body(ordinal: number, extra: Partial<CombatantInput> = {}): CombatantInput {
    return {
        id: `body-${ordinal}`,
        name: `Somebody at ${ordinal}`,
        realmOrdinal: ordinal,
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, resolve: 2, fortune: 2 },
        injuries: [],
        hp: 100,
        maxHp: 100,
        qi: 100,
        maxQi: 100,
        ...extra
    } as CombatantInput;
}

function exposureOf(weaponPower: number, targetOrdinal: number, extra: Partial<CombatantInput> = {}) {
    return weaponAgainst(
        { id: 'w', name: 'a blade', power: weaponPower },
        assessPower(body(targetOrdinal, extra), AMBIENT)
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE GATE
// ═══════════════════════════════════════════════════════════════════════════

describe('realm is the gate on unmaking, and it is absolute', () => {
    it('a Qi Condensation cultivator cannot shatter a forty-six', () => {
        const reach = canUnmake(5, 46);
        expect(reach.reaches).toBe(false);
        // A refusal names its cause and names the rung that would not have been
        // refused. Both halves, or it is indistinguishable from a missing
        // feature.
        expect(reach.cause).toContain('46');
        expect(reach.needs).toBe(46);
    });

    it('nothing carried, rolled or brought gets past it', () => {
        // The best body in the world, whole, veteran and armed, standing at a
        // rung under the object. There is no probability here to improve.
        const e = exposureOf(46, 30, {
            attributes: { might: 3, insight: 4, resolve: 3, fortune: 3 },
            battlesSurvived: 40,
            artifactGrade: 5
        });
        expect(e.reach.reaches).toBe(false);
        expect(e.chance).toBe(0);
        expect(e.passiveChance).toBe(0);
    });

    it('is the making rule read backwards, not a second rule beside it', () => {
        // The medicine ladder gates refining by realm: a grade's band floor is
        // the rung an alchemist must reach. Unmaking asks the same question of
        // an object's own rung. Same predicate, two unit systems.
        for (const grade of ['mortal', 'earth', 'heaven', 'immortal'] as const) {
            const floor = pillBandOrdinal(grade);
            expect(canUnmake(floor, floor).reaches).toBe(true);
            expect(canUnmake(floor - 1, floor).reaches).toBe(false);
        }
    });

    it('leaves the immortal band unmakeable by anybody below the Lid', () => {
        // Not asserted anywhere. It falls out: the ceiling on what can be held
        // here is the highest rung anybody here stands at, so the band above it
        // is out of everyone's reach by the same arithmetic that puts it out of
        // reach to make.
        for (let rung = 0; rung <= OBJECT_CEILING_BELOW_THE_LID; rung++) {
            expect(canUnmake(rung, MAX_ORDINAL).reaches).toBe(false);
        }
    });

    it('and a forty-four cannot unmake a forty-five, which is why sent-down objects last', () => {
        expect(canUnmake(44, 45).reaches).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE ONE QUANTITY, AND NO TABLE
// ═══════════════════════════════════════════════════════════════════════════

describe('the odds are one subtraction on the ladder', () => {
    it('counts realms as the ladder counts them', () => {
        expect(REALM_POWER_STEP).toBe(4);
        expect(realmsBetween(REALM_POWER_STEP, 1)).toBeCloseTo(1, 10);
        expect(realmsBetween(REALM_POWER_STEP ** 3, 1)).toBeCloseTo(3, 10);
        // Negative when the weapon is the larger. One-sided by construction.
        expect(realmsBetween(1, REALM_POWER_STEP)).toBeCloseTo(-1, 10);
    });

    it('is monotone in the gap, with no step anywhere', () => {
        // The shape test. If a tenth case needed a branch, this would find the
        // branch as a discontinuity or an inversion.
        const seen: number[] = [];
        for (let target = 18; target <= 40; target++) seen.push(exposureOf(18, target).chance);
        for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
        expect(seen[0]).toBe(0);
        expect(seen[seen.length - 1]).toBe(1);
    });

    it('a weapon within a realm of what it meets is fit and does not break', () => {
        // The whole reason to carry a weapon at your own grade. Asserted across
        // the ladder rather than at one rung, because a fit weapon must be fit
        // everywhere or the claim is a coincidence at one band.
        for (const rung of [4, 12, 18, 22, 26, 30, 34, 38, 41]) {
            const e = exposureOf(rung, rung);
            expect(e.realmsInFull, `rung ${rung}`).toBeLessThan(FIT_WITHIN_REALMS);
            expect(e.chance, `rung ${rung}`).toBe(0);
        }
    });

    it('two realms under what it is swung into and it is not a chance', () => {
        // The design owner's own example: swing at somebody two realms above
        // and they shatter it. Two realms is also `HELPLESS_REALM_GAP`, which
        // is the calibration rather than a coincidence.
        const e = exposureOf(18, 29);
        expect(e.realmsInFull).toBeGreaterThan(CERTAIN_ABOVE_REALMS);
        expect(e.chance).toBe(1);
    });

    it('a Tribulation Transcender who brought a bad weapon brought nothing', () => {
        expect(exposureOf(4, 41).chance).toBe(1);
        expect(exposureOf(18, 41).chance).toBe(1);
        // And one within a realm of the fight is adequate, which is what makes
        // "of your grade or higher" a real preference rather than a slogan.
        expect(exposureOf(38, 41).chance).toBe(0);
    });

    it('names the rung that would have held, and says when none would', () => {
        const e = exposureOf(18, 33);
        expect(e.heldAt).not.toBeNull();
        expect(e.heldAt!).toBeGreaterThan(18);
        expect(e.cause).toContain(String(e.heldAt));
        // Standing far enough above anything holdable and the honest answer is
        // that nothing in this world would have survived it.
        const hopeless = exposureOf(4, MAX_ORDINAL);
        expect(hopeless.heldAt).toBeGreaterThan(OBJECT_CEILING_BELOW_THE_LID);
        expect(hopeless.cause).toContain('Nothing that can be held in this world');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ABILITY DECIDES INSIDE THE GATE
// ═══════════════════════════════════════════════════════════════════════════

describe('inside what a realm reaches, ability decides', () => {
    it('two cultivators at the same rung are not equally likely to break the same blade', () => {
        const hurt = exposureOf(18, 21, {
            attributes: { might: 1, insight: 1, resolve: 1, fortune: 1 },
            hp: 30,
            qi: 5
        });
        const whole = exposureOf(18, 21, {
            attributes: { might: 3, insight: 4, resolve: 3, fortune: 3 },
            battlesSurvived: 40,
            artifactGrade: 5
        });
        expect(hurt.reach.reaches).toBe(true);
        expect(whole.reach.reaches).toBe(true);
        expect(whole.chance).toBeGreaterThan(hurt.chance);
        // And the weak one does not break it at all, which is the point: a
        // superior opponent is not a machine that deletes your equipment.
        expect(hurt.chance).toBe(0);
    });

    it('the passive reading is the body alone, and it moves when the body does', () => {
        const plain = exposureOf(18, 25);
        expect(plain.bodyAlone).toBe(true);
        expect(plain.carriedBy).toBe('');
        // Give them something that is not their body and the extra is theirs.
        const armed = exposureOf(18, 22, { artifactGrade: 5, battlesSurvived: 40 });
        expect(armed.chance).toBeGreaterThan(armed.passiveChance);
        expect(armed.bodyAlone).toBe(false);
        expect(armed.carriedBy).not.toBe('');
        expect(armed.cause).toContain(armed.carriedBy);
    });

    it('the passive case takes no roll at all, and a fit weapon takes none either', () => {
        const rng = makeRNG(1234);
        const certain = resolveWeaponAgainstBody(
            {
                weaponPower: 4,
                weaponStanding: combatPowerForOrdinal(4),
                metBy: combatPowerForOrdinal(41),
                metByBodyAlone: combatPowerForOrdinal(41),
                metByOrdinal: 41
            },
            rng
        );
        expect(certain.broke).toBe(true);
        expect(certain.roll).toBeNull();

        const fit = resolveWeaponAgainstBody(
            {
                weaponPower: 41,
                weaponStanding: combatPowerForOrdinal(41),
                metBy: combatPowerForOrdinal(41),
                metByBodyAlone: combatPowerForOrdinal(41),
                metByOrdinal: 41
            },
            rng
        );
        expect(fit.broke).toBe(false);
        expect(fit.roll).toBeNull();
    });

    it('and rolls exactly once when the answer is genuinely in doubt', () => {
        const input = {
            weaponPower: 18,
            weaponStanding: combatPowerForOrdinal(18),
            metBy: combatPowerForOrdinal(24),
            metByBodyAlone: combatPowerForOrdinal(24),
            metByOrdinal: 24
        };
        const e = weaponExposure(input);
        expect(e.chance).toBeGreaterThan(0);
        expect(e.chance).toBeLessThan(1);

        // Over many seeds the rate is the reported chance, which is the whole
        // claim of showing a player the number before they swing.
        let broke = 0;
        const runs = 4000;
        for (let seed = 0; seed < runs; seed++) {
            if (resolveWeaponAgainstBody(input, makeRNG(seed)).broke) broke++;
        }
        expect(broke / runs).toBeCloseTo(e.chance, 1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. WHAT IS LEFT
// ═══════════════════════════════════════════════════════════════════════════

describe('everything below the immortal grade is ruined, not shattered', () => {
    it('mints no fragments for anything anybody down here can swing', () => {
        for (const rung of [4, 9, 14, 18, 22, 26, 29, 34, 38, 41, 43, 44]) {
            const out = resolveWeaponAgainstBody(
                {
                    weaponPower: rung,
                    weaponStanding: combatPowerForOrdinal(rung),
                    metBy: combatPowerForOrdinal(MAX_ORDINAL) * 1000,
                    metByBodyAlone: combatPowerForOrdinal(MAX_ORDINAL) * 1000,
                    metByOrdinal: MAX_ORDINAL
                },
                makeRNG(1)
            );
            expect(out.broke, `rung ${rung}`).toBe(true);
            expect(out.leavesFragments, `rung ${rung}`).toBe(false);
            expect(out.fragmentPower, `rung ${rung}`).toBeNull();
            expect(out.narrationHint).toContain('The record of it stands');
        }
    });

    it('and a forty-six leaves forty-fives, which is the world\'s one recorded case', () => {
        const out = resolveWeaponAgainstBody(
            {
                weaponPower: MAX_ORDINAL,
                weaponStanding: combatPowerForOrdinal(MAX_ORDINAL),
                metBy: combatPowerForOrdinal(MAX_ORDINAL) * 1000,
                metByBodyAlone: combatPowerForOrdinal(MAX_ORDINAL) * 1000,
                metByOrdinal: MAX_ORDINAL
            },
            makeRNG(1)
        );
        expect(out.broke).toBe(true);
        expect(out.leavesFragments).toBe(true);
        expect(out.fragmentPower).toBe(OBJECT_CEILING_BELOW_THE_LID);
        expect(out.fragmentPower).toBe(shardPower(MAX_ORDINAL));
        expect(FRAGMENTS_AT_OR_ABOVE).toBeLessThanOrEqual(MAX_ORDINAL);
    });

    it('spent is not gone: a ruined object keeps its row, its owner and its history', () => {
        const blade = makeObject({
            id: 'artifact-a-sword-elders-tally',
            name: "A Sword Elder's Tally",
            kind: 'artifact',
            significance: 'significant',
            power: 16,
            ownerId: 'sect-azure-cloud-pavilion',
            ownerName: 'The Azure Cloud Pavilion',
            possessorId: 'npc-somebody',
            provenance: [{
                onDay: 10, holderId: 'npc-somebody', holderName: 'Somebody', how: 'awarded',
                source: 'the office', previousHolderId: null, previousHolderName: null,
                factId: null, note: ''
            }]
        });

        const after = ruin(blade, { onDay: 400, source: 'swung at somebody three realms above' });

        expect(isRuined(after)).toBe(true);
        expect(after.possessorId).toBeNull();
        expect(after.power).toBeNull();
        // The parts that must survive being destroyed.
        expect(after.id).toBe(blade.id);
        expect(after.name).toBe(blade.name);
        expect(after.ownerId).toBe('sect-azure-cloud-pavilion');
        expect(after.provenance).toHaveLength(2);
        expect(after.provenance[0]).toEqual(blade.provenance[0]);
        expect(after.provenance[1].previousHolderId).toBe('npc-somebody');
        expect(after.provenance[1].source).toContain('three realms above');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. THROUGH A FIGHT
// ═══════════════════════════════════════════════════════════════════════════

describe('through the resolver a player actually reaches', () => {
    it('a weapon far under the rung it is swung into does not come home', () => {
        const result = resolveConfrontation(
            body(29, { weapon: { id: 'artifact-notched-sabre', name: 'A Notched Sabre', power: 4 } }),
            body(30),
            { rng: makeRNG(7), ambient: 'normal', turn: 1, intent: { goal: 'drive_off' } }
        );
        expect(result.brokenObjects.length).toBeGreaterThan(0);
        const [gone] = result.brokenObjects;
        expect(gone.broke.objectId).toBe('artifact-notched-sabre');
        expect(gone.carrierId).toBe('body-29');
        expect(gone.breakerId).toBe('body-30');
        expect(gone.broke.leavesFragments).toBe(false);
    });

    it('the same fight with a weapon of the right grade keeps it', () => {
        const result = resolveConfrontation(
            body(29, { weapon: { id: 'artifact-a-good-blade', name: 'A Good Blade', power: 29 } }),
            body(30),
            { rng: makeRNG(7), ambient: 'normal', turn: 1, intent: { goal: 'drive_off' } }
        );
        expect(result.brokenObjects).toHaveLength(0);
        // And it was worth something while it was there.
        const armed = assessPower(
            body(29, { weapon: { id: 'x', name: 'A Good Blade', power: 29 } }),
            AMBIENT
        );
        expect(armed.total).toBeGreaterThan(assessPower(body(29), AMBIENT).total);
    });

    it('losing it mid-fight makes them weaker for the rest of it', () => {
        // "Bring a dogshit weapon and you brought nothing" has to be true after
        // the first exchange as well as before it.
        const result = resolveConfrontation(
            body(29, { weapon: { id: 'artifact-notched-sabre', name: 'A Notched Sabre', power: 4 } }),
            body(30),
            { rng: makeRNG(11), ambient: 'normal', turn: 1, intent: { goal: 'drive_off' } }
        );
        expect(result.brokenObjects.length).toBeGreaterThan(0);
        // The aggressor is re-priced without it, so their line reads as bare.
        const artifacts = result.aggressor.factors.find(f => f.source === 'artifacts');
        expect(artifacts?.note).toContain('Carrying nothing graded');
        expect(result.aggressor.weapon).toBeNull();
    });

    it('swinging at somebody two realms above is refused AND costs the sword', () => {
        // The gap being categorical is a statement about what the aggressor can
        // do to the defender. It says nothing about what the defender's body
        // does to the metal, and the owner's headline example is exactly this.
        const result = resolveConfrontation(
            body(18, { weapon: { id: 'artifact-a-fair-blade', name: 'A Fair Blade', power: 18 } }),
            body(29),
            { rng: makeRNG(3), ambient: 'normal', turn: 1, intent: { goal: 'kill' } }
        );
        expect(result.outcome).toBe('no_contest');
        expect(result.brokenObjects).toHaveLength(1);
        expect(result.narrationHint).toContain('A Fair Blade');
    });

    it('and a caller that names no weapon has nothing at risk anywhere', () => {
        const result = resolveConfrontation(
            body(18),
            body(29),
            { rng: makeRNG(3), ambient: 'normal', turn: 1, intent: { goal: 'kill' } }
        );
        expect(result.brokenObjects).toHaveLength(0);
        for (const x of result.exchanges) expect(x.result.weapon).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. THE DISTRIBUTION IS A CONSEQUENCE, NOT A RULE
// ═══════════════════════════════════════════════════════════════════════════

describe('nothing anywhere says who may hold what', () => {
    it('prices a great object in a weak hand without complaint', () => {
        // A Core Formation cultivator carrying a forty-five is legal, priced,
        // and enormously strong. The reason it does not happen is that somebody
        // stronger wants it - which is a fact about the world, not a branch.
        const weakHand = assessPower(
            body(18, { weapon: { id: 'sent-ninth-nail', name: 'The Ninth Nail', power: 45 } }),
            AMBIENT
        );
        expect(weakHand.weapon?.power).toBe(45);
        expect(weakHand.total).toBeGreaterThan(assessPower(body(18), AMBIENT).total * 100);
    });

    it('and the object is never at risk in that hand from anybody who could want it', () => {
        // The self-enforcing half. A forty-five cannot be unmade by anyone below
        // the Lid, so the way it leaves a weak holder is robbery rather than
        // breakage - which is the whole reason it is worth coming for.
        for (let rung = 0; rung <= OBJECT_CEILING_BELOW_THE_LID - 1; rung++) {
            expect(canUnmake(rung, 45).reaches, `rung ${rung}`).toBe(false);
        }
    });
});
