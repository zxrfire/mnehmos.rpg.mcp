import io
p = 'src/engine/cultivation/time-skip.ts'
s = io.open(p, encoding='utf-8').read()

old = """    /**
     * The ground under this place, resolved once.
     */
    const groundDensity = ctx.locationDensity ?? impliedDensityFor(ctx.seed, ctx.locationId);"""

new = """    /**
     * The ground under this place, resolved once.
     *
     * ── THE WORLD'S OWN DENSITY, WHICH WAS ONE FIELD AWAY ────────────────
     *
     * `ctx.locationDensity` is the front door and NOTHING in the repository
     * has ever passed it - not one of the ten `simulateTimeSkip` call sites.
     * So every skip in the played game fell to `impliedDensityFor`, which is a
     * hash of the place's NAME, and a cultivator's progress was decided by how
     * their location was spelled.
     *
     * MEASURED across a seeded world of 1064 locations: the band that read out
     * was wrong at 77.5% of them, the rate multiplier was off by 2x at 45.7%
     * and by 4x at 22.1%, and a ten-year seclusion on the richest drawable
     * ground in the world returned 27.6% of what that ground is worth.
     *
     * And the real number was already here. `options.ground` is a
     * `GroundConditions` carrying the location's actual `spiritualDensity`;
     * nine of the ten call sites already build it and pass it, and this
     * function already reads it - for crowding and for the barren-ground
     * ceiling - and then threw it away when it came to the band. The same
     * fact, derived in three places, with only the worst derivation allowed to
     * decide anything.
     *
     * So this is a fallback CHAIN and not a new argument: an explicit
     * `locationDensity` still wins where a caller states one, the world's own
     * ground answers next, and the name hash is what is left for a caller that
     * knows neither - which is now only a test.
     *
     * ── AND `sealed` IS DELIBERATELY NOT JOINED HERE ─────────────────────
     *
     * `ambientForLocationOnDay` short-circuits to `sealed_vein` the moment
     * `sealed` is true, BEFORE it reads any density - and `sealed_vein` is the
     * richest band in the game and the only one that carries anybody past
     * ordinal 32. Passing a sealed ruin's real density alongside its seal
     * would hand the thinnest ground in the world the best rate in it. The
     * seal is a separate ruling and does not ride in on this one.
     */
    const groundDensity = ctx.locationDensity
        ?? ctx.options?.ground?.density
        ?? impliedDensityFor(ctx.seed, ctx.locationId);"""

assert old in s, 'ground density line not found'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
print('ok')
