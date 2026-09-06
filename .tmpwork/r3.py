import io

p = 'src/web/turn-engine.ts'
s = io.open(p, encoding='utf-8').read()

old = """                const sheet = this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible,
                    techniqueCeiling(
                        cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap,
                        // Or the sheet sends somebody to buy a book that is in
                        // their bag. See `techniqueCeiling`.
                        copiesHeldBy(this.db, cultivator.id).length > 0
                    ).line
                ));"""
new = """                const sheet = this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible,
                    techniqueCeiling(
                        cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap,
                        // Or the sheet sends somebody to buy a book that is in
                        // their bag. See `techniqueCeiling`.
                        copiesHeldBy(this.db, cultivator.id).length > 0
                    ).line
                ));
                // AND WHAT THEY ARE ACTUALLY CARRYING, when it is close enough
                // to matter. The design owner: *"objects have volume and
                // weight"*, *"how much you can carry is limited by volume and
                // weight by cultivation level."*
                //
                // Silent below seven tenths, and it names WHICH of the two ran
                // out - a pouch of pills is heavy and small, a bundle of herbs
                // is the reverse, and "it will not fit" and "you cannot lift
                // it" send somebody to do two different things. See
                // `what-a-body-can-carry-and-what-a-ring-holds.ts`.
                const load = whatAllOfThatTakes(allPouchRows(this.db, cultivator.id));
                const carrying = whatCarryingThatIsLike(
                    load, whatABodyCanCarry(cultivator.realmOrdinal)
                );
                if (carrying !== null) {
                    sheet.facts.lines.push(carrying);
                    sheet.facts.prose = `${sheet.facts.prose}\\n\\n${carrying}`;
                }"""
assert old in s, 'status block not found'
s = s.replace(old, new, 1)

s = s.replace("import { aSealHereMeansAnUndrawnPocket } from '../engine/world/locations.js';",
"import { aSealHereMeansAnUndrawnPocket } from '../engine/world/locations.js';\n"
"import {\n"
"    whatABodyCanCarry,\n"
"    whatAllOfThatTakes,\n"
"    whatCarryingThatIsLike\n"
"} from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── and a pouch reader that returns every kind, artifacts included ───────
p2 = 'src/server/consolidated/cultivation-support.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """function allPouchRows(db: Database.Database, cultivatorId: string): PouchEntry[] {"""
new2 = """/**
 * EVERY row in a pouch, artifacts included.
 *
 * `listPouch` drops artifacts and `listCarriedArtifacts` keeps only those,
 * because the two callers that existed each wanted one half. Weighing a pouch
 * wants all of it: a carried blade is the heaviest thing in there and leaving
 * it out would report a load that is not the load.
 */
export function everythingInThePouch(
    db: Database.Database,
    cultivatorId: string
): PouchEntry[] {
    return allPouchRows(db, cultivatorId);
}

function allPouchRows(db: Database.Database, cultivatorId: string): PouchEntry[] {"""
assert old2 in s2, 'allPouchRows not found'
s2 = s2.replace(old2, new2, 1)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
