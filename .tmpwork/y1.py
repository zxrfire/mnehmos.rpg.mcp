import io

p = 'src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.ts'
s = io.open(p, encoding='utf-8').read()

old = """/**
 * The rung at which a house issues one.
 *
 * The design owner: *"anything higher than outer disciple inclusive."* Index
 * rather than a name, because every house names its rungs differently and the
 * ladder is a house's own - what they share is that the bottom rung is servants
 * and hangers-on, and the first rung that is a DISCIPLE is where a house starts
 * putting its name on somebody.
 */
export const THE_RUNG_A_HOUSE_ISSUES_AT = 1;

/** Whether somebody at this rung carries their house's token. */
export function carriesATokenAt(rankIndex: number): boolean {
    return rankIndex >= THE_RUNG_A_HOUSE_ISSUES_AT;
}"""

new = """/**
 * The rung at which a house issues one.
 *
 * The design owner: *"anything higher than outer disciple inclusive."* Index
 * rather than a name, because every house names its rungs differently and the
 * ladder is a house's own - what they share is that the bottom rung is servants
 * and hangers-on, and the first rung that is a DISCIPLE is where a house starts
 * putting its name on somebody.
 */
export const THE_RUNG_A_HOUSE_ISSUES_AT = 1;

/** Whether somebody at this rung carries their house's token. */
export function carriesATokenAt(rankIndex: number): boolean {
    return rankIndex >= THE_RUNG_A_HOUSE_ISSUES_AT;
}

/**
 * THE REALM A PLATE IS CUT AT.
 *
 * The design owner: *"let's make life plates a core formation craft. Anyone
 * less than that doesn't get one. Same for identity tokens"*, corrected a
 * moment later to *"someone at least FOUNDATION must craft it for you."*
 *
 * A HOUSE-LEVEL GATE AND NOT A PERSON-LEVEL ONE, which is the whole of what it
 * changes. It is not that a disciple must be Core Formation to be given a plate
 * - it is that somebody in the house has to be Core Formation to CUT one. A
 * house with nobody at that rung has no plates at all, for anybody: no roll it
 * can read, no notice when one of its own dies, and no token its members can
 * prove themselves with.
 *
 * Which is a real difference between a house and a gathering of people, and it
 * arrives without a rule being written for it. A hill sect is not a lesser
 * version of a court; it is a body that cannot do this at all.
 *
 * ONE RUNG UNDER A QI SEAL, and the gap is the point. Sealing a person opens at
 * Core Formation; cutting the jade that says who they are opens a realm below
 * it. Making the thing that proves an identity is ordinary craft, and taking
 * somebody's ability to draw is not - so most houses can issue and far fewer
 * can hold.
 *
 * Read off the ladder rather than written as a number, for the same reason
 * `qiSealOpensAt` is: the tiers have been renamed more than once and a constant
 * copied out of them is a coincidence maintained by attention.
 */
export const THE_REALM_A_PLATE_IS_CUT_AT = 'foundation_establishment';

export function platesAreCutAt(): number {
    const tier = REALM_TIERS.find(row => row.key === THE_REALM_A_PLATE_IS_CUT_AT);
    if (!tier) {
        throw new Error(
            `No realm tier is keyed ${THE_REALM_A_PLATE_IS_CUT_AT}. Cutting a plate is gated on a `
            + 'realm rather than a number, so a renamed tier has to fail loudly here rather than '
            + 'silently giving every house plates or none.'
        );
    }
    return tier.ordinalStart;
}

/** Whether this hand could cut a plate or a token. */
export function couldCutAPlate(ordinal: number): boolean {
    return realmForOrdinal(ordinal).ordinalStart >= platesAreCutAt();
}

/**
 * Whether this house can issue at all, off the best hand it has.
 *
 * The house's own question, asked once, rather than a check repeated per
 * member: either somebody here can cut them and everybody eligible gets one, or
 * nobody can and the house has none.
 */
export function thisHouseCanIssue(ordinalsOnTheRoll: readonly number[]): boolean {
    return ordinalsOnTheRoll.some(couldCutAPlate);
}"""
assert old in s, 'rung block not found'
s = s.replace(old, new, 1)
s = s.replace("import { makeObject, type ObjectRecord } from './possessions.js';",
              "import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';\n"
              "import { makeObject, type ObjectRecord } from './possessions.js';")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── the seeder asks the house first ─────────────────────────────────────
p2 = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """        const plateRoom = roomFor(WHERE_THE_PLATES_HANG);
        for (const member of state.npcs) {"""
new2 = """        //
        // AND ONLY WHERE THE HOUSE CAN CUT THEM. A plate is a Core Formation
        // craft, so a house with nobody at that rung has none at all - no roll
        // it can read, no notice when one of its own dies, and no token its
        // members can prove themselves with. That is a real difference between
        // a house and a gathering of people, and it needed no rule of its own.
        const onTheRoll = state.npcs
            .filter(npc => npc.factionId === house.id && npc.status === 'alive')
            .map(npc => npc.cultivation.realmOrdinal);
        if (!thisHouseCanIssue(onTheRoll)) continue;

        const plateRoom = roomFor(WHERE_THE_PLATES_HANG);
        for (const member of state.npcs) {"""
assert old2 in s2, 'seed loop not found'
s2 = s2.replace(old2, new2, 1)
s2 = s2.replace("""    WHERE_THE_PLATES_HANG,
    carriesATokenAt,
    issueTo
} from './a-house-knows-its-own-by-a-plate-and-a-token.js';""",
"""    WHERE_THE_PLATES_HANG,
    carriesATokenAt,
    issueTo,
    thisHouseCanIssue
} from './a-house-knows-its-own-by-a-plate-and-a-token.js';""")
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
