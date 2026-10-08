/**
 * Actual model rooms09 stood in the town clinic beside an ordinary physician,
 * but both dialogue and the personal care request targeted "the physician"
 * rather than a backend name. engine.resolveParty refused; no care or charge
 * occurred. The model still narrated an invented answer. source=model did not
 * establish acceptance. The shared all-person-verb resolver lacked professions. An off-duty physician remains a physician; role identification does not promise available care.
 * These front-door controls use real catalog work, physical capped presence and
 * accepted scripted plans. A unique ordinary public role can receive a question before
 * introduction; absent or ambiguous roles never pick another person.
 * Catalog name and id words supply role aliases, without a physician-only list.
 * The initial red ambiguity control found zero clinicians because adding a second
 * working doctor rearranged clinic areas while the patient retained the old one.
 * The control now arranges an ordinary shared meal and re-reads its actual area;
 * two physically present catalog physicians must still refuse an ambiguous role.
 * The initial post-talk no-name assertion was wrong: existing talk authority
 * explicitly gives a stranger their name and files that ruling. Resolver-only
 * awareness remains unchanged; learned names after talk require that actual
 * introduction fact and witnessed provenance. No role read manufactures
 * knowledge, a name, treatment, stock or wealth.
 */
import { expect, it } from 'vitest';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { ScriptedProvider } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { getOccupation } from '../../src/data/cultivation/mortal-world.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world.js';

function script(role: string, topic: string) {
    return new ScriptedProvider({ plans: [JSON.stringify({ lane: 'speak', intent: 'talk', target: role, topic })],
        narrations: ['Debug prose: no narrative acceptance is claimed.'] });
}
function knowsName(h: Awaited<ReturnType<typeof atAWorkingPhysician>>) {
    return thePlayerIsSureItIsThem(h.physician.name, h.game.knowledge.awareness(h.cultivator.id));
}
function moneyAndBody(h: Awaited<ReturnType<typeof atAWorkingPhysician>>) {
    const patient = h.game.state().cultivator;
    return { hp: patient.hp, wounds: patient.injuries, stones: patient.spiritStones, physicianStones: h.physician.spiritStones };
}
for (const role of ['the physician', 'doctor']) {
    it('addresses the present anonymous ' + role + ' without buying care or giving a free name', async () => {
        const topic = 'what care do you offer travellers?';
        const provider = script(role, topic);
        const h = await atAWorkingPhysician('ordinary-role-' + role, { provider });
        expect(knowsName(h)).toBe(false);
        const before = moneyAndBody(h);
        const awareness = JSON.stringify(h.game.knowledge.awareness(h.cultivator.id));
        expect(h.game.somebodyAtHand(role, h.game.state().cultivator)?.id).toBe(h.physician.id);
        expect(JSON.stringify(h.game.knowledge.awareness(h.cultivator.id))).toBe(awareness);
        const turn = await h.game.act('I ask ' + role + ' ' + topic);
        expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
        expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
        expect(turn.toolCalls.some(c => c.name === 'engine.readState' && c.ok)).toBe(true);
        expect(provider.calls.some(c => c.messages.at(-1)?.content.includes('mortal-grade care'))).toBe(true);
        expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare')).toBe(false);
        expect(moneyAndBody(h)).toEqual(before);
        // A successful conversation may explicitly give a name. Target
        // selection itself above must never do so. Any learned name here
        // requires the existing engine introduction fact and provenance.
        expect(knowsName(h)).toBe(true);
        expect(provider.calls.some(c => c.messages.at(-1)?.content.includes(h.physician.name + ' gives you their name.'))).toBe(true);
        expect(h.game.knowledge.provenanceOf(h.cultivator.id, 'cultivator', h.physician.id)
            .some(row => row.sourceKind === 'witnessed' && row.statement?.includes(h.physician.name + ' gave you their name'))).toBe(true);
        h.db.close();
    }, 120_000);
}
for (const state of ['dead', 'elsewhere', 'ambiguous'] as const) {
    it('does not redirect an anonymous physician question when ' + state, async () => {
        const role = 'the physician', topic = 'what care do you offer travellers?';
        const h = await atAWorkingPhysician('ordinary-role-refusal-' + state, { provider: script(role, topic) });
        if (state === 'dead') h.physician.status = 'physically_dead';
        if (state === 'elsewhere') h.physician.locationId = h.world.locations.find(p => p.id !== h.place.id && p.kind === 'settlement')!.id;
        if (state === 'ambiguous') {
            const other = createNpc(h.world.seed, { id: 'second-actual-clinician', bornOnDay: h.world.currentDay - 30 * 365,
                onDay: h.world.currentDay, locationId: h.place.id, occupation: h.physician.identity.occupation,
                cultivation: { realmOrdinal: 0 }, takenNames: new Set(h.world.npcs.map(n => n.name)) });
            // Two ordinary physicians share a meal, not separate working-clinic bins.
            // Role identification remains valid off duty; no available care is promised.
            h.physician.activity = { kind: 'at_a_table', note: 'Eating together.', withIds: [other.id], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
            other.activity = { kind: 'at_a_table', note: 'Eating together.', withIds: [h.physician.id], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
            h.world.npcs.push(other);
        }
        h.game.theWorldMoved();
        if (state === 'ambiguous') {
            const areas = theAreasOf(h.world, h.place);
            const sharedArea = areas.whereIs.get(h.physician.id)!;
            expect(areas.whereIs.get('second-actual-clinician')).toBe(sharedArea);
            h.repos.cultivators.standIn(h.cultivator.id, sharedArea);
        }
        const patient = h.game.state().cultivator;
        if (state === 'ambiguous') expect(h.game.present(patient).filter(n => h.world.npcs.find(p => p.id === n.id)?.identity.occupation === h.physician.identity.occupation)).toHaveLength(2);
        const before = moneyAndBody(h), elapsed = h.game.state().run.elapsedDays;
        const turn = await h.game.act('I ask ' + role + ' ' + topic);
        expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
        expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(true);
        expect(turn.toolCalls.some(c => c.name === 'engine.askedAbout' || c.name === 'engine.mortalCare')).toBe(false);
        expect(moneyAndBody(h)).toEqual(before);
        expect(h.game.state().run.elapsedDays).toBe(elapsed);
        h.db.close();
    }, 120_000);
}
it('can address an off-duty physician, whose care information does not offer present service', async () => {
    const topic = 'what care do you offer travellers?', role = 'the physician';
    const provider = script(role, topic);
    const h = await atAWorkingPhysician('ordinary-role-off-duty', { provider });
    h.physician.activity = { kind: 'at_a_table', note: 'Eating.', withIds: [], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
    h.game.theWorldMoved();
    const area = theAreasOf(h.world, h.place).whereIs.get(h.physician.id)!;
    h.repos.cultivators.standIn(h.cultivator.id, area);
    expect(h.game.present(h.game.state().cultivator).some(n => n.id === h.physician.id)).toBe(true);
    const before = moneyAndBody(h);
    const turn = await h.game.act('I ask ' + role + ' ' + topic);
    expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
    expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
    expect(turn.toolCalls.some(c => c.name === 'engine.readState' && c.ok)).toBe(true);
    expect(provider.calls.some(c => c.messages.at(-1)?.content.includes('not currently offering care here'))).toBe(true);
    expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare')).toBe(false);
    expect(moneyAndBody(h)).toEqual(before);
    h.db.close();
}, 120_000);
for (const id of ['job-scribe', 'job-porter']) {
    it('addresses ordinary catalog work beyond clinical care: ' + id, async () => {
        const job = getOccupation(id)!, role = 'the ' + job.name.toLowerCase(), topic = 'what is your name?';
        const h = await atAWorkingPhysician('ordinary-role-' + id, { provider: script(role, topic) });
        h.physician.identity.occupation = job.name;
        h.physician.activity = { kind: 'the_work_of_their_rank', note: 'Working as ' + job.name + '.', withIds: [], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
        h.game.theWorldMoved();
        const area = theAreasOf(h.world, h.place).whereIs.get(h.physician.id)!;
        h.repos.cultivators.standIn(h.cultivator.id, area);
        expect(h.game.present(h.game.state().cultivator).some(n => n.id === h.physician.id)).toBe(true);
        expect(h.game.somebodyAtHand('physician', h.game.state().cultivator)).toBeNull();
        const turn = await h.game.act('I ask ' + role + ' ' + topic);
        expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
        expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
        expect(turn.toolCalls.some(c => c.name === 'engine.askedAbout')).toBe(true);
        h.db.close();
    }, 120_000);
}
