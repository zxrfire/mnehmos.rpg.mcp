import io

p = 'src/engine/world/the-world-changing-on-its-own.ts'
s = io.open(p, encoding='utf-8').read()

# ── 1. the party actually leaves ────────────────────────────────────────
old = """        sent++;

        for (const missing of sending.lost) {"""
new = """        sent++;

        // ── AND THEY GO ──────────────────────────────────────────────────
        //
        // The posting names a place off the reason's own `needs` key, and the
        // party stands there until the term is up. Before this a sending was
        // resolved without anybody moving: measured, 74 of 76 NPCs who survived
        // two hundred years never changed location once.
        //
        // `setLocation` is the mover, and it had no caller anywhere in the
        // repository.
        const goingTo = whereASendingGoes({
            needs: reason.needs,
            fromLocationId: faction.seatLocationId,
            seatsInPlay: state.factions
                .filter(f => f.id !== faction.id && f.dissolvedOnDay === null)
                .map(f => f.seatLocationId)
                .filter((id): id is string => id !== null),
            elsewhere: state.locations
                .filter(l => l.kind === 'region' && isBelowTheLid(l))
                .map(l => l.id),
            pick: count => rng.int(0, Math.max(0, count - 1))
        });
        const lost = new Set(sending.lost.map(m => m.id));
        if (goingTo !== null) {
            const partyIds = party.map(p => p.id);
            for (const member of party) {
                if (lost.has(member.id)) continue;
                const index = at.get(member.id);
                if (index === undefined) continue;
                const row = state.npcs[index];
                if (row === undefined || !isTheWorldsToMove(row)) continue;
                state.npcs[index] = {
                    ...setLocation(row, goingTo, day),
                    // `mustering` is the kind whose own doc names this
                    // machinery, and the one where `withIds` is the party
                    // rather than a companion. The term is what makes a party
                    // still out tellable from a party that never came home.
                    activity: {
                        kind: 'mustering',
                        note: `Out for the ${houseName(faction.name)} on ${reason.name.toLowerCase()}.`,
                        withIds: partyIds.filter(id => id !== member.id),
                        sinceDay: day,
                        untilDay: sending.returnsOnDay
                    }
                };
            }
        }

        for (const missing of sending.lost) {"""
assert old in s
s = s.replace(old, new, 1)

# ── 2. and they come home, before anybody new is sent ───────────────────
anchor = "        const posting = postingFor({"
head = s.index(anchor)
fn_start = s.rindex('function applySendings', 0, head)
body_start = s.index('{', s.index(')', fn_start)) + 1
s = s[:body_start] + """
    // ── FIRST, WHOEVER IS DUE BACK ───────────────────────────────────────
    //
    // Before a house sends anybody new, the people it already sent come home.
    // A party is away until its term is up, and the term is on the activity, so
    // nothing has to remember: a row whose `untilDay` has passed is a row whose
    // errand is over.
    //
    // Home is their house's seat. Somebody whose house dissolved while they
    // were out stays where they are, which is a truer answer than teleporting
    // them to a hall that is not there.
    bringHomeWhoeverIsDue(state, day);
""" + s[body_start:]

# ── 3. the homecoming ───────────────────────────────────────────────────
tail = "// THE YARD"
homecoming = '''/**
 * Everybody whose errand is over, standing where they started.
 *
 * Reads the term off the activity rather than a list of who is out, so a world
 * loaded from disk mid-sending brings the right people home without anything
 * having had to persist a roster of parties.
 */
function bringHomeWhoeverIsDue(state: WorldState, day: number): number {
    const seatOf = new Map(state.factions.map(f => [f.id, f.seatLocationId]));
    let home = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc === undefined || npc.status !== 'alive') continue;
        const doing = npc.activity;
        if (!doing || doing.kind !== 'mustering') continue;
        if (doing.untilDay === null || doing.untilDay === undefined) continue;
        if (day < doing.untilDay) continue;

        const seat = npc.factionId === null ? null : seatOf.get(npc.factionId) ?? null;
        state.npcs[i] = {
            ...(seat === null ? npc : setLocation(npc, seat, day)),
            activity: null
        };
        home++;
    }
    return home;
}

// THE YARD'''
assert tail in s
s = s.replace(tail, homecoming, 1)

# ── imports ─────────────────────────────────────────────────────────────
s = s.replace("""import {
    armItsOwn,""",
"""import { whereASendingGoes } from './who-goes-out-for-a-house-and-what-comes-back.js';
import {
    armItsOwn,""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('sending moves people')
