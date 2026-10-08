/**
 * Played through the actual model on lived-rooms-20261003: an infirmary attendant
 * was standing in the infirmary, but her card said she inspected array anchors.
 * The model repeated that supplied work and sent the player elsewhere for care.
 * The mission and infirmary cards also disclosed chronological ages 86 and 52,
 * which nobody could read from those strangers' bodies. These are input defects,
 * not a request to make the model disregard engine facts.
 *
 * Clinical duty derives from the same current provider that placement and care
 * use. It must reach both unfamiliar and familiar scene cards, without rewriting
 * stored ordinary work. Observer cards omit chronology; the engine keeps ages.
 * Model probe 05 also supplied invented patients from "seeing to patients".
 * Clinical readiness describes the provider's work without asserting a patient
 * or transaction that the actual scene does not contain. Questions read the
 * finite shelf and contribution price without taking medicine or buying care.
 */
import { expect, it } from 'vitest';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { whoDispensesAtTheHouse } from '../../src/engine/world/who-is-actually-seeing-to-wounds.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { thePeopleHere } from '../../src/web/the-narrator-plays-the-world.js';
import { describeWhoIsHere } from '../../src/web/prompt.js';
import { askingAboutCareHere } from '../../src/web/asking-about-the-care-actually-offered-here.js';
import { countedWoundMedicine, onTheShelf, whatTheShelfChargesAMember } from '../../src/engine/world/house-wound-medicine.js';

it('a working clinical provider reads as doing clinical work, without changing their ordinary activity', async () => {
    const h = await atAWorkingPhysician('clinical-card-work');
    const playerId = h.cultivator.id;
    const read = () => h.game.company(h.repos.cultivators.getById(playerId)!);
    const ordinaryPhysicianWork = JSON.stringify(h.physician.activity);
    expect([...read().named, ...read().strangers].some(p => p.at?.includes('ready to examine a wound'))).toBe(true);
    h.game.knowledge.learn({ holderId: playerId, kind: 'cultivator', id: h.physician.id, name: h.physician.name,
        onDay: h.world.currentDay, sourceKind: 'told', statement: 'The physician has given their name.' });
    expect(read().named.find(p => p.id === h.physician.id)?.at).toContain('ready to examine a wound');
    expect(JSON.stringify(h.physician.activity)).toBe(ordinaryPhysicianWork);

    const world = h.game.atHand!;
    let chosen: { houseId: string; personId: string; hour: number } | undefined;
    for (let hour = 10; hour < 18 && !chosen; hour++) {
        world.currentHour = hour;
        for (const house of world.factions) {
            const person = whoDispensesAtTheHouse(world, house.id);
            if (person) { chosen = { houseId: house.id, personId: person.id, hour }; break; }
        }
    }
    expect(chosen, 'an actual working infirmary attendant').toBeDefined();
    const attendant = world.npcs.find(n => n.id === chosen!.personId)!;
    const infirmary = world.locations.find(p => p.controllingFactionId === chosen!.houseId && purposeOf(p) === 'infirmary')!;
    const area = theAreasOf(world, infirmary).whereIs.get(attendant.id)!;
    h.repos.sects.addMember(chosen!.houseId, playerId, 0);
    h.repos.cultivators.update(playerId, { location: infirmary.name });
    h.repos.cultivators.standIn(playerId, area);
    const run = h.game.state().run;
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(Math.floor(run.elapsedDays) + chosen!.hour / 24, run.id);
    await h.game.loadWorld();
    const ordinaryAttendantWork = JSON.stringify(attendant.activity);
    const company = read();
    expect([...company.named, ...company.strangers].some(p => p.at?.includes('ready to dispense the house\'s medicine'))).toBe(true);
    h.game.knowledge.learn({ holderId: playerId, kind: 'cultivator', id: attendant.id, name: attendant.name,
        onDay: world.currentDay, sourceKind: 'told', statement: 'The attendant has given their name.' });
    expect(read().named.find(p => p.id === attendant.id)?.at).toContain('ready to dispense the house\'s medicine');
    expect(JSON.stringify(attendant.activity)).toBe(ordinaryAttendantWork);
    const house = h.game.atHand!.factions.find(f => f.id === chosen!.houseId)!;
    const before = JSON.stringify({ state: h.game.state(), resources: house.resources, activity: attendant.activity });
    const info = askingAboutCareHere(h.game, h.repos.cultivators.getById(playerId)!, attendant.id,
        'What medicine and contribution fees are offered here?');
    expect(info?.prose).toContain('finite medicine');
    expect(info?.prose).toContain('contribution');
    for (const pill of countedWoundMedicine().filter(p => onTheShelf(house, p.id) > 0)) {
        expect(info?.prose).toContain(`${pill.name}: ${onTheShelf(house, pill.id)} doses`);
        expect(info?.prose).toContain(`${pill.grade} grade, ${whatTheShelfChargesAMember(pill)} contribution per dose`);
    }
    expect(JSON.stringify({ state: h.game.state(), resources: house.resources, activity: attendant.activity })).toBe(before);
}, 120_000);

it('the observer and classifier cards show visible sex and work, without leaking chronological ages', () => {
    const person = { id: 'observed-person', name: 'Observed Person', age: 86, ordinal: 0,
        sex: 'female', at: 'dispensing medicine', withNames: [], like: null, looksUp: true,
        playsToTheRoom: 0, chewing: null, houseId: null, houseName: null, rank: null,
        ownMind: null, toReachFor: null, rankIndex: -1 };
    const company = { named: [person], strangers: [], total: 1 } as never;
    const observer = thePeopleHere(company, 0, [], null).join('\n');
    const classifier = describeWhoIsHere(company, 0).join('\n');
    expect(observer).toContain('female');
    expect(observer).toContain('dispensing medicine');
    expect(observer).not.toMatch(/\b86\b|years old|of about/);
    expect(classifier).not.toMatch(/\b86\b|years old|of about/);
});
