/**
 * THE ONE PERMANENT WOUND THAT HAS AN ANSWER, AND THE ONES THAT STILL DO NOT.
 *
 * The ruling behind this file, on whether giving away a piece of yourself
 * should be permanent: people cannot grow arms back, that needs medicine,
 * expensive medicine, and permanent wounds occur at any band. So `wounds.ts`
 * gained `severed-flesh` - a part taken out of a body, permanent at every rung
 * on the ladder - and the catalog gained the one thing that reaches it.
 *
 * ── WHY IT IS NOT `treat_injury`, AND WHY THAT MATTERS HERE ──────────────
 *
 * `treatWorstInjury` skips permanent wounds, and it has to: it picks by
 * SEVERITY, so a medicine that reached a permanent wound on a severity band
 * would reach a parted meridian and a rooted heart demon along with a missing
 * arm, and all three of those rows say in their own `treatment` that nothing
 * answers them. `regrow_flesh` matches the pill's `mends` list against the
 * wound key instead, so the pill row and the wound row have to agree before
 * anything happens.
 *
 * ── AND IT IS NOT THE MEDICINE THAT MENDS A BROKEN CULTIVATOR ────────────
 *
 * `structural-repair-medicine.ts` answers a structure that did not SET at a
 * realm wall - a foundation, a core, an infant soul. `repairRefusalReason`
 * turns away anything else in as many words. A body short an arm has a
 * structure that set perfectly well, so that subsystem was the wrong shelf and
 * a new medicine was made rather than that one stretched.
 *
 * What is asserted: the pill closes the wound it names, it is spent and does
 * nothing against a wound it does not name, and the graded ladder still cannot
 * touch a maiming.
 *
 * Red-checked: dropping `mends` off the pill fails the first; letting
 * `regrow_flesh` fall through to `treatWorstInjury` fails the second and the
 * third.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { addToPouch, ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { pillThatMends } from '../../src/data/cultivation/pills.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: Record<string, unknown>) => payload(await handleAlchemyManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

/** Read out of the catalog, never typed here. The wound names its own answer. */
const MEDICINE = pillThatMends('severed-flesh')!;
/** The graded ladder's top rung, which must still refuse a maiming. */
const SEVERED_MERIDIAN_RESTORATION = 'pill-severed-meridian-restoration';

describe('a part of the body, taken off and grown back', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });
    afterEach(() => closeDb());

    /**
     * A cultivator at the BOTTOM of the ladder carrying a permanent wound,
     * which is the whole point of the ruling: this used to be unreachable
     * below the immortal band.
     */
    async function aMaimedNovice(woundType: string) {
        const created = await cultivation({
            action: 'create_cultivator',
            name: 'Short',
            seed: 'a-part-grown-back',
            location: 'Burnt Earth'
        });
        const id = created.cultivator.id as string;
        const repos = ensureCultivationDb();
        new CultivatorRepository(repos.db).addInjury(id, {
            severity: 'crippling',
            source: 'other',
            description: 'A part of the body was taken out of it.',
            sustainedOnTurn: 1,
            woundType
        });
        addToPouch(repos.db, id, MEDICINE.id, 'pill', 1);
        return id;
    }

    it('closes the wound it names, on a body at the bottom of the ladder', async () => {
        const id = await aMaimedNovice('severed-flesh');
        const result = await alchemy({ action: 'consume_pill', pillId: MEDICINE.id, cultivatorId: id });
        expect(result.error).toBeUndefined();
        // Read off the row rather than the summary. A narrator can say things
        // that did not happen; the database cannot.
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        const maiming = stored.injuries.find(i => i.woundType === 'severed-flesh')!;
        expect(maiming.treated, 'the part was narrated back and never written back').toBe(true);
    });

    it('is spent and does nothing against a wound it does not name', async () => {
        // A parted meridian is authored as having no answer anywhere, and this
        // pill must not quietly become one. Agency: the attempt is allowed and
        // it costs.
        const id = await aMaimedNovice('severed-meridian');
        const result = await alchemy({ action: 'consume_pill', pillId: MEDICINE.id, cultivatorId: id });
        expect(result.error).toBeUndefined();
        expect(result.consumed).toBe(true);
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        expect(stored.injuries.find(i => i.woundType === 'severed-meridian')!.treated).toBe(false);
        // And it says what it does answer, rather than "nothing to treat" to
        // somebody visibly carrying a maiming.
        expect(String(result.applied)).toMatch(/Severed flesh/i);
    });

    it('is not reachable from the graded treat-injury ladder, at any grade', async () => {
        const id = await aMaimedNovice('severed-flesh');
        addToPouch(ensureCultivationDb().db, id, SEVERED_MERIDIAN_RESTORATION, 'pill', 1);
        const result = await alchemy({
            action: 'consume_pill',
            pillId: SEVERED_MERIDIAN_RESTORATION,
            cultivatorId: id
        });
        expect(result.error).toBeUndefined();
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        expect(
            stored.injuries.find(i => i.woundType === 'severed-flesh')!.treated,
            'a severity-graded medicine closed a permanent wound'
        ).toBe(false);
    });
});
