/**
 * Three played attacks produced four distinct wrongs in the committed-head
 * census. The extra bodily blood feud belonged to a person whose actual world
 * ending had left only a remnant. The resolver expected a surviving soul, but
 * the applied existence transition ended them. Dead people hold nothing; the
 * actual accounts held by their heirs and house must remain unchanged.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { obligationFromRow } from '../../src/storage/repos/obligation.repo';
import { whatTheirRecordMakesThem } from '../../src/engine/social-leverage/personal-alignment';

it('leaves no new personal account held by somebody whose actual ending ended them', async () => {
    const previous = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        const h = await makeGameInWorld({ seed: 'record', worldSeed: 'world-align', adminMode: true });
        const { cultivator } = await h.game.newRun('Taker');
        await h.game.act('ADMIN set_realm 30');
        const world = h.game.atHand!;
        const alive = new Set(world.npcs.filter(person => person.status === 'alive').map(person => person.id));
        const blood = new Set(['kin', 'spouse', 'parent', 'child']);
        const places = new Map<string, string[]>();
        for (const person of world.npcs) {
            if (!person.locationId || !alive.has(person.id)
                || !person.relationships.some(tie => blood.has(tie.kind) && alive.has(tie.targetId))) continue;
            places.set(person.locationId, [...places.get(person.locationId) ?? [], person.name]);
        }
        const [placeId, names] = [...places].sort((a, b) => b[1].length - a[1].length
            || a[0].localeCompare(b[0]))[0]!;
        expect(names.length, 'the world must supply actual people somebody would miss').toBeGreaterThanOrEqual(3);
        const place = world.locations.find(location => location.id === placeId)!;
        await h.game.act(`ADMIN grant_knowledge kind=place name=${place.name}`);
        await h.game.act(`ADMIN set_location ${place.name}`);
        const attacked = names.slice(0, 3);
        for (const name of attacked) await h.game.act(`I kill ${name}`);

        const rows = (h.db.prepare('SELECT * FROM obligations').all() as never[]).map(obligationFromRow)
            .filter(row => row.subjectId === cultivator.id);
        expect(rows.length, 'all real holders must still have their accounts').toBeGreaterThan(attacked.length);
        for (const row of rows) {
            const holder = world.npcs.find(person => person.id === row.holderId);
            if (holder) expect(['physically_dead', 'remnant']).not.toContain(holder.status);
            expect(row.triggeringEventId, 'the surviving account retains its actual fact').toBeTruthy();
        }
        expect(whatTheirRecordMakesThem({ personId: cultivator.id, ledger: rows }).wrongs)
            .toBeLessThanOrEqual(attacked.length);
    } finally {
        if (previous === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = previous;
    }
}, 180_000);
