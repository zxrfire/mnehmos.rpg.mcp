import io
p = 'src/engine/social-leverage/authority-for-an-order.ts'
s = io.open(p, encoding='utf-8').read()

old = """/** Who runs what in this house, off its own rooms and its own roll. */
export function portfoliosIn(input: {
    locations: readonly LocationRecord[];
    sectId: string;
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APortfolio[] {
    return whoIsInChargeOfWhat({
        rooms: theRoomsThisHouseHas(input.locations, input.sectId),
        roll: input.roll,
        rankCount: input.rankCount
    });
}"""

new = """/**
 * Who runs what in this house, off its own OFFICES and its own roll.
 *
 * ── A SELECTOR, NOT A SECOND SOURCE ──────────────────────────────────────
 *
 * The design owner: *"an office is not a sealed room"*, *"it is just a two-way
 * mapping - list of positions, list of people"*, and on the shape to move the
 * repo toward: *"I agree with redux, exactly what we need."*
 *
 * So the OFFICE TABLE is the store and this is a selector over it. It answers
 * the question the old callers ask - which ROOM does this person run - by
 * asking the offices which rooms they control, rather than by being a second
 * place that decides who runs what.
 *
 * `whoIsInChargeOfWhat` used to be the source: it dealt the sealed rooms
 * round-robin to the deciders, deepest first, which made an office a position
 * in a sorted array. Adding a room reassigned unrelated offices - measured,
 * when sealing the ancestral hall moved discipline past the rung that held it
 * and two played tests failed on a hard-coded name two subsystems away.
 *
 * Rooms with no office over them are simply not portfolios any more, which is
 * the point: a sealed door nobody answers for is a locked door.
 */
export function portfoliosIn(input: {
    locations: readonly LocationRecord[];
    sectId: string;
    roll: readonly OnTheRoll[];
    rankCount: number;
    /**
     * How much house this house is, on the `sectThreat(...).acting` scale.
     *
     * Optional and defaulted high, because most callers do not have it to hand
     * and the honest default is *"assume it can staff what it built"* - a house
     * that has an archive has somebody minding it. A caller that knows the
     * standing passes it and gets the smaller cabinet a hill sect really has.
     */
    acting?: number;
}): APortfolio[] {
    const rooms = theRoomsThisHouseHas(input.locations, input.sectId);
    const offices = whichOfficesAHouseHas({
        acting: input.acting ?? ENOUGH_HOUSE_TO_STAFF_WHAT_IT_BUILT,
        rooms
    });
    const held = whoHoldsEachOffice({
        offices, roll: input.roll, rankCount: input.rankCount
    });
    return held
        .filter(row => row.office.room !== null)
        .map(row => ({
            purpose: row.office.room as RoomPurpose,
            holderId: row.holderId,
            depth: roomAuthorityOf(row.office.room as RoomPurpose).depth
        }));
}

/**
 * The standing assumed for a caller that does not say.
 *
 * Above every `wantsAHouseOfAtLeast` in the table, so an unstated house gets
 * the full cabinet for the rooms it actually built. Deliberately not zero: a
 * missing argument should not silently strip a house of its offices.
 */
const ENOUGH_HOUSE_TO_STAFF_WHAT_IT_BUILT = 999;"""

assert old in s, 'portfoliosIn not found'
s = s.replace(old, new, 1)

s = s.replace("import { purposeOf, type LocationRecord } from '../world/architecture.js';",
              "import { purposeOf, type LocationRecord } from '../world/architecture.js';")
# imports
if "whichOfficesAHouseHas" not in s.split('\n\n')[0]:
    s = s.replace("import type { APortfolio } from './what-an-elder-is-in-charge-of.js';",
                  "import type { APortfolio } from './what-an-elder-is-in-charge-of.js';")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
