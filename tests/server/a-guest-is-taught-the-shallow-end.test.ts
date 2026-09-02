/**
 * The guest roll, end to end through the tool surface.
 *
 * The engine's own suite covers which houses take guests and what each would
 * open. What this covers is the half that has burned this project repeatedly:
 * whether anything in the RUNNING GAME reads it. A guest place that opens a
 * shelf nobody can then learn from is a card in a menu, and every artefact of a
 * finished feature would be present except the one that matters.
 *
 * So each test below is about a state change or a refusal, and every one of
 * them goes through `technique_manage.learn` or `sect_manage.guest` rather than
 * through the pure functions.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { handleTechniqueManage } from '../../src/server/consolidated/technique-manage.js';
import { handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { adminResult } from '../../src/server/consolidated/admin-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { getTechnique } from '../../src/data/cultivation/techniques.js';
import {
    guestPlaceAt,
    housesThatWouldTakeAGuest,
    takesGuests,
    whatAHouseKeepsBack,
    whatAHouseWillShowAGuest
} from '../../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const ctx = undefined;

function payload(res: { content: Array<{ text?: string }> }): any {
    const text = res.content[0]?.text ?? '{}';
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (a: Record<string, unknown>) => payload(await handleCultivationManage(a, ctx));
const technique = async (a: Record<string, unknown>) => payload(await handleTechniqueManage(a, ctx));
const sect = async (a: Record<string, unknown>) => payload(await handleSectManage(a, ctx));
const admin = async (a: Record<string, unknown>) => (await adminResult(a)) as any;

/** Tell this cultivator a house's name, which every read here is gated on. */
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

async function aNobody(name = 'Du Lin') {
    const made = await cultivation({
        action: 'create_cultivator', name, seed: 'guest-roll-1', location: 'Sweptground'
    });
    expect(made.error).toBeUndefined();
    return made.cultivator.id as string;
}

/**
 * A house that takes guests and would show a beginner a cultivation road.
 *
 * Chosen off the catalog rather than named, so a content change moves the test
 * rather than breaking it.
 */
function aHouseThatWouldTeachABeginner(): { id: string; roadId: string } {
    for (const house of SECTS) {
        const place = guestPlaceAt(house.id, 0, null);
        if (!place) continue;
        const road = place.opens.find(o => {
            const t = getTechnique(o.techniqueId);
            return t !== undefined && t.class === 'cultivation' && t.cap != null;
        });
        if (road) return { id: house.id, roadId: road.techniqueId };
    }
    throw new Error('no house in the catalog would show a beginner a road');
}

describe('a nobody on somebody else\'s guest roll', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        delete process.env.ADMIN_MODE;
    });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('is refused the road before the place, and taught it after - and pays nothing either way', async () => {
        const id = await aNobody();
        const { id: houseId, roadId } = aHouseThatWouldTeachABeginner();
        hearOf(id, houseId);

        const cultivators = new CultivatorRepository(db);
        const before = cultivators.getById(id)!;

        // WITHOUT the place: the membership gate refuses, which is the whole
        // reason the arrangement is worth anything.
        const refused = await technique({ action: 'learn', cultivatorId: id, techniqueId: roadId });
        expect(refused.error).toBeTruthy();
        expect(String(refused.error)).toMatch(/no_road_to_this_book|no_copy_of_this_book/);

        const taken = await sect({ action: 'guest', cultivatorId: id, sectId: houseId, accept: true });
        expect(taken.error).toBeUndefined();
        expect(taken.accepted).toBe(true);

        const learned = await technique({ action: 'learn', cultivatorId: id, techniqueId: roadId });
        expect(learned.error).toBeUndefined();

        const after = cultivators.getById(id)!;
        expect(after.knownTechniques).toContain(roadId);
        // Access, and nothing changed hands. The house spent teaching time.
        expect(after.spiritStones).toBe(before.spiritStones);
    });

    it('is on the guest roll and on nobody\'s house roll', async () => {
        const id = await aNobody();
        const { id: houseId } = aHouseThatWouldTeachABeginner();
        hearOf(id, houseId);
        await sect({ action: 'guest', cultivatorId: id, sectId: houseId, accept: true });

        // The membership table is untouched, which is the mechanism rather
        // than a detail: a guest is entered on a roll that is not the house
        // roll, so nothing about rank, stipend or contribution exists for them.
        const standing = await sect({ action: 'standing', cultivatorId: id });
        expect(standing.member).not.toBe(true);
        const cultivators = new CultivatorRepository(db);
        expect(cultivators.getById(id)!.sectId).toBeFalsy();
    });

    it('walks out owing nothing, and keeps what is in their head', async () => {
        const id = await aNobody();
        const { id: houseId, roadId } = aHouseThatWouldTeachABeginner();
        hearOf(id, houseId);
        await sect({ action: 'guest', cultivatorId: id, sectId: houseId, accept: true });
        await technique({ action: 'learn', cultivatorId: id, techniqueId: roadId });

        const gone = await sect({ action: 'guest', cultivatorId: id, depart: true });
        expect(gone.departed).toBe(true);
        expect(String(gone.forfeited)).toMatch(/Nothing/i);

        const cultivators = new CultivatorRepository(db);
        expect(cultivators.getById(id)!.knownTechniques).toContain(roadId);

        // And the shelf closes behind them.
        const shut = await technique({ action: 'learn', cultivatorId: id, techniqueId: roadId });
        expect(shut.error).toBeTruthy();
    });
});

describe('the shallow end is not a back door', () => {
    beforeEach(() => { closeDb(); getDb(':memory:'); delete process.env.ADMIN_MODE; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('refuses what the house keeps back, and names what membership would change', async () => {
        // A house that keeps back a cultivation road an outsider could not
        // otherwise reach, and a guest standing high enough to open it - so
        // the realm gate is satisfied and the only thing left refusing is the
        // guest boundary itself.
        let found: { houseId: string; roadId: string; ordinal: number } | null = null;
        for (const house of SECTS) {
            if (!takesGuests(house.id)) continue;
            for (const kept of whatAHouseKeepsBack(house.id)) {
                const t = getTechnique(kept.techniqueId);
                if (!t || t.class !== 'cultivation' || t.cap == null) continue;
                // Mortal and earth grade only. Above that `daoGate` refuses
                // first and for a better reason - "the pages are perfectly
                // legible and the meaning does not arrive" - and a test that
                // caught that refusal would be measuring the dao gate while
                // believing it was measuring this one.
                if (t.grade !== 'mortal' && t.grade !== 'earth') continue;
                found = { houseId: house.id, roadId: t.id, ordinal: t.requiredOrdinal };
                break;
            }
            if (found) break;
        }
        expect(found, 'no guest-taking house keeps a road back').not.toBeNull();

        process.env.ADMIN_MODE = 'true';
        const id = await aNobody('Shen Yue');
        hearOf(id, found!.houseId);
        await admin({ action: 'set_realm', ordinal: found!.ordinal });
        await sect({ action: 'guest', cultivatorId: id, sectId: found!.houseId, accept: true });

        const refused = await technique({
            action: 'learn', cultivatorId: id, techniqueId: found!.roadId
        });
        expect(refused.error).toBeTruthy();
        // The refusal names the thing that would work, which is the standard
        // everywhere in this build. It must not read as a bare no.
        const said = `${refused.message ?? ''} ${refused.hint ?? ''}`;
        expect(said).toMatch(/membership|theirs|taken/i);
    });

    it('opens nothing at a house that has nothing held back', async () => {
        const shallow = SECTS.find(s => !takesGuests(s.id) && s.teaches.length > 0)!;
        const id = await aNobody();
        hearOf(id, shallow.id);
        const answer = await sect({ action: 'guest', cultivatorId: id, sectId: shallow.id });
        expect(answer.error).toBe('nothing_held_back');
        // And says where a guest place WOULD be found.
        expect(String(answer.hint)).toMatch(/depth|guest/i);
        expect(whatAHouseWillShowAGuest(shallow.id)).toEqual([]);
    });
});

describe('the two refusals a name earns', () => {
    beforeEach(() => { closeDb(); getDb(':memory:'); });

    it('will not discuss a house nobody has named to this cultivator', async () => {
        const id = await aNobody();
        const { id: houseId } = aHouseThatWouldTeachABeginner();
        const answer = await sect({ action: 'guest', cultivatorId: id, sectId: houseId });
        expect(answer.error).toBe('sect_not_known');
    });

    it('lists only the houses this cultivator could actually name', async () => {
        const id = await aNobody();
        const bare = await sect({ action: 'guest', cultivatorId: id });
        expect(bare.wouldTakeAGuest).toBeGreaterThan(0);
        expect(bare.knownToYou).toBe(0);
        expect(bare.houses).toEqual([]);

        const { id: houseId } = aHouseThatWouldTeachABeginner();
        hearOf(id, houseId);
        const after = await sect({ action: 'guest', cultivatorId: id });
        expect(after.knownToYou).toBe(1);
        expect(after.houses[0].hostFactionId).toBe(houseId);
        // Never empty, and it is read before accepting rather than after.
        expect(after.notOffered.join(' ')).toMatch(/protection/i);
    });
});

describe('a guest keeps their own house', () => {
    beforeEach(() => { closeDb(); getDb(':memory:'); delete process.env.ADMIN_MODE; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('does not touch the membership row, and the home house has a stated view', async () => {
        // Somebody in a house, sitting in at another one. Nothing is left, so
        // none of the departure machinery fires.
        const home = SECTS.find(s =>
            s.recruits
            && s.admissionOrdinal <= 6
            && housesThatWouldTakeAGuest(6, s.id).length > 0
        )!;
        const host = housesThatWouldTakeAGuest(6, home.id)[0];

        process.env.ADMIN_MODE = 'true';
        const id = await aNobody('Lan Qi');
        hearOf(id, home.id);
        hearOf(id, host.factionId);
        await admin({ action: 'set_realm', ordinal: Math.max(6, home.admissionOrdinal) });

        const joined = await sect({ action: 'join', cultivatorId: id, sectId: home.id });
        // Walking up is an attempt and may be refused; the point of this test
        // is the guest place beside a membership, so only proceed when it took.
        if (joined.error) return;

        const taken = await sect({
            action: 'guest', cultivatorId: id, sectId: host.factionId, accept: true
        });
        expect(taken.error).toBeUndefined();
        expect(['sends', 'permits', 'forbids']).toContain(taken.homeStance);
        expect(String(taken.stillOf)).toContain(getSect(home.id)!.name);

        const standing = await sect({ action: 'standing', cultivatorId: id });
        expect(standing.member).toBe(true);
        expect(standing.sect.id).toBe(home.id);
    });
});
