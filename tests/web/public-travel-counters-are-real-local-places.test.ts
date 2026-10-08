/**
 * Oct7 owner ruling: a local knows their city's public carriage/folding counter
 * exists as a resident knows an airport, even without having travelled. The
 * existing menus had no distinct walkable area, and theWayTo ignored public
 * offerings. Native directions02 run66433 reached Willow Village walking1,
 * carriage1/fare3, then failed because no carriage facts were supplied.
 * These controls use actual seeded people, existing public offerings and actual
 * local area/movement authorities. No provider, experience, booking, knowledge
 * record or transport route is manufactured. A city without a surveyed folding
 * counter does not grow a portal merely for being a city. This is native proof;
 * model intent/prose is scripted and no live-model acceptance is claimed.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { publicTransportHubsAt } from '../../src/engine/world/public-transport-at-a-place.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whatThisPersonKnowsOfTheLand } from '../../src/web/the-way-to-somewhere-asked-of-somebody.js';
import { howMuchOfTheRoadALifeHasSeen } from '../../src/engine/world/what-somebody-knows-of-the-land.js';
import { counterPlaceNameAt } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { whatKindOfPlace } from '../../src/data/cultivation/regions.js';

async function fixture() {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The actual local answer and movement are shown.'] });
    const h = await makeGameInWorld({ seed: 'remembered-route', worldSeed: 'road-world', worldEnabled: true,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
    await h.game.newRun('A local counter visitor');
    const world = await h.game.loadWorld();
    if (!world) { h.db.close(); throw new Error('The native public venue fixture has no world.'); }
    return { ...h, plans, provider, world };
}
for (const kind of ['carriage_station', 'span_counter'] as const) {
    it('an actual untravelled local knows the public ' + kind + ' and its named area can be walked to', async () => {
        const h = await fixture();
        try {
            const id = h.game.currentRun().cultivator.id;
            let selected: { speaker: NonNullable<ReturnType<typeof h.game.somebodyAtHand>>;
                venue: typeof h.world.locations[number]; hub: ReturnType<typeof publicTransportHubsAt>[number] } | null = null;
            for (const venue of h.world.locations) {
                const hub = publicTransportHubsAt(h.world, venue.name, h.world.currentDay).find(row => row.kind === kind);
                if (!hub) continue;
                const reading = theAreasOf(h.world, venue);
                for (const area of reading.areas.filter(row => row.for !== 'room' && row.for !== kind)) {
                    h.repos.cultivators.update(id, { location: venue.name, standingIn: area.id });
                    const body = h.game.currentRun().cultivator;
                    const speaker = h.game.somebodyAtHand('somebody', body);
                    const actual = speaker && h.world.npcs.find(row => row.id === speaker.id);
                    if (!speaker || !actual || actual.locationId !== venue.id
                        || howMuchOfTheRoadALifeHasSeen(actual.identity.occupation) !== 0) continue;
                    selected = { speaker, venue, hub }; break;
                }
                if (selected) break;
            }
            if (!selected) throw new Error('No actual untravelled local is present at a genuine ' + kind + '.');
            const { speaker, venue, hub } = selected;
            const before = h.game.currentRun();
            const npcBefore = structuredClone(h.world.npcs.find(row => row.id === speaker.id)!);
            const land = whatThisPersonKnowsOfTheLand(h.game, id, h.world, speaker);
            expect(land.publicHubs?.some(row => row.kind === kind && row.place === venue.name)).toBe(true);
            expect(h.world.npcs.find(row => row.id === speaker.id)).toEqual(npcBefore);
            h.plans.push(JSON.stringify({ action: 'interact', target: 'somebody', intent: 'ask', topic: 'the way to ' + hub.name }));
            const answer = await h.game.act('I ask somebody how to get to ' + hub.name + '.');
            expect(refusedCall(answer)).toBeNull();
            expect(answer.toolCalls.some(row => row.name === 'engine.theWayTo' && row.ok)).toBe(true);
            const call = [...h.provider.calls].reverse().find(row =>
                !row.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router')));
            if (!call) throw new Error('The actual venue directions never reached narration.');
            const input = call.messages.map(row => row.content).join('\n');
            const ruled = input.slice(input.indexOf('WHAT THE ENGINE RULED.')).split('\n\n')[0]!;
            expect(ruled).toContain(hub.name);
            expect(ruled).toContain(venue.name);
            expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            const area = theAreasOf(h.game.atHand!, venue).areas.find(row => row.for === kind);
            expect(area, 'an actual public offering must have an actual local destination').toBeDefined();
            h.plans.push(JSON.stringify({ action: 'move', target: hub.name }));
            const moved = await h.game.act('I walk to ' + hub.name + '.');
            console.log(JSON.stringify({ kind, venue: venue.name, actualLocal: speaker.id, answerCalls: answer.toolCalls, moveCalls: moved.toolCalls }));
            expect(refusedCall(moved)).toBeNull();
            expect(h.game.currentRun().cultivator.location).toBe(venue.name);
            expect(h.game.currentRun().cultivator.standingIn).toBe(area!.id);
        } finally { h.db.close(); }
    }, 120_000);
}
it('an actual city without a surveyed folding counter does not acquire a portal or its advertisement', async () => {
    const h = await fixture();
    try {
        const venue = h.world.locations.find(row => row.kind === 'settlement'
            && (row.tags.includes('city') || whatKindOfPlace(row.name) === 'provincial capital')
            && counterPlaceNameAt(row.name) === null);
        if (!venue) throw new Error('No actual city supplies a no-folding-counter control.');
        expect(publicTransportHubsAt(h.world, venue.name, h.world.currentDay).some(row => row.kind === 'span_counter')).toBe(false);
        expect(theAreasOf(h.world, venue).areas.some(row => row.for === 'span_counter')).toBe(false);
    } finally { h.db.close(); }
});
