/**
 * The legacy plague report at a reached settlement named nine dead people,
 * guaranteed a cure, and claimed a globally chosen house had sent nobody.
 * Neither a named death nor a house decision supported those statements.
 * The report remains a real interruption; actual plague/death/care readers
 * decide its consequences. A generated report only states the local report.
 */
import { expect, it } from 'vitest';
import { ENCOUNTERS } from '../../../src/data/cultivation/encounters';
import { resolveOccurrence } from '../../../src/engine/encounters/resolve';

it('a local plague report supplies no invented casualties or institutional decision', () => {
    const entry = ENCOUNTERS.find(row => row.id === 'enc-plague-village')!;
    const occurrence = resolveOccurrence({ entry, activity: 'travel', ordinal: 0,
        maxHp: 25, hp: 25, spiritStones: 61, absoluteDay: 2, dayOffset: 2,
        values: { place: 'The reached village', count: 9, loot: 'a pill', faction: 'The unrelated house' },
        grants: [], castIds: [], cast: [], outcome: 'landed' });
    expect(occurrence.event.summary).toBe('People at The reached village report an outbreak of plague.');
    expect(occurrence.interrupts).toBe(true);
});
