import io

p = 'src/engine/world/the-world-changing-on-its-own.ts'
s = io.open(p, encoding='utf-8').read()

# ── the pass, wired where the wars are fought ───────────────────────────
anchor = """        // Wars that reached the day they were scheduled to end. BEFORE the
        // statuses, so a war that ended this year is a road open this year."""
add = """        // AND WHAT A HOUSE DID ABOUT LOSING ONE. A treasury that is only ever
        // spent on payroll and rebuilding is a savings account; what makes it a
        // war chest is that a house watching the thing end opens it. The
        // decision is not the treasury's - it is the elders' and the
        // patriarch's - and `what-a-house-opens-its-treasury-for.ts` puts it to
        // them through the same room that decides whether one sword leaves the
        // armoury.
        events.push(...housesOpeningTheirVaults(
            state,
            withinSpan(year * 365 + 62, fromDay, toDay)
        ));

        // Wars that reached the day they were scheduled to end. BEFORE the
        // statuses, so a war that ended this year is a road open this year."""
assert anchor in s
s = s.replace(anchor, add, 1)

# ── the pass itself ─────────────────────────────────────────────────────
tail_anchor = "function applyBookAcquisition(state: WorldState, year: number, day: number): number {"
pass_src = '''/**
 * HOUSES AT WAR, OPENING WHAT THEY HOLD.
 *
 * One pass, once a year, over the houses a war names. Nothing here decides
 * anything: it reads how the war is going off the compound (`HALLS_DOWN`, which
 * `what-a-year-of-war-does-to-a-compound.ts` already counts), puts the question
 * to the house's own elders, and moves what they agreed to move.
 *
 * ARMING IS THE DISCRETE HALF and the only half that produces an event. Stones
 * leaving for a war are a rate - nobody remembers the year the house paid for
 * arrows - but a house taking its good weapons out of the vault and putting
 * them in disciples' hands is a thing everybody who was there remembers, and it
 * is a LOAN: ownership never moves and the house can call every one back in.
 */
function housesOpeningTheirVaults(state: WorldState, day: number): PressureEvent[] {
    const out: PressureEvent[] = [];
    const onDay = Math.floor(day);

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        if (!house.tags.includes('at_war')) continue;

        const how = howTheWarGoesFor({
            atWar: true,
            hallsDown: Number(house.resources[HALLS_DOWN] ?? 0)
        });
        // A house that is holding its own does not empty its vault, and the
        // room says so on its own - this is only the cheap exit before the
        // roll is built.
        if (how === 'at_war' && !house.tags.includes('losing')) {
            // still asked, because a room can be open-handed. See the rate.
        }

        const members = state.npcs.filter(npc =>
            npc.factionId === house.id && npc.status === 'alive');
        if (members.length === 0) continue;

        const armed = armItsOwn({
            how,
            roll: members.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
            rankCount: house.ranks.length,
            holds: state.objects.filter(o => o.ownerId === house.id),
            takers: members.map(npc => ({
                id: npc.id,
                name: npc.name,
                ordinal: npc.cultivation.realmOrdinal
            })),
            houseName: house.name,
            onDay
        });
        if (armed.lent.length === 0) continue;

        // The rows, moved. One write per object that actually left.
        const moved = new Map(armed.objects.map(o => [o.id, o]));
        for (let i = 0; i < state.objects.length; i++) {
            const next = moved.get(state.objects[i].id);
            if (next) state.objects[i] = next;
        }

        const fact = appendWorldFact(state, {
            day: onDay,
            kind: 'shared_event',
            scale: 'faction',
            summary: `${house.name} opened its vault and armed its own: `
                + `${armed.lent.length} of its own things into its own hands, lent.`,
            actors: armed.lent.slice(0, 4).map(l => ({
                id: l.toId, name: l.toName, role: 'armed'
            })),
            witnessIds: [],
            locationId: null,
            factionIds: [house.id],
            visibility: 'faction',
            magnitude: how === 'about_to_lose' ? 0.7 : 0.45,
            data: { how, lent: armed.lent.length }
        });

        out.push({
            kind: 'house_armed_its_own',
            onDay,
            fact,
            touched: {
                factions: [house.id],
                locations: [],
                npcs: armed.lent.map(l => l.toId)
            },
            deaths: []
        });
    }

    return out;
}

'''
assert tail_anchor in s
s = s.replace(tail_anchor, pass_src + tail_anchor, 1)

# ── imports ─────────────────────────────────────────────────────────────
s = s.replace("import {\n    isTheWorldsToMove,",
"""import {
    armItsOwn,
    howTheWarGoesFor
} from './what-a-house-opens-its-treasury-for.js';
import { HALLS_DOWN } from './what-a-year-of-war-does-to-a-compound.js';
import {
    isTheWorldsToMove,""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('wired')
