/** Scouts offer exposure; probation never grants a house's name or protection. */
import { AZURE_CLOUD_INTAKE } from '../../data/cultivation/governance-and-water-rights.js';
import { PRICES, CASH_PER_STONE } from '../../data/cultivation/mortal-world.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { suitsRoot } from './manuals.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { judgeProbation } from '../encounters/where-a-probation-ends-and-who-is-placed-where.js';
import { whatAHouseWillShowAGuest } from '../encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';
import { ageInYears, isTheWorldsToMove, setLocation } from './npc-state.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import type { WorldState } from './world-state.js';

const PROBATION = 'scouted-probation|';
const TESTED = 'scout-tested';
// Schooling starts at seven; older candidates still have time for the existing probation span.
const AGES = { first: 7, last: 14 };
const A_YEAR_OF_FOOD = PRICES.find(p => p.id === 'price-month-rations')!.cash / CASH_PER_STONE * 12;

export function scoutsPlaceChildren(state: WorldState, year: number, day: number): void {
    const house = state.factions.find(f => f.id === AZURE_CLOUD_INTAKE.factionId && f.dissolvedOnDay === null);
    if (!house?.seatLocationId) return;
    // Food is paid from the actual treasury; a place is not a claim on the child.
    const scouts = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
        && n.factionId === house.id && n.factionRankIndex > 0
        && n.cultivation.realmOrdinal >= FOUNDATION_ORDINAL && !n.activity).slice(0, 6);
    const markets = state.locations.filter(l => l.kind === 'settlement' && l.discovered && !l.sealed
        && l.thresholds.entry === 0 && l.thresholds.survival === 0);
    for (let index = 0; index < scouts.length && markets.length > 0; index++) {
        const scout = scouts[index]!;
        const market = markets[(year * scouts.length + index) % markets.length]!;
        const at = state.npcs.findIndex(n => n.id === scout.id);
        const moved = setLocation(scout, market.id, day);
        scouts[index] = state.npcs[at] = { ...moved, activity: { kind: 'out_with_a_party',
            note: 'Walking the house scout circuit.', withIds: [], sinceDay: day, untilDay: day + 30,
            returnTo: scout.locationId } };
    }
    const nominated = new Map<string, number>();
    for (let at = 0; at < state.npcs.length; at++) {
        let child = state.npcs[at]!;
        if (!isTheWorldsToMove(child) || child.status !== 'alive') continue;
        const held = child.tags.find(t => t.startsWith(PROBATION));
        if (held) {
            const [, since, home] = held.split('|');
            const start = Number(since);
            let judgement = judgeProbation({ hostFactionId: house.id, ordinal: child.cultivation.realmOrdinal,
                age: ageInYears(child, day), yearsOnTheRoll: Math.max(0, day - start) / DAYS_PER_YEAR });
            if (judgement.outcome === 'carried' && (house.resources.spirit_stones ?? 0) < A_YEAR_OF_FOOD) {
                judgement = { ...judgement, outcome: 'turned_out', factionId: null, factionName: null,
                    reason: 'The house cannot fund another year of food.' };
            }
            if (judgement.outcome === 'carried') {
                house.resources.spirit_stones -= A_YEAR_OF_FOOD;
                const primer = whatAHouseWillShowAGuest(house.id).find(art => art.requiredOrdinal <= child.cultivation.realmOrdinal
                    && suitsRoot(child.cultivation.spiritRoot, getTechnique(art.techniqueId)?.element ?? null));
                if (primer && !child.cultivation.techniqueIds.includes(primer.techniqueId)) state.npcs[at] = {
                    ...child, cultivation: { ...child.cultivation, techniqueIds: [...child.cultivation.techniqueIds, primer.techniqueId] } };
                continue;
            }
            const destination = state.factions.find(f => f.id === judgement.factionId);
            child = { ...child, tags: child.tags.filter(t => !t.startsWith(PROBATION)),
                factionId: judgement.factionId, factionRankIndex: judgement.factionId ? 0 : -1, activity: null };
            state.npcs[at] = setLocation(child, destination?.seatLocationId ?? (home || null), day);
            appendWorldFact(state, makeFact({ day, kind: judgement.factionId ? 'promotion' : 'expulsion',
                summary: `${house.name} ended ${child.name}'s probation: ${judgement.reason}`,
                actors: [{ id: child.id, name: child.name, role: judgement.outcome }], factionIds: [house.id],
                data: { scoutPlacement: true, outcome: judgement.outcome } }));
            continue;
        }
        const age = ageInYears(child, day);
        if (age < AGES.first || age > AGES.last || child.factionId || child.tags.includes(TESTED)) continue;
        if (!['thin_county', 'market_town'].includes(child.identity.origin)) continue;
        if (scouts.length === 0 || (house.resources.spirit_stones ?? 0) < A_YEAR_OF_FOOD) continue;
        const scout = scouts.find(n => (nominated.get(n.id) ?? 0) < 2
            && regionCatalogIdOf(state, n.locationId) === regionCatalogIdOf(state, child.locationId));
        if (!scout) continue;
        const rng = forStream(state.seed, 'pavilion-scout', child.id, year);
        const grade = getSpiritRoot(child.cultivation.spiritRoot).grade;
        const chance = grade === 'single' || grade === 'mutated' ? 0.03 : grade === 'dual' ? 0.01 : 0.001;
        state.npcs[at] = { ...child, tags: [...child.tags, TESTED] };
        if (!rng.chance(chance)) continue;
        house.resources.spirit_stones -= A_YEAR_OF_FOOD;
        nominated.set(scout.id, (nominated.get(scout.id) ?? 0) + 1);
        state.npcs[at] = setLocation({ ...child, factionId: null, factionRankIndex: -1,
            tags: [...child.tags, TESTED, `${PROBATION}${day}|${child.locationId ?? ''}`],
            activity: { kind: 'at_the_shelves', note: 'Learning on probation.', withIds: [scout.id],
                sinceDay: day, untilDay: null } }, house.seatLocationId, day);
        appendWorldFact(state, makeFact({ day, kind: 'said_in_public', visibility: 'faction',
            summary: `${scout.name} placed ${child.name} on probation at ${house.name}.`,
            actors: [{ id: scout.id, name: scout.name, role: 'scout' }, { id: child.id, name: child.name, role: 'probationer' }],
            factionIds: [house.id], locationId: house.seatLocationId,
            data: { scoutPlacement: true, probation: true, age, sinceDay: day } }));
    }
}
