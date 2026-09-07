import io

p = 'src/engine/world/who-goes-out-for-a-house-and-what-comes-back.ts'
s = io.open(p, encoding='utf-8').read()

addition = '''
// ═════════════════════════════════════════════════════════════════════════
// AND WHERE THEY ACTUALLY GO
// ═════════════════════════════════════════════════════════════════════════

/**
 * WHERE A SENDING GOES, off the reason's own `needs` key.
 *
 * A posting used to be pitched at the house's own seat, which is not a place
 * anybody is sent TO - it is where they left from. Measured: 74 of 76 NPCs who
 * survived two hundred years never changed location once, because the only
 * pass that moves anybody filters `factionId === null` and half the world is in
 * a house.
 *
 * Nothing new decides this. `needs` already names what the errand is about, and
 * the predicate for each is already written in `NEED_PREDICATES` - a house that
 * has no rival cannot be sent at one. So the destination falls out of the same
 * key that decides whether the reason is open at all:
 *
 *     a_rival        their seat. A war is fought where somebody lives.
 *     an_ally        their seat. A marriage is somewhere.
 *     a_subsidiary   their seat. Tribute is collected from a place.
 *     a_find         the find. That is the whole errand.
 *     a_parent       their seat. A call comes from somewhere.
 *     ground         contested ground, which is what standing to means.
 *     nothing        out. Materials, recruits and escorts are errands whose
 *                    destination is not stated, and the honest answer is any
 *                    province that is not this one - which is also the answer
 *                    that makes a recruiting trip reach a lesser house.
 *
 * Null where the world holds nowhere to go, and a caller must read that as
 * "they went out and the record does not say where" rather than as home.
 */
export function whereASendingGoes(input: {
    needs: ReasonNeed;
    /** The house's own seat, so it can be excluded. */
    fromLocationId: string | null;
    /** Seats of the houses this reason is about, in the world's own order. */
    seatsInPlay: readonly string[];
    /** Places that are neither this house's nor anybody's seat. */
    elsewhere: readonly string[];
    /** Picks one. The caller's stream, so no draw anywhere else moves. */
    pick: (count: number) => number;
}): string | null {
    const notHome = (ids: readonly string[]): string[] =>
        ids.filter(id => id !== input.fromLocationId);

    const pool = input.needs === 'nothing' || input.needs === 'a_find'
        ? notHome(input.elsewhere)
        : notHome(input.seatsInPlay);

    // A house with a rival it cannot find the seat of still sends the party.
    // Falling back to elsewhere rather than to home, because the one thing that
    // is certainly wrong is a party posted to the hall it left.
    const chosen = pool.length > 0 ? pool : notHome(input.elsewhere);
    if (chosen.length === 0) return null;
    return chosen[Math.min(chosen.length - 1, Math.max(0, input.pick(chosen.length)))] ?? null;
}
'''

s = s.rstrip() + '\n' + addition
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('destination added')
