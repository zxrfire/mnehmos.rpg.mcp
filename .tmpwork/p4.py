import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""/** The stream a treasury is drawn on. Not the world seed: see `seedTreasuries`. */
const WHAT_A_HOUSE_KEEPS = 'treasury:what-a-house-keeps';

""", "")
s = s.replace("""/**
 * Fill every house's treasury, and return the rows to file.
 *
 * Deterministic off the world seed and the house's own id, so a world reseeded
 * holds the same things, and two houses of the same standing do not hold
 * identical treasuries.
 *
 * Called from the seeder alongside `seedHouseWards`, and idempotent by id: a
 * house's furnace is `furnace-<id>` and running twice replaces rather than
 * duplicates.
 */""",
"""/**
 * Fill every house's treasury, and return the rows to file.
 *
 * NOTHING IS DRAWN. What a house keeps is a function of the house - its
 * standing, its founding, and how long since it had a peak - so there is no
 * RNG here at all and no stream name to keep. Two houses of the same standing
 * hold the same shape of treasury, which is correct: what makes one different
 * from another is what has HAPPENED to it since, and that is the world sim's
 * job rather than a draw at seeding.
 *
 * Called from the seeder alongside `seedHouseWards`, and idempotent by id: a
 * house's furnace is `furnace-<id>` and running twice replaces rather than
 * duplicates.
 */""")
s = s.replace("""
/** Exported for the tests and probes that pin the shape. */
export const WHAT_A_TREASURY_IS_DRAWN_ON = WHAT_A_HOUSE_KEEPS;
""", "")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
