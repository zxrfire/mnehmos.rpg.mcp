/**
 * An inheritance ground: finding it, standing outside it, going in, taking.
 *
 * Four steps and they are deliberately four, because each one is a different
 * decision with a different price. Approaching costs nothing; reading a face
 * from outside costs nothing; going IN spends days and can kill; taking is
 * what the whole thing was for. A model answering `{"intent": "go in and get
 * it"}` gets the listing, because the default intent of anything that commits
 * has to be the cheapest branch it has.
 *
 * Two gates on top of ordinary target resolution, and neither is this file's
 * invention:
 *
 * - A site whose awareness is below `named` CANNOT BE RESOLVED AT ALL. The
 *   catalog withholds the name, so there is nothing to type - which is why a
 *   villager can type thirteen of them and the rest have to reach the player
 *   from somebody first.
 * - A specific name that resolves to nothing does NOT fall through to the site
 *   at hand. Naming a grave you have only heard rumoured must not quietly open
 *   the one you were standing at an hour ago.
 *
 * And the structural gate underneath is the catalog's: `outsideViewOf` returns
 * a type with no `interior` key, `SiteFace` has no field that could hold one,
 * and the single call to `enterSite` sits below a recorded entry in a method
 * that has already spent the days. Three independent reasons rather than one
 * convention.
 *
 * ── HOW THIS IS ATTACHED ────────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.site(...)` resolves and typechecks exactly as it did when
 * the bodies sat in the class, and every line below is the line it was.
 * `src/web/README.md` has the argument and the warning about `private`.
 */

import { getTechnique } from '../data/cultivation/index.js';
import {
    type AdmissionReading,
    SITES,
    type Site,
    enterSite
} from '../data/cultivation/inheritance-trials.js';
import { assessPower, resolveExchange } from '../engine/cultivation/combat.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    describeDeath,
    evaluateDeathConditions,
    stagnationRemaining
} from '../engine/cultivation/survival.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { type Severity, createGrudge } from '../engine/social/grudges.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { locationHistory } from '../engine/world/locations.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    addToPouch,
    isGuidingErrorBody,
    removeFromPouch,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import { handleLearn } from '../server/consolidated/technique-manage.js';
import {
    type ActionName,
    DEFAULT_BURIAL_DAYS,
    DEFAULT_SITE_INTENT,
    SITE_INTENTS,
    type SiteIntent
} from './actions.js';
import { applyTimeSkip } from './apply.js';
import { type DatabaseHandle, PLAYER_ROLL_IDENTITY, writeObligation } from './encounters.js';
import { worldLocationFor } from './entities.js';
import {
    type SiteFace,
    factsForGateRefused,
    factsForGroundRefused,
    factsForGroundSurvived,
    factsForPlaceHistory,
    factsForRefusal,
    factsForSiteFace,
    factsForSiteInterior,
    factsForSiteListing,
    factsForSiteTaken,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    rungAndOrdinal
} from './facts.js';
import {
    type FoundGround,
    describeFoundGround,
    foundGroundIn,
    readFoundGroundAccess,
    resolveFoundGround
} from './ground-the-world-found.js';
import { loosePlaceKey } from './knowledge.js';
import {
    DEFAULT_LEGACY_INTENT,
    LEGACY_INTENTS,
    type LegacyIntent,
    handleLegacy,
    phraseIn,
    pouchStacks
} from './leaving-things-for-the-next-life.js';
import type { FiledOutcome } from './narrator.js';
import { refused, skipCalls, tollCalls, worldCalls } from './tool-result-prose.js';
import {
    type FateEvidence,
    type GateVerdict,
    awarenessOfSite,
    claimantOf,
    faceOf,
    forceAt,
    forceOrdinalOf,
    groundForceOrdinalOf,
    nameableSites,
    prizeImmortalItemIds,
    prizeOther,
    prizeTechniqueIds,
    readAccess,
    readGates,
    resolveSite
} from './trials.js';
import { ENTERING_DAYS, ENTERING_FOCUS, STARTING_AGE } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * The words that mean "the site in front of me" rather than naming one.
 *
 * The same defect `GENERIC_LIBRARY_PHRASE` exists for, and the same fix. The
 * parser hands over the noun phrase it found after the verb, and for the
 * commonest phrasings that phrase is generic - "the door", "the grave", "what
 * is behind the plate". Handing one of those to a fuzzy matcher resolves it:
 * "door" is contained in "The Door That Wants Somebody Not In the Record" and
 * scores over the threshold, so "I study the door" would open a specific
 * fate-gated trial three provinces away that the player has never heard of.
 * A generic phrase names nothing and falls through to the site at hand.
 */
const GENERIC_SITE_PHRASE =
    /^(?:the |a |an |this |that |it |what |whatever )*(?:door|doorway|gate|gateway|gate frame|threshold|marker|headstone|entrance|shaft|plate|standing stone|site|sites|place|trial|trials|grave|graves|tomb|tombs|crypt|crypts|barrow|barrows|undercroft|interment|inheritance|inheritance ground|inheritance grounds|grave goods?|prize|contents|manuals?|is behind.*|is inside.*|is in there|is left|behind.*|inside.*)$/i;

const GRAVE_UNFORGIVABLE_ORDINAL = 33;

const GRAVE_GRAVE_ORDINAL = 21;

/**
 * What emptying a piece of ground is worth to whoever holds it, by the rung the
 * ground is pitched at.
 *
 * Bands rather than a curve, and read off the site's own ordinal, so the same
 * table prices a Qi Condensation grave and the interment of somebody at the top
 * of the ladder. Aligned to the realm boundaries the rest of the game already
 * uses rather than chosen: `serious` opens at Foundation, `grave` at Core
 * Formation, `unforgivable` where the ladder stops producing people who can be
 * quietly robbed.
 */
const GRAVE_SERIOUS_ORDINAL = 13;

/** The ways of saying "here" that are not the name of anywhere. */
const HERE_ITSELF =
    /^(?:this|that|the)?\s*(?:place|ground|village|town|city|region|area|spot|here|it|ruin|ruins)$/i;

/**
 * How many things done to a place are read out at once.
 *
 * A place that has been fought over for three thousand years has a long log,
 * and a wall of them is a chronicle rather than an answer. The most recent
 * changes are the ones that made it what it is now.
 */
const PLACE_CHANGES_SHOWN = 3;

export const siteVerbs = {
    /** Sites this cultivator could put a name to. The gate under everything. */
    nameableFor(this: GameService, cultivator: Cultivator): Site[] {
        return nameableSites(siteId => this.knowledge.isAwareOf(cultivator.id, 'place', siteId));
    },

    /**
     * The world state a fate gate is allowed to turn on.
     *
     * Counted off the obligations ledger, which is real rows written by things
     * that happened. `generation > 0` is business inherited rather than
     * incurred, which is exactly what "carrying an obligation you did not take
     * on" means, and it is not a number that rises because somebody repeated an
     * activity - which is the test `FATE_IS_NOT_A_STAT` sets.
     */
    fateEvidence(this: GameService, cultivator: Cultivator): FateEvidence {
        const row = this.db
            .prepare(
                "SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND status = 'open' AND generation > 0"
            )
            .get(cultivator.id) as { n: number } | undefined;
        return { obligationsNotTakenOn: row?.n ?? 0 };
    },

    /**
     * Which site a sentence meant.
     *
     * A name resolves against the ones this cultivator may name and nothing
     * else, so a player cannot type their way into a grave they have never
     * heard of. A generic phrase - "the door", "the grave", "what is behind the
     * plate" - names nothing and falls through to the site they went to most
     * recently, which is a row rather than a guess, exactly the way "what
     * happened here" falls through to the ground underfoot.
     */
    siteMeant(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): { site: Site | null; namedSomethingUnknown: boolean } {
        const permitted = this.nameableFor(cultivator);
        const query = (target ?? '').trim();

        if (query.length >= 3 && !GENERIC_SITE_PHRASE.test(query)) {
            const named = resolveSite(query, permitted);
            // A specific name that resolved to nothing does NOT fall through to
            // the site at hand. Naming a grave the player has only heard
            // rumoured must not quietly open the one they were standing at an
            // hour ago - that is the same class of mistake as fuzzy-matching an
            // elder and dismissing the wrong person.
            return { site: named, namedSomethingUnknown: named === null };
        }

        const record = this.sites.atHand(run.id);
        const site = record ? permitted.find(entry => entry.id === record.catalogId) ?? null : null;
        return { site, namedSomethingUnknown: false };
    },

    /**
     * Ground the world found, in this province, that this cultivator may name.
     *
     * Gated on `isAwareOf` exactly as the authored sites are: the world knowing
     * about a ruin is not the player knowing about it, and listing every find
     * the moment it is uncovered would spend somebody else's discovery.
     */
    foundGroundFor(this: GameService, cultivator: Cultivator): FoundGround[] {
        if (!this.atHand) return [];
        const region = this.atHand.locations.find(
            row => row.kind === 'region'
                && loosePlaceKey(row.name) === loosePlaceKey(standingOf(cultivator).regionName)
        );
        return foundGroundIn(
            this.atHand,
            region?.id ?? null,
            id => this.knowledge.isAwareOf(cultivator.id, 'place', id)
        );
    },

    /**
     * Standing outside something the world uncovered.
     *
     * Free, like the authored approach: looking at a door costs nothing. What
     * it reports is STRUCTURE - character, scale, whose it was, what the ground
     * does - because that is what a find carries. There is no authored interior
     * to quote and none is invented; see `ground-the-world-found.ts`.
     *
     * The access read is the same `readAdmission` the authored sites use, so a
     * cap here refuses for the same reason a cap there does and the player
     * learns one rule rather than two.
     */
    approachFoundGround(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ground: FoundGround
    ): Execution {
        const lines = describeFoundGround(ground);
        const reading = readFoundGroundAccess(ground, cultivator.realmOrdinal);
        if (reading) {
            lines.push(
                reading.admitted && reading.survives
                    ? 'At your rung it would let you in, and let you out again.'
                    : reading.admitted
                        ? 'At your rung it would let you in. It would not let you out.'
                        : 'At your rung it would not have you at all.'
            );
        }

        const facts = factsForToolResult(`${ground.name}, from outside.`, lines);
        const floor = ground.access?.floorOrdinal;
        facts.structure.push(
            `Ground of ${ground.character} character`
            + `${ground.origin ? `, ${ground.origin} in origin` : ', of no origin the record states'}`
            + `${ground.scale ? `, at ${ground.scale} scale` : ', at no scale the record states'}. `
            + (ground.access
                ? `It admits ${ground.access.admits}`
                  + `${floor === undefined || floor === null
                      ? ' and states no floor'
                      : ` from no lower than ${rungAndOrdinal(floor)}`}. `
                : 'Nothing about who it admits is recorded on the find. ')
            + (ground.discoveredOnDay === undefined || ground.discoveredOnDay === null
                ? 'The day the world found it is unrecorded.'
                : `The world found it on day ${ground.discoveredOnDay}.`)
        );

        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [{
            name: 'engine.foundGroundIn',
            action: 'site',
            summary:
                `${ground.id} was found by the world's own prospecting and is nameable by this `
                + `cultivator. ${reading
                    ? `readAdmission at ordinal ${cultivator.realmOrdinal}: `
                      + `admitted=${reading.admitted}, survives=${reading.survives}.`
                    : 'No access recorded on the find; nothing read.'}`,
            ok: true
        }];
        return execution;
    },

    /** The pre-entry face, at whatever awareness this cultivator holds. */
    faceFor(this: GameService, site: Site, cultivator: Cultivator): SiteFace | null {
        const awareness = awarenessOfSite(site, this.knowledge.isAwareOf(cultivator.id, 'place', site.id));
        const view = faceOf(site, awareness);
        if (!view) return null;
        return {
            name: view.name,
            kind: view.kind,
            marker: view.outside.marker,
            rumour: view.outside.rumour,
            attributedTo: view.outside.attributedTo,
            lastPartySaid: view.outside.lastPartySaid,
            whatAKnowledgeablePartyReads: view.outside.whatAKnowledgeablePartyReads,
            whatAnIgnorantPartyConcludes: view.outside.whatAnIgnorantPartyConcludes,
            advertisedOrdinal: view.outside.advertisedOrdinal,
            grave: view.kind === 'grave'
                ? {
                    mannerOfDeath: view.mannerOfDeath,
                    burial: view.burial,
                    occupantOrdinal: view.occupantOrdinal,
                    yearsDead: view.yearsDead
                }
                : null
        };
    },

    /** The refusal every step gives when no site resolved. Costs nothing. */
    noSiteAtHand(this: GameService, action: ActionName, query: string | undefined): Execution {
        return refused('engine.resolveSite', action, factsForRefusal(
            'Nothing here to go into.',
            'You turn to the thing you meant and there is no thing you meant. Ground worth opening '
            + 'is ground somebody told you about, and you are not standing at any of it.',
            `Unresolved site "${(query ?? '').trim() || '(none named)'}": no nameable site matched and `
            + 'no site has been approached in this run.'
        ));
    },

    /**
     * Putting things beyond your own death, and collecting what somebody else
     * put beyond theirs.
     *
     * The whole surface lives in `leaving-things-for-the-next-life.ts`, on the
     * `trials.ts` precedent: this method supplies the clock, the mover and the
     * company, and decides nothing about how a cache or a deposit turns out.
     *
     * The phrase comes off the RAW INPUT and never off a planned action's
     * `topic`. A model asked to fill a field paraphrases, and a paraphrased
     * phrase does not open the entry - so the one thing a player has to carry
     * across a death is the one thing no model touches.
     */
    async legacyAct(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        intent: string | undefined,
        target: string | undefined,
        rawInput: string,
        days: number | undefined
    ): Promise<Execution> {
        const label = (intent ?? '').trim().toLowerCase() as LegacyIntent;
        const chosen: LegacyIntent =
            LEGACY_INTENTS.includes(label) ? label : DEFAULT_LEGACY_INTENT;

        const outcome = handleLegacy(
            {
                ledger: this.legacy,
                mover: {
                    stones: (id, delta) => {
                        this.repos.cultivators.applyDeltas(id, { spiritStones: delta });
                    },
                    add: (id, stack) => addToPouch(this.db, id, stack.itemId, stack.kind, stack.quantity),
                    take: (id, stack) => removeFromPouch(this.db, id, stack.itemId, stack.quantity)
                },
                cultivator,
                here: cultivator.location ?? '',
                // The world clock, because a run's clock restarts every life
                // and the gap between two of them is the whole subject.
                worldSeed: this.atHand?.seed ?? null,
                worldDay: this.atHand?.currentDay ?? null,
                runId: run.id,
                // Anybody standing close enough to watch, read off the same
                // roster `look` reads, and recorded once at the moment of
                // burial rather than re-decided whenever somebody asks.
                watchers: this.present(cultivator).length,
                pouch: pouchStacks(this.db, cultivator.id),
                // Why they are at the counter. Settling is not a mood - it is
                // the allowance running down at a rung they are not leaving.
                road: {
                    settlingYearsLeft: stagnationRemaining(cultivator),
                    lifespanYearsLeft: null
                }
            },
            chosen,
            target,
            phraseIn(rawInput),
            days ?? DEFAULT_BURIAL_DAYS
        );

        // A read costs nothing and returns here. Digging and burying spend
        // days, and days are spent the way `gather` spends them, so the food
        // clock and the toll run through them exactly as they do anywhere else.
        if (outcome.daysSpent === 0) {
            const free = this.freeAction(run, 'legacy', outcome.facts);
            free.calls = outcome.calls;
            free.outcome = outcome.refused ? 'refused' : 'executed';
            return free;
        }

        // RE-READ BEFORE THE SKIP, because the goods have already moved.
        //
        // `handleLegacy` empties the purse into the ground first, and
        // `applyTimeSkip` writes `end.spiritStones - mid.spiritStones` where
        // `end` is derived from whatever cultivator it was handed. Handed the
        // pre-burial row, it computes a delta that puts every buried stone
        // straight back. Found by playing this integration: buried 28 of 30
        // stones, came out of the week holding 30.
        const afterGoods = this.repos.cultivators.getById(cultivator.id) ?? cultivator;

        const skip = simulateTimeSkip(afterGoods, outcome.daysSpent, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(afterGoods),
            turn: run.turn,
            startDay: Math.floor(run.elapsedDays),
            options: { ...this.rateTermsFor(afterGoods), ground: this.groundFor(afterGoods) },
            understanding: this.understandingFor(run, afterGoods),
            rations: this.drawFromPack(afterGoods, outcome.daysSpent),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, afterGoods)
        });
        const applied = applyTimeSkip(this.repos, { before: afterGoods, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        return {
            facts: outcome.facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: outcome.refused ? 'refused' : 'executed',
            calls: [
                ...outcome.calls,
                ...skipCalls('legacy', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    },

    /**
     * The trials and the graves: reaching one, reading it, going in, taking it.
     *
     * `intent` selects WHICH of the four runs and nothing else, on the same
     * terms as `sect` and `look`: the label is matched against a closed set of
     * literals, an unrecognised one falls through to the default, and every
     * outcome on the far side is computed from the catalog and from this
     * cultivator's own rows. What is different here is that one of the four
     * spends days and can kill, so the default is deliberately the CHEAPEST of
     * them. A model that answers `{"action":"site","intent":"go in and get it"}`
     * gets the listing.
     */
    async site(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string | undefined
    ): Promise<Execution> {
        const step: SiteIntent = SITE_INTENTS.includes(intent as SiteIntent)
            ? intent as SiteIntent
            : DEFAULT_SITE_INTENT;

        const meant = this.siteMeant(run, cultivator, target);
        const site = meant.site;

        // A named site that resolved to nothing is refused on every step that
        // does something, and answered with the listing on the step that is a
        // question. "I go to the eighth stone" from somebody who has only ever
        // heard it rumoured is a real sentence with an honest answer, and the
        // honest answer is what they DO have names for.
        if (!site && meant.namedSomethingUnknown && step !== 'approach') {
            return this.noSiteAtHand('site', target);
        }

        if (step === 'approach' && !site) {
            // Naming none is a question rather than a failure: it asks what
            // there is, and the honest answer is what has reached this person.
            const known = this.nameableFor(cultivator);

            // ── AND WHAT THE WORLD HAS FOUND SINCE ───────────────────────
            //
            // This read used to be the catalog and nothing else, so the
            // thirty authored sites were the only places that could ever be
            // named - while the discovery engine steadily uncovered ground into
            // a table nothing player-facing read. See
            // `ground-the-world-found.ts` for the measurement.
            const found = this.foundGroundFor(cultivator);
            const facts = factsForSiteListing(
                cultivator,
                [
                    ...known.map(entry => ({ name: entry.name, kind: entry.kind })),
                    ...found.map(entry => ({ name: entry.name, kind: entry.character }))
                ]
            );
            for (const ground of found) facts.structure.push(...describeFoundGround(ground));

            const listing = this.freeAction(run, 'site', facts);
            const total = known.length + found.length;
            listing.outcome = total === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'engine.nameableSites',
                action: 'site',
                summary:
                    `${known.length} of ${SITES.length} catalogued site(s) are nameable by this `
                    + `cultivator, plus ${found.length} the world has found and this cultivator `
                    + 'has a record for. Filtered by awareness; the catalog holds no locations, so '
                    + 'nothing here was filtered by distance.',
                ok: total > 0
            }];
            return listing;
        }

        // A find, named. Answered before the catalog's own refusal, because a
        // place the world uncovered is a real place and "no site by that name"
        // would be false about it.
        if (!site) {
            const named = resolveFoundGround(
                (target ?? '').trim(), this.foundGroundFor(cultivator)
            );
            if (named) return this.approachFoundGround(run, cultivator, named);
        }

        if (!site) return this.noSiteAtHand('site', target);

        const face = this.faceFor(site, cultivator);
        if (!face) return this.noSiteAtHand('site', target);

        switch (step) {
            case 'approach':
            case 'outside':
                return this.readSiteFromOutside(run, cultivator, site, face, step === 'approach');
            case 'enter':
                return this.enterTheSite(run, cultivator, ambient, site);
            case 'take':
                return this.takeFromSite(run, cultivator, site);
        }
    },

    /**
     * Reaching one, and reading it without going in.
     *
     * Both steps return the same disclosure because the gate between outside
     * and inside is a door rather than a distance, and both are reads: no time
     * passes, nothing is spent, and being refused costs what being answered
     * costs. What the approach additionally does is write down that this
     * cultivator has been here, which is what makes "I go inside" a sentence
     * that resolves to something afterwards.
     */
    readSiteFromOutside(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        site: Site,
        face: SiteFace,
        arriving: boolean
    ): Execution {
        this.sites.write(run.id, site, run.elapsedDays, { soughtOnDay: Math.floor(run.elapsedDays) });

        // Standing at a thing is knowing it is there. Written by the engine,
        // in phase 2, so the narrator is never the reason a name is available.
        const learned = face.name !== null && this.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: site.id,
            name: site.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: 'witnessed',
            sourceNote: 'Stood at it.',
            stance: 'knows',
            confidence: 1
        });

        const facts = factsForSiteFace(cultivator, face, arriving);
        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            {
                name: 'engine.outsideViewOf',
                action: arriving ? 'approach' : 'assess_from_outside',
                summary:
                    `${site.id}: pre-entry view returned at awareness `
                    + `${awarenessOfSite(site, true) === 'named' ? 'named' : site.outside.startingAwareness}. `
                    + 'The returned type has no interior key, so the inside could not have been read '
                    + 'here even by mistake. Read only: no time passed, nothing changed.',
                ok: true
            },
            ...(learned ? [{
                name: 'knowledge.learn',
                action: 'place_witnessed',
                summary: `"${site.name}" recorded as witnessed: this cultivator has now stood at it.`,
                ok: true
            }] : [])
        ];
        return execution;
    },

    /**
     * Going in.
     *
     * Three things happen, in this order, and the order is the design.
     *
     * FIRST the days are spent, through `simulateTimeSkip` and `applyTimeSkip`
     * like every other stretch of time in this package. That is what makes
     * entering cost something even at a site that turns out to be empty, and it
     * is why a cultivator on their last ration can die of the walk in - through
     * the survival layer, on the same code path as starving anywhere else.
     * Nothing about that death is asserted here.
     *
     * SECOND the gates are read, in the order the catalog puts them in, and the
     * first one that does not open stops it. Which kind refused decides what
     * the player is told, because the three are not three settings of one dial:
     * strength names a shortfall, talent names what was wanted and says power
     * does not substitute, and fate names nothing at all.
     *
     * THIRD, and only for a strength gate, the thing does what it was built to
     * do. A strength gate is the one kind that states an ordinal of force, so
     * it is the one kind that puts force into a body, and it is resolved by
     * `resolveExchange` - the engine's own combat model, priced at the gate's
     * ordinal - rather than by a damage formula invented in this layer. Death
     * from it goes through `evaluateDeathConditions` and `markDead`, which is
     * the same pair `technique_manage.learn` uses when a deviation kills
     * somebody. A talent gate is indifferent to how hard the claimant can be
     * hit and a fate gate is not about the claimant at all, so neither of them
     * is turned into damage: the bench's own `howItKills` opens "It does not,
     * and that is the trap", and the engine agrees with it.
     */
    async enterTheSite(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, ENTERING_DAYS, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: ENTERING_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: this.drawFromPack(cultivator, ENTERING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const spentLine =
            `${humanDays(skip.simulatedDays)} went on getting in and being in there, and they came `
            + 'off the same clock everything else comes off.';

        const baseCalls: ToolCallRecord[] = [
            ...skipCalls('site', skip, null),
            ...tollCalls(applied.tollLines),
            ...worldCalls(world)
        ];

        // Killed by the trip rather than by the door. The survival layer has
        // already written it; this only reports what it found.
        if (!applied.cultivator.alive) {
            const facts = factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, 'Going in');
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: baseCalls
            };
        }

        const claimant = claimantOf(applied.cultivator, {
            // Years actually spent at it. `STARTING_AGE` is the age this
            // deployment starts a cultivator at, so the difference is the time
            // the run has put in - which is the thing a talent gate asks about
            // and the thing that cannot be borrowed on the day.
            yearsCultivated: applied.cultivator.age - STARTING_AGE,
            fate: this.fateEvidence(applied.cultivator)
        });
        // ── WHAT THE GROUND DOES, BEFORE ANY GATE ────────────────────────
        //
        // `readGates` answers whether this claimant satisfies the locks
        // somebody built. This is the prior question - what the place does to a
        // body of this size - and nothing player-facing read it, so two of the
        // three ways the catalog closes ground had never once fired for a
        // player. The catalog holds 30 sites across 14 characters, 6 origins
        // and 4 scales, and all of the cap and elder-floor writing in it was
        // unreachable.
        //
        // Above the line first, because a cap turns somebody away at the
        // threshold and a gate inside is not consulted for somebody who never
        // got in. It costs the days and nothing else: being measured and found
        // too large is not an injury, which is why `groundForceOrdinalOf`
        // returns null for it.
        const access = readAccess(site, claimant);
        if (!access.admitted) {
            const facts = factsForGroundRefused(
                applied.cultivator, site.name, access, skip.simulatedDays
            );
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...baseCalls, {
                    name: 'engine.readAdmission',
                    action: 'ground_capped',
                    summary:
                        `${site.id} admits ${site.access.admits}; ordinal `
                        + `${applied.cultivator.realmOrdinal} is above the line. Turned away at `
                        + 'the threshold, no gate consulted, no force applied.',
                    ok: false
                }]
            };
        }


        const reading = readGates(site, claimant);
        const gateCalls: ToolCallRecord[] = reading.verdicts.map(verdict => ({
            name: 'engine.evaluateGate',
            action: `gate_${verdict.kind}`,
            summary: verdict.structure,
            ok: verdict.met
        }));

        if (reading.blockedBy) {
            const blocked = reading.blockedBy;
            const hurt = await this.gateForce(run, applied.cultivator, ambient, site, blocked);
            const facts = factsForGateRefused(
                applied.cultivator,
                site.name,
                { kind: blocked.kind, account: blocked.account, shortfall: blocked.shortfall },
                spentLine
            );
            facts.lines.push(...hurt.lines);
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            if (hurt.lines.length > 0) facts.prose = `${facts.prose}\n\n${hurt.lines.join('\n\n')}`;

            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                // The days were spent and, at a strength gate, a body was hurt.
                // Marking this refused would say nothing happened, and something
                // did. The gate's own call carries the ok: false.
                outcome: 'executed',
                calls: [...baseCalls, ...gateCalls, ...hurt.calls]
            };
        }

        // ── AND THEN THE DEPTH, WHICH IS AFTER THE DOOR AND NOT BEFORE IT ──
        //
        // Admitted and not surviving is the ORDINARY case for a minimum, and it
        // is not a locked door: `readAdmission` says so in as many words - "the
        // door is not what stops them". So it is read AFTER the gates rather
        // than before them, which is not where this was first written.
        //
        // The specification said to put the whole access check ahead of
        // `readGates`, and half of it belongs there: a CAP turns somebody away
        // at the threshold, so no lock inside is consulted for a body that
        // never got in. A FLOOR is the opposite - the door opened, they walked
        // through it, and the place is deeper than they are. Evaluating it
        // first made the gate unreachable for anybody under the floor, and
        // `misparse.test.ts` caught it immediately: a strength gate stopped
        // producing a reading at all.
        //
        // The two halves are ordered by what physically happens: refused at the
        // door, then the lock, then the depth beyond it.
        if (!access.survives) {
            const hurt = await this.groundForce(run, applied.cultivator, ambient, site, access);
            const facts = factsForGroundRefused(
                applied.cultivator, site.name, access, skip.simulatedDays
            );
            facts.lines.push(...hurt.lines);
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            if (hurt.lines.length > 0) facts.prose = `${facts.prose}\n\n${hurt.lines.join('\n\n')}`;
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...baseCalls, {
                    name: 'engine.readAdmission',
                    action: 'ground_floor',
                    summary:
                        `${site.id} floor is ${site.access.floorOrdinal}; ordinal `
                        + `${applied.cultivator.realmOrdinal} is under it. Admitted and not `
                        + 'survived - the door is not what stops them.',
                    ok: false
                }, ...hurt.calls]
            };
        }
        // Every gate opened. This is the one place in the package that calls
        // `enterSite`, and it is below a recorded entry by construction.
        const record = this.sites.write(run.id, site, run.elapsedDays, {
            soughtOnDay: this.sites.get(run.id, site.id)?.soughtOnDay ?? startDay,
            enteredOnDay: startDay
        });
        // A trial and a grave hold different records on purpose - one was
        // calibrated for a claimant who was expected to arrive, the other was
        // arranged for nobody - so the three lines are taken from whichever
        // shape this entry actually has rather than flattened into one.
        const whole = enterSite(site.id)!;
        const interior = whole.kind === 'trial'
            ? {
                scene: whole.interior.chamber,
                arrangement: whole.interior.setBy,
                whatItDoesToPeople: whole.interior.howItKills
            }
            : {
                scene: whole.interior.scene,
                arrangement: whole.interior.arrangedForAFinder
                    ? 'Somebody arranged this for whoever found it. That is the exception rather than the rule.'
                    : 'Nobody arranged this for anybody. Nothing in it was the right size for whoever turned up.',
                whatItDoesToPeople: whole.interior.whatTheDeathDidToTheContents
            };
        const facts = factsForSiteInterior(applied.cultivator, site.name, {
            ...interior,
            onOffer: [...prizeOther(whole), ...this.prizeNames(whole)],
            afterwards: record.takenOnDay !== null ? whole.interior.afterwards : null
        });
        // WHAT STANDING AT ITS DEPTH IS LIKE, before the room is described.
        //
        // Clearing a floor is an event, not silence. An elder floor in
        // particular says who the errand is FOR - the sentence that makes a
        // senior's trip somebody else's inheritance - and it is written per
        // site, so it goes in ahead of the interior rather than being folded
        // into it.
        const held = factsForGroundSurvived(applied.cultivator, site.name, access);
        facts.lines.unshift(...held.lines);
        facts.structure.push(...held.structure);

        facts.lines.unshift(spentLine);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...baseCalls,
                ...gateCalls,
                {
                    name: 'engine.enterSite',
                    action: 'site',
                    summary:
                        `${site.id}: every gate opened, entry recorded on day ${startDay}. The interior `
                        + 'was read only after the row existed.',
                    ok: true
                }
            ]
        };
    },

    /**
     * What a strength gate does to somebody who is under it.
     *
     * Priced by `assessPower` and resolved by `resolveExchange`, which are the
     * engine's own, so a gate hits exactly as hard as a person at that ordinal
     * would and no harder. Nothing about the arithmetic lives here; what lives
     * here is the decision that a strength gate is the only kind that applies
     * force at all, which is the catalog's own distinction and not a new one.
     */
    async gateForce(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        blocked: GateVerdict
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const ordinal = forceOrdinalOf(site, blocked);
        if (ordinal === null) return { lines: [], calls: [] };
        return this.forceAtOrdinal(run, cultivator, ambient, site, ordinal, 'site_gate');
    },

    /**
     * The depth of the ground itself, applied to somebody short of it.
     *
     * The sibling `gateForce` needed and did not have. A GATE is something a
     * person built and is priced off a gate ordinal; a FLOOR is geology, and is
     * priced off the floor. Same exchange, same resolver, same writes - what
     * differs is only where the number comes from, which is why this splits at
     * the ordinal rather than duplicating the body.
     *
     * A separate RNG stream from the gate's, so that a place which both has a
     * floor and has gates does not draw the same sample twice for two different
     * hazards.
     */
    async groundForce(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        access: AdmissionReading
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const ordinal = groundForceOrdinalOf(site, access);
        if (ordinal === null) return { lines: [], calls: [] };
        return this.forceAtOrdinal(run, cultivator, ambient, site, ordinal, 'site_ground');
    },

    async forceAtOrdinal(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        ordinal: number,
        stream: string
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {

        const rng = forStream(run.seed, stream, Math.floor(run.elapsedDays), site.id);
        const context = { ambient };
        const gate = assessPower(forceAt(site, ordinal), context);
        const body = assessPower(
            {
                id: cultivator.id,
                name: cultivator.name,
                realmOrdinal: cultivator.realmOrdinal,
                immortalStatus: cultivator.immortalStatus,
                traditionId: cultivator.traditionId,
                spiritRoot: cultivator.spiritRoot,
                attributes: cultivator.attributes,
                injuries: cultivator.injuries,
                insights: cultivator.insights,
                foundationQuality: cultivator.foundationQuality,
                soulState: cultivator.soulState,
                hp: cultivator.hp,
                maxHp: cultivator.maxHp,
                qi: cultivator.qi,
                maxQi: cultivator.maxQi,
                battlesSurvived: cultivator.battlesSurvived
            },
            context
        );
        const exchange = resolveExchange(gate, body, cultivator.maxHp, {
            rng,
            ambient,
            turn: run.turn,
            vector: 'body'
        });

        let death: { cause: string; description: string } | null = null;
        const persist = this.db.transaction(() => {
            if (exchange.injury) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: exchange.injury.id,
                    severity: exchange.injury.severity,
                    source: exchange.injury.source,
                    description: exchange.injury.description,
                    sustainedOnTurn: exchange.injury.sustainedOnTurn,
                    woundType: exchange.injury.woundType
                });
            }
            this.repos.cultivators.applyDeltas(cultivator.id, { hp: -exchange.damage });

            const after = this.repos.cultivators.getById(cultivator.id)!;
            const cause = evaluateDeathConditions(after);
            if (cause) {
                death = { cause, description: describeDeath(cause, after) };
                this.repos.cultivators.markDead(cultivator.id, cause, run.turn + 1, death.description);
            }
        });
        persist();

        const lines = [
            `It cost ${exchange.damage} of what ${cultivator.name} had to give.`
            + (exchange.injury
                ? ` It left a ${exchange.injury.severity} injury that will not close on its own.`
                : '')
        ];
        if (death) lines.push((death as { description: string }).description);

        return {
            lines,
            calls: [
                {
                    name: 'engine.resolveExchange',
                    action: 'gate_strength',
                    summary:
                        `The gate at ordinal ${ordinal} applied force to a body at `
                        + `${cultivator.realmOrdinal}. ${exchange.narrationHint} Roll `
                        + `${exchange.roll.toFixed(4)}, advantage ${exchange.advantage.toFixed(2)}.`,
                    ok: true
                },
                ...(death ? [{
                    name: 'engine.evaluateDeathConditions',
                    action: 'death',
                    summary:
                        `${(death as { cause: string }).cause}. Written by the survival layer after the `
                        + 'damage landed, on the same path every other death in this package takes.',
                    ok: true
                }] : [])
            ]
        };
    },

    /** Catalogued arts a site is holding, by name rather than by id. */
    prizeNames(this: GameService, site: Site): string[] {
        const arts = prizeTechniqueIds(site)
            .map(id => getTechnique(id)?.name ?? id);
        const items = prizeImmortalItemIds(site);
        const lines: string[] = [];
        if (arts.length > 0) {
            lines.push(`Written down here, in full: ${arts.join(', ')}.`);
        }
        if (items.length > 0) {
            lines.push('There is also a thing here that did not come from any forge in this world.');
        }
        return lines;
    },

    /**
     * Taking it, which is the act that empties the place.
     *
     * Entry has to be on record first. That is not ceremony: the whole surface
     * is built so a player cannot learn what is inside without going in, and a
     * take that worked from the threshold would be a route around that.
     *
     * The grant itself goes through `technique_manage.learn` rather than
     * through anything reimplemented here, so a manual the claimant cannot read
     * comes back as the engine's own refusal - which is not a bug and is the
     * world's stated design: the top grades are written for somebody who has
     * walked a road, which is why they sit in ruins unread.
     */
    async takeFromSite(this: GameService, run: Run, cultivator: Cultivator, site: Site): Promise<Execution> {
        const record = this.sites.get(run.id, site.id);

        if (!record || record.enteredOnDay === null) {
            return refused('engine.siteLedger', 'site', factsForRefusal(
                'You are not in there.',
                'You reach for it from where you are standing, which is outside, and the reaching '
                + 'stops at the door. Whatever is behind it is behind it.',
                `No entry on record for ${site.id} in this run. The interior was not read and the `
                + 'prize was not resolved.'
            ));
        }

        if (record.takenOnDay !== null) {
            const whole = enterSite(site.id)!;
            return refused('engine.siteLedger', 'site', factsForRefusal(
                `${site.name}: already emptied.`,
                whole.interior.afterwards,
                `${site.id} was taken on day ${record.takenOnDay}${record.takenBy ? ` by ${record.takenBy}` : ''}. `
                + `${record.granted.length} thing(s) left the site then and are not here now.`
            ));
        }

        const whole = enterSite(site.id)!;
        const granted: string[] = [];
        const withheld: string[] = [];
        const calls: ToolCallRecord[] = [];

        for (const techniqueId of prizeTechniqueIds(whole)) {
            const result = await handleLearn({
                action: 'learn',
                techniqueId,
                cultivatorId: cultivator.id,
                // A prize out of a sealed place. The book is IN THE ROOM,
                // which is the whole reason anybody goes into one - so this
                // path says where it came from and the ownership gate in
                // `handleLearn` stands aside for it.
                provenance: 'found_in_place'
            });
            const name = getTechnique(techniqueId)?.name ?? techniqueId;
            if (isGuidingErrorBody(result)) {
                withheld.push(result.message);
                calls.push({
                    name: 'technique_manage.learn',
                    action: 'site_prize',
                    summary: `${techniqueId}: ${result.error}. ${result.message}`,
                    ok: false
                });
                continue;
            }
            granted.push(name);
            calls.push({
                name: 'technique_manage.learn',
                action: 'site_prize',
                summary: `${techniqueId} learned off the site. Written by the same handler the tool surface uses.`,
                ok: true
            });
        }

        // The one immortal item in the whole catalog that is a grave good. It
        // leaves the site - the row below says so - and there is nowhere on a
        // cultivator to put it, because nothing in the storage layer models a
        // person holding one. Reported rather than faked: an item the player is
        // told they are carrying and that no query can find is worse than a
        // hole that says it is a hole.
        const items = prizeImmortalItemIds(whole);
        for (const itemId of items) {
            withheld.push(
                'There is a thing here that did not come from any forge in this world. It comes away '
                + 'with you, and there is nothing in your life that is the right shape to keep it in.'
            );
            calls.push({
                name: 'engine.possessions',
                action: 'site_prize',
                summary:
                    `${itemId} left ${site.id} and is recorded against the site. There is no `
                    + 'cultivator-side possession row for an immortal item in the storage layer, so '
                    + 'nothing was written on the cultivator. This is a gap, reported rather than faked.',
                ok: false
            });
        }

        const other = prizeOther(whole);
        this.sites.write(run.id, site, run.elapsedDays, {
            takenOnDay: Math.floor(run.elapsedDays),
            takenBy: cultivator.id,
            granted: [...prizeTechniqueIds(whole), ...items]
        });

        // ── AND TAKE THE ATTENTION ───────────────────────────────────────
        //
        // `tone.md` states the dilemma as two things the world will make you
        // regret: "rob the grave and TAKE THE ATTENTION, or stay poor and stay
        // slow." Only half of it existed. A site could be emptied and the
        // emptying was recorded against the site and against nobody else, so
        // there was no second half and therefore no decision - taking was
        // strictly better than not taking, every time.
        //
        // No new rule and no grave-specific branch. `factionIds` is an ordinary
        // column on every site, trial and grave alike; a house whose name is on
        // the ground notices what came off it, and the record is held BY that
        // house ABOUT this cultivator - the same direction `refuseDuty` and
        // `combat-manage` already write in.
        //
        // The reason an unclaimed grave is safe to rob is therefore structural
        // rather than merciful: there is nobody on the row to notice.
        const noticed = this.attentionFor(run, cultivator, site);
        for (const line of noticed.lines) withheld.push(line);
        calls.push(...noticed.calls);

        const facts = factsForSiteTaken(cultivator, site.name, {
            granted,
            withheld,
            other,
            afterwards: whole.interior.afterwards
        });

        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            ...calls,
            {
                name: 'engine.siteLedger',
                action: 'site',
                summary:
                    `${site.id} marked taken on day ${Math.floor(run.elapsedDays)}. The next party to `
                    + 'reach it finds what `afterwards` says they find.',
                ok: true
            }
        ];
        return execution;
    },

    /**
     * The engine's own account of this turn, for the output-side check.
     *
     * Built from the `Execution` the caller already holds, so it cannot drift
     * from what was actually filed: a rank counted off the skip's own deltas, a
     * breakthrough attempt counted by whether one was RESOLVED at all, and a
     * death read off the row rather than off anybody's sentence.
     *
     * `breakthroughAttempted` is deliberately true for a FAILURE as well as a
     * success. Prose about a failed attempt legitimately contains the words a
     * successful one would, and refusing that would throw away good writing
     * about the most dramatic thing in the game.
     */
    filedOutcome(this: GameService, execution: Execution): FiledOutcome {
        return {
            ranksGained: Math.max(0, execution.timeSkip?.deltas.realmOrdinal ?? 0)
                + (execution.breakthrough?.outcome === 'success' ? 1 : 0),
            breakthroughAttempted: execution.breakthrough !== null,
            // Read off the row rather than off anybody's sentence, which is the
            // whole point of this object.
            died: execution.timeSkip?.died === true
                || execution.breakthrough?.outcome === 'death'
                || !this.currentRun().cultivator.alive
        };
    },

    /**
     * Who notices that a piece of ground was emptied.
     *
     * Every house named on the site, and nobody else. The severity is read off
     * what the ground is pitched at rather than chosen: emptying a Qi
     * Condensation grave is a slight and emptying somebody at the top of the
     * ladder is not, and the same table prices both. Nothing here is written
     * about graves in particular.
     *
     * The record is an ordinary `grudge` row on the `obligations` tables, so
     * it is discoverable by every query that already reads them, it inherits
     * the ordinary inheritance rules, and a descendant three generations later
     * can still be carrying it.
     */
    attentionFor(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        site: Site
    ): { lines: string[]; calls: ToolCallRecord[] } {
        const onDay = Math.floor(run.elapsedDays);
        // The rung the ground is pitched at. A grave states the occupant's; a
        // trial states what it advertises, and a trial that advertises nothing
        // is priced at the bottom, which is honest - nobody can be indignant
        // about a theft nobody can size.
        const pitch = site.kind === 'grave'
            ? site.occupantOrdinal
            : site.outside.advertisedOrdinal ?? 0;
        const severity: Severity =
            pitch >= GRAVE_UNFORGIVABLE_ORDINAL ? 'unforgivable'
                : pitch >= GRAVE_GRAVE_ORDINAL ? 'grave'
                    : pitch >= GRAVE_SERIOUS_ORDINAL ? 'serious'
                        : 'slight';

        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];
        /** Claimants this cultivator has no name for. Counted, then said once. */
        let nameless = 0;

        const claimants = site.factionIds
            .map(id => ({ id, house: this.repos.sects.getById(id) }))
            .filter((row): row is { id: string; house: NonNullable<typeof row.house> } =>
                row.house !== undefined && row.house !== null);

        // ── AND THE WORLD CONTAINS THE THEFT ─────────────────────────────
        //
        // Written FIRST, so the grudges below can carry its id. Before this,
        // emptying a house's ground produced an obligation row and nothing
        // else: the ledger said a house was owed something and the world did
        // not contain the event the house was owed for. Nobody could repeat it,
        // no digest carried it, and a stranger in the next province had heard
        // nothing - because `circulating` and `digest` both read
        // `state.history.facts` and only the simulation was writing to it.
        //
        // The severity is NOT recomputed. It was decided above for the record
        // the house holds and it is decided exactly once; this hands the same
        // word to the fact so the two cannot disagree, and joins them by id
        // rather than by keeping two opinions.
        const deed = this.atHand && claimants.length > 0
            ? aDeedEntersTheWorld(this.atHand, {
                kind: 'resource_contested',
                weight: severity,
                day: Math.floor(this.atHand.currentDay),
                locationId: this.worldPlaceOf(cultivator),
                place: placeName(cultivator),
                actors: [{ id: cultivator.id, name: cultivator.name, role: 'took it' }],
                factionIds: claimants.map(row => row.id),
                summary:
                    `${cultivator.name} emptied ${site.name}, which `
                    + `${claimants.map(row => row.house.name).join(' and ')} `
                    + `${claimants.length === 1 ? 'claims' : 'claim'}.`,
                unattributed:
                    'Somebody has been up at the old ground, and whoever holds it has people on '
                    + 'the road asking.',
                data: { siteId: site.id, siteKind: site.kind, pitch }
            })
            : null;
        if (deed) {
            this.worldDirty = true;
            lines.push(deed.line);
            calls.push({
                name: 'world.aDeedEntersTheWorld',
                action: 'site',
                summary:
                    `${deed.fact.id} (${deed.fact.kind}, ${deed.weight}, magnitude `
                    + `${deed.fact.magnitude.toFixed(2)}, ${deed.fact.visibility}) written to the `
                    + `world's history on day ${deed.fact.day}, naming ${cultivator.id}. `
                    + `${deed.fact.witnessIds.length} witness id(s). It is now a thing that can be `
                    + 'repeated, digested and heard about second hand.',
                ok: true
            });
        }

        for (const { id: factionId, house } of claimants) {
            const record = createGrudge({
                holderId: factionId,
                subjectId: cultivator.id,
                cause: 'robbery',
                severity,
                onDay,
                // The ground-truth event this record rests on. The column has
                // existed since the social migration, `grudges.ts` indexes by
                // it, and until the fact above existed nothing in `src/web/`
                // had one to put in it.
                triggeringEventId: deed?.fact.id ?? null,
                description:
                    `${site.name} was emptied on day ${onDay}. The ground is ${house.name}'s and `
                    + 'what came off it did not.',
                terms: null,
                dueOnDay: null,
                tags: ['site', site.kind, site.id]
            });
            writeObligation(this.db as unknown as DatabaseHandle, record);

            // Said to the player as a fact about the world, not as a warning.
            // Whether they can name the house is the discovery layer's
            // question, and it is asked here rather than assumed.
            const known = this.knowledge.isAwareOf(cultivator.id, 'sect', factionId);
            if (known) {
                lines.push(
                    `${house.name} holds this ground, and what came off it did not come off it `
                    + 'quietly.'
                );
            } else {
                nameless++;
            }
            calls.push({
                name: 'social.createGrudge',
                action: 'site',
                summary:
                    `${factionId} now holds a ${severity} robbery grudge about ${cultivator.id}, `
                    + `off ${site.id} at pitch ${pitch}. Written to obligations; permanent until `
                    + 'settled, and inheritable.',
                ok: true
            });
        }

        // Said once, however many of them there are. Three separate sentences
        // reading "somebody will notice" is three copies of one fact, and the
        // discovery layer's rule is that not knowing who is ITSELF the fact.
        if (nameless > 0) {
            lines.push(
                lines.length === 0 && nameless === 1
                    ? 'This ground was somebody\'s. Whoever they are, they will find it emptied, '
                      + 'and they will not have to wonder whether somebody was here.'
                    : `${nameless} part${nameless === 1 ? 'y has' : 'ies have'} a claim on this `
                      + 'ground and you have no name for any of them. They will find it emptied '
                      + 'all the same.'
            );
        }

        return { lines, calls };
    },

    /**
     * What was done to this ground, and who says why.
     *
     * `engine/world/locations.ts` has carried the whole of this from the
     * start - origin, an append-only change log, and a current state that is
     * the two folded together, patched in place so the map scars rather than
     * growing - and nothing in this layer reached any of it. A player could
     * stand in a scar for a hundred turns and never be able to ask about it.
     *
     * Three things are read out and one is withheld:
     *
     *  - what the place IS, which anybody with eyes has;
     *  - that it CHANGED, and when, which is legible in the ground itself;
     *  - what the people here BELIEVE, which is `attributedCauses` and is
     *    stored as belief because that is what it is;
     *  - and the CAUSE, only when `causeKnown` says the world has surrendered
     *    it. `causeFactId` is deliberately not consulted when it has not: the
     *    seeded ruins all carry a cause fact that nobody has recovered, and an
     *    answer that read differently in that case would be an answer.
     *
     * A read. No time passes, nothing is spent, and being refused costs the
     * same as being answered.
     */
    placeHistory(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const asked = (target ?? '').trim();
        // "what happened to this place" names nowhere. It means underfoot.
        const wanted = asked.length >= 2 && !HERE_ITSELF.test(asked)
            ? asked
            : (cultivator.location ?? '');
        const place = this.atHand ? worldLocationFor(this.atHand, wanted) : null;

        if (!place) {
            // Worded so that it does not confirm anything either way. A place
            // the world does not model and a place with nothing on record have
            // to look the same from inside, for the same reason the cause gate
            // does: the shape of the refusal must not be the answer.
            return refused('engine.locationHistory', 'look', factsForRefusal(
                'The ground keeps nothing.',
                `You look over ${placeName(cultivator)} for the mark of whatever made it this way, ` +
                'and there is no mark and nobody to ask. Ground that has had something done to it ' +
                'usually shows it, and this does not.',
                `No world location record for "${wanted || placeName(cultivator)}"` +
                `${this.atHand ? '' : ' (world simulation is off for this run)'}.`
            ));
        }

        const rows = locationHistory(place);
        const origin = rows.find(row => row.changeId === null) ?? null;
        const facts = this.repos && this.atHand ? this.atHand.history.facts : [];

        // Newest first: the thing that made this place what it is now is the
        // last thing that happened to it, not the first.
        const changes = rows
            .filter(row => row.changeId !== null)
            .slice()
            .reverse()
            .slice(0, PLACE_CHANGES_SHOWN)
            .map(row => ({
                year: row.year,
                summary: row.summary,
                causeKnown: row.causeKnown,
                cause: row.causeKnown && row.causeFactId
                    ? facts.find(fact => fact.id === row.causeFactId)?.summary ?? null
                    : null,
                attributed: row.attributedCauses
            }));

        const rendered = factsForPlaceHistory(
            { name: place.name, kind: place.kind, description: place.description },
            origin && origin.onDay > Number.NEGATIVE_INFINITY
                ? { kind: place.origin.kind, year: origin.year }
                : { kind: place.origin.kind, year: null },
            changes
        );
        rendered.structure.push(`world location ${place.id}; ${place.changes.length} change(s) on record.`);

        const execution = this.freeAction(run, 'look', rendered);
        execution.calls = [{
            name: 'world.locationHistory',
            action: 'look',
            summary:
                `${place.id}: ${place.changes.length} change(s); ` +
                `${changes.filter(c => c.causeKnown).length} with a cause on record, ` +
                `${changes.reduce((n, c) => n + c.attributed.length, 0)} explanation(s) held locally. ` +
                'Read only: no time passed, nothing changed.',
            ok: true
        }];
        return execution;
    }
};
