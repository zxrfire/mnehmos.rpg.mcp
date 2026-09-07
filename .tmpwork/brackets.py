import io

p = 'src/engine/world/gatherings.ts'
s = io.open(p, encoding='utf-8').read()

# ── a placing knows which board it was on ───────────────────────────────
s = s.replace("""export interface GatheringPlacing {
    npcId: string;
    name: string;
    factionId: string | null;
    /** 1 is first. Ties are broken deterministically, never left equal. */
    place: number;
    /** The scoring number, for a harness that wants to see the distribution. */
    score: number;
}""",
"""export interface GatheringPlacing {
    npcId: string;
    name: string;
    factionId: string | null;
    /** 1 is first ON THEIR OWN BOARD. Ties broken deterministically, never equal. */
    place: number;
    /** The scoring number, for a harness that wants to see the distribution. */
    score: number;
    /**
     * The realm the board was run at.
     *
     * The design owner: *"remember those competitions are by realm too, so you
     * can have a qi condensation winner, a foundation establishment winner, and
     * so on."*
     *
     * Which is how the genre works and also the only way the thing means
     * anything: ranking a Qi Condensation disciple against a Core Formation one
     * measures which of them is further along, which everybody already knew.
     * Bracketed, a first place is a statement about the people who could
     * plausibly have beaten you.
     */
    bracket: RealmKey;
}""", 1)

s = s.replace("""function place(npc: NpcRecord, at: number, score: number): GatheringPlacing {
    return { npcId: npc.id, name: npc.name, factionId: npc.factionId, place: at, score };
}""",
"""function place(npc: NpcRecord, at: number, score: number): GatheringPlacing {
    return {
        npcId: npc.id,
        name: npc.name,
        factionId: npc.factionId,
        place: at,
        score,
        bracket: realmForOrdinal(npc.cultivation.realmOrdinal).key
    };
}

/**
 * The boards a field is split into, strongest bracket first.
 *
 * Read off the realm ladder rather than a list here, so a renamed or added tier
 * is a board without anybody touching this file.
 */
function boardsFor(entrants: readonly NpcRecord[]): Map<RealmKey, NpcRecord[]> {
    const boards = new Map<RealmKey, NpcRecord[]>();
    for (const npc of entrants) {
        const key = realmForOrdinal(npc.cultivation.realmOrdinal).key;
        const board = boards.get(key);
        if (board) board.push(npc); else boards.set(key, [npc]);
    }
    return boards;
}""", 1)

# ── the competition runs one board per realm ────────────────────────────
s = s.replace("""    const scored = attendees.map(npc => {
        const power = assessPower(combatantOf(npc, state), { ambient: 'normal' }).total;
        const showing = 1 + (rng.next() - 0.5) * 2 * SHOWING_SPREAD;
        return { npc, score: power * showing };
    }).sort((a, b) => b.score - a.score || (a.npc.id < b.npc.id ? -1 : 1));

    for (let i = 0; i < scored.length; i++) {
        placings.push(place(scored[i].npc, i + 1, scored[i].score));
    }""",
"""    // ONE BOARD PER REALM. Ranking a Qi Condensation disciple against a Core
    // Formation one measures which of them is further along, which everybody
    // in the room already knew. Bracketed, a first place is a statement about
    // the people who could plausibly have beaten you - and a house comes away
    // with a Qi Condensation winner AND a Foundation winner, which is what a
    // sect competition in this genre produces.
    const scored: { npc: NpcRecord; score: number }[] = [];
    for (const [, board] of boardsFor(attendees)) {
        const ranked = board.map(npc => {
            const power = assessPower(combatantOf(npc, state), { ambient: 'normal' }).total;
            const showing = 1 + (rng.next() - 0.5) * 2 * SHOWING_SPREAD;
            return { npc, score: power * showing };
        }).sort((a, b) => b.score - a.score || (a.npc.id < b.npc.id ? -1 : 1));

        for (let i = 0; i < ranked.length; i++) {
            placings.push(place(ranked[i]!.npc, i + 1, ranked[i]!.score));
        }
        scored.push(...ranked);
    }""", 1)

# ── prestige is per board, so a small board is not a free win ───────────
s = s.replace("""    for (const p of placings) {
        if (!p.factionId) continue;
        const faction = state.factions.find(f => f.id === p.factionId);
        if (!faction) continue;
        const share = placings.length <= 1 ? 0 : 1 - 2 * ((p.place - 1) / (placings.length - 1));
        faction.resources.prestige = Number(faction.resources.prestige ?? 0) + share;
    }""",
"""    // AGAINST THE BOARD THEY WERE ON, not against the room. Coming first in a
    // field of two says less than coming first in a field of twelve, and a
    // bracket with one person in it is not a win at all - it is somebody
    // standing on a stage alone.
    const boardSize = new Map<RealmKey, number>();
    for (const p of placings) boardSize.set(p.bracket, (boardSize.get(p.bracket) ?? 0) + 1);
    for (const p of placings) {
        if (!p.factionId) continue;
        const faction = state.factions.find(f => f.id === p.factionId);
        if (!faction) continue;
        const size = boardSize.get(p.bracket) ?? 1;
        const share = size <= 1 ? 0 : 1 - 2 * ((p.place - 1) / (size - 1));
        faction.resources.prestige = Number(faction.resources.prestige ?? 0) + share;
    }""", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('brackets in')
