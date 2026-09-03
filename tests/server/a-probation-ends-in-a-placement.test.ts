/**
 * The Azure intake, end to end, as a PROCESS rather than as four functions.
 *
 * Somebody walks up at the floor, is taken onto the roll, is carried, and is
 * placed - or is not, and is turned out or kept on. Every step below goes
 * through the tool surface, because the defect this whole change exists to fix
 * was that the design was complete, well written, and read by nothing in the
 * running game.
 *
 * `AZURE_INTAKE` in `src/data/cultivation/sects.ts` is the specification, and
 * `guestWouldBeOfferedAPlace` - "the payoff for the whole arrangement" - had
 * no caller anywhere in `src/` before this. So a unit test on the sort would
 * have been the same class of artefact it was replacing.
 *
 * Time is moved with `ADMIN advance_days`, which runs the real simulation:
 * the body ages, the belly empties, the stagnation clock runs and the death
 * checks fire. Rank is moved with `ADMIN set_realm`, which goes through
 * `advanceRealm` like every other rank change. Both are arranging a
 * precondition, which is what the admin surface is for; neither asserts an
 * outcome.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { adminResult } from '../../src/server/consolidated/admin-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../src/schema/cultivation.js';
import { guestTermYears } from '../../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const PAVILION = 'sect-azure-cloud-pavilion';
const MIST = 'sect-azure-mist-court';
const DEW = 'sect-azure-dew-sect';

const ctx = undefined;

function payload(res: { content: Array<{ text?: string }> }): any {
    const text = res.content[0]?.text ?? '{}';
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (a: Record<string, unknown>) =>
    payload(await handleCultivationManage(a, ctx));
const sect = async (a: Record<string, unknown>) => payload(await handleSectManage(a, ctx));
const admin = async (a: Record<string, unknown>) => (await adminResult(a)) as any;

function hearOf(cultivatorId: string, factionId: string): void {
    const repos = ensureCultivationDb();
    const house = getSect(factionId)!;
    new KnowledgeGate(repos.db).learn({
        holderId: cultivatorId,
        kind: 'sect',
        id: house.id,
        name: house.name,
        onDay: 0,
        sourceKind: 'told',
        stage: 'named',
        statement: `${house.name} exists and is spoken of.`
    });
}

/** A nobody at the floor of the ladder, which is who this intake is for. */
async function aNobody(name: string, seed: string) {
    const made = await cultivation({
        action: 'create_cultivator', name, seed, location: 'Low Fall'
    });
    expect(made.error).toBeUndefined();
    expect(made.cultivator.realm.ordinal).toBe(0);
    hearOf(made.cultivator.id, PAVILION);
    // Provisions for the span, bought rather than wished away: `advance_days`
    // runs the real survival layer and an unprovisioned body stops the
    // simulation long before a probation is over. Stocking the purse is
    // arranging the precondition; nothing about the sort is touched by it.
    new CultivatorRepository(getDb()).update(made.cultivator.id, { spiritStones: 500_000 });
    return made.cultivator.id as string;
}

/**
 * Carry somebody for a span, the way the house does.
 *
 * The first years are real: `advance_days` runs the whole survival layer, so
 * the clock, the age and the belly all move through the same code the game
 * moves them through, and `probationOf` reads exactly what a played run would
 * put in front of it.
 *
 * The REST of a long probation is set rather than lived, and the reason is
 * cost rather than danger: a probation is thirty to fifty years and the sort
 * reads three columns, so living every year of one would buy the assertions
 * nothing they do not already get from three.
 *
 * ── WHAT THIS COMMENT USED TO SAY, AND WHY IT NO LONGER SAYS IT ──────────
 *
 * It used to record a finding: *"an unprovisioned idle body accumulates
 * untreated wounds at rather more than one a year and dies of qi deviation
 * inside eight - measured here, at ordinal 0, with rations paid for."* That was
 * a true measurement of a defect rather than a fact about the world. The time
 * skip rolled qi deviation against the calendar, so a guest the house was
 * CARRYING - doing nothing, by definition, because that is what a probation is
 * - tore their own meridians open while sitting still.
 *
 * The design owner has ruled otherwise: **a wound has a cause you can point
 * at.** Deviation is now the price of drawing qi and is not rolled on a body
 * that is not, which `DEVIATION_CHECK_DAYS` in `time-skip.ts` carries in full.
 * Measured again across all eight seeds here, three years at ordinal 0 with
 * rations paid: **zero wounds, zero interrupts, nobody below their opening HP.**
 *
 * So the lived stretch is three years again. It went to one for a day, while
 * the roll was still running - two of these seeds died inside three real years
 * once `advance_days` stopped truncating the span and hiding it.
 *
 * So the clock and the age are advanced directly for the remainder, which is
 * arranging a precondition. Nothing about the sort is touched: it reads the
 * run's elapsed days, the roll's start day and the cultivator's age, and all
 * three are the real columns.
 */
async function carryFor(id: string, years: number, restRungAt: number): Promise<void> {
    const repos = ensureCultivationDb();
    const cultivators = new CultivatorRepository(getDb());

    // Real time first, through the real simulation.
    const livedYears = Math.min(years, 3);
    const res = await admin({
        action: 'advance_days', cultivatorId: id, years: livedYears, rations: livedYears * 400
    });
    expect(res.error, JSON.stringify(res).slice(0, 400)).toBeUndefined();

    const remainder = years - livedYears;
    if (remainder <= 0) return;

    const run = repos.runs.getActiveRun(id)!;
    repos.runs.advanceDays(run.id, Math.round(remainder * 365));
    const now = cultivators.getById(id)!;
    cultivators.update(id, {
        age: now.age + remainder,
        // A rung along the way, because the stagnation allowance is real: a
        // span longer than it is not a probation, it is a death.
        realmOrdinal: Math.max(now.realmOrdinal, restRungAt),
        yearsAtCurrentRealm: 0
    });
}

async function standAt(id: string, ordinal: number): Promise<void> {
    const res = await admin({ action: 'set_realm', cultivatorId: id, ordinal });
    // Already there is the same state as put there, and `set_realm` says so
    // rather than moving nobody silently.
    if (res.error === 'already_at_ordinal') return;
    expect(res.error, JSON.stringify(res).slice(0, 300)).toBeUndefined();
    expect(new CultivatorRepository(getDb()).getById(id)!.realmOrdinal).toBe(ordinal);
}

describe('the Azure intake, walked from the floor', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
        process.env.ADMIN_MODE = 'true';
    });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('refuses a nobody membership, and the refusal names the door that is open', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-refusal');

        // The bar has not moved and does not move here. What changed is that
        // the refusal says what would work, which every refusal in this repo
        // is required to do - and before this it named a rung and stopped,
        // leaving somebody standing in front of the widest door in the setting
        // with no way to find it except by guessing the word "guest".
        const refused = await sect({ action: 'join', cultivatorId: id, sectId: PAVILION });
        expect(refused.error).toBe('below_admission_ordinal');
        expect(refused.publishedDoorAtOrdinal).toBe(0);
        expect(String(refused.message)).toMatch(/already open and needs no opening/);
    });

    it('takes them at the floor, on a roll that is not the house roll', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-entry');

        const taken = await sect({
            action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true
        });
        expect(taken.error).toBeUndefined();
        expect(taken.accepted).toBe(true);

        // Entered, and not a member. This is the distinction the whole
        // arrangement rests on: all of the exposure, none of the standing.
        const standing = await sect({ action: 'standing', cultivatorId: id });
        expect(standing.member).toBe(false);
        expect(standing.onProbation).toBe(true);
        expect(standing.probation.wherePlacementLeadsTo.map((p: any) => p.factionId))
            .toEqual([PAVILION, MIST, DEW]);

        // And no claim to protection, said before anything happens rather than
        // discovered afterwards.
        expect(String(JSON.stringify(taken.notOffered))).toMatch(/protection/i);
    });

    it('places somebody who crosses quickly at the terraces', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-exceptional');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });

        await carryFor(id, Math.max(2, guestTermYears(PAVILION) - 6), 1);
        await standAt(id, FOUNDATION_ORDINAL);

        const placed = await sect({ action: 'standing', cultivatorId: id });
        expect(placed.probationEnded).toBe(true);
        expect(placed.outcome).toBe('placed');
        expect(placed.band).toBe('exceptional');
        expect(placed.placedAtFactionId).toBe(PAVILION);

        // A member now, with a rung and a stipend, seated by the same rule a
        // walk-up is seated by.
        const after = await sect({ action: 'standing', cultivatorId: id });
        expect(after.member).toBe(true);
        expect(after.sect.id).toBe(PAVILION);
        expect(after.rank.stipendPerMonth).toBeGreaterThan(0);
    });

    it('sends somebody who crosses slowly down the gorge, and it is not a disgrace', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-promising');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });

        await carryFor(id, guestTermYears(PAVILION) + 8, 1);
        await standAt(id, FOUNDATION_ORDINAL);

        const placed = await sect({ action: 'standing', cultivatorId: id });
        expect(placed.probationEnded).toBe(true);
        expect(placed.band).toBe('promising');
        expect(placed.placedAtFactionId).toBe(MIST);
        expect(String(placed.narrationHint)).toMatch(/not a\s+disgrace/);

        const after = await sect({ action: 'standing', cultivatorId: id });
        expect(after.member).toBe(true);
        expect(after.sect.id).toBe(MIST);
    });

    it('keeps somebody who never crosses, at the menial rung, if they met the bar', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-kept');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });

        const bar = getSect(PAVILION)!.admissionOrdinal;
        await carryFor(id, stagnationYearsForOrdinal(0) + 4, bar + 2);
        await standAt(id, bar + 2);

        const judged = await sect({ action: 'standing', cultivatorId: id });
        expect(judged.probationEnded).toBe(true);
        expect(judged.outcome).toBe('kept');
        expect(judged.rankIndex).toBe(0);
        expect(judged.placedAtFactionId).toBe(PAVILION);

        // Kept on and NOT admitted. The seat is the menial rung whatever they
        // reached, because they did not cross - a washout is not promoted for
        // having got some of the way.
        const after = await sect({ action: 'standing', cultivatorId: id });
        expect(after.member).toBe(true);
        expect(after.rank.index).toBe(0);
    });

    it('turns out somebody who never reaches the bar at all', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-turned-out');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });

        const bar = getSect(PAVILION)!.admissionOrdinal;
        await carryFor(id, stagnationYearsForOrdinal(0) + 4, bar - 2);
        await standAt(id, bar - 2);

        const judged = await sect({ action: 'standing', cultivatorId: id });
        expect(judged.probationEnded).toBe(true);
        expect(judged.outcome).toBe('turned_out');
        expect(judged.placedAtFactionId).toBeNull();

        // Off the roll, on nobody's roll, and unaffiliated again.
        const after = await sect({ action: 'standing', cultivatorId: id });
        expect(after.member).toBe(false);
        expect(after.onProbation).toBeUndefined();
    });

    it('is decided once, and asking again does not re-decide it', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-idempotent');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });
        await carryFor(id, 6, 1);
        await standAt(id, FOUNDATION_ORDINAL);

        const first = await sect({ action: 'standing', cultivatorId: id });
        expect(first.probationEnded).toBe(true);
        const second = await sect({ action: 'standing', cultivatorId: id });
        expect(second.probationEnded).toBeUndefined();
        expect(second.member).toBe(true);
        const third = await sect({ action: 'guest', cultivatorId: id });
        expect(third.probation).toBeNull();
    });

    it('lets somebody placed down the gorge climb back out of it', async () => {
        const id = await aNobody('Shen Ruo', 'azure-intake-recall');
        await sect({ action: 'guest', cultivatorId: id, sectId: PAVILION, accept: true });
        await carryFor(id, guestTermYears(PAVILION) + 8, 1);
        await standAt(id, FOUNDATION_ORDINAL);

        const placed = await sect({ action: 'standing', cultivatorId: id });
        expect(placed.placedAtFactionId).toBe(MIST);

        // Nothing yet: the Mist's shelf still covers them.
        const before = await sect({ action: 'standing', cultivatorId: id });
        expect(before.recall).toBeNull();

        // Past what the Mist can teach, and the roll the Mist keeps says so.
        await standAt(id, 20);
        const due = await sect({ action: 'standing', cultivatorId: id });
        expect(due.recall).not.toBeNull();
        expect(due.recall.toFactionId).toBe(PAVILION);

        // And going up is not a defection: no roll at the door, because the
        // house below owes the terraces whoever the terraces ask for.
        hearOf(id, PAVILION);
        const up = await sect({ action: 'join', cultivatorId: id, sectId: PAVILION });
        expect(up.error).toBeUndefined();
        expect(up.joined).toBe(true);
        expect(up.recalled).not.toBeNull();
        expect(up.recalled.fromFactionId).toBe(MIST);
    });
});
