/** Oct6: a remembered destination is not a self-navigation route, but a real
 * public driver can carry an uninformed passenger. Actual booking must remain
 * legal without a free prior route grant. The board previously displayed its
 * nearest six lines but filed placed knowledge for EVERY available line.
 * These native controls read real seeded services and canonical quotes; no route,
 * counter mouth, knowledge, driver or fare is invented. Operator arrangement moves
 * only the player to a real station. Direct booking keeps its existing arrival
 * learning. A competing native booking supplies genuine unavailability.
 * The board control requires an actual omitted unfamiliar line and compares
 * knowledge with emitted route lines, rather than copying the display limit.
 * Root guided02 run84818 proved the board and counter controls but booking
 * fixtures used unsupported passage/buy plans (no engine booking reached).
 * Successor uses supported ride/destination/carriage; asserts model routing and
 * logs complete native calls before receipt assertions. No outcome is fabricated.
 * Root joint13 run25140: guided purchase and board passed; refused purchase
 * kept body/time/purse/history but ordinary end-turn geography taught 13 places.
 * Clear Creek Village was genuinely signed from Emerald Water City. Whole
 * awareness equality incorrectly forbade that learning. The refusal now checks
 * target provenance against actual local geography, preserving its signposts
 * while excluding a ticket-board/arrival grant from the denied booking.
 * Root joint14 run21264 again reached the correct refusal and local teaching;
 * the target provenance assertion queried stable location id, while the native
 * land teacher files its actual display-name key. KnowledgeGate.provenanceOf
 * queries only that supplied claim key; canPointAtLocation resolves both aliases.
 * Read the emitted name-key provenance here and keep native route validation.
 * This successor is uncompiled/unrun; no actual-model acceptance claimed.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { aSeatOnAShipOrACarriage, whatRunsFromHere, sayTheLine, stonesFor } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { quotePublicCarriage, commitPublicCarriage } from '../../src/engine/world/public-carriages.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { whatStandingHereShows } from '../../src/engine/world/what-somebody-knows-of-the-land.js';

async function fixture() {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The engine receipt is shown.'] });
    const h = await makeGameInWorld({ seed: 'guided-route', worldSeed: 'road-world', worldEnabled: true,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
    await h.game.newRun('Guided passenger');
    h.game.atHand = await prepareWorldClockForPreciseSpan(h.game.currentRun().run, h.game.currentRun().cultivator);
    if (!h.game.atHand) throw new Error('Actual passage requires its world.');
    return { ...h, plans, world: h.game.atHand };
}
async function station() {
    const h = await fixture();
    const id = h.game.currentRun().cultivator.id;
    for (const from of h.world.locations.filter(row => row.kind === 'settlement')) {
        h.repos.cultivators.update(id, { location: from.name, standingIn: null, spiritStones: 500 });
        const body = h.game.currentRun().cultivator;
        for (const line of whatRunsFromHere(h.game, body, Math.floor(h.world.currentDay)).filter(row => row.service === 'carriage')) {
            const to = worldLocationFor(h.world, line.to);
            if (!to || h.game.canPointAtLocation(body, to)
                || h.game.knowledge.isAwareOf(id, 'place', to.id) || h.game.knowledge.isAwareOf(id, 'place', to.name)) continue;
            const quote = quotePublicCarriage(h.world, { fromId: from.id, toId: to.id, day: routineTime(h.world),
                conveyanceId: 'conv-carriage-mortal', passengerIds: [id], fareStones: stonesFor(line.cashPerSeat), hired: false,
                playedPassenger: { id, locationId: from.id, alive: body.alive } });
            if (quote) return { ...h, line, to, quote };
        }
    }
    h.db.close(); throw new Error('No actual available station supplies an unfamiliar native carriage route.');
}
it('an actual guided booking carries a passenger who has never learned its route', async () => {
    const h = await station();
    try {
        const before = h.game.currentRun();
        expect(h.game.canPointAtLocation(before.cultivator, h.to)).toBe(false);
        const factIds = new Set(h.world.history.facts.map(row => row.id));
        h.plans.push(JSON.stringify({ action: 'ride', target: h.line.to, topic: 'carriage' }));
        const done = await h.game.act('I ride a carriage to ' + h.line.to + '.');
        console.log(JSON.stringify({ guidedBookingToolCalls: done.toolCalls }));
        expect(done.toolCalls.find(row => row.name === 'narrator.plan')?.source).toBe('model');
        expect(done.toolCalls.find(row => row.name === 'narrator.plan')?.action).toBe('ride');
        expect(refusedCall(done)).toBeNull();
        const receipt = h.game.atHand!.history.facts.find(row => !factIds.has(row.id)
            && row.data.publicPassage === true && row.data.service === 'carriage'
            && row.data.toLocationId === h.to.id && row.actors.some(actor => actor.id === before.cultivator.id));
        expect(receipt).toBeDefined();
        expect(h.game.atHand!.npcs.some(row => row.id === receipt!.data.driverId)).toBe(true);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
        expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
        // No automatic boarding route grant: only the existing actual arrival
        // reader may supply witnessed destination knowledge after this trip.
        expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.to.name)
            .every(row => row.sourceKind !== 'read')).toBe(true);
    } finally { h.db.close(); }
}, 120_000);
it('a real unavailable guided service refuses without fare, new booking or purchased route grant', async () => {
    const h = await station();
    try {
        // A real native booking reserves this passenger/vehicle. The SQL player
        // has no continuation claim: a second counter purchase must not duplicate it.
        expect(commitPublicCarriage(h.world, h.quote)).not.toBeNull();
        h.game.theWorldMoved();
        const before = h.game.currentRun();
        const facts = h.world.history.facts.length;
        const targetKnowledge = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.to.name);
        const here = before.cultivator.location;
        if (here === null) throw new Error('The actual unavailable-service fixture lost its station location.');
        const local = whatStandingHereShows(h.world, here).find(row => row.name === h.to.name);
        expect(h.game.canPointAtLocation(before.cultivator, h.to)).toBe(false);
        h.plans.push(JSON.stringify({ action: 'ride', target: h.line.to, topic: 'carriage' }));
        const done = await h.game.act('I ride a carriage to ' + h.line.to + '.');
        console.log(JSON.stringify({ guidedBookingToolCalls: done.toolCalls }));
        expect(done.toolCalls.find(row => row.name === 'narrator.plan')?.source).toBe('model');
        expect(done.toolCalls.find(row => row.name === 'narrator.plan')?.action).toBe('ride');
        expect(refusedCall(done)?.name).toBe('engine.publicCarriage');
        expect(h.game.currentRun().cultivator).toEqual(before.cultivator);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.atHand!.history.facts.length).toBe(facts);
        const afterKnowledge = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.to.name);
        if (!local) {
            expect(afterKnowledge).toEqual(targetKnowledge);
            expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, h.to)).toBe(false);
        } else {
            expect(afterKnowledge.some(row => row.stage === local.stage
                && row.sourceKind === (local.stage === 'placed' ? 'witnessed' : 'overheard')
                && row.sourceNote.includes(here))).toBe(true);
            expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, h.to)).toBe(local.stage === 'placed');
        }
        expect(afterKnowledge.every(row => row.sourceKind !== 'read'
            && !row.sourceNote.startsWith('Arrived on day'))).toBe(true);
    } finally { h.db.close(); }
}, 120_000);
it('a visible board grants only the actual route lines it displays', async () => {
    const h = await fixture();
    try {
        const id = h.game.currentRun().cultivator.id;
        for (const from of h.world.locations.filter(row => row.kind === 'settlement')) {
            h.repos.cultivators.update(id, { location: from.name, standingIn: null });
            const before = h.game.currentRun();
            const lines = whatRunsFromHere(h.game, before.cultivator, Math.floor(h.world.currentDay));
            // This fixture criterion is only to reach the truncation defect; the
            // assertions derive the advertised list from actual emitted facts.
            if (lines.length <= 6 || lines.some(line => h.game.knowledge.isAwareOf(id, 'place', line.to))) continue;
            const board = await aSeatOnAShipOrACarriage(h.game, before.run, before.cultivator, undefined, 'board', null);
            const shown = lines.filter(line => board.facts.lines.includes(sayTheLine(line)));
            const omitted = lines.filter(line => !shown.includes(line));
            expect(shown.length).toBeGreaterThan(0);
            expect(omitted.length).toBeGreaterThan(0);
            for (const line of shown) expect(h.game.canPointAtLocation(before.cultivator, worldLocationFor(h.world, line.to)!)).toBe(true);
            for (const line of omitted) expect(h.game.canPointAtLocation(before.cultivator, worldLocationFor(h.world, line.to)!)).toBe(false);
            expect(h.game.currentRun().cultivator).toEqual(before.cultivator);
            expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
            return;
        }
        throw new Error('Seeded service world has no wholly unfamiliar board with actual omitted route lines.');
    } finally { h.db.close(); }
}, 120_000);
