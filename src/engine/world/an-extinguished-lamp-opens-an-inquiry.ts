/** A lamp proves death. The house still needs somebody to bring the account or remains. */
import { whoHasALampBurningIn } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { A_PRICE_STANDS_FOR_DAYS, A_PURSE_NOBODY_CROSSES_A_ROAD_FOR,
    WHAT_A_HOUSE_PUTS_UP_OF_ITS_PURSE, howThisHouseHonoursItsPaper } from './a-house-puts-a-price-on-somebody.js';
import type { WorldState } from './world-state.js';

export function extinguishedLampsOpenInquiries(state: WorldState, day: number): void {
    const people = new Map(state.npcs.map(n => [n.id, n]));
    const places = new Map(state.locations.map(l => [l.id, l]));
    const inquired = new Set<string>();
    const firstDeath = new Map<string, (typeof state.history.facts)[number]>();
    for (const fact of state.history.facts) {
        if (typeof fact.data.lampInquiry === 'string') {
            for (const houseId of fact.factionIds) inquired.add(`${houseId}\u001f${fact.data.lampInquiry}`);
        }
        if (fact.kind === 'death') for (const actor of fact.actors) {
            if (['victim', 'deceased', 'died'].includes(actor.role) && !firstDeath.has(actor.id)) {
                firstDeath.set(actor.id, fact);
            }
        }
    }
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        for (const id of whoHasALampBurningIn(state.objects, house.id)) {
            const member = people.get(id);
            if (!member || member.status === 'alive' || member.diedOnDay === null || member.diedOnDay > day) continue;
            if (inquired.has(`${house.id}\u001f${id}`)) continue;
            const death = firstDeath.get(id);
            const known = death && (death.locationId === house.seatLocationId
                || death.witnessIds.some(w => people.get(w)?.factionId === house.id));
            if (known) continue;
            // People at home are accounted for even where the death record had no witnesses.
            let where = member.locationId;
            let atHome = false;
            for (let hops = 0; where && hops < 8; hops++) {
                if (where === house.seatLocationId) { atHome = true; break; }
                where = places.get(where)?.parentId ?? null;
            }
            if (atHome) continue;
            const inquiry = appendWorldFact(state, makeFact({ day, kind: 'said_in_public', visibility: 'faction',
                summary: `${house.name} opened an inquiry after ${member.name}'s life lamp went out. No account of the death has reached the house.`,
                factionIds: [house.id], locationId: house.seatLocationId,
                actors: [{ id: member.id, name: member.name, role: 'unaccounted for' }],
                data: { lampInquiry: member.id, causeUnknownToHouse: true } }), { bystanders: false });
            inquired.add(`${house.id}\u001f${id}`);
            const purse = Math.floor((house.resources.spirit_stones ?? 0) * WHAT_A_HOUSE_PUTS_UP_OF_ITS_PURSE.grave);
            if (purse < A_PURSE_NOBODY_CROSSES_A_ROAD_FOR) continue;
            appendWorldFact(state, makeFact({ day, kind: 'bounty_posted', scale: 'local', visibility: 'regional',
                summary: `${house.name} offers ${purse} spirit stones for ${member.name}'s remains after their life lamp went out.`,
                factionIds: [house.id], locationId: house.seatLocationId, causes: [inquiry.id],
                actors: [{ id: member.id, name: member.name, role: 'named' }],
                data: { accountKey: inquiry.id, priceOn: member.id, priceOnName: member.name, purseStones: purse,
                    evidence: `bones from ${member.name}'s body`, honoured: howThisHouseHonoursItsPaper(state, house.id),
                    severity: 'grave', lapsesOnDay: day + A_PRICE_STANDS_FOR_DAYS,
                    forWhat: 'to recover their remains and establish where they died', inquiryFactId: inquiry.id,
                    unattributed: 'A house asks for the remains of a member whose life lamp went out.' } }), { bystanders: false });
        }
    }
}
