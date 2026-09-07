import io

# ══════════════════════════════════════════════════════════════════════════
# THE THREE WORDS, ONE PER SCOPE. The design owner:
#
#     seal      = people
#     locked    = room
#     forbidden = site
#
# One field was carrying all three and they met.
# ══════════════════════════════════════════════════════════════════════════

# ── 1. the site word ────────────────────────────────────────────────────
p = 'src/engine/cultivation/ambient.ts'
s = io.open(p, encoding='utf-8').read()

old = """    /**
     * This location is a pocket nothing has drawn on: an unopened ruin, a
     * sealed vein, a secret realm. Supplied by the world layer from real
     * state; the engine holds no map and will never infer it.
     */
    sealed?: boolean;"""
new = """    /**
     * This SITE is forbidden ground: an unopened ruin, an untouched vein, a
     * secret realm. Nothing has drawn on what is in there, which is why it is
     * rich. Supplied by the world layer from real state; the engine holds no
     * map and will never infer it.
     *
     * ── THREE WORDS, ONE PER SCOPE ──────────────────────────────────────
     *
     * The design owner, settling a collision that had cost real money:
     *
     *     seal      = people      a qi seal, on a person, taking what they draw
     *     locked    = room        a door with a key on it
     *     forbidden = site        ground nothing has drawn on, and rich for it
     *
     * All three were `sealed`, and two of them met here. `LocationRecord.sealed`
     * means a LOCKED DOOR - `architecture.ts` writes it from `PurposeSpec.sealed`
     * and puts a `data.keyId` on the row two lines later - and this function
     * returns `sealed_vein` the moment its flag is true, BEFORE it reads any
     * density, and `sealed_vein` is the richest band in the game.
     *
     * Measured on a seeded world: 112 `sealed` locations, ELEVEN of them
     * genuine forbidden ground and 101 locked doors - 36 treasuries, 27
     * discipline halls, 23 archives - every one of them reporting the best
     * cultivation ground in the world.
     *
     * A guard was added at the caller that was forwarding it. This is the other
     * half: with three facts under three names, nothing can forward one as
     * another by accident again.
     */
    forbidden?: boolean;"""
assert old in s, 'SiteConditions.sealed not found'
s = s.replace(old, new, 1)

s = s.replace("""    // A sealed site does not roll and does not refresh. What is in there has
    // been in there since somebody closed it, and it stays until it is drawn
    // down - which is what makes it something to hold rather than to visit.
    if (opts.sealed) return 'sealed_vein';""",
"""    // FORBIDDEN GROUND does not roll and does not refresh. What is in there has
    // been in there since somebody closed it, and it stays until it is drawn
    // down - which is what makes it something to hold rather than to visit.
    // Not a locked door and not a sealed person: see `SiteConditions.forbidden`
    // for the three words and what confusing two of them cost.
    if (opts.forbidden) return 'sealed_vein';""")
s = s.replace("""// of that 1.0 was in the arguments. The same omission also means `sealed` is
// never passed, so `sealed_vein` is unreachable in play.""",
"""// of that 1.0 was in the arguments. The same omission also means `forbidden` is
// never passed, so `sealed_vein` is unreachable in play.""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. the skip context follows ─────────────────────────────────────────
p2 = 'src/engine/cultivation/time-skip.ts'
s2 = io.open(p2, encoding='utf-8').read()
s2 = s2.replace("""    /** The location is a sealed pocket nothing has drawn on. */
    sealed?: boolean;""",
"""    /**
     * This SITE is forbidden ground - nothing has drawn on it.
     *
     * `forbidden` and not `sealed`, on the owner's vocabulary: seal is people,
     * locked is a room, forbidden is a site. See `SiteConditions.forbidden`.
     */
    forbidden?: boolean;""")
s2 = s2.replace("            sealed: ctx.sealed", "            forbidden: ctx.forbidden")
s2 = s2.replace("        sealed: ctx.sealed", "        forbidden: ctx.forbidden")
s2 = s2.replace("""     * ── AND `sealed` IS DELIBERATELY NOT JOINED HERE ─────────────────────""",
"""     * ── AND `forbidden` IS DELIBERATELY NOT JOINED HERE ──────────────────""")
s2 = s2.replace("""     * `ambientForLocationOnDay` short-circuits to `sealed_vein` the moment
     * `sealed` is true, BEFORE it reads any density - and `sealed_vein` is the
     * richest band in the game and the only one that carries anybody past
     * ordinal 32. Passing a sealed ruin's real density alongside its seal
     * would hand the thinnest ground in the world the best rate in it. The
     * seal is a separate ruling and does not ride in on this one.""",
"""     * `ambientForLocationOnDay` short-circuits to `sealed_vein` the moment
     * `forbidden` is true, BEFORE it reads any density - and `sealed_vein` is
     * the richest band in the game and the only one that carries anybody past
     * ordinal 32. Passing a locked vault's real density alongside a forbidden
     * flag would hand the thinnest ground in the world the best rate in it.
     * Forbidden ground is a separate ruling and does not ride in on this one.""")
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('src ok')
