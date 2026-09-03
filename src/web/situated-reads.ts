/**
 * What the world volunteers to somebody standing here.
 *
 * A command line answers what you typed. A game answers what you meant and
 * tells you what you could have meant instead, and this is the half of that
 * which is the engine's rather than the reader's. Every read here is a pure
 * question about a situation: why nothing is accumulating, who could teach
 * you, where you could go, what is live on this ground, what a thing would
 * take.
 *
 * The reason it is one module is that these were built together and for one
 * reason, and it is written down. A full run in the browser reached qi
 * deviation with three untreated injuries, every stone spent on food and
 * satiety at zero - five turns from death, with a way out - and `help`, `what
 * can I do` and `what are my options` all refused. The trap was well designed
 * and the exit was hidden. So the rules these keep are shared and have to stay
 * shared:
 *
 * - Prompts, never a menu. The whole character of this game is that you say
 *   what you do in your own words, so the read always closes by saying it is
 *   not the list.
 * - Situated, never a dump. Every line is gated on a fact the engine already
 *   computes, and the whole read is capped.
 * - Every sentence is verified to parse. Offering somebody a sentence that
 *   reaches nothing is worse than the refusal it replaces.
 * - Nothing changes an outcome. No price, no probability, no unlock. Dying
 *   becomes a decision rather than a failure to guess vocabulary.
 *
 * ── HOW THIS IS ATTACHED ──────────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.guidance(...)` resolves and typechecks exactly as it did
 * when the bodies sat in the class, and every line below is the line it was.
 * `src/web/README.md` has the argument and the warning about `private`.
 */

import { getSect, getTechnique } from '../data/cultivation/index.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { REGIONS, canAdvanceHere, requireRegion } from '../data/cultivation/regions.js';
import { getSectsTeaching } from '../data/cultivation/sects.js';
import { capOf, classOf } from '../data/cultivation/techniques.js';
import { isPermanentWound } from '../data/cultivation/wounds.js';
import { canAttemptBreakthrough } from '../engine/cultivation/breakthrough.js';
import { techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { effectiveCapOf, writtenTo } from '../engine/cultivation/escapes.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import { untreatedInjuries } from '../engine/cultivation/injuries.js';
import { rankName } from '../engine/cultivation/realms.js';
import { turnsUntilStarvation } from '../engine/cultivation/survival.js';
import { brokenStatusesOn } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { medicineReaches } from '../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { grantsHeldWith } from '../engine/world/capability.js';
import { billsOnTheWall } from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    couldFoldThere
} from '../engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { ordinaryBandFor } from '../engine/world/qi-scale.js';
import {
    isSoldAtAStall,
    stallPriceStones
} from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { thereIsACounterAt } from '../engine/world/where-the-measured-span-still-answers.js';
import {
    type AmbientQi,
    type Cultivator,
    type Run,
    stagnationYearsForOrdinal
} from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import { listPouch } from '../server/consolidated/cultivation-support.js';
import {
    requiredContributionForRank,
    requiredOrdinalForRank
} from '../server/consolidated/sect-manage.js';
import { holdsACopyOf } from '../server/consolidated/technique-manage.js';
import { stillStands } from './choosing-what-to-do-when-a-seclusion-is-broken.js';
import { rosterFor, sectBoardFor } from './encounters.js';
import { resolveTechnique, worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult, placeName, rungAndOrdinal } from './facts.js';
import { whoAnswersForThisGround } from './ground-holder-lines.js';
import {
    type GroundNearby,
    type ThingThatTeaches,
    groundThatTeachesARoad,
    groundUnderfoot,
    howAPlayerStands,
    thingsCarriedThatTeachARoad,
    whatThisGroundTeaches,
    whatThisGroundWants,
    whatThisThingTeaches,
    whatThisThingWants
} from './ground-that-teaches-a-road.js';
import { loosePlaceKey } from './knowledge.js';
import { wholeWorkVolumes } from './manual-volumes.js';
import { stagesHeldBy, stagesWrittenSince } from './stages.js';
import { MEAL_COST_STONES } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import {
    openDoorsInTheWorld,
    postingGroundOf,
    provinceOfPlace
} from './what-is-posted-on-the-wall-here.js';
import {
    type Affordance,
    type StandingHere,
    linesFor,
    whatIsWorthDoingStandingHere
} from './what-is-worth-doing-standing-here.js';
import { whatWouldCloseThisWound } from './what-would-close-this-wound.js';
import {
    LEAVES_THE_GROUND,
    type Sighting,
    horizonInDays,
    whatCanBeSeenFromUpThere
} from './what-you-can-see-from-up-there.js';
import { type Destination, whereCouldTheyGo } from './where-this-cultivator-could-go.js';
import { readWhatIsOnOfferHere } from './who-here-is-offering-something.js';
import { type SomebodyAbove, whoWouldTeach } from './who-would-teach-this-cultivator.js';
import { type SeatStanding, whyProgressHasStopped } from './why-progress-has-stopped.js';
import type { GameService } from './turn-engine.js';

export const situatedReads = {
    /**
     * Why nothing is accumulating, with the binding gate named first.
     *
     * The pieces were all present and none of them was reachable. The manual
     * axis was on the STATUS read - forty lines down a sheet a player asks for
     * when they want their hit points - and the province, the seat and the
     * settling clock were reachable by no sentence at all.
     *
     * Free, and that is load-bearing: a player at a wall has to be able to ask
     * what it is as many times as they like. The whole design rests on the
     * pressure being legible, and pressure a player is charged to look at is
     * pressure they will stop looking at.
     */
    ceiling(this: GameService, run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const terms = this.rateTermsFor(cultivator);
        const manual = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);
        const eligibility = canAttemptBreakthrough(cultivator);
        const where = standingOf(cultivator);
        const region = requireRegion(where.regionId);

        // The seat, read off the same two functions `handlePromote` gates on.
        // Absent for somebody who serves nobody, which is not a gate - it is
        // the ordinary condition of most people alive.
        let seat: SeatStanding | null = null;
        const membership = this.repos.sects.getMembership(cultivator.id);
        if (membership) {
            const sect = this.repos.sects.getById(membership.sectId);
            if (sect) {
                const next = membership.rankIndex + 1;
                const atTop = next >= sect.ranks.length;
                seat = {
                    sectName: sect.name,
                    rankTitle: membership.rankTitle,
                    nextRankTitle: atTop ? null : sect.ranks[next],
                    requiredOrdinal: atTop
                        ? 0
                        : requiredOrdinalForRank(sect.admissionOrdinal, next),
                    requiredContribution: atTop ? 0 : requiredContributionForRank(next),
                    contribution: membership.contribution
                };
            }
        }

        const read = whyProgressHasStopped({
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            manual,
            manualCap: terms.techniqueCap,
            regionName: region.name,
            localCeilingOrdinal: region.localCeilingOrdinal,
            canAdvanceHere: canAdvanceHere(where.regionId, cultivator.realmOrdinal),
            ambient,
            seat,
            progressRequired: eligibility.progressRequired,
            progressAvailable: eligibility.progressAvailable,
            eligible: eligibility.eligible,
            yearsAtCurrentRealm: cultivator.yearsAtCurrentRealm,
            stagnationYears: stagnationYearsForOrdinal(cultivator.realmOrdinal)
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);
        // A hard gate is exactly the kind of fact `required` was built for: the
        // measured failure was a model receiving "without a manual there is no
        // road for the qi to take" inside a long digest and dropping it, after
        // which a cultivator sat for fifty years and was never told why.
        if (read.required.length > 0) facts.required = read.required;

        const execution = this.freeAction(run, 'ceiling', facts);
        execution.calls = [{
            name: 'engine.whyProgressHasStopped',
            action: 'ceiling',
            summary:
                `${read.gates.length} gate(s) read, `
                + `${read.gates.filter(g => g.hard).length} hard. `
                + `Every figure restated from techniqueCeiling, canAdvanceHere, `
                + `requiredOrdinalForRank, canAttemptBreakthrough and `
                + `stagnationYearsForOrdinal. Nothing computed here.`,
            ok: true
        }];
        return execution;
    },

    /**
     * Who stands above them and would teach, said only of people they know of.
     *
     * Two populations, joined and then gated the same way:
     *
     *   THE ROLL   `rosterFor` returns the house's catalog roster with `known`
     *              already resolved against the knowledge rows, plus the
     *              `master` role and the three teaching limits.
     *   THE ROOM   `present()` is who is physically here, which includes
     *              people from no house at all. Gated on `isAwareOf`, the same
     *              predicate `company()` uses for a face in a square.
     *
     * Somebody in both is reported once, from the roster, because the roster
     * row carries strictly more - and `here` is set from the room, so "they
     * are here" is a fact about the present rather than about the catalog.
     */
    teacher(this: GameService, run: Run, cultivator: Cultivator): Execution {
        const inTheRoom = new Map(this.present(cultivator).map(row => [row.id, row]));
        const above: SomebodyAbove[] = [];
        const counted = new Set<string>();

        const deps = { repos: this.repos, knowledge: this.knowledge, world: this.atHand };
        const membership = this.repos.sects.getMembership(cultivator.id);
        // The catalog rows behind the roster, indexed once. `rosterFor` carries
        // the role and `teaching.knows`; the other two limits and the seat
        // title are only on the catalog entry, and reading them per person
        // through `getMembersOf` was a scan of the whole house per member.
        const catalog = new Map(
            getMembersOf(membership?.sectId ?? '').map(m => [m.id, m])
        );

        for (const person of rosterFor(deps, cultivator)) {
            if (person.id === cultivator.id) continue;
            if (person.realmOrdinal <= cultivator.realmOrdinal) continue;
            counted.add(person.id);
            const member = catalog.get(person.id);
            above.push({
                // The gate. A roster row is not permission to say a name.
                name: person.known ? person.name : null,
                realmOrdinal: person.realmOrdinal,
                rankTitle: person.known ? (member?.rank ?? null) : null,
                willTeach: person.role === 'master',
                // The three limits stay separate - merging them is how a
                // master becomes an oracle. Null when they are not one.
                knows: person.known ? (member?.teaching?.knows ?? null) : null,
                mayNotSay: person.known ? (member?.teaching?.mayNotSay ?? null) : null,
                costsThem: person.known ? (member?.teaching?.costsThem ?? null) : null,
                here: inTheRoom.has(person.id)
            });
        }

        // Anybody standing here who is not on the roll. A wanderer four rungs
        // up is as real a teacher as an elder, and a rogue cultivator has no
        // roster to read at all - which is most of the reason this half exists.
        for (const [id, row] of inTheRoom) {
            if (counted.has(id)) continue;
            if (row.realmOrdinal <= cultivator.realmOrdinal) continue;
            above.push({
                name: this.knowledge.isAwareOf(cultivator.id, 'cultivator', id)
                    ? row.name
                    : null,
                realmOrdinal: row.realmOrdinal,
                rankTitle: null,
                // Nothing on the roster row says they teach, and this layer
                // will not guess. `willTeach` is a catalog fact or it is false.
                willTeach: false,
                knows: null,
                mayNotSay: null,
                costsThem: null,
                here: true
            });
        }

        above.sort((a, b) =>
            Number(b.willTeach) - Number(a.willTeach)
            || Number(b.here) - Number(a.here)
            || a.realmOrdinal - b.realmOrdinal);

        const terms = this.rateTermsFor(cultivator);
        const read = whoWouldTeach({
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            placeName: placeName(cultivator),
            sectName: membership
                ? this.repos.sects.getById(membership.sectId)?.name ?? null
                : null,
            above,
            manualState: techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap).state
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);

        const execution = this.freeAction(run, 'teacher', facts);
        execution.calls = [{
            name: 'engine.whoWouldTeach',
            action: 'teacher',
            summary:
                `${above.length} above this cultivator, ${read.nameable} of them nameable. `
                + `Every name gated on isAwareOf; the rest reported as a count and an `
                + `altitude. Teaching limits read from members.ts, never composed.`,
            ok: true
        }];
        return execution;
    },

    /**
     * Where they could go, priced, with the qi and the province's ceiling.
     *
     * The discovery gate here is `canPointAt` rather than `isAwareOf`, and the
     * difference is the whole point: `REACHABLE_FROM` is `placed`, and a name
     * caught through a wall is a name and not a destination. `somewhereReal`
     * already applies exactly this predicate when the player tries to TRAVEL
     * to a place, so listing on any looser rule would advertise destinations
     * the move verb would then refuse.
     *
     * The names below `placed` are counted and never listed. Listing them would
     * quietly promote a whisper into a road and spend a discovery the player
     * was supposed to earn.
     */
    destinations(this: GameService, run: Run, cultivator: Cultivator): Execution {
        const here = standingOf(cultivator);
        const fromRegion = requireRegion(here.regionId);

        // What it costs to reach each other province, off the region's own
        // `connections`. Absent means no stated road, which is a real state.
        const cost = new Map<string, number>();
        for (const link of fromRegion.connections) {
            const known = cost.get(link.otherRegionId);
            if (known === undefined || link.travelDays < known) {
                cost.set(link.otherRegionId, link.travelDays);
            }
        }

        const reachable: Destination[] = [];
        let unplaceable = 0;

        // ── ONE ROW PER PLACE, WHATEVER TAG IT ARRIVED UNDER ─────────────
        //
        // A place can hold TWO knowledge records under two different ids and
        // one display name: the catalog's own id, and the world location row
        // the seeder wrote for the same ground. `awareness` dedupes by
        // `claim_key`, which is correct at its own level and is not a dedupe
        // by PLACE - so `exists:place:the-dead-verge` and
        // `exists:place:loc-region-quiet-marches-the-dead-verge` are two rows,
        // both resolve to the same catalog place, and both were pushed.
        //
        // Reproduced before fixing, on an ordinary opening turn: two of seven
        // destinations were emitted twice, byte-identical, in the prose AND on
        // the engine channel - "The Dead Verge" and "The Gapwater face". The
        // quiet-ground loop below already guarded against this for its own
        // rows; nothing guarded the two loops above it.
        //
        // First writer wins, which is the catalog row: it carries the authored
        // `kind` and the region the place actually sits in.
        const remember = (destination: Destination): void => {
            const key = loosePlaceKey(destination.name);
            if (reachable.some(row => loosePlaceKey(row.name) === key)) return;
            reachable.push(destination);
        };

        for (const row of this.knowledge.awareness(cultivator.id, 'place')) {
            if (!this.knowledge.canPointAt(cultivator.id, 'place', row.id)) {
                unplaceable++;
                continue;
            }
            const wanted = loosePlaceKey(row.name);

            // A PROVINCE, which is the scale the catalog actually prices. This
            // half was missing from the first build and it was the whole of the
            // travel answer: "The Low Fall" and "The Drowned Reach" are names
            // in the knowledge table like any other, they are the only names
            // with a stated `travelDays` beside them, and looking up
            // settlements only dropped every one of them on the floor. The
            // read listed five towns in the player's own province, each of them
            // zero days away, and the cost map below never once returned a row.
            const province = REGIONS.find(region => loosePlaceKey(region.name) === wanted);
            if (province) {
                remember({
                    name: province.name,
                    kind: 'province',
                    // Deliberately null. A region's `ambientProfile` is a
                    // distribution across its settlements, and flattening it to
                    // one band would state a fact about ground nobody has stood
                    // on. The settlements inside it carry their own.
                    ambient: null,
                    regionName: province.name,
                    travelDays: province.id === fromRegion.id
                        ? null
                        : cost.get(province.id) ?? null,
                    localCeilingOrdinal: province.localCeilingOrdinal,
                    hereNow: false,
                    sameProvince: province.id === fromRegion.id,
                    // A province is a container; nobody stands in one, so there
                    // is no occupancy to report and inventing an average across
                    // its settlements would be the same error as flattening
                    // their ambient bands.
                    occupants: null,
                    supportedDraw: null
                });
                continue;
            }

            // A SETTLEMENT. A place the player has a record for that the
            // catalog does not describe is skipped rather than guessed at:
            // this read prices roads, and it has no price for somewhere it
            // cannot find.
            const found = REGIONS
                .flatMap(region => region.places.map(place => ({ region, place })))
                .find(candidate => loosePlaceKey(candidate.place.name) === wanted);
            if (!found) continue;

            remember({
                name: found.place.name,
                kind: found.place.kind,
                ambient: found.place.ambient,
                regionName: found.region.name,
                // Never zero for "somewhere in this province". Nothing in the
                // catalog prices a road between two settlements of one region,
                // and a fabricated zero is a number a player plans around.
                travelDays: found.region.id === fromRegion.id
                    ? null
                    : cost.get(found.region.id) ?? null,
                localCeilingOrdinal: found.region.localCeilingOrdinal,
                hereNow: wanted === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: found.region.id === fromRegion.id,
                ...this.occupancyOf(found.place.name)
            });
        }

        // ── GROUND THAT IS NOT A TOWN ────────────────────────────────────
        //
        // The read listed settlements and nothing else, so a player asking
        // where they could go was answered with the two market towns they had
        // names for - both crowded, both thin - while a DENSE vein with nobody
        // on it sat in the same province. Measured on a live world: 34 caves,
        // wilds and veins, all of them already `discovered` by the world, 31 of
        // them with zero occupancy, the best at qiDensity 70 against a
        // settlement's 35.
        //
        // Nothing was stopping the player travelling there either - `move`
        // accepts any world location by name, and has all along. They were
        // simply never told the names, so "I look for a quiet cave in the
        // mountains" and "I seek an uninhabited place to cultivate" both
        // reached nothing and the busiest ground in the world stayed the only
        // ground they could name.
        //
        // Own province only, and only what the world has already discovered.
        // This is local geography - a farm boy knows where the caves are - and
        // not the hard discovery that finding a lone rich cave is meant to be.
        //
        // ── AND IT IS STILL GATED, WHICH IT WAS NOT ──────────────────────
        //
        // "A farm boy knows where the caves are" is a reason to GRANT a record,
        // not a reason to skip the gate, and this loop read the world's own
        // location table straight into a player-facing list with no knowledge
        // check anywhere in it. `seedTheGroundAroundHome` grants the ordinary
        // ground at birth so the farm boy keeps his caves; everything else has
        // to be learned like anything else.
        //
        // Measured before this: a fresh cultivator holding no record for any of
        // them was handed The Glass Field and The Nine-City Assize by name.
        // Those are DAO GROUNDS - `how-a-cultivator-comes-by-a-road.ts` seeds
        // its `open` catalog rows as ordinary `wilds`, discovered - and this
        // read was the only place in the game they appear at all, ungated,
        // stripped of everything that makes them what they are. The same hole
        // would have handed over any prospected find that landed on one of
        // these three kinds.
        //
        // The gate is `canPointAt`, the same predicate the rest of this read
        // and `foundGroundIn` already use. Default-deny: the loop asks whether
        // this cultivator can point at the row, rather than asking whether the
        // row is one of the kinds somebody remembered to exclude.
        let unnamed = 0;
        // Ground this cultivator cannot point at, kept as what it looks like
        // from above it. Filled by this loop and the one after it, and read at
        // the foot of the method. `Sighting` carries no name and no holder, so
        // nothing social can cross into it however this pool is filled.
        const onTheGround: Sighting[] = [];
        for (const record of this.quietGroundIn(fromRegion.name)) {
            // Named already, under its catalog id. Checked before the gate so
            // that a place already on the list is not also counted as ground
            // the world holds and this cultivator cannot point at.
            if (reachable.some(row => loosePlaceKey(row.name) === loosePlaceKey(record.name))) continue;
            if (!this.canPointAtLocation(cultivator, record)) {
                unnamed++;
                const standing = this.occupancyOf(record.name);
                onTheGround.push({
                    kind: record.kind,
                    bearing: fromRegion.bearing,
                    days: null,
                    ambient: ordinaryBandFor(record.qiDensity),
                    inhabited: standing.occupants === null ? null : standing.occupants > 0
                });
                continue;
            }
            remember({
                name: record.name,
                kind: record.kind,
                ambient: ordinaryBandFor(record.qiDensity),
                regionName: fromRegion.name,
                travelDays: null,
                localCeilingOrdinal: fromRegion.localCeilingOrdinal,
                hereNow: loosePlaceKey(record.name) === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: true,
                ...this.occupancyOf(record.name)
            });
        }

        // ── AND WHAT IS SIMPLY VISIBLE FROM UP THERE ─────────────────────
        //
        // The second discovery channel, and the one the design was missing.
        // Everything above this line is somebody having SAID something: the
        // knowledge rows, `canPointAt`, the count of names too vague to walk
        // towards. That is the whole of how the world reached a player, and it
        // is a mortal's account of how the world reaches anybody.
        //
        //   "at higher ranks you should just be able to fly and look around."
        //
        // So the gazetteer is walked a second time on a different question -
        // not "have you been told about this" but "could you see it from the
        // height you can reach" - and what comes back is physical and stripped.
        // See `what-you-can-see-from-up-there.ts` for the line this must hold
        // and for why `Sighting` has no name on it.
        //
        // Ground already on `reachable` is skipped: for a place they can point
        // at, the read above says more and says it better, and printing the
        // silhouette of somewhere they can already name is noise.
        for (const region of REGIONS) {
            const sameProvince = region.id === fromRegion.id;
            // No stated road is not a distance. A province the catalog does not
            // connect is left out rather than given a null that `withinSight`
            // would read as "inside this province" - the exact fabricated-zero
            // mistake `whereCouldTheyGo` records having made once already.
            const days = sameProvince ? null : cost.get(region.id) ?? null;
            if (!sameProvince && days === null) continue;
            for (const place of region.places) {
                const key = loosePlaceKey(place.name);
                if (reachable.some(row => loosePlaceKey(row.name) === key)) continue;
                if (key === loosePlaceKey(cultivator.location ?? '')) continue;
                const standing = this.occupancyOf(place.name);
                onTheGround.push({
                    kind: place.kind,
                    bearing: region.bearing,
                    days,
                    ambient: place.ambient,
                    inhabited: standing.occupants === null ? null : standing.occupants > 0
                });
            }
        }

        const overlook = whatCanBeSeenFromUpThere({
            ordinal: cultivator.realmOrdinal,
            from: fromRegion.bearing,
            onTheGround
        });

        // ── AND THE GATES ────────────────────────────────────────────────
        //
        // Same gate, same shape, different half of the map. A house's ground is
        // where the people worth asking actually stand - measured on 5 seeds,
        // every one of the 88 cultivators at Foundation Establishment and above
        // is on one - and until it appeared here the read that answers "where
        // can I go" could not name a single one of the 34.
        //
        // Counted into `unnamed` when the gate refuses, exactly like quiet
        // ground. That counter reaches the engine channel and never the prose,
        // which is right: `unplaceable` is the player-facing "and two further
        // names you cannot place", and it is about names they HOLD. A gate they
        // have never been told about is not a name they are carrying, and
        // saying "there are eight things here you cannot see" would advertise
        // the discovery instead of gating it.
        for (const record of this.housesWithGroundIn(fromRegion.name)) {
            if (reachable.some(row => loosePlaceKey(row.name) === loosePlaceKey(record.name))) continue;
            if (!this.canPointAtLocation(cultivator, record)) {
                unnamed++;
                continue;
            }
            remember({
                name: record.name,
                kind: record.kind,
                ambient: ordinaryBandFor(record.qiDensity),
                regionName: fromRegion.name,
                travelDays: null,
                localCeilingOrdinal: fromRegion.localCeilingOrdinal,
                hereNow: loosePlaceKey(record.name) === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: true,
                ...this.occupancyOf(record.name)
            });
        }

        const read = whereCouldTheyGo({
            ordinal: cultivator.realmOrdinal,
            placeName: placeName(cultivator),
            regionName: fromRegion.name,
            localCeilingOrdinal: fromRegion.localCeilingOrdinal,
            reachable,
            unplaceable
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);

        // ── AND THE TWO WAYS OF GETTING THERE THAT ARE NOT THE ROAD ──────
        //
        // Both belong on this read rather than beside their own verbs, for the
        // same reason the sight horizon does: this is the question a player
        // asks when they want to leave, and a capability nobody can find out
        // about is a capability nobody has. A counter in the square is a fact
        // about the square, and how far a rung reaches is a fact about the
        // person - neither is a secret and neither costs anything to say.
        if (thereIsACounterAt(placeName(cultivator))) {
            const line = 'The Measured Span keeps a counter here. There is a board on the wall '
                + 'with what runs from it, what each costs and when it goes, and reading it '
                + 'costs nothing.';
            facts.lines.push(line);
            facts.prose = `${facts.prose}\n\n${line}`;
        }
        {
            const heldGrants = grantsHeldWith(
                cultivator.realmOrdinal, brokenStatusesOn(cultivator.injuries)
            );
            const inOneStep = reachable
                .filter(place => place.travelDays !== null
                    && couldFoldThere(cultivator.realmOrdinal, heldGrants, place.travelDays))
                .map(place => place.name);
            if (inOneStep.length > 0) {
                const line = `Inside one step, for somebody who folds: ${inOneStep.join(', ')}. `
                    + 'The reach is the rung, and the far end has to be ground you have stood on '
                    + 'or something you have made out yourself - being told about somewhere is '
                    + 'not a fix and never becomes one.';
                facts.lines.push(line);
                facts.prose = `${facts.prose}\n\n${line}`;
                facts.structure.push(
                    `couldFoldThere: ${inOneStep.length} of ${reachable.length} listed place(s) `
                    + `inside the fold range at ordinal ${cultivator.realmOrdinal}.`
                );
            }
        }

        // The two channels are kept visibly apart in the prose as well as in
        // the code. What was said to you comes first, because it is the answer
        // to the question; what you can see comes after it and is introduced as
        // a different kind of knowing, so a player can tell at a glance which
        // of their facts came from a person and which from their own eyes.
        //
        // Said whenever there is ground out here they cannot point at - which
        // includes the case where the horizon is zero, because a refusal that
        // names what would work is worth more than silence, and "you cannot get
        // above it yet" is exactly the sentence that tells a low cultivator
        // their map has holes and that asking is still the way to fill them.
        if (onTheGround.length > 0) {
            facts.lines.push('', overlook.headline, ...overlook.lines);
            facts.prose = `${facts.prose}\n\n${overlook.headline}\n${overlook.lines.join('\n')}`;
        }
        facts.structure.push(...overlook.structure);

        const execution = this.freeAction(run, 'destinations', facts);
        execution.calls = [{
            name: 'engine.whereCouldTheyGo',
            action: 'destinations',
            summary:
                `${reachable.length} place(s) this cultivator can point at, `
                + `${unplaceable} name(s) held and unplaceable, `
                + `${unnamed} piece(s) of ground in this province held by the world and `
                + `not by them. Gated on canPointAt, the same predicate the move verb `
                + `enforces. Travel days off region connections; qi bands off the region `
                + `catalog.`,
            ok: true
        }];
        execution.calls.push({
            name: 'engine.whatCanBeSeenFromUpThere',
            action: 'destinations',
            summary:
                `${overlook.seen} of ${onTheGround.length} piece(s) of unnameable ground inside a `
                + `horizon of ${horizonInDays(cultivator.realmOrdinal).toFixed(1)} travel days at `
                + `ordinal ${cultivator.realmOrdinal}. Perception, not knowledge: no name, holder `
                + `or ceiling crosses this channel, and below ordinal ${LEAVES_THE_GROUND} it `
                + `returns nothing at all.`,
            ok: overlook.seen > 0
        });
        return execution;
    },

    /**
     * What ground this cultivator can point at teaches, and what it wants.
     *
     * ── THE DEFECT ───────────────────────────────────────────────────────
     *
     * Twenty-three places that teach a road are seeded into every world, and
     * `daoGroundsInReachOf` - the function that decides who can get at one -
     * had NO CALLER anywhere in `src/web` or `src/server`. Every NPC alive was
     * walking roads off ground the player could not name, could not be told
     * about, and took nothing from while standing on it. This is the verb, and
     * `ground-that-teaches-a-road.ts` is what it reads.
     *
     * ── THE GATE HOLDS, AND IS THE SAME GATE ─────────────────────────────
     *
     * Nothing here names a place the cultivator could not already name. The
     * predicate is `canPointAtLocation`, which is what `destinations` and the
     * move verb use, plus the one case it cannot cover: ground they are
     * standing on, which they can obviously point at whatever the table says.
     * A player who has been told about nothing gets a short honest answer that
     * does not say what exists.
     *
     * ── AND EVERY REFUSAL NAMES WHAT WOULD WORK ──────────────────────────
     *
     * The bar, the reading against it, and the gap - the three facts the sect
     * admission line answers with, which is the one refusal in this game that
     * has always read well. Composed in
     * `ground-that-teaches-a-road.ts` off the row's own fields, so a
     * twenty-fourth ground needs no branch here or there.
     */
    roadsWithinReach(this: GameService, run: Run, cultivator: Cultivator): Execution {
        const world = this.atHand;
        if (!world) {
            return this.freeAction(run, 'roads', factsForRefusal(
                'The ground is not saying anything.',
                'You take stock of what is around you and there is nothing here the engine '
                + 'holds a reading for.',
                'World driver off; no location table to read dao ground out of.'
            ));
        }

        const underfoot = groundUnderfoot(world, cultivator.location, loosePlaceKey);
        const who = howAPlayerStands(
            world,
            underfoot ?? worldLocationFor(world, cultivator.location),
            cultivator
        );
        const all = groundThatTeachesARoad(world, who, underfoot?.id ?? null);
        const mine = this.groundTheyCanPointAt(cultivator);

        // Standing on it first, then what would teach them, then what would not
        // - which is the order somebody actually cares about the answers in.
        mine.sort((a, b) =>
            Number(b.underfoot) - Number(a.underfoot)
            || Number(b.standing.inReach) - Number(a.standing.inReach)
            || (a.name < b.name ? -1 : 1));

        const lines: string[] = [];
        for (const row of mine) {
            const wants = whatThisGroundWants(row, who);
            const where = row.underfoot ? 'You are standing on it. ' : '';
            lines.push(wants === null
                ? `${where}${whatThisGroundTeaches(row)}`
                : `${where}${wants.because} ${wants.wouldWork}`);
        }

        // ── AND THE GROUND YOU CAN CARRY ─────────────────────────────────
        //
        // A body at a great height imparts a dao, and an object fit for a path
        // does the same thing: it is a locus you sit with rather than a place
        // you go. One reader, so the two can never disagree about who receives
        // anything. Nothing is listed that is not already bound to this
        // cultivator - carried, or kept by a house that has taken them in - so
        // this cannot name a thing they had no business knowing about.
        const holding = { ...who, id: cultivator.id };
        const carried = thingsCarriedThatTeachARoad(world, holding);
        for (const thing of carried) {
            const wants = whatThisThingWants(thing, holding);
            lines.push(wants === null
                ? whatThisThingTeaches(thing)
                : `${wants.because} ${wants.wouldWork}`);
        }

        const inReach = mine.filter(row => row.standing.inReach).length
            + carried.filter(row => row.standing.inReach).length;
        const headline = mine.length + carried.length === 0
            ? 'Nobody has pointed you at ground like that.'
            : inReach > 0
                ? 'What would teach you something, if you stayed with it.'
                : 'You know where they are. None of them is saying anything to you.';

        const facts = factsForToolResult(headline, lines.length > 0 ? lines : [
            'Places where a road can be walked are not advertised and are not on any list. '
            + 'They are ordinary ground that somebody local would mention without thinking, '
            + 'if it came up.'
        ]);
        facts.structure.push(
            `${mine.length} dao ground(s) this cultivator can point at and `
            + `${carried.length} thing(s) carrying a road bound to them; ${inReach} in reach. `
            + `Standing: ordinal ${who.ordinal}, province ${who.regionCatalogId ?? 'none'}, `
            + `house ${who.factionId ?? 'none'} at rank index ${who.factionRankIndex}.`
        );

        const execution = this.freeAction(run, 'roads', facts);
        execution.calls = [{
            name: 'engine.howSomebodyStandsToAGround',
            action: 'roads',
            summary:
                `${all.length} dao ground(s) in the world, ${mine.length} this cultivator can `
                + `point at, plus ${carried.length} object(s) carrying a road bound to them; `
                + `${inReach} in reach. Gated on canPointAt - the same predicate `
                + `destinations and move enforce - plus the ground underfoot. Reach and `
                + `refusal both from howSomebodyStandsToAGround, which is the rule the world `
                + `runs for its own people.`,
            ok: true
        }];
        return execution;
    },

    // ─────────────────────────────────────────────────────────────────────
    // WHAT IS LIVE STANDING HERE
    //
    // The fourth question, and it turned out to be the one a new player asks
    // first: not "why am I stuck" but "what are the kinds of thing I can do
    // at all". Found by playing a full run in the browser, where `help` and
    // `what can I do` - the two most universal inputs in the history of text
    // games - both landed on the unclear refusal while a dozen good verbs sat
    // one guess away.
    //
    // Nothing below computes an outcome. It is a GATHERING, in the same shape
    // as `ceiling`, `teacher` and `destinations` above it: six facts this
    // class already reads for other purposes, handed to a pure function that
    // holds no thresholds of its own beyond the schema's. See
    // `what-is-worth-doing-standing-here.ts` for what it may and may not say.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The state that decides what is worth offering, as scalars.
     *
     * Every field is read through the function that already owns it -
     * `techniqueCeiling` for the road, `medicineReaches` for what a physician
     * can close, `canAttemptBreakthrough` for the crossing - so this cannot
     * disagree with the verb it points at. A second opinion about whether a
     * wound is treatable would be a second medicine system.
     *
     * Cheap enough to run on every state read: one pouch query, one roster
     * read that is already in hand, and arithmetic.
     */
    whatIsLiveHere(
        this: GameService,
        cultivator: Cultivator,
        ambient: AmbientQi,
        run: Run
    ): StandingHere {
        const terms = this.rateTermsFor(cultivator);
        const road = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);

        const hurt = untreatedInjuries(cultivator.injuries);
        const mendable = hurt.filter(injury => !isPermanentWound(injury.woundType));

        // One pouch read, split two ways. Herbs are what a buyer prices; pills
        // are the purchase that does nothing at all until somebody swallows it.
        const pouch = listPouch(this.db, cultivator.id);
        const here = placeName(cultivator);
        const roster = this.present(cultivator);

        return {
            satiety: cultivator.satiety,
            starvationTurns: cultivator.starvationTurns,
            // The engine's own clock, which folds in the realm's burn
            // multiplier and the grace after the belly empties. Dividing
            // satiety by the per-action cost here would be a second, wrong
            // hunger model living beside the real one.
            turnsUntilStarvation: turnsUntilStarvation(
                { satiety: cultivator.satiety, starvationTurns: cultivator.starvationTurns },
                cultivator.realmOrdinal
            ),
            spiritStones: cultivator.spiritStones,
            mealCost: MEAL_COST_STONES,
            treatableWounds: mendable.filter(injury =>
                medicineReaches('mortal', injury.severity, cultivator.realmOrdinal)).length,
            woundsPastMortalCare: mendable.filter(injury =>
                !medicineReaches('mortal', injury.severity, cultivator.realmOrdinal)).length,
            cure: whatWouldCloseThisWound(
                hurt,
                cultivator.realmOrdinal,
                cultivator.spiritStones,
                // The province they are standing in, so the panel quotes the
                // figure `buy` will charge rather than the board's base.
                standingOf(cultivator).regionId
            ),
            battered: cultivator.hp < cultivator.maxHp,
            practisesAMethod: road.state !== 'no_method',
            methodExhausted: road.state === 'exhausted',
            breakthroughReady: canAttemptBreakthrough(cultivator).eligible,
            inASect: this.repos.sects.getMembership(cultivator.id) !== null,
            sellableGoods: pouch.length,
            pillsCarried: pouch.filter(entry => entry.kind === 'pill').length,
            peopleAboveHere: roster.filter(row => row.realmOrdinal > cultivator.realmOrdinal).length,
            peopleHere: roster.length,
            // ── WHAT IS NAILED UP HERE, AND WHEN THE DOOR OPENS ──────────
            //
            // The derivation the deliberate read runs, without the granting.
            // See the import note: `readTheWall` writes a knowledge row for
            // every house on the paper, and this method runs on every state
            // read, so calling it here would grant the province to somebody
            // standing still.
            //
            // Null where the place is off the map rather than a zeroed shape.
            // "There is no wall here" and "I have no idea what is here" are
            // different facts and only the first is worth a sentence.
            paperOnTheWall: this.paperUpAt(cultivator, run),
            spanCounterHere: thereIsACounterAt(here),
            // What the board would actually put to somebody at this rung, which
            // is a different number at every rung and is the reason the duty
            // line is gated on the count rather than on membership. An empty
            // board offered as an affordance is a refusal with a button on it.
            dutiesGoing: sectBoardFor(
                { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
                cultivator
            ).offers.length,
            // The read half only. `readWhatIsOnOfferHere` writes nothing; the
            // granting variant is reached by a player who actually looked.
            peopleHereWithSomethingToSell: new Set(
                readWhatIsOnOfferHere(cultivator, this.atHand).offers.map(o => o.sellerId)
            ).size,
            thinGround: ambient === 'thin',
            aboveTheLid: canExistBeyondTheLid(cultivator),
            // The one entry here that is gone next turn whatever happens. See
            // the field's note in the affordance module for why it is offered
            // ahead of the body, which nothing else is.
            brokenSeclusion: stillStands(this.crossroads, run.id, cultivator)
                ? {
                    daysRemaining: this.crossroads.daysRemaining,
                    canWithdraw: this.crossroads.canWithdraw
                }
                : null,
            // Ground they can point at where a road can be walked. A count and
            // never a name: this decides whether a LINE is offered, and the
            // line routes to the read that is gated on the same knowledge rows.
            // Somebody who has been told about none of them is offered nothing
            // and learns nothing about what exists.
            groundThatTeachesARoad: this.groundTheyCanPointAt(cultivator).length
                + this.thingsTheyHoldThatTeach(cultivator).length
        };
    },

    /**
     * The recruiting paper up where this cultivator is standing, counted.
     *
     * ── Why this is a separate method from `readTheWall` ─────────────────
     *
     * Because one of them writes and one of them does not, and the difference
     * is the whole discovery rule. `readTheWall` grants a knowledge row for
     * every house on the paper, which is correct for somebody who walked over
     * and looked at it and would be a leak on a surface that renders on every
     * state read. So the affordance layer takes the pure derivation - the same
     * `billsOnTheWall` call, the same field, the same day, the same seed - and
     * gets back counts. No house name leaves this method.
     *
     * ── And what it is for ───────────────────────────────────────────────
     *
     * The miss that produced it, from a real run: two houses were holding
     * intakes at Wheatgate, one in 35 days and one in 70, the engine knew both
     * and narrated both, and the row of things to do went on offering the same
     * three reads it offers everywhere. A wall is the most place-specific
     * object in a settlement and it is the one channel that runs towards the
     * player instead of waiting to be found.
     *
     * Null rather than a zeroed shape where the location is off the map, which
     * is a different fact from an empty wall and wants a different silence.
     */
    paperUpAt(
        this: GameService,
        cultivator: Cultivator,
        run: Run
    ): { bills: number; withinReach: number; daysToTheSoonest: number | null } | null {
        const place = placeName(cultivator);
        const ground = postingGroundOf(place);
        if (ground === 'unplaceable') return null;

        const onDay = Math.floor(run.elapsedDays);
        const bills = billsOnTheWall({
            field: openDoorsInTheWorld(),
            placeName: place,
            ground,
            placeProvinceId: provinceOfPlace(place),
            onDay,
            seed: run.seed
        });
        if (bills.length === 0) return { bills: 0, withinReach: 0, daysToTheSoonest: null };

        // The bar on the paper is the real bar, so "within reach" is the same
        // comparison the door makes and not a softer one.
        const withinReach = bills.filter(
            bill => cultivator.realmOrdinal >= bill.admissionOrdinal
        ).length;
        const soonest = Math.min(...bills.map(bill => bill.opensOnDay));
        return {
            bills: bills.length,
            withinReach,
            daysToTheSoonest: Math.max(0, Math.round(soonest - onDay))
        };
    },

    /**
     * Who answers for the ground under them, asked for deliberately.
     *
     * The trust term in `ground-trust.ts` has been moving the player's odds off
     * this since it landed, and the played game would not say it:
     * `whoHoldsTheGround` had two callers in `src/` and both were inside the
     * NPC simulation. Measured on a fresh run, which opens at the Meet on The
     * Blown Ground - so a player stands on the one province nobody holds, on
     * turn one, and could not find out. Five phrasings, five wrong answers:
     *
     *   "I ask who holds this ground"  an NPC, and the resolve failed
     *   "who holds this ground"        `destinations`, answering with the
     *                                  province's realm ceiling
     *   "whose ground is this"         the same
     *   "who is in charge here"        `sect`, answering about the PLAYER
     *   "who do I complain to here"    unclear
     *
     * Somebody who ASKED is answered whichever of the four readings it is,
     * including "the record does not say" - which is the one the old fold
     * priced as a vacuum. The volunteer is narrower and lives with the look
     * itself; see `ground-holder-lines.ts` for why.
     *
     * Free. Asking whose ground you are standing on costs nothing anywhere.
     */
    whoAnswersHere(this: GameService, run: Run, cultivator: Cultivator): Execution {
        const where = this.worldPlaceOf(cultivator);
        if (!this.atHand || !where) {
            return this.freeAction(run, 'look', factsForRefusal(
                'There is no place on the record to ask the question of.',
                'You look for whose ground this is, and there is no record here to read it '
                + 'off. Somewhere the world keeps a survey of would have an answer.'
            ));
        }
        const holder = whoAnswersForThisGround({
            locations: this.atHand.locations,
            locationId: where,
            standingHere: true
        });
        const facts = factsForToolResult(
            holder.holderName
                ? `${holder.holderName} holds ${holder.placeName ?? 'this ground'}.`
                : `Nobody's name is against ${holder.placeName ?? 'this ground'}.`,
            [holder.answer]
        );
        facts.structure.push(holder.structure);
        return this.freeAction(run, 'look', facts);
    },

    /**
     * Dao ground this cultivator holds a record for, or is standing on.
     *
     * The gate, in one place, so the affordance and the read cannot disagree
     * about what the player knows. The predicate is the one `destinations` and
     * the move verb enforce, over the same rows - `canPointAt` and never
     * `isAwareOf`, because a name caught through a wall is a name and not a
     * destination.
     *
     * The awareness table is read ONCE rather than per ground. This runs on
     * every `look` and every `help`, and `canPointAtLocation` costs two queries
     * a row.
     */
    /**
     * Things bound to this cultivator that carry a road - carried, or kept by a
     * house that has taken them in.
     *
     * No knowledge gate, because there is nothing to gate: an object is on this
     * list only because it is already theirs or their house's, and nobody has
     * to be told where their own hands are.
     */
    thingsTheyHoldThatTeach(this: GameService, cultivator: Cultivator): ThingThatTeaches[] {
        const world = this.atHand;
        if (!world) return [];
        return thingsCarriedThatTeachARoad(world, {
            ...howAPlayerStands(
                world,
                groundUnderfoot(world, cultivator.location, loosePlaceKey)
                    ?? worldLocationFor(world, cultivator.location),
                cultivator
            ),
            id: cultivator.id
        });
    },

    groundTheyCanPointAt(this: GameService, cultivator: Cultivator): GroundNearby[] {
        const world = this.atHand;
        if (!world) return [];
        const underfoot = groundUnderfoot(world, cultivator.location, loosePlaceKey);
        const who = howAPlayerStands(
            world,
            underfoot ?? worldLocationFor(world, cultivator.location),
            cultivator
        );
        const all = groundThatTeachesARoad(world, who, underfoot?.id ?? null);
        if (all.length === 0) return [];

        const pointable = new Set<string>();
        for (const row of this.knowledge.awareness(cultivator.id, 'place')) {
            if (!this.knowledge.canPointAt(cultivator.id, 'place', row.id)) continue;
            pointable.add(loosePlaceKey(row.name));
            pointable.add(loosePlaceKey(row.id));
        }
        return all.filter(row => row.underfoot
            || pointable.has(loosePlaceKey(row.id))
            || pointable.has(loosePlaceKey(row.name)));
    },

    /**
     * The same list, for the sheet.
     *
     * On the state payload rather than only in narration because the player
     * who most needs it is the one who has not thought to ask: the run that
     * found this pressed Cultivate, because it was the only obvious control on
     * the screen, and died. Two or three of these beside it are the difference
     * between a trap and a decision.
     *
     * Never throws and never blocks a state read. A sheet that fails to render
     * because the suggestion list could not be built would be a far worse bug
     * than the one this fixes, and `present()` in particular depends on a world
     * that a bare state read may not have loaded.
     */
    affordancesFor(this: GameService, cultivator: Cultivator, run: Run): Affordance[] {
        try {
            return whatIsWorthDoingStandingHere(
                this.whatIsLiveHere(cultivator, this.ambientFor(cultivator, run), run)
            );
        } catch {
            return [];
        }
    },

    /**
     * `help`, `what can I do`, and everything that means them.
     *
     * Free, and that is load-bearing for the same reason `ceiling` is free: a
     * player who is charged a turn to ask what their options are will stop
     * asking, and this is the one read a player in trouble asks repeatedly.
     *
     * It is deliberately situated rather than a catalog. A fixed command list
     * would flatten the whole character of the game, which is that you say
     * what you do in your own words; what comes back is the handful of things
     * that are live in THIS state, so the player learns the shape of the space
     * and then phrases it themselves.
     */
    guidance(this: GameService, run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const here = this.whatIsLiveHere(cultivator, ambient, run);
        const live = whatIsWorthDoingStandingHere(here);

        const standing =
            `${placeName(cultivator)}, at ${rankName(cultivator.realmOrdinal)}. `
            + 'What is live for you here:';
        const facts = factsForToolResult(
            `${placeName(cultivator)} at ${rankName(cultivator.realmOrdinal)}: `
            + `${live.length} thing(s) live.`,
            [standing, ...linesFor(live)],
            // The closing line is not decoration. It is the difference between
            // a prompt and a menu, and a player who reads this as the list of
            // accepted commands has learned the wrong game.
            [
                standing,
                linesFor(live).map(line => `  ${line}`).join('\n'),
                'That is not a list of what you may say. It is what is live standing here. '
                + 'Say what you actually mean to do, in your own words, and find out what '
                + 'it costs.'
            ].join('\n\n')
        );
        facts.structure.push(
            `${live.length} thing${live.length === 1 ? ' is' : 's are'} live standing here, `
            + `${live.filter(a => a.urgency === 'now').length} of them pressing. Satiety `
            + `${here.satiety} of 100, ${here.spiritStones} spirit stones, `
            + `${here.treatableWounds} wound${here.treatableWounds === 1 ? '' : 's'} a `
            + `physician could still close and ${here.woundsPastMortalCare} past what mortal `
            + `care reaches. `
            + (here.practisesAMethod
                ? (here.methodExhausted
                    ? 'The method being practised has stopped carrying them.'
                    : 'The method being practised is still carrying them.')
                : 'No method is being practised at all.')
        );

        const execution = this.freeAction(run, 'unclear', facts);
        execution.calls = [{
            name: 'engine.whatIsWorthDoingStandingHere',
            action: 'help',
            summary: live.map(a => `${a.urgency}:${a.id}`).join(', '),
            ok: true
        }];
        return execution;
    },

    /**
     * A manual's real ceiling for this holder, stages and volumes folded in.
     *
     * The single place this layer is allowed to answer "how far does this book
     * carry them". Never `manual.cap`: that is the CATALOG's ceiling and it
     * stops being the manual's real one the moment anybody writes a stage.
     */
    reachOf(
        this: GameService,
        cultivator: Cultivator,
        art: { id: string; name: string; cap?: number | null; volumes?: readonly string[] | null }
    ) {
        const manual = {
            id: art.id,
            name: art.name,
            cap: art.cap ?? capOf(art as never),
            volumes: art.volumes ?? null
        };
        const held = effectiveCapOf(
            manual,
            wholeWorkVolumes(art),
            stagesHeldBy(this.repos, cultivator.id, art.id)
        );

        // TWO DIFFERENT NUMBERS, and they need two calls.
        //
        // `EffectiveCap.writtenTo` is computed from the count it was GIVEN, so
        // handing it this holder's stages makes both fields the holder's and
        // the world's ceiling never appears. The world's is `writtenTo` over
        // the row count, which is what `stagesWrittenSince` is for - and the
        // gap between them is the sentence worth having: it goes further than
        // you can follow it.
        return {
            ...held,
            worldWrittenTo: writtenTo(manual, stagesWrittenSince(this.repos, art.id))
        };
    },

    /**
     * What standing between this cultivator and one named book actually is.
     *
     * The answer to a QUESTION about learning, and it changes nothing. Returns
     * null when the name is not an art at all, so the caller falls through to
     * the listing rather than refusing a sentence it merely failed to resolve.
     *
     * Every line is a restatement of something the engine already computed:
     * the rung the book opens at, what a stall asks for a copy, whether one is
     * already held, and how many houses teach it. Nothing here decides
     * anything - that is `handleLearn`'s - which is what keeps the answer to
     * "may I" and the answer to "I do" from drifting apart.
     */
    whatItWouldTake(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        query: string
    ): Execution | null {
        const art = resolveTechnique(this.repos, query, cultivator.id);
        if (!art) return null;
        const catalog = getTechnique(art.id);
        if (!catalog) return null;

        const lines: string[] = [];
        const cap = catalog.cap ?? capOf(catalog as never);
        lines.push(
            `${catalog.name} opens at ${rankName(catalog.requiredOrdinal)}`
            + (classOf(catalog) === 'cultivation'
                ? cap === null
                    ? ' and carries a cultivator the whole way.'
                    : ` and carries a cultivator as far as ${rankName(cap)}.`
                : '. It carries nobody anywhere; it is an art, not a road.')
        );
        if (catalog.requiredOrdinal > cultivator.realmOrdinal) {
            lines.push(
                `You stand at ${rankName(cultivator.realmOrdinal)}, which is `
                + `${catalog.requiredOrdinal - cultivator.realmOrdinal} rung(s) under it. `
                + 'Nothing about the book changes that; you do.'
            );
        }

        if (this.repos.techniques.knows(cultivator.id, art.id)) {
            lines.push('You already practise it. What is left is mastery, and that is sitting with it.');
        } else if (holdsACopyOf(this.db, cultivator.id, art.id)) {
            lines.push('The copy is already yours. Nothing stands between you and it but the work.');
        } else {
            const stall = stallPriceStones(art.id);
            const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
            if (house?.teaches.includes(art.id)) {
                lines.push(`${house.name} teaches it, which is what wearing their colours buys.`);
            } else if (stall !== null) {
                lines.push(
                    `A stall sells a copy for about ${stall} spirit stone`
                    + `${stall === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}`
                    + (cultivator.spiritStones >= stall
                        ? ', so it is a decision rather than a wish. What the stones do not then '
                          + 'buy is the food.'
                        : `, which is ${stall - cultivator.spiritStones} short.`)
                );
            } else {
                const taughtBy = getSectsTeaching(art.id).length;
                lines.push(
                    'Nobody sells it. '
                    + (taughtBy > 0
                        ? `${taughtBy} house${taughtBy === 1 ? '' : 's'} teach${taughtBy === 1 ? 'es' : ''} `
                          + 'it, to their own, and being one of their own is the whole of the price.'
                        : 'No house is known to teach it either, so what is left is finding a copy '
                          + 'somewhere nobody has been.')
                );
            }
        }

        const facts = factsForToolResult(`${catalog.name}, and what stands in the way.`, lines);
        facts.structure.push(
            `${catalog.name} opens at ${rungAndOrdinal(catalog.requiredOrdinal)} and `
            + `${cap === null || cap === undefined
                ? 'nothing caps how far this cultivator may be taught'
                : `this cultivator may be taught no further than ${rungAndOrdinal(cap)}`}. `
            + `${isSoldAtAStall(art.id) ? 'A stall sells it' : 'No stall sells it'}, and `
            + `${holdsACopyOf(this.db, cultivator.id, art.id)
                ? 'they already hold a copy'
                : 'they hold no copy'}. `
            + 'Reading this cost nothing: no time passed, nothing spent, nothing learned.'
        );
        return this.freeAction(run, 'list_techniques', facts);
    }
};
