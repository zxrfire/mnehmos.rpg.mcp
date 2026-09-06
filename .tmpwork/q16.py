import io

# ── the two meanings of `sealed`, told apart where the field lives ──────
p = 'src/engine/world/locations.ts'
s = io.open(p, encoding='utf-8').read()

anchor = 'export function evaluateAccess('
i = s.index(anchor)
block = '''/**
 * WHETHER THIS PLACE'S SEAL IS A QI POCKET OR A LOCKED DOOR.
 *
 * `LocationRecord.sealed` is one field carrying two unrelated facts, and they
 * came from two different systems that both had a good reason for the word:
 *
 *   a RUIN, a sealed domain, a vein, a secret realm - nothing has drawn on what
 *   is in there since somebody closed it. `SiteConditions.sealed` in
 *   `ambient.ts` means exactly this, and says so: *"a pocket nothing has drawn
 *   on [...] the vein is rich."*
 *
 *   a VAULT or a CHAMBER inside a compound - the door is locked and you need
 *   the token. `architecture.ts` writes it from `PurposeSpec.sealed` and puts a
 *   `data.keyId` on the row two lines later, which is what settles the meaning.
 *
 * ── AND THE COLLISION WAS LIVE ───────────────────────────────────────────
 *
 * `ambientForLocationOnDay` returns `sealed_vein` the moment `sealed` is true,
 * before it reads any density - and `sealed_vein` is the richest band in the
 * game, four times the ordinary baseline. So every locked room in every
 * compound reported the best cultivation ground in the world: the archive, the
 * treasury, the tribute room, the under hall, and the punishment hall.
 *
 * The punishment hall is the one that makes it plain. It carries the ONLY
 * negative `qiLift` in the room table, put there so that *"time spent here is
 * time off the ladder"* and *"holding somebody is a punishment instead of an
 * inconvenience"* - and it was the best ground a cultivator could stand on.
 * A discipline hall you would queue for.
 *
 * Nothing here changes what a lock does. `evaluateAccess` reads the same field
 * for the same reason two lines below and is correct to. This says only which
 * of the two questions a caller is asking, so the qi reader stops answering
 * the door's question.
 */
export function aSealHereMeansAnUndrawnPocket(kind: LocationKind): boolean {
    switch (kind) {
        // Closed ground. The seal is the reason the qi is still in there.
        case 'ruin':
        case 'grave':
        case 'sealed_domain':
        case 'secret_realm':
        case 'forbidden_zone':
        case 'vein':
        case 'cave':
            return true;
        // Everything else that can be sealed is a door somebody locked, and a
        // locked door has never made a room rich.
        default:
            return false;
    }
}

'''
s = s[:i] + block + s[i:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── and the caller asks the right question ──────────────────────────────
p2 = 'src/web/turn-engine.ts'
s2 = io.open(p2, encoding='utf-8').read()
old = """        return ambientForBlock(run.seed, place, Math.floor(run.elapsedDays), {
            ...(density === undefined ? {} : { density }),
            ...(here ? { sealed: here.sealed } : {})
        });"""
new = """        // THE SEAL ONLY COUNTS WHERE IT MEANS AN UNDRAWN POCKET. A locked vault
        // is not a rich one, and this line used to say it was: `sealed` short
        // circuits `ambientForLocationOnDay` to `sealed_vein`, the richest band
        // in the game, so the archive, the treasury and the punishment hall all
        // reported the best cultivation ground in the world. See
        // `aSealHereMeansAnUndrawnPocket`.
        const sealedGround = here !== null
            && here.sealed
            && aSealHereMeansAnUndrawnPocket(here.kind);

        return ambientForBlock(run.seed, place, Math.floor(run.elapsedDays), {
            ...(density === undefined ? {} : { density }),
            ...(sealedGround ? { sealed: true } : {})
        });"""
assert old in s2, 'ambientFor not found'
s2 = s2.replace(old, new, 1)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
