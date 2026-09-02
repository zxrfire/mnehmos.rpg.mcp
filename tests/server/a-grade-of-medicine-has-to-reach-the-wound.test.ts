/**
 * The pill path and the physician now answer the same question the same way.
 *
 * ── THE DEFECT, AS PLAYED ────────────────────────────────────────────────
 *
 * `GameService.treat` consulted `what-grade-of-medicine-a-wound-needs.ts` and
 * refused a crippling tear in as many words. One turn later a 60-stone MORTAL
 * Clear Meridian Pill closed the same wound, because `treat_injury` in
 * `alchemy-manage.ts` called `treatWorstInjury` with no `reaches` predicate and
 * nothing else. The game held two positions on one question and the cheaper one
 * won. That is why the run that found it survived.
 *
 * ── WHAT IS ASSERTED HERE ────────────────────────────────────────────────
 *
 * That the gate binds, that it costs rather than bans, and that the refusal
 * names what would work. AGENTS.md is specific about the third: the fix is a
 * price, a consequence, or a refusal that names its cause - never a removed
 * verb. The pill is still swallowed, the toxicity still lands, and the player
 * is told which medicine WOULD have closed it and on what terms.
 *
 * ── AND IT IS NOT THE OTHER LADDER ───────────────────────────────────────
 *
 * Nothing here is about who may REFINE a grade. That is
 * `who-can-refine-a-grade-of-medicine.ts`, answered by the alchemist's realm,
 * and it has its own file. A cultivator can be handed a pill they could never
 * have made; what this file asks is whether the pill reaches the wound.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { addToPouch, ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { getPill } from '../../src/data/cultivation/pills.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: Record<string, unknown>) => payload(await handleAlchemyManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

/** Mortal grade, sixty stones, and the pill that used to close everything. */
const CLEAR_MERIDIAN = 'pill-clear-meridian';
/** Heaven grade. The catalog's own answer to crippling damage. */
const MERIDIAN_REBIRTH = 'pill-meridian-rebirth';

describe('a mortal pill against a wound above it', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });
    afterEach(() => closeDb());

    async function aWoundedNovice(severity: 'serious' | 'crippling') {
        const created = await cultivation({
            action: 'create_cultivator',
            name: 'Torn',
            seed: 'grade-reaches-the-wound',
            location: 'Sweptground'
        });
        const id = created.cultivator.id as string;
        const repos = ensureCultivationDb();
        new CultivatorRepository(repos.db).addInjury(id, {
            severity,
            source: 'qi_deviation',
            description: 'A channel torn on a botched circulation.',
            sustainedOnTurn: 1,
            woundType: 'torn-meridian'
        });
        addToPouch(repos.db, id, CLEAR_MERIDIAN, 'pill', 1);
        return id;
    }

    it('still closes the wound it was always for', () => {
        // The half that must not regress. `items.md`: a wound that does not
        // block advancement is a survival problem and its medicine belongs at
        // the common end. A novice with an ordinary tear buys a pill and is
        // mended, exactly as before.
        return (async () => {
            const id = await aWoundedNovice('serious');
            const result = await alchemy({ action: 'consume_pill', pillId: CLEAR_MERIDIAN, cultivatorId: id });
            expect(result.error).toBeUndefined();
            expect(result.injuriesTreated.length).toBe(1);
            const stored = new CultivatorRepository(getDb()).getById(id)!;
            expect(stored.injuries.every(i => i.treated)).toBe(true);
        })();
    });

    it('does not close a crippling one, and the wound stays on the record', async () => {
        const id = await aWoundedNovice('crippling');
        const result = await alchemy({ action: 'consume_pill', pillId: CLEAR_MERIDIAN, cultivatorId: id });
        expect(result.error).toBeUndefined();
        expect(result.injuriesTreated.length).toBe(0);
        // Read from the database rather than from the summary. The narrator can
        // say things that did not happen; the row cannot.
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        expect(stored.injuries.filter(i => !i.treated).length).toBe(1);
    });

    it('charges for the attempt rather than forbidding it', async () => {
        // Agency: anybody may attempt anything and the engine says what it
        // cost. The pill is gone and the toxicity is on the body, which is the
        // price of having tried.
        const id = await aWoundedNovice('crippling');
        const result = await alchemy({ action: 'consume_pill', pillId: CLEAR_MERIDIAN, cultivatorId: id });
        expect(result.consumed).toBe(true);
        expect(result.toxicity.after).toBeGreaterThan(0);
        const held = await alchemy({ action: 'inventory', cultivatorId: id });
        expect(held.pills.some((p: any) => p.id === CLEAR_MERIDIAN)).toBe(false);
    });

    it('names the medicine that would have worked, and its terms', async () => {
        const id = await aWoundedNovice('crippling');
        const result = await alchemy({ action: 'consume_pill', pillId: CLEAR_MERIDIAN, cultivatorId: id });
        const said = String(result.applied);
        // Not "nothing to treat", which reads as "you had no wounds" to
        // somebody visibly carrying one.
        expect(said).not.toMatch(/^Nothing to treat/);
        expect(said).toContain(getPill(MERIDIAN_REBIRTH)!.name);
        expect(said).toMatch(/heaven/i);
        // And why it cannot simply be bought, which is the other half of a
        // refusal that names its cause.
        expect(said).toMatch(/favour owed|not bought|Nobody sells/i);
    });

    it('lets the heaven-grade medicine close it, so the ladder is a ladder', async () => {
        const id = await aWoundedNovice('crippling');
        addToPouch(ensureCultivationDb().db, id, MERIDIAN_REBIRTH, 'pill', 1);
        const result = await alchemy({ action: 'consume_pill', pillId: MERIDIAN_REBIRTH, cultivatorId: id });
        expect(result.error).toBeUndefined();
        expect(result.injuriesTreated.length).toBeGreaterThan(0);
        // The crippling tear specifically. A heaven-grade pill carries four
        // points of toxicity against a tolerance of three, so swallowing one
        // mints a poison injury in the same breath - which is the medicine
        // being expensive rather than the gate failing, and "every injury is
        // treated" would assert the wrong thing.
        const stored = new CultivatorRepository(getDb()).getById(id)!;
        const tear = stored.injuries.find(i => i.severity === 'crippling')!;
        expect(tear.treated).toBe(true);
    });
});
