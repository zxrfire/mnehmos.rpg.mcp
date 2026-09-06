import io

# ── 1. the hall's qi is hardcoded low, not lifted-down from the host ────
p = 'src/engine/world/architecture.ts'
s = io.open(p, encoding='utf-8').read()

old = """    const qi = clampQiDensity(Math.min(QI_DENSITY_MAX, host.qiDensity + spec.qiLift));"""
new = """    // ── A DISCIPLINE HALL IS POOR GROUND, FULL STOP ──────────────────────
    //
    // The design owner: *"prisoners are just sealed and thrown into a qi poor
    // area"*, *"hardcode the qi levels there to low."*
    //
    // Every other room in a compound is the host's ground plus or minus a lift,
    // which is right: a furnace room is the mountain with a furnace on it. A
    // discipline hall is not that. It is a room a house PUT somewhere poor, and
    // a -10 against a rich mountain still leaves rich ground - the seat at 80
    // gives a cell at 70, which is better than most of the world. A house on a
    // strong vein would have the best prison in the province.
    //
    // So the floor is absolute rather than relative, and it is a wall rather
    // than a formula, because a formula invites an argument about the formula.
    // The seal on the PERSON is the other half and does the rest of the work -
    // see `a-qi-seal-is-put-on-a-person.ts`. Neither is doing the other's job.
    const qi = spec.qiLift <= WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING.lift
        ? WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING.density
        : clampQiDensity(Math.min(QI_DENSITY_MAX, host.qiDensity + spec.qiLift));"""
assert old in s, 'buildRoom density line not found'
s = s.replace(old, new, 1)

anchor = "const PURPOSE: Record<RoomPurpose, PurposeSpec> = {"
block = """/**
 * The ground a house puts somebody it is holding on.
 *
 * `lift` is the marker rather than a magnitude: the discipline hall carries the
 * only negative lift in the table, so "at or below this" names that room and
 * nothing else, and a second room built to be bad ground would join it by
 * saying so in its own spec rather than by anybody editing this.
 *
 * `density` is the absolute figure, hardcoded on the owner's instruction and
 * low enough that `typicalAmbientFor` reads it as the thinnest band there is.
 */
const WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING = Object.freeze({
    lift: -10,
    density: 2
});

"""
assert anchor in s
s = s.replace(anchor, block + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('architecture ok')
