/**
 * THE ONE MEDICINE FOR A PERMANENT INJURY THAT A PLAYER CAN ACTUALLY TAKE.
 *
 * The ruling behind `severed-flesh`, on whether giving away a piece of yourself
 * should be permanent: people cannot grow arms back, that needs medicine,
 * expensive medicine, and permanent wounds occur at any band.
 *
 * WHAT THIS FILE USED TO PIN, AND WHAT OVERTURNED IT. It pinned a Limb Rebirth
 * Pill - a bespoke row naming `severed-flesh` and reaching nothing else -
 * written because `repairRefusalReason` said structural repair medicine answers
 * a structure that did not SET at a realm wall and refuses everything else. The
 * design owner overruled that premise: a repair dose answers every permanent
 * injury AT ITS RANK, and a second module doing the first one's job was the
 * defect rather than the fix. The pill is gone.
 *
 * WHAT IT PINS NOW IS THE RUNG ABOVE THAT LADDER, and that is why the file is
 * not deleted along with the pill. The four repair doses are institutional
 * objects that houses spend on their own people; no verb anywhere puts one in a
 * player's hand. The chaos rung IS reachable - it sits in a pouch, it is
 * refined from a recovered formula, and it is swallowed through this handler.
 * The design owner kept it deliberately, *"that one then has a point worth
 * keeping"*, because it reaches any rank and the price of that is that it picks
 * which injury it closes rather than the taker picking.
 *
 * So: somebody carrying one thing that does not close is certain of the
 * outcome, and the graded treat-injury ladder still cannot touch any of it at
 * any grade.
 *
 * Red-checked: letting the drawn medicine fall through to `treatWorstInjury`
 * fails the first and the third; giving the chaos row a `mends` list fails the
 * second.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { addToPouch, ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { getPillsByEffect } from '../../src/data/cultivation/pills.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: Record<string, unknown>) => payload(await handleAlchemyManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

/**
 * The chaos rung, read off the effect rather than named here. There is exactly
 * one, and `a-medicine-made-for-nothing-in-particular.test.ts` is the ratchet.
 */
const MEDICINE = getPillsByEffect('mends_what_will_not_close')[0]!;
/** The graded ladder's top rung, which must still refuse a permanent wound. */
const THE_GRADED_LADDERS_TOP_RUNG = 'pill-returning-spring';

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

    it('closes the one thing that does not close, on a body at the bottom of the ladder', async () => {
        const id = await aMaimedNovice('severed-flesh');
        const result = await alchemy({ action: 'consume_pill', pillId: MEDICINE.id, cultivatorId: id });
        expect(result.error).toBeUndefined();
        // Read off the row rather than the summary. A narrator can say things
        // that did not happen; the database cannot.
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        const maiming = stored.injuries.find(i => i.woundType === 'severed-flesh')!;
        expect(maiming.treated, 'the part was narrated back and never written back').toBe(true);
    });

    it('names no wound, so the one it closes is whichever one is there', async () => {
        // Made for nothing in particular, so there is no `mends` list to match
        // against: it closes ONE of whatever this body is carrying that does
        // not close. Being the only one is what makes the taker certain.
        expect(MEDICINE.mends ?? [], 'the chaos rung was given a wound to name').toEqual([]);
        const id = await aMaimedNovice('severed-meridian');
        const result = await alchemy({ action: 'consume_pill', pillId: MEDICINE.id, cultivatorId: id });
        expect(result.error).toBeUndefined();
        expect(result.consumed).toBe(true);
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        expect(stored.injuries.find(i => i.woundType === 'severed-meridian')!.treated).toBe(true);
    });

    it('is not reachable from the graded treat-injury ladder, at any grade', async () => {
        const id = await aMaimedNovice('severed-flesh');
        addToPouch(ensureCultivationDb().db, id, THE_GRADED_LADDERS_TOP_RUNG, 'pill', 1);
        const result = await alchemy({
            action: 'consume_pill',
            pillId: THE_GRADED_LADDERS_TOP_RUNG,
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
