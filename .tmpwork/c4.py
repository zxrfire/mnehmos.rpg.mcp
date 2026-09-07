import io, os, re

def upto(s, start, end, label):
    a = s.find(start); assert a >= 0, 'start ' + label
    b = s.find(end, a + len(start)); assert b >= 0, 'end ' + label
    return s[:a] + s[b:]

# ── the surviving writer takes one record too, and gets a transaction ───
p = 'src/storage/repos/obligation.repo.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace(""" * `encounters.ts` still holds its own copy of this insert. The two are the same
 * statement and the older one wants deleting in favour of this when its file is
 * free; until then, both write the same columns from the same record type.
 */""",
""" * THERE WAS A SECOND COPY of this insert in `encounters.ts` - the same 23
 * columns from the same record type, exported as `writeObligation` and reached
 * from 41 sites. It is gone, and this is the only writer.
 *
 * AND IT COMMITS ONCE. It was a bare loop of N autocommits, so a span that
 * opened forty accounts committed forty times and a failure part-way left some
 * of them standing. `db.transaction` nests, which is load-bearing here: most
 * callers are already inside a transition's boundary.
 */""", 1)

s = s.replace("""export function writeObligations(
    db: ObligationWriteDb,
    records: readonly ObligationRecord[]
): number {
    if (records.length === 0) return 0;
    const statement = db.prepare(`""",
"""export function writeObligations(
    db: ObligationWriteDb,
    records: readonly ObligationRecord[]
): number {
    if (records.length === 0) return 0;
    const write = (): number => writeThemAll(db, records);
    // A handle without `transaction` is a caller that already holds one, or a
    // test double. Either way the rows still go down.
    return typeof db.transaction === 'function' ? db.transaction(write)() : write();
}

/** One record, for a caller that has exactly one. */
export function writeOneObligation(
    db: ObligationWriteDb,
    record: ObligationRecord
): ObligationRecord {
    writeObligations(db, [record]);
    return record;
}

function writeThemAll(db: ObligationWriteDb, records: readonly ObligationRecord[]): number {
    const statement = db.prepare(`""", 1)

s = s.replace("""/** The handle a write needs. Separate from the read one so neither widens. */
export interface ObligationWriteDb {
    prepare(sql: string): { run(params: Record<string, unknown>): unknown };
}""",
"""/** The handle a write needs. Separate from the read one so neither widens. */
export interface ObligationWriteDb {
    prepare(sql: string): { run(params: Record<string, unknown>): unknown };
    /** Present on a real connection; absent on a caller's double. */
    transaction?<T>(fn: () => T): () => T;
}""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── delete the copy ─────────────────────────────────────────────────────
p = 'src/web/encounters.ts'
s = io.open(p, encoding='utf-8').read()
a = s.find("export function writeObligation(")
assert a >= 0
# back up over its doc comment
doc = s.rfind('/**', 0, a)
b = s.find("\nfunction writeObligationRow(db: DatabaseHandle, record: ObligationRecord): ObligationRecord {")
assert b >= 0
end = s.find("\n}\n", b)
assert end >= 0
s = s[:doc] + s[end + 3:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('writer merged')
