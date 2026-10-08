/**
 * Live model care17, 2026-10-03: actual before/after injury rows were empty;
 * HP1 became25/30 after24 native care HP. Facts nevertheless said meridians
 * were where they were and the remaining damage was no longer a wound. The
 * model invented formerly raw meridians and residual damage from that input.
 * These are emitter-boundary controls using real repository sheets and native
 * grade-gated triage/persistence. HP1->25 is the measured resolved receipt
 * fixture, not a reimplementation or test of healing arithmetic. Existing care
 * suites test payment/time/provider/HP mechanics; actual model replay is still
 * needed. Zero wounds, unclosed actual wounds and native closed scars differ.
 * Meaningful baseline: zero-wound and unclosed-wound controls failed; actual
 * scar control passed. After the fact repair all 3 and 19 existing provider,
 * clinical receipt and offer controls pass (care17 root logs 20261003-02).
 * The required actual before sheet is the third argument. Old runtime code
 * ignores it and reaches the false-history assertions, rather than crashing
 * because an added first argument changed the original positional contract.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness';
import { factsForTreatment } from '../../src/web/facts';
import { defaultInjuryDescription, treatWorstInjuries, untreatedInjuryCount } from '../../src/engine/cultivation/injuries';
import { medicineReaches } from '../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs';
import type { InjurySeverity } from '../../src/schema/cultivation';

async function sheets(severities: InjurySeverity[]) {
    const h = makeGame({ seed: 'care17-fact-authority' });
    const opened = await h.game.newRun('The recorded patient');
    h.repos.cultivators.update(opened.cultivator.id, { maxHp: 30, hp: 1 });
    for (const severity of severities) h.repos.cultivators.addInjury(opened.cultivator.id,
        { severity, source: 'qi_deviation', sustainedOnTurn: opened.run.turn,
            description: defaultInjuryDescription(severity, 'qi_deviation') });
    const before = h.repos.cultivators.getById(opened.cultivator.id)!;
    const triage = treatWorstInjuries(before.injuries, 1,
        severity => medicineReaches('mortal', severity, before.realmOrdinal));
    const treated = triage.injuries.filter(i => i.treated && !before.injuries.find(old => old.id === i.id)!.treated);
    for (const row of treated) h.repos.cultivators.treatInjury(row.id, opened.run.turn + 1);
    // Explicit measured post-care bodily receipt; the facts do not heal anything.
    h.repos.cultivators.applyDeltas(before.id, { hp: 24 });
    const after = h.repos.cultivators.getById(before.id)!;
    const facts = factsForTreatment(after, { what: 'Splint and a month of care',
        note: 'Thirty days of care.', cashEach: 500, stonesEach: 5, stonesSpent: 1,
        days: 30, treated: treated.map(i => i.description),
        stillUntreated: untreatedInjuryCount(after.injuries), mended: 24 }, before);
    return { ...h, before, after, treated, facts };
}
it('a bodily course with zero wounds reports actual missing HP without invented meridian history', async () => {
    const h = await sheets([]);
    expect(h.before.injuries).toEqual([]); expect(h.after.injuries).toEqual([]);
    expect(h.after.hp).toBe(25); expect(h.after.maxHp).toBe(30);
    expect(h.facts.lines.join('\n')).toMatch(/No meridian wounds needed treatment/);
    expect(h.facts.lines.join('\n')).toMatch(/24 HP.*care itself/);
    expect(h.facts.lines.join('\n')).toMatch(/25 of 30 HP.*5 HP remains missing/);
    expect(h.facts.lines.join('\n')).not.toMatch(/scar tissue|meridians are where|not a wound any more|whole of why|permanent|raw/);
    h.db.close();
});
it('an actual wound beyond mortal medicine remains untreated without a false scar or closure', async () => {
    const h = await sheets(['crippling']);
    expect(h.treated).toHaveLength(0); expect(untreatedInjuryCount(h.after.injuries)).toBe(1);
    expect(h.facts.lines.join('\n')).toMatch(/No meridian wound was closed/);
    expect(h.facts.lines.join('\n')).toMatch(/1 still untreated/);
    expect(h.facts.lines.join('\n')).not.toMatch(/scar tissue|No meridian wounds needed|not a wound any more/);
    h.db.close();
});
it('scar facts belong only to native triage-closed rows and remaining wounds retain their count', async () => {
    const h = await sheets(['minor', 'serious']);
    expect(h.treated).toHaveLength(1); expect(untreatedInjuryCount(h.after.injuries)).toBe(1);
    expect(h.after.injuries.find(i => i.id === h.treated[0].id)!.treated).toBe(true);
    expect(h.facts.lines.join('\n')).toMatch(/Closed:.*scar tissue/);
    expect(h.facts.lines.join('\n')).toMatch(/1 still untreated/);
    expect(h.facts.lines.join('\n')).not.toMatch(/No meridian wounds needed|not a wound any more/);
    h.db.close();
});
