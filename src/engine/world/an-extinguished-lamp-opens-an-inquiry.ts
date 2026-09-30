/** A lamp proves death. The house still needs somebody to bring the account or remains. */
import { whoHasALampBurningIn } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { A_PRICE_STANDS_FOR_DAYS, A_PURSE_NOBODY_CROSSES_A_ROAD_FOR,
    WHAT_A_HOUSE_PUTS_UP_OF_ITS_PURSE, howThisHouseHonoursItsPaper } from './a-house-puts-a-price-on-somebody.js';
import type { WorldState } from './world-state.js';

export function extinguishedLampsOpenInquiries(state: WorldState, day: number): void {
    const people = new Map(state.npcs.map(n => [n.id, n]));
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        for (const id of whoHasALampBurningIn(state.objects, house.id)) {
            const member = people.get(id);
            if (!member || member.status === 'alive' || member.diedOnDay === null || member.diedOnDay > day) continue;
            if (state.history.facts.some(f => f.data.lampInquiry === id && f.factionIds.includes(house.id))) continue;
            const death = state.history.facts.find(f => f.kind === 'death'
                && f.actors.some(a => a.id === id && ['victim', 'deceased', 'died'].includes(a.role)));
            const known = death && (death.locationId === house.seatLocationId
                || death.witnessIds.some(w => people.get(w)?.factionId === house.id));
            if (known) continue;
            // People at home are accounted for even where the death record had no witnesses.
            let where = member.locationId;
            let atHome = false;
            for (let hops = 0; where && hops < 8; hops++) {
                if (where === house.seatLocationId) { atHome = true; break; }
                where = state.locations.find(l => l.id === where)?.parentId ?? null;
            }
            if (atHome) continue;
            const inquiry = appendWorldFact(state, makeFact({ day, kind: 'said_in_public', visibility: 'faction',
                summary: `${house.name} opened an inquiry after ${member.name}'s life lamp went out. No account of the death has reached the house.`,
                factionIds: [house.id], locationId: house.seatLocationId,
                actors: [{ id: member.id, name: member.name, role: 'unaccounted for' }],
                data: { lampInquiry: member.id, causeUnknownToHouse: true } }), { bystanders: false });
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
