/**
 * What the world volunteers to somebody standing here.
 */

import { getSect, getTechnique } from '../data/cultivation/index.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { REGIONS, canAdvanceHere, placeRoadDays, requireRegion } from '../data/cultivation/regions.js';
import { getSectsTeaching } from '../data/cultivation/sects.js';
import { capOf, carriesTo, classOf } from '../data/cultivation/techniques.js';
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
import { noticesThatTheyAreThere } from '../engine/social/presence-recognition.js';
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
    AMBIENT_QI_RATE_MULTIPLIER,
    type AmbientQi,
    type Cultivator,
    type Run,
    stagnationYearsForOrdinal
} from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import { daoHeartFor, listPouch } from '../server/consolidated/cultivation-support.js';
import { copiesHeldBy } from '../server/consolidated/technique-manage.js';
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
import { FLAG_YIELDING_TO_YOU } from './flag-keys.js';
import { readFlag } from '../server/consolidated/cultivation-support.js';
import {
    whatBeingAMemberTellsYou,
    whatStandingAmongYourOwnShows
} from './meeting-your-own-house.js';
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
import { wayOut, whereThisFightStands } from '../engine/cultivation/unfinished-fight.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import { readAdmission } from '../data/cultivation/inheritance-trials.js';
import { canHurtYou } from './action-set.js';
import { parseIntent } from './actions.js';
import { theFightStillStands } from './fight-answers.js';
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
import { type RankStanding, whyProgressHasStopped } from './why-progress-has-stopped.js';
import type { GameService } from './turn-engine.js';

/**
 * The furthest rung anything this person is carrying could put the asker on, or
 * null where nothing they hold goes past where the asker already stands.
 */
function howFarTheyCouldCarry(
    game: GameService,
    personId: string,
    askerOrdinal: number
): number | null {
    let best: number | null = null;
    for (const id of game.whatTheyAreCarrying(personId)) {
        const reach = carriesTo(
            // Their own rung is not passed in: `carriesTo` wants the TEACHER's
            // ordinal and the world row already knows it. Reading it back out
            // of the roster row here would be a second source for the same
            // number, and the two drift the moment somebody advances.
            game.repos.cultivators.getById(personId)?.realmOrdinal
                ?? ordinalOfWorldPerson(game, personId),
            id
        );
        if (reach === null || reach <= askerOrdinal) continue;
        if (best === null || reach > best) best = reach;
    }
    return best;
}

/** Where a world NPC stands, for people who have no cultivator row. */
function ordinalOfWorldPerson(game: GameService, personId: string): number {
    for (const npc of game.atHand?.npcs ?? []) {
        if (npc.id === personId) return npc.cultivation.realmOrdinal;
    }
    return 0;
}

export const situatedReads = {
    /**
     * Why nothing is accumulating, with the binding gate named first.
     */
    ceiling(this: GameService, run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const terms = this.rateTermsFor(cultivator);
        // The third argument is what stops the sheet telling somebody to go and
        // buy a book they are already carrying. See `techniqueCeiling`.
        const manual = techniqueCeiling(
            cultivator.realmOrdinal,
            terms.techniqueCap,
            copiesHeldBy(this.db, cultivator.id).length > 0
        );
        const eligibility = canAttemptBreakthrough(cultivator);
        const where = standingOf(cultivator);
        const region = requireRegion(where.regionId);

        // The rank, read off the same two functions `handlePromote` gates on.
        // Absent for somebody who serves nobody, which is not a gate - it is
        // the ordinary condition of most people alive.
        let rank: RankStanding | null = null;
        const membership = this.repos.sects.getMembership(cultivator.id);
        if (membership) {
            const sect = this.repos.sects.getById(membership.sectId);
            if (sect) {
                const next = membership.rankIndex + 1;
                const atTop = next >= sect.ranks.length;
                rank = {
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
            rank,
            progressRequired: eligibility.progressRequired,
            progressAvailable: eligibility.progressAvailable,
            eligible: eligibility.eligible,
            yearsAtCurrentRealm: cultivator.yearsAtCurrentRealm,
            stagnationYears: stagnationYearsForOrdinal(cultivator.realmOrdinal),
            // The same read the crossing takes, taken here before anybody
            // commits to one. `daoHeartFor` is the single derivation.
            daoHeart: daoHeartFor(this.db, cultivator, Math.floor(run.elapsedDays))
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
     */
    teacher(this: GameService, run: Run, cultivator: Cultivator): Execution {
        const inTheRoom = new Map(this.present(cultivator).map(row => [row.id, row]));
        const above: SomebodyAbove[] = [];
        const counted = new Set<string>();
        /**
         * How many were dropped for being unnoticeable, for the inspector.
         */
        let unnoticed = 0;

        const deps = { repos: this.repos, knowledge: this.knowledge, world: this.atHand };
        const membership = this.repos.sects.getMembership(cultivator.id);
        // The catalog rows behind the roster, indexed once. `rosterFor` carries
        // the role and `teaching.knows`; the other two limits and the rank
        // title are only on the catalog entry, and reading them per person
        // through `getMembersOf` was a scan of the whole house per member.
        const catalog = new Map(
            getMembersOf(membership?.sectId ?? '').map(m => [m.id, m])
        );

        for (const person of rosterFor(deps, cultivator)) {
            if (person.id === cultivator.id) continue;
            if (person.realmOrdinal <= cultivator.realmOrdinal) continue;
            // Before anything else is read off the row. A roster is not a
            // reason to have noticed somebody, and being on the same roll as
            // a person nine rungs up is not the same fact as being able to
            // tell they are there.
            if (!noticesThatTheyAreThere({
                theirOrdinal: person.realmOrdinal,
                yourOrdinal: cultivator.realmOrdinal,
                // A roster row with no `known` field at all has not been
                // resolved against the knowledge table, and the safe reading
                // of "unresolved" is "not known" - the other way round would
                // reopen the leak on exactly the rows nobody checked.
                known: person.known === true
            })) {
                // Marked counted anyway, so the room half below does not
                // re-introduce the same person through the other door.
                counted.add(person.id);
                unnoticed++;
                continue;
            }
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
                here: inTheRoom.has(person.id),
                carriesYouTo: person.known
                    ? howFarTheyCouldCarry(this, person.id, cultivator.realmOrdinal)
                    : null
            });
        }

        // Anybody standing here who is not on the roll. A wanderer four rungs
        // up is as real a teacher as an elder, and a rogue cultivator has no
        // roster to read at all - which is most of the reason this half exists.
        for (const [id, row] of inTheRoom) {
            if (counted.has(id)) continue;
            if (row.realmOrdinal <= cultivator.realmOrdinal) continue;
            const known = this.knowledge.isAwareOf(cultivator.id, 'cultivator', id);
            // Standing in the same square is not being seen either. Somebody
            // this far above does not register on you unless they mean to, and
            // meaning to leaves a knowledge row like everything else does.
            if (!noticesThatTheyAreThere({
                theirOrdinal: row.realmOrdinal,
                yourOrdinal: cultivator.realmOrdinal,
                known
            })) {
                unnoticed++;
                continue;
            }
            above.push({
                name: known ? row.name : null,
                realmOrdinal: row.realmOrdinal,
                rankTitle: null,
                // Nothing on the roster row says they teach, and this layer
                // will not guess. `willTeach` is a catalog fact or it is false.
                willTeach: false,
                knows: null,
                mayNotSay: null,
                costsThem: null,
                here: true,
                // And this half is where it matters most. A wanderer or a rogue
                // has no roster row to be marked a master on, so `willTeach` is
                // false for every one of them by construction - what they are
                // CARRYING is the only thing that can say they are a road.
                carriesYouTo: known
                    ? howFarTheyCouldCarry(this, id, cultivator.realmOrdinal)
                    : null
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
                + `altitude. Teaching limits read from members.ts, never composed. `
                + `${unnoticed} further ${unnoticed === 1 ? 'person stands' : 'people stand'} `
                + `above them and ${unnoticed === 1 ? 'was' : 'were'} not counted at all: `
                + `nine or more rungs up with no knowledge row, which REGARD_BANDS calls `
                + `unreachable and this read therefore never mentions.`,
            ok: true
        }];

        // AND THE PEOPLE ON YOUR OWN ROLL, WHOM YOU HAVE MET
        const meeting = whatStandingAmongYourOwnShows(cultivator, membership?.sectId ?? null, {
            // The catalog's display name, which is what a member would say.
            houseName: getSect(membership?.sectId ?? '')?.name ?? 'the house',
            // THE ROOM, not the catalog roster. Measured: the authored roll
            // carries `member-*` ids and the people standing on a house's
            // ground are `npc-*` rows - overlap by id, zero. `RosterEntry`
            // carries `sectId`, so the house is asked of the person in front of
            // you rather than looked up in a catalog they may not be in.
            here: [...inTheRoom.values()].map(row => ({
                id: row.id,
                name: row.name,
                realmOrdinal: row.realmOrdinal,
                factionId: row.sectId,
                known: this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)
            }))
        });
        // AND THE STRUCTURE, which needs nobody in the room. Being told who
        // leads your house is what joining consists of; `told` rather than
        // `witnessed`, so the ceiling holds it at `placed` and knowing the
        // head's name never becomes having met them. The protector and the
        // guests are out - `what-joining-tells-you.ts` says why.
        const structure = whatBeingAMemberTellsYou(membership?.sectId ?? null, {
            houseName: getSect(membership?.sectId ?? '')?.name ?? 'the house',
            ladder: getMembersOf(membership?.sectId ?? '').map(member => ({
                id: member.id,
                name: member.name,
                rankIndex: member.rankIndex,
                realmOrdinal: member.realmOrdinal
            })),
            ranks: getSect(membership?.sectId ?? '')?.ranks ?? []
        });
        if (structure) (execution.perceived ??= []).push(structure);

        if (meeting) {
            (execution.perceived ??= []).push(meeting.perception);
            execution.facts.structure.push(
                `on the roll and in the room: ${meeting.perception.names.length} newly nameable, `
                + `${meeting.hiddenByHeight} withheld for height. Serving together grants `
                + '`named` and nothing about their arts or their business.'
            );
        }
        return execution;
    },

    /**
     * Where they could go, priced, with the qi and the province's ceiling.
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

        // ONE ROW PER PLACE, WHATEVER TAG IT ARRIVED UNDER
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

            // A PROVINCE, which is the scale the catalog actually prices. This half
            // was missing from the first build and it was the whole of the travel
            // answer: "The Jade Gorge" and "The Drowned Sea" are names in the
            // knowledge table like any other, they are the only names with a stated
            // `travelDays` beside them, and looking up settlements only dropped
            // every one of them on the floor. The read listed five towns in the
            // player's own province, each of them zero days away, and the cost map
            // below never once returned a row.
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
                // Never zero for "somewhere in this province", and never
                // fabricated. Two figures can answer, at two scales, and the one
                // that applies is decided by where the player is standing:
                travelDays: found.region.id === fromRegion.id
                    ? placeRoadDays(cultivator.location, found.place.name)
                    : cost.get(found.region.id) ?? null,
                localCeilingOrdinal: found.region.localCeilingOrdinal,
                hereNow: wanted === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: found.region.id === fromRegion.id,
                ...this.occupancyOf(found.place.name)
            });
        }

        // GROUND THAT IS NOT A TOWN
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

        // AND WHAT IS SIMPLY VISIBLE FROM UP THERE
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

        // AND THE GATES
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

        // AND THE TWO WAYS OF GETTING THERE THAT ARE NOT THE ROAD
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

        // The two channels are kept visibly apart in the prose as well as in the
        // code. What was said to you comes first, because it is the answer to the
        // question; what you can see comes after it and is introduced as a
        // different kind of knowing, so a player can tell at a glance which of
        // their facts came from a person and which from their own eyes.
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

        // AND THE GROUND YOU CAN CARRY
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

    // WHAT IS LIVE STANDING HERE

    /**
     * The state that decides what is worth offering, as scalars.
     */
    whatIsLiveHere(
        this: GameService,
        cultivator: Cultivator,
        ambient: AmbientQi,
        run: Run
    ): StandingHere {
        const terms = this.rateTermsFor(cultivator);
        const road = techniqueCeiling(
            cultivator.realmOrdinal,
            terms.techniqueCap,
            copiesHeldBy(this.db, cultivator.id).length > 0
        );

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
            // -- AND WHOEVER IS ON THEIR KNEES IN FRONT OF THEM -----------
            yielding: (() => {
                const noted = readFlag(this.db, cultivator.id, FLAG_YIELDING_TO_YOU);
                if (!noted) return null;
                const who = noted.split(':')[0];
                const stillHere = roster.find(row => row.id === who);
                return stillHere ? { name: stillHere.name } : null;
            })(),
            battered: cultivator.hp < cultivator.maxHp,
            practisesAMethod: road.state !== 'no_method',
            methodExhausted: road.state === 'exhausted',
            breakthroughReady: canAttemptBreakthrough(cultivator).eligible,
            inASect: this.repos.sects.getMembership(cultivator.id) !== null,
            sellableGoods: pouch.length,
            pillsCarried: pouch.filter(entry => entry.kind === 'pill').length,
            peopleAboveHere: roster.filter(row => row.realmOrdinal > cultivator.realmOrdinal).length,
            peopleHere: roster.length,
            // WHAT IS NAILED UP HERE, AND WHEN THE DOOR OPENS
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
            // The band itself rather than a `thinGround` boolean. A boolean can
            // say the ground is bad and cannot say it is worth four ordinary
            // years for one, which is the sentence somebody standing on a vein
            // needs and was never shown.
            ambient,
            // THE NAMES, ALREADY GATED
            peopleHereByName: roster
                .filter(row => this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id))
                .map(row => ({
                    name: row.name,
                    realmOrdinal: row.realmOrdinal,
                    standsAbove: row.realmOrdinal > cultivator.realmOrdinal,
                    rungsApart: Math.abs(row.realmOrdinal - cultivator.realmOrdinal)
                }))
                // Deepest first: in a square, the person you notice is the one
                // the others are being careful around.
                .sort((a, b) => b.realmOrdinal - a.realmOrdinal),
            thickerGroundWithinReach: this.thickerGroundTheyCouldReach(cultivator, ambient),
            // The read half. `readWhatIsOnOfferHere` is already being run for
            // the seller count above; this is the same rows, named. The THING
            // is named and the seller is not - `learnTheSeller` is what writes
            // a knowledge row for a person, and it wants somebody to have
            // walked over.
            goodsOnOfferHere: readWhatIsOnOfferHere(cultivator, this.atHand).offers
                .map(offer => ({ name: offer.name, askStones: offer.askStones }))
                .sort((a, b) => a.askStones - b.askStones),
            roadUnderfoot: this.groundTheyCanPointAt(cultivator)
                .find(row => row.underfoot)?.name ?? null,
            // THE DANGEROUS HALF, WHICH WAS NEVER BEING PRODUCED
            sitesYouCouldOpen: this.nameableFor(cultivator)
                .map(site => ({
                    name: site.name,
                    setAtOrdinal: site.access.floorOrdinal,
                    // The site's OWN reading, which splits being let in from
                    // coming back out. A ground that admits somebody it will
                    // not release is exactly what that distinction is for.
                    survivable: readAdmission(site.access, cultivator.realmOrdinal).survives
                }))
                // Survivable first, deepest of those - the best ground the body
                // can actually take. Then the shallowest that it cannot, which
                // is the nearest thing to aim at rather than the worst.
                .sort((a, b) =>
                    Number(b.survivable) - Number(a.survivable)
                    || (a.survivable
                        ? b.setAtOrdinal - a.setAtOrdinal
                        : a.setAtOrdinal - b.setAtOrdinal)
                    || (a.name < b.name ? -1 : 1)),
            // The ENUM and never `holderName` - that field is null both for an
            // unheld ground and for a holder nothing can place, so an absent
            // name is not evidence of absent authority. These are the same two
            // readings `ground-holder-lines.ts` volunteers unasked.
            groundIsUnheld: (() => {
                const where = this.worldPlaceOf(cultivator);
                if (!this.atHand || !where) return false;
                const holding = whoHoldsTheGround(this.atHand.locations, where).holding;
                return holding === 'no_authority' || holding === 'no_holder_of_record';
            })(),
            aboveTheLid: canExistBeyondTheLid(cultivator),
            // The one entry here that is gone next turn whatever happens. See the
            // field's note in the affordance module for why it is offered ahead of
            // the body, which nothing else is. WHAT IS HAPPENING, WHICH BEATS WHERE
            // IT IS HAPPENING
            fight: theFightStillStands(this.fight, run.id, cultivator.id)
                ? (() => {
                    const held = this.fight!;
                    const where = whereThisFightStands(held.state, ambient);
                    return {
                        them: held.party.name,
                        yourHp: where.yourHp,
                        yourMaxHp: where.yourMaxHp,
                        theirHp: where.theirHp,
                        theirMaxHp: where.theirMaxHp,
                        roundsLeft: where.roundsLeft,
                        flightChance: where.flight.chance,
                        // `wayOut` with nothing named picks the nearest, which
                        // is where somebody actually running goes. Null where
                        // the ground has no road, and that stays null rather
                        // than becoming a direction this layer invented.
                        wayOut: (() => {
                            const out = wayOut(held.state.ground, null);
                            return out ? { name: out.name, days: out.days } : null;
                        })()
                    };
                })()
                : null,
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
     * Places they could set out for whose ground beats the ground underfoot.
     */
    thickerGroundTheyCouldReach(
        this: GameService,
        cultivator: Cultivator,
        here: AmbientQi
    ): { name: string; ambient: AmbientQi; travelDays: number | null }[] {
        const rateHere = AMBIENT_QI_RATE_MULTIPLIER[here];
        const from = requireRegion(standingOf(cultivator).regionId);

        // What it costs to reach each other province, off this region's own
        // `connections`. Absent means no stated road, which is a real state and
        // is never printed as a zero - see `Destination.travelDays`.
        const cost = new Map<string, number>();
        for (const link of from.connections) {
            const known = cost.get(link.otherRegionId);
            if (known === undefined || link.travelDays < known) {
                cost.set(link.otherRegionId, link.travelDays);
            }
        }

        const standing = loosePlaceKey(cultivator.location ?? '');
        const better: { name: string; ambient: AmbientQi; travelDays: number | null }[] = [];
        const seen = new Set<string>();

        for (const row of this.knowledge.awareness(cultivator.id, 'place')) {
            if (!this.knowledge.canPointAt(cultivator.id, 'place', row.id)) continue;
            const wanted = loosePlaceKey(row.name);
            if (wanted === standing || seen.has(wanted)) continue;

            // A settlement, because a settlement is the only scale that carries
            // a band. A province's `ambientProfile` is a distribution over the
            // places inside it and flattening it would state a fact about
            // ground nobody has stood on - the same refusal `destinations`
            // makes, for the same reason.
            const found = REGIONS
                .flatMap(region => region.places.map(place => ({ region, place })))
                .find(candidate => loosePlaceKey(candidate.place.name) === wanted);
            if (!found) continue;
            if (AMBIENT_QI_RATE_MULTIPLIER[found.place.ambient] <= rateHere) continue;

            seen.add(wanted);
            better.push({
                name: found.place.name,
                ambient: found.place.ambient,
                travelDays: found.region.id === from.id
                    ? null
                    : cost.get(found.region.id) ?? null
            });
        }

        // Best band first, then the shorter walk. A stated road beats an
        // unpriced one at equal band only because the number is worth saying.
        return better.sort((a, b) =>
            AMBIENT_QI_RATE_MULTIPLIER[b.ambient] - AMBIENT_QI_RATE_MULTIPLIER[a.ambient]
            || (a.travelDays ?? 0) - (b.travelDays ?? 0)
            || (a.name < b.name ? -1 : 1));
    },

    /**
     * The recruiting paper up where this cultivator is standing, counted.
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
            standingHere: true,
            // What the asker may be TOLD, on the same bar the gate at a door
            // uses. Without it this read named the holder for 220 of 220 barred
            // held locations at a rung the door itself withheld it at.
            readerOrdinal: cultivator.realmOrdinal
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
     */
    /**
     * Things bound to this cultivator that carry a road - carried, or kept by a
     * house that has taken them in.
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
     */
    affordancesFor(this: GameService, cultivator: Cultivator, run: Run): Affordance[] {
        try {
            const live = whatIsWorthDoingStandingHere(
                this.whatIsLiveHere(cultivator, this.ambientFor(cultivator, run), run)
            );
            // THE HARM AXIS, STAMPED HERE AND DEFINED NOWHERE NEAR HERE
            return live.map(a => a.canHurtYou
                ? a
                : (() => {
                    const plan = parseIntent(a.say);
                    return { ...a, canHurtYou: canHurtYou(plan.action, plan.intent) };
                })());
        } catch {
            return [];
        }
    },

    /**
     * `help`, `what can I do`, and everything that means them.
     */
    guidance(this: GameService, run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const here = this.whatIsLiveHere(cultivator, ambient, run);
        const live = whatIsWorthDoingStandingHere(here);

        const standing =
            `${placeName(cultivator)}, at ${rankName(cultivator.realmOrdinal)}. `
            + 'What is live for you here:';

        // THE STATE GOES ON `lines`, NOT ONLY ON `structure`
        const theirState =
            `On them: ${here.spiritStones} spirit stone${here.spiritStones === 1 ? '' : 's'}, `
            + `satiety ${here.satiety} of 100`
            + (here.treatableWounds > 0
                ? `, and ${here.treatableWounds} wound${here.treatableWounds === 1 ? '' : 's'} a `
                  + 'physician could still close'
                : ', and nothing a physician would need to close')
            + '.';
        const facts = factsForToolResult(
            `${placeName(cultivator)} at ${rankName(cultivator.realmOrdinal)}: `
            + `${live.length} thing(s) live.`,
            [standing, theirState, ...linesFor(live)],
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
        return {
            ...held,
            worldWrittenTo: writtenTo(manual, stagesWrittenSince(this.repos, art.id))
        };
    },

    /**
     * What standing between this cultivator and one named book actually is.
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
