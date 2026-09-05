/**
 * Hitting somebody, and everything the world does about it afterwards.
 */

import { getApexInstitution, getCourt } from '../data/cultivation/hierarchy.js';
import { getPill, getSect, getTechnique } from '../data/cultivation/index.js';
import { requireRegion } from '../data/cultivation/regions.js';
import { SECTS, sectThreat } from '../data/cultivation/sects.js';
import {
    type ConfrontationOutcome,
    type ConfrontationResult,
    assessPower
} from '../engine/cultivation/combat.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    type CouldBeCalled,
    type FightAnswer,
    type FightGround,
    type FightTurn,
    type WayOut,
    openFight,
    takeAFightTurn,
    whereThisFightStands
} from '../engine/cultivation/unfinished-fight.js';
import {
    theAccountsAFightOpens,
    whatFollowsFromTheBout,
    type BoutTerms
} from '../engine/social-leverage/index.js';
import { createObligation, severityRank } from '../engine/social/grudges.js';
import { whatItWasWorth } from '../engine/social-leverage/what-a-deed-leaves.js';
import { whatTheyDoAboutBeingWronged } from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import type { InheritanceRelation, ObligationInput } from '../engine/social/grudges.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { type NpcRecord, bodyStandingOn, maxBodyOf } from '../engine/world/npc-state.js';
import { npcsInFaction } from '../engine/world/world-state.js';
import { whatTheyRecogniseAboutIt } from '../engine/world/artifact-recognition.js';
import {
    isRuined,
    isTracked,
    revealOwnership,
    ruin,
    transferPossession
} from '../engine/world/possessions.js';
import {
    whatTheConfrontationDidToThem
} from '../engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import {
    type AmbientQi,
    type Cultivator,
    type Injury,
    InjurySchema,
    type Run,
    type Technique
} from '../schema/cultivation.js';
import {
    combatantFromCultivator,
    combatantFromOpponent,
    settleAFight
} from '../server/consolidated/combat-manage.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    isGuidingErrorBody,
    listPouch,
    removeFromPouch
} from '../server/consolidated/cultivation-support.js';
import {
    whatBeingMadeIntoAThingOpens,
    whatTheHandLeaves
} from '../engine/social/a-body-under-somebody-elses-hand.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ActionName } from './actions.js';
import { foldTheCallsIntoOneTurn } from './a-sentence-can-be-more-than-one-call.js';
import {
    type Reachability,
    type SetShape,
    type TheSetAsKnown,
    howTheSetWasCounted,
    theSetAsThisCultivatorKnowsIt,
    theSetThisNames,
    whatTheActDidNotReach
} from './acts-over-a-set.js';
import { whoTheyCarryFor } from './what-a-telling-lands-on.js';
import { type DatabaseHandle, PLAYER_ROLL_IDENTITY, writeObligation } from './encounters.js';
import { resolveCultivator } from './entities.js';
import { factsForRefusal, factsForToolResult, placeName, rungAndOrdinal } from './facts.js';
import { type StandingFight, theFightStillStands } from './fight-answers.js';
import { routesOutOfAGap, sayingWhatWouldWork } from './gap-routes.js';
import { loosePlaceKey } from './knowledge.js';
import { creditIn, headTitleOf, positionIn, spendStanding } from './standing.js';
import { refused } from './tool-result-prose.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import { FLAG_YIELDING_TO_YOU } from './flag-keys.js';
import { writeFlag } from '../server/consolidated/cultivation-support.js';

/**
 * Priority at which a want is the whole of why somebody is standing there.
 */
const WOULD_RATHER_DIE_PRIORITY = 0.8;

/**
 * Standing at which somebody answers rather than yields.
 */
const ANSWERS_RATHER_THAN_YIELDS = -60;

function wouldTheyKneel(
    them: NpcRecord,
    coercerId: string
): { yields: boolean; because: string } {
    const errand = them.goals.find(
        goal => goal.status === 'active'
            && goal.priority >= WOULD_RATHER_DIE_PRIORITY
            && goal.targetId === coercerId
    );
    if (errand) {
        return {
            yields: false,
            because:
                `an open want at priority ${errand.priority.toFixed(2)} pointed at the person `
                + `doing this: ${errand.text}`
        };
    }

    const feud = them.relationships.find(
        tie => tie.targetId === coercerId
            && tie.standing <= ANSWERS_RATHER_THAN_YIELDS
    );
    if (feud) {
        return {
            yields: false,
            because:
                `standing ${feud.standing} toward the person doing this, which is a feud: `
                + feud.note
        };
    }

    return {
        yields: true,
        because: 'nothing on their record says this is somebody who would rather die'
    };
}

/**
 * A phrase that names a HEIGHT rather than a person.
 */
const SOMEBODY_OF_MY_OWN_HEIGHT =
    /\b(?:my (?:own )?(?:realm|rank|rung|level|height|standing)|my equal|an equal|someone equal|of equal (?:rank|realm)|the same (?:realm|rank|rung) as me|my own kind)\b/i;

export const combatVerbs = {
    /**
     * Hitting somebody.
     */
    /**
     * Whether the person being coerced yields, or would rather die.
     */
    /**
     * The art this cultivator is actually fighting with. ── WHAT IT PICKS, AND WHY
     * IT IS NOT A CHOICE TAKEN FROM THE PLAYER ──
     */
    /**
     * The art they would actually run with, which is not the one they fight with.
     */
    artTheyWouldRunWith(this: GameService, cultivator: Cultivator): Technique | null {
        return this.repos.techniques.listKnown(cultivator.id)
            .filter(art => art.category === 'movement' && art.requiredOrdinal <= cultivator.realmOrdinal)
            .sort((a, b) => b.mastery - a.mastery || (a.id < b.id ? -1 : 1))[0] ?? null;
    },

    /**
     * The ground a fight is standing on, and the roads off it.
     */
    groundUnderAFight(this: GameService, cultivator: Cultivator): FightGround {
        const here = standingOf(cultivator);
        const hereKey = loosePlaceKey(cultivator.location ?? '');
        let waysOut: WayOut[] = [];
        try {
            const region = requireRegion(here.regionId);
            waysOut = region.places
                .filter(place => loosePlaceKey(place.name) !== hereKey)
                .map(place => ({ id: place.name, name: place.name, days: 1 }));
        } catch {
            // No region for this location - a harness with the world off, or a
            // place the gazetteer does not hold. Running is still running.
            waysOut = [];
        }
        return {
            locationId: cultivator.location ?? here.regionId,
            locationName: placeName(cultivator),
            waysOut
        };
    },

    /**
     * Who is standing close enough to hear somebody shout, and what they are.
     */
    whoCouldHearAShout(this: GameService, cultivator: Cultivator, exceptId: string): CouldBeCalled[] {
        const mine = this.repos.cultivators.getById(cultivator.id);
        const myHouse = mine?.sectId ?? null;
        return this.present(cultivator)
            .filter(row => row.id !== cultivator.id && row.id !== exceptId)
            .map(row => {
                const npc = this.atHand?.npcs.find(n => n.id === row.id) ?? null;
                const tie = npc?.relationships.find(r => r.targetId === cultivator.id) ?? null;
                return {
                    id: row.id,
                    name: row.name,
                    realmOrdinal: row.realmOrdinal,
                    standing: tie?.standing ?? 0,
                    // Somebody on the same roll standing on their own house's
                    // ground answers because it is their ground, which is not
                    // the same as answering you.
                    answersForThisGround:
                        myHouse !== null && npc?.factionId === myHouse
                };
            });
    },

    artTheyWouldFightWith(this: GameService, cultivator: Cultivator): string | undefined {
        const usable = this.repos.techniques.listKnown(cultivator.id)
            .filter(art => art.requiredOrdinal <= cultivator.realmOrdinal)
            .sort((a, b) => b.mastery - a.mastery || (a.id < b.id ? -1 : 1));
        return usable[0]?.id;
    },

    async attack(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        /**
         * The band the ground is running at.
         */
        ambient: AmbientQi,
        target: string | undefined,
        goal: string,
        terms: BoutTerms = 'open',
        /**
         * How the fight was opened. Passed straight to the resolver, which
         * gives a concealed opening the ambush edge and takes the target's
         * first swing away. Nothing in this layer reads it to pick an outcome.
         */
        opening: 'open' | 'from_concealment' = 'open',
        /**
         * What the compliance was FOR, when the verb was `coerce`.
         */
        wanted?: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        // A NAME PHASE 1 DROPPED HAS ALREADY BEEN PUT BACK
        const query = (target ?? '').trim();

        if (query.length < 2) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named for a confrontation. Nothing was resolved and ' +
                'no exchange was run.'
            ));
        }

        // A SET IS NOT ONE PERSON, AND USED TO BECOME THE WORST OF THEM
        const asASet = theSetThisNames(query);
        if (asASet) {
            return await this.attackOverASet(
                cultivator, asASet, goal, terms, opening, wanted
            );
        }

        // a house is not a person
        const asFaction = this.factionMeant(query, cultivator);
        if (asFaction && !this.somebodyAtHand(query, cultivator)) {
            const theirs = sectThreat(asFaction.id)?.acting
                ?? getCourt(asFaction.id)?.powerOrdinal
                ?? getApexInstitution(asFaction.id)?.powerOrdinal
                ?? null;
            const position = positionIn(this.repos, cultivator.id);
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'A house is not standing in front of you.',
                `${asFaction.name} is a name, a roll and some ground. There is nobody called that `
                + 'to swing at. What there is instead is people who answer to it - and any one of '
                + 'them can be fought by somebody standing in the same place as them - or the '
                + 'thing a house does to another house, which is a decision made by whoever heads '
                + 'that house and not by whoever is angry.'
                + (theirs === null
                    ? ''
                    : ` The strongest person they will actually put in a room stands at `
                      + `${rankName(theirs)}.`)
                + (position
                    ? ''
                    : ' You serve no house anywhere, so the second route is not open to you either.'),
                `"${query}" resolved to the faction ${asFaction.id}, and a faction is not a `
                + 'combatant: the confrontation resolver takes a person. '
                + (theirs === null
                    ? 'What the strongest person they would put in a room stands at is not '
                      + 'recorded anywhere this read can see.'
                    : `The strongest person they will put in a room stands at `
                      + `${rungAndOrdinal(theirs)}.`)
                + (position
                    ? ` This cultivator serves ${position.sectId}, so the other route is open to `
                      + `them: what a house does to a house is decided by its ${headTitleOf(position)}.`
                    : ' This cultivator holds no membership anywhere, so the other route - what a '
                      + 'house does to a house, decided by whoever heads it - is not open to them '
                      + 'either.')
                + ' What is open is attacking a named member standing in the same place as them.'
            ));
        }

        // SOMEBODY OF MY OWN HEIGHT
        const peer = SOMEBODY_OF_MY_OWN_HEIGHT.test(query)
            ? [...this.present(cultivator)]
                .sort((a, b) =>
                    Math.abs(a.realmOrdinal - cultivator.realmOrdinal)
                    - Math.abs(b.realmOrdinal - cultivator.realmOrdinal)
                    || (a.id < b.id ? -1 : 1))[0]
            : undefined;

        // A gesture at somebody in the square resolves to somebody in the
        // square. A name resolves to that name or to nothing.
        const pointed = peer ?? this.somebodyAtHand(query, cultivator);
        const party = pointed
            ? { kind: 'cultivator' as const, id: pointed.id, name: pointed.name }
            : resolveCultivator(this.repos, query, cultivator.id, scope, cultivator.realmOrdinal);
        const present = party ? this.present(cultivator).some(row => row.id === party.id) : false;
        if (!party || !present) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nothing to swing at.',
                // Not the conversational brush-off. A fight that does not
                // happen fails differently from a question nobody answers.
                'You look for them and the moment goes past you. There is nobody in front of ' +
                'you that the thought fits, and standing here deciding is its own answer.',
                `Unresolved party "${query}" for a confrontation` +
                `${party ? ', resolved but not co-located' : ''}. No exchange was run.`
            ));
        }

        // `goal` decides which endings the engine will reach for. It is passed
        // straight through; nothing in this layer reads it to pick a winner.
        const intent = goal === 'kill' || goal === 'subdue' || goal === 'humiliate'
            || goal === 'coerce'
            ? goal
            : 'drive_off';

        // Half the people in a square exist only in the world state, not in the
        // cultivators table, and `combat_manage` looks its opponent up by id.
        // Passing an id it cannot find produced "No cultivator with id npc-95."
        // as the answer to a player swinging at somebody standing in front of
        // them. Where there is no row, the opponent is described instead -
        // which is what `OpponentSchema` has the name and ordinal fields for.
        const onRecord = this.repos.cultivators.getById(party.id) !== undefined
            && this.repos.cultivators.getById(party.id) !== null;
        const standing = this.present(cultivator).find(row => row.id === party.id);

        // THE PERSON THE WORLD ACTUALLY HOLDS
        const theirRecord = !onRecord && this.atHand
            ? this.atHand.npcs.find(npc => npc.id === party.id) ?? null
            : null;

        // SWINGING AT SOMEBODY YOU ARE ALREADY FIGHTING
        const alreadyFighting = theFightStillStands(this.fight, run.id, cultivator.id)
            ? this.fight
            : null;
        if (alreadyFighting && alreadyFighting.party.id === party.id) {
            return await this.answerTheFight(
                run, cultivator, ambient, alreadyFighting, { kind: 'strike' }
            );
        }

        // AND THE BODY THEY ARE ACTUALLY STANDING IN
        const opponentSpec = onRecord
            ? { cultivatorId: party.id }
            : {
                name: party.name,
                ...(standing ? { realmOrdinal: standing.realmOrdinal } : {}),
                ...(theirRecord
                    ? {
                        realmOrdinal: theirRecord.cultivation.realmOrdinal,
                        // Clamped to the schema's bands rather than passed
                        // raw: an out-of-range attribute is a validation
                        // error, and a fight that fails to start is a worse
                        // answer than one fought on the nearest legal body.
                        might: Math.max(1, Math.min(3, theirRecord.cultivation.attributes.might)),
                        insight: Math.max(1, Math.min(4, theirRecord.cultivation.attributes.insight)),
                        untreatedInjuries: Math.max(0, Math.min(
                            10, Math.floor(theirRecord.cultivation.untreatedInjuries)
                        )),
                        maxHp: Math.max(1, Math.round(maxBodyOf(theirRecord))),
                        hp: Math.max(1, Math.round(
                            bodyStandingOn(theirRecord, Math.floor(run.elapsedDays))
                        ))
                    }
                    : {})
            };

        const opponentBody = combatantFromOpponent(opponentSpec, this.repos);
        if (isGuidingErrorBody(opponentBody)) {
            return this.fromToolResult(
                'combat_manage.resolve', intent === 'coerce' ? 'coerce' : 'attack',
                opponentBody, party.name
            );
        }

        // What they are actually swinging. Absent until it was added, so every
        // played fight was fought bare by somebody holding a manual - see
        // `artTheyWouldFightWith`.
        const techniqueId = this.artTheyWouldFightWith(cultivator) ?? null;
        const selfBody = combatantFromCultivator(
            cultivator, this.repos, techniqueId ?? undefined
        );

        // AND NOW IT IS A FIGHT RATHER THAN A RESULT
        const opened = openFight({
            // Stable for the life of the fight and unique to it, so round four
            // is round four however long the player took over it. Not the row
            // ids: `PLAYER_ROLL_IDENTITY` exists because those are randomUUIDs
            // and keying on them made the same seed produce a different fight.
            id: `${run.turn + 1}:${PLAYER_ROLL_IDENTITY}:${opponentBody.realmOrdinal}`,
            seed: run.seed,
            aggressor: {
                input: selfBody,
                edges: [],
                vector: 'body',
                movement: this.artTheyWouldRunWith(cultivator),
                movementMastery: this.artTheyWouldRunWith(cultivator)?.mastery ?? 0
            },
            defender: {
                input: opponentBody, edges: [], vector: 'body',
                movement: null, movementMastery: 0
            },
            intent: {
                goal: intent,
                willWithdraw: true,
                opening,
                // WHETHER THEY WOULD RATHER DIE
                ...(intent === 'coerce' && theirRecord
                    ? (() => {
                        const kneel = wouldTheyKneel(theirRecord, cultivator.id);
                        return { yields: { willYield: kneel.yields, because: kneel.because } };
                    })()
                    : {})
            },
            playerId: cultivator.id,
            ground: this.groundUnderAFight(cultivator),
            turn: run.turn + 1,
            ambient
        });

        // Seeing somebody well enough to fight them is seeing them.
        this.noteEncounter(
            cultivator, run, party, 'witnessed',
            `Fought at ${placeName(cultivator)}.`
        );

        const held: StandingFight = {
            state: opened.fight ?? {
                // Never read when the gap settled it; the shape is filled so the
                // conclusion below can be given one object rather than two.
                id: '', seed: run.seed, roundsFought: 0, roundBudget: 0,
                aggressor: { input: selfBody, edges: [], vector: 'body', movement: null, movementMastery: 0 },
                defender: { input: opponentBody, edges: [], vector: 'body', movement: null, movementMastery: 0 },
                hp: {}, injuries: {}, hpAtOpening: {}, exchanges: [], brokenObjects: [],
                intent: { goal: intent }, playerId: cultivator.id,
                ground: this.groundUnderAFight(cultivator), openedOnTurn: run.turn + 1
            },
            runId: run.id,
            cultivatorId: cultivator.id,
            party: { id: party.id, name: party.name },
            theirRecord,
            opponentIdOnRecord: onRecord ? party.id : null,
            standingOrdinal: standing?.realmOrdinal ?? null,
            self: selfBody,
            opponent: opponentBody,
            techniqueId,
            terms,
            verb: intent === 'coerce' ? 'coerce' : 'attack',
            ...(wanted !== undefined ? { wanted } : {})
        };

        // ── THE GAP CAN STILL END IT BEFORE ANYBODY MOVES ────────────────
        //
        // `no_contest` and the one-sided path are not fights, so they are not
        // held open for eight turns of the player typing at them. They settle
        // exactly as they always did, through the same conclusion.
        if (opened.settled) {
            this.fight = null;
            return this.whatTheySawYouCarrying(
                cultivator, held, this.concludeTheFight(run, cultivator, held, opened.settled)
            );
        }

        this.fight = held;
        // The opening round happens on the turn the player swung, because they
        // swung. A verb that opened a fight and then spent the turn describing
        // it would be the player's own action costing them a round.
        return this.whatTheySawYouCarrying(
            cultivator, held,
            await this.answerTheFight(run, cultivator, ambient, held, { kind: 'strike' })
        );
    },

    /**
     * Who a set-shaped target actually names, as this cultivator holds it.
     */
    theSetAsYouKnowIt(
        this: GameService,
        cultivator: Cultivator,
        set: SetShape
    ): TheSetAsKnown | null {
        const here = this.present(cultivator);
        const gates: Reachability = {
            isPresent: id => here.some(row => row.id === id),
            hasHeardOf: id => this.knowledge.isAwareOf(cultivator.id, 'cultivator', id)
        };
        const asCandidate = (row: { id: string; name: string }) =>
            ({ id: row.id, name: row.name });

        if (set.kind === 'everyone_here' || set.kind === 'role_here') {
            const members = set.kind === 'everyone_here'
                ? here
                : here.filter(row =>
                    (row.sectRank ?? '').toLowerCase().includes(set.role.toLowerCase()));
            // Being able to see somebody is what makes them a member of a set
            // defined by where they are standing, so the discovery gate is not
            // asked - `whoTheNearestFaceIs` already lets a player swing at a
            // face they cannot name. The remainder is empty by construction,
            // and that is the honest answer: the square is the whole set.
            return theSetAsThisCultivatorKnowsIt({
                members: members.map(asCandidate),
                gates,
                presenceIsItsOwnDiscovery: true
            });
        }

        if (set.kind === 'kin_of') {
            const anchor = this.whoASetHangsOn(cultivator, set.anchor);
            if (!anchor) return null;
            const record = this.atHand?.npcs.find(npc => npc.id === anchor.id) ?? null;
            // `whoTheyCarryFor` and not a second opinion about who somebody's
            // family is: it reads the six ties `the-ties-an-ordinary-life-
            // produces.ts` writes, and a list restated here would drift from it.
            const ids = whoTheyCarryFor(anchor.id, record).ids;
            return theSetAsThisCultivatorKnowsIt({
                members: ids
                    .map(id => this.whoThatIsIfTheyAreStillAlive(id))
                    .filter((one): one is { id: string; name: string } => one !== null),
                gates,
                presenceIsItsOwnDiscovery: false
            });
        }

        if (set.kind === 'of_alignment') {
            // The catalog's own word, and nothing here decides what righteous
            // means. A leaning it does not carry names no houses, and the set
            // is empty - which is a real answer and reads as one.
            const houses = new Set<string>(
                SECTS.filter(row => row.alignment === set.alignment).map(row => row.id)
            );
            if (houses.size === 0) return null;
            const members = [
                ...this.repos.cultivators.roster()
                    .filter(row => row.alive && row.sectId !== null && houses.has(row.sectId)),
                ...(this.atHand
                    ? [...houses].flatMap(id => npcsInFaction(this.atHand!, id))
                    : [])
            ].filter(row => row.id !== cultivator.id).map(asCandidate);
            return theSetAsThisCultivatorKnowsIt({
                members, gates, presenceIsItsOwnDiscovery: false
            });
        }

        const house = this.factionMeant(set.house, cultivator)
            // "the whole sect" names a house without saying which, exactly as
            // "him" names a person without saying who. It resolves the same
            // way: whoever the player is standing in front of, and their house.
            ?? this.factionMeant(
                this.whoASetHangsOn(cultivator, '')?.sectName ?? '', cultivator);
        if (!house) return null;
        const members = [
            ...this.repos.cultivators.roster().filter(row => row.sectId === house.id && row.alive),
            ...(this.atHand ? npcsInFaction(this.atHand, house.id) : [])
        ].filter(row => row.id !== cultivator.id).map(asCandidate);
        return theSetAsThisCultivatorKnowsIt({
            members, gates, presenceIsItsOwnDiscovery: false
        });
    },

    /**
     * The one person a set is described in terms of.
     */
    whoASetHangsOn(
        this: GameService,
        cultivator: Cultivator,
        anchor: string
    ): RosterEntry | null {
        const wanted = anchor.trim();
        const asPronoun = wanted.length === 0
            ? 'them'
            : ({ his: 'him', her: 'her', their: 'them', its: 'them' } as Record<string, string>)[
                wanted.toLowerCase()];
        if (asPronoun) return this.somebodyAtHand(asPronoun, cultivator);
        // `my` and `your` name the player themselves, which is a set they are
        // standing in rather than one in front of them.
        if (/^(?:my|your|our)$/i.test(wanted)) {
            return this.present(cultivator).find(row => row.id === cultivator.id) ?? null;
        }
        const named = resolveCultivator(
            this.repos, wanted, cultivator.id, this.scopeFor(cultivator), cultivator.realmOrdinal
        );
        return named
            ? this.present(cultivator).find(row => row.id === named.id)
                ?? ({ id: named.id, name: named.name } as RosterEntry)
            : null;
    },

    /**
     * A name for an id, from whichever store holds the person - and null for
     * somebody the world holds as dead.
     */
    whoThatIsIfTheyAreStillAlive(
        this: GameService,
        id: string
    ): { id: string; name: string } | null {
        const row = this.repos.cultivators.getById(id);
        if (row) return row.alive ? { id, name: row.name } : null;
        const npc = this.atHand?.npcs.find(person => person.id === id);
        return npc && npc.status === 'alive' ? { id, name: npc.name } : null;
    },

    /**
     * An act aimed at a set completes over the part of it the player can reach.
     *
     * The design owner, having listed the ways a set gets named: *and replace
     * kill with other verb too*. So the LOOP is here and the ACT is the
     * caller's - what differs between robbing a family and killing one is which
     * routine runs per person, never how the set is read, gated, counted or
     * reported. A verb that grew its own copy of this would be the branch this
     * file exists to prevent.
     */
    async actOverASet(
        this: GameService,
        cultivator: Cultivator,
        set: SetShape,
        action: ActionName,
        runOne: (member: { id: string; name: string }) => Promise<Execution>,
        /** What reaching nobody reads as, in this verb's own terms. */
        nothing: { headline: string; prose: string; note: string },
        /**
         * Whether a fight still standing stops the run. Only a confrontation
         * leaves one, and the rest of the set is named rather than resolved
         * behind the player's back.
         */
        stopsOnAHeldFight: boolean
    ): Promise<Execution> {
        const known = this.theSetAsYouKnowIt(cultivator, set);
        if (known === null) {
            return refused('engine.resolveParty', action, factsForRefusal(
                nothing.headline,
                nothing.prose,
                `Unresolved set "${set.word}": read as ${set.kind}, and nothing this cultivator `
                + `can name answers to it. ${nothing.note}`
            ));
        }

        const remainder = whatTheActDidNotReach(set, known.reached, known.heardOfAndNotHere);
        const counted = howTheSetWasCounted(set, known);

        if (known.reached.length === 0) {
            return refused('engine.resolveParty', action, factsForRefusal(
                'Nobody of them is standing here.',
                remainder ?? nothing.prose,
                `${counted} ${nothing.note}`
            ));
        }

        const done: Execution[] = [];
        let heldOn: string | null = null;
        for (const member of known.reached) {
            const now = this.currentRun();
            if (!now.cultivator.alive) break;
            done.push(await runOne(member));
            if (!this.currentRun().cultivator.alive) break;
            if (stopsOnAHeldFight && this.fight !== null) { heldOn = member.name; break; }
        }

        const reachedButNotYet = heldOn === null
            ? []
            : known.reached.slice(known.reached.findIndex(one => one.name === heldOn) + 1);

        const folded = foldTheCallsIntoOneTurn(done, `${set.word}: ${done.length} of `
            + `${known.reached.length} standing here.`);

        const tail = [
            heldOn !== null && reachedButNotYet.length > 0
                ? `${heldOn} is still in front of you, and while they are, `
                  + `${reachedButNotYet.map(one => one.name).join(', ')} `
                  + `${reachedButNotYet.length === 1 ? 'is' : 'are'} not something you have got to.`
                : null,
            remainder
        ].filter((line): line is string => line !== null);

        if (tail.length > 0) {
            folded.facts.lines.push(...tail);
            folded.facts.prose = [folded.facts.prose, ...tail]
                .filter(text => text.length > 0).join('\n\n');
        }
        folded.facts.structure.push(counted);
        folded.calls.unshift({
            name: 'engine.actOverASet',
            action,
            summary: counted,
            ok: true
        });
        return folded;
    },

    /** A confrontation, over a set. The loop is `actOverASet`; this is the act. */
    async attackOverASet(
        this: GameService,
        cultivator: Cultivator,
        set: SetShape,
        goal: string,
        terms: BoutTerms = 'open',
        opening: 'open' | 'from_concealment' = 'open',
        wanted?: string
    ): Promise<Execution> {
        return this.actOverASet(
            cultivator,
            set,
            'attack',
            member => {
                const now = this.currentRun();
                return this.attack(
                    now.run, now.cultivator, this.ambientFor(now.cultivator, now.run),
                    member.name, goal, terms, opening, wanted
                );
            },
            {
                headline: 'Nothing to swing at.',
                prose: 'You look for them and the moment goes past you. There is nobody in '
                    + 'front of you that the thought fits, and standing here deciding is its '
                    + 'own answer.',
                note: 'No exchange was run.'
            },
            true
        );
    },

    /**
     * What the person in front of them made of the thing in their hand.
     */
    whatTheySawYouCarrying(
        this: GameService,
        cultivator: Cultivator,
        held: StandingFight,
        execution: Execution
    ): Execution {
        const carried = held.self.weapon;
        const them = held.theirRecord;
        // Nobody real is looking, or there is nothing in the hand. A described
        // opponent has no record to learn anything onto, and inventing one
        // would be writing a fact nobody established.
        if (!carried || !them || !this.atHand) return execution;

        const at = this.atHand.objects.findIndex(object => object.id === carried.id);
        if (at < 0) return execution;
        const thing = this.atHand.objects[at];

        // WHO IS HOLDING IT UP, not what the register says. The player's
        // holding lives in their pouch and the world row goes on saying nobody
        // has it, which is the coherent state a stolen thing is in - so the
        // check is told what is actually in front of the observer. Reading the
        // row's own possessor here made a recognised theft read as somebody
        // merely knowing the object, which is how this was found.
        const read = whatTheyRecogniseAboutIt({ ...thing, possessorId: cultivator.id }, {
            id: them.id,
            factionId: them.factionId,
            realmOrdinal: them.cultivation.realmOrdinal,
            referenceFor: (factionId: string) => this.knowledge.stageOf(them.id, 'sect', factionId)
        });
        if (read.reading === 'nothing') return execution;

        // They know now, and they go on knowing. Written before the line is
        // composed, so a narration that never runs cannot lose the fact.
        if (!thing.knownOwnershipBy.includes(them.id)) {
            this.atHand.objects[at] = revealOwnership(thing, them.id);
            this.worldDirty = true;
        }

        const line = read.inTheWrongHands
            ? `${held.party.name} looks at ${thing.name} in your hand and knows what it is. `
                + `It is ${read.ownerName || 'somebody else'}'s, and you are not them.`
            : `${held.party.name} knows ${thing.name} on sight.`;

        // `required`, and `prose` as well as `lines`. What somebody has learned
        // about you is not decoration - it is the whole consequence of carrying
        // the thing, and a narrator that drops it leaves the player believing
        // they walked in unread.
        execution.facts.lines.push(line);
        execution.facts.required = [...(execution.facts.required ?? []), line];
        execution.facts.prose = [execution.facts.prose, line].join('\n');
        execution.facts.structure.push(
            `${thing.id} read by ${them.id}: realm afforded ${read.fromRealm}, reference `
            + `afforded ${read.fromReference} at stage ${read.reference}; the reading is the `
            + `lower of the two, ${read.reading}. Owner ${thing.ownerId ?? 'nobody'}, holder `
            + `${cultivator.id}. ${read.toldWhereItCameFrom ? 'They had been told.' : 'Read off the two axes.'}`
        );
        execution.calls.push({
            name: 'world.revealOwnership',
            action: held.verb,
            summary:
                `${them.name} recognised ${thing.name} (${read.reading}) and is now on its `
                + `knownOwnershipBy. inTheWrongHands=${read.inTheWrongHands}. Ownership itself was `
                + 'not touched: recognising a thing does not move it.',
            ok: true
        });
        return execution;
    },

    /**
     * One round of a fight the service is holding, and what it left.
     */
    async answerTheFight(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        held: StandingFight,
        answer: FightAnswer
    ): Promise<Execution> {
        const turn = takeAFightTurn(held.state, answer, {
            ambient,
            turn: run.turn + 1,
            couldBeCalled: answer.kind === 'call_for_help'
                ? this.whoCouldHearAShout(cultivator, held.party.id)
                : undefined,
            priceThem: answer.kind === 'call_for_help'
                ? (who: CouldBeCalled) => assessPower(
                    { ...held.opponent, id: who.id, name: who.name, realmOrdinal: who.realmOrdinal },
                    { ambient }
                )
                : undefined
        });

        if (turn.finished) {
            this.fight = null;
            return this.concludeTheFight(run, cultivator, held, turn.finished, turn);
        }

        this.fight = { ...held, state: turn.fight! };

        // WHAT THE ROUND DID, AND WHERE THAT LEAVES THEM
        const where = whereThisFightStands(this.fight.state, ambient);
        const facts = factsForToolResult(
            `${held.party.name}: the exchange goes on.`,
            [turn.line, where.line]
        );
        facts.required = [turn.line, where.line];
        facts.structure.push(
            `Fight ${held.state.id}, round ${this.fight.state.roundsFought} of `
            + `${this.fight.state.roundBudget}. Player answered "${turn.playerAct}"; `
            + `${held.party.name} answered "${turn.theirAct}". `
            + turn.exchanges.map(x =>
                `${x.attackerId} -> ${x.defenderId}: advantage ${x.result.advantage.toFixed(2)}, `
                + `${x.result.damage} damage, ${x.defenderHpAfter} left`
                + (x.result.injury ? `, a ${x.result.injury.severity} wound` : '')).join('. ')
            + `. Breaking off prices at ${(where.flight.chance * 100).toFixed(0)}%: `
            + where.flight.modifiers.map(m => `${m.source} ${m.delta >= 0 ? '+' : ''}`
                + m.delta.toFixed(2)).join(', ')
            + '. Nothing was persisted; a fight writes on the turn it ends.'
        );
        if (turn.shout) facts.structure.push(...turn.shout.heard.map(h => h.because));

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            // A round happened, so the turn executed. What it did NOT do is end
            // the fight, and nothing on this execution says it did: there is no
            // `combat_manage.resolve` row and no outcome line, so a narrator has
            // no licence to write an ending that has not been resolved.
            outcome: 'executed',
            calls: [{
                name: 'combat.round',
                action: held.verb,
                summary: `${turn.line} ${where.line}`,
                ok: true
            }]
        };
    },

    /**
     * A round happens to somebody who did something else with their turn.
     */
    async takeTheRoundFirst(
        this: GameService,
        held: StandingFight | null,
        andThen: () => Promise<Execution>,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        /** The verb the plan settled on, so a fighting verb is not charged twice. */
        verb: ActionName
    ): Promise<Execution> {
        // `attack` and `coerce` ANSWER the fight - they continue the one that is
        // standing rather than doing something else during it - so taking a
        // round here as well would charge the player two rounds for one sentence
        // and give the other side a free blow for swinging back.
        if (held === null || verb === 'attack' || verb === 'coerce') return await andThen();

        const round = await this.answerTheFight(run, cultivator, ambient, held, { kind: 'guard' });
        // The world may have moved - a death, a withdrawal - so the thing they
        // asked for runs against the run as it now stands.
        const asked = await andThen();

        asked.facts.lines.unshift(...round.facts.lines);
        asked.facts.required = [...(round.facts.required ?? []), ...(asked.facts.required ?? [])];
        asked.facts.prose = [round.facts.prose, asked.facts.prose].join('\n\n');
        asked.facts.structure.unshift(
            'A fight was standing and the sentence was not an answer to it, so the round landed '
            + 'first and then the sentence ran. Nothing was refused.',
            ...round.facts.structure
        );
        asked.calls.unshift(...round.calls);
        return asked;
    },

    /**
     * A fight is over, whoever ran the rounds.
     */
    concludeTheFight(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        result: ConfrontationResult,
        lastRound?: FightTurn
    ): Execution {
        const settled = settleAFight({
            repos: this.repos,
            run,
            cultivator,
            self: held.self,
            opponent: held.opponent,
            technique: held.techniqueId ? getTechnique(held.techniqueId) ?? null : null,
            result,
            nextTurn: run.turn + 1,
            day: Math.floor(run.elapsedDays),
            opponentIdOnRecord: held.opponentIdOnRecord,
            edges: []
        });

        const execution = this.fromToolResult(
            'combat_manage.resolve', held.verb, settled, held.party.name
        );

        this.whatTheFightBroke(cultivator, held, result, execution);

        // A ROUTE OUT OF A HOPELESS FIGHT IS NOT OPTIONAL
        if (result.outcome === 'no_contest' && result.gap.options.length > 0) {
            const routes = sayingWhatWouldWork(
                routesOutOfAGap(result.gap.options), held.party.name
            );
            execution.facts.required = [...(execution.facts.required ?? []), ...routes];
            execution.facts.structure.push(
                `Gap: ${result.gap.verdict}, ${result.gap.realmGap} major realms, power ratio `
                + `${result.gap.powerRatio.toFixed(1)}. The engine offered `
                + `${result.gap.options.length} real options and ${routes.length === 0 ? 0 : routes.length - 1} `
                + 'of them have a verb a player can type. The rest are recorded in '
                + '`gap-routes.ts` as unreachable rather than printed.'
            );
        }

        // What the last round did, said before what the fight came to. Without
        // it a player who broke off reads the outcome and never the attempt.
        if (lastRound) {
            execution.facts.lines.unshift(lastRound.line);
            execution.facts.required = [lastRound.line, ...(execution.facts.required ?? [])];
            execution.facts.prose = [lastRound.line, execution.facts.prose].join('\n\n');
            if (lastRound.flight) {
                execution.facts.structure.push(
                    `Flight: ${(lastRound.flight.chance * 100).toFixed(0)}% against a roll of `
                    + `${lastRound.flight.roll.toFixed(3)}; ${lastRound.flight.escaped
                        ? 'clear' : 'caught'}, ${lastRound.flight.damage} paid either way`
                    + (lastRound.fleeingToward
                        ? `, making for ${lastRound.fleeingToward.name}` : ', nowhere named')
                    + '.'
                );
            }
            if (lastRound.shout) {
                execution.facts.structure.push(...lastRound.shout.heard.map(h => h.because));
            }
        }

        // -- SOMEBODY KNELT, AND THAT HAS TO OUTLIVE THE SENTENCE --------
        if (held.verb === 'coerce' && result.outcome === 'submission') {
            writeFlag(
                this.db, cultivator.id, FLAG_YIELDING_TO_YOU,
                `${held.party.id}:${run.turn}`
            );

            // -- AND WHAT THEY WERE MADE TO KNEEL FOR --------------------
            //
            // Beside the flag rather than in `afterAFight`, because this is
            // the one place the outcome is still typed as a submission. The
            // strip offers this sentence, so the act has to run where the
            // sentence lands.
            if (held.wanted === 'hand_over') {
                this.whatAYieldingHandedOver(run, cultivator, held, execution);
            }
            if (held.wanted === 'swallow') {
                this.whatWasPutDownTheirThroat(run, cultivator, held, execution);
            }
        }

        // AND WHAT LETTING SOMEBODY GO OPENS
        if (lastRound?.playerAct === 'spare' && result.outcome === 'humiliation') {
            this.whatSparingThemLeft(run, cultivator, held, execution);
        }

        // LAST, and the order is load-bearing. `afterAFight` writes the accounts a
        // bout opens because it went past what was agreed, and
        // `a-bout-two-people-agreed-to.test.ts` reads the ledger in insertion order
        // to find them. This adds a row for every ending rather than for the rare
        // one, so writing it first would put it in front of the row that test is
        // about and hide a real assertion behind an ordering accident.
        const done = this.afterAFight(run, cultivator, held, settled, execution);
        this.whatTheLoserNowHoldsAboutYou(run, cultivator, held, result, done);
        return done;
    },

    /**
     * The account the person you beat now holds, written down.
     */
    whatTheLoserNowHoldsAboutYou(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        result: ConfrontationResult,
        execution: Execution
    ): void {
        const onDay = Math.floor(run.elapsedDays);
        for (const seed of result.obligations) {
            // The player's own side is already handled where it always was -
            // `settleAFight` puts it on the `feuds` column - and writing it
            // here as well would put one grievance in two places.
            if (seed.holderId === cultivator.id) continue;

            // The resolver names the two of them by their COMBAT ids, and a
            // described opponent fights under a synthetic one. The ledger is
            // keyed on who people are, so the row is written against the party
            // this turn actually resolved.
            const holderId = seed.holderId === held.opponent.id ? held.party.id : seed.holderId;
            const subjectId = seed.subjectId === held.self.id ? cultivator.id : seed.subjectId;

            const record = createObligation({
                kind: seed.kind,
                holderId,
                subjectId,
                cause: seed.cause,
                severity: seed.severity,
                onDay,
                description: seed.description
            });
            writeObligation(this.db as unknown as DatabaseHandle, record);
            execution.calls.push({
                name: 'social.createObligation',
                action: held.verb,
                summary:
                    `${record.id}: ${record.holderId} holds a ${record.severity} ${record.kind} `
                    + `about ${record.subjectId} for ${record.cause}, off a `
                    + `${result.outcome}. Decided by seedObligations and written here; nothing `
                    + 'about the weight is re-decided.',
                ok: true
            });
        }
    },

    /**
     * The favour a spared person owes, written the way every other kindness is.
     */
    whatSparingThemLeft(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        execution: Execution
    ): void {
        if (!this.atHand) return;
        const them = held.theirRecord;
        const onDay = Math.floor(run.elapsedDays);
        const watching = this.present(cultivator)
            .filter(row => row.id !== held.party.id && row.id !== cultivator.id).length;
        const mine = positionIn(this.repos, cultivator.id);
        const theirHouseId = them?.factionId
            ?? this.repos.cultivators.getById(held.party.id)?.sectId ?? null;

        const deed = aDeedEntersTheWorld(this.atHand, {
            kind: 'debt_incurred',
            day: Math.floor(this.atHand.currentDay),
            locationId: this.worldPlaceOf(cultivator),
            place: placeName(cultivator),
            actors: [
                { id: cultivator.id, name: cultivator.name, role: 'stopped' },
                { id: held.party.id, name: held.party.name, role: 'was let go' }
            ],
            factionIds: theirHouseId ? [theirHouseId] : [],
            summary:
                `${cultivator.name} beat ${held.party.name} and let them go alive.`,
            unattributed:
                'Somebody walked away from a fight they had already lost, and would not say '
                + 'why they were still walking.',
            price: {
                deed: {
                    cause: 'spared',
                    paidBy: 'actor',
                    // Against what the sparer had to give, which at the end of
                    // a fight is the finish they had already earned. One, and
                    // the ledger's own bands take it from there.
                    cost: 1,
                    irreversible: true,
                    onDay,
                    description:
                        `${held.party.name} was beaten and let go by ${cultivator.name}, and is `
                        + 'alive because of a decision somebody else made.',
                    witnesses: watching,
                    participants: [held.party.id]
                },
                actor: {
                    id: cultivator.id,
                    name: cultivator.name,
                    houseId: mine?.sectId ?? cultivator.sectId ?? null,
                    houseName: null,
                    alignment: null,
                    ranked: mine !== null
                },
                subject: {
                    id: held.party.id,
                    name: held.party.name,
                    houseId: theirHouseId,
                    houseName: null,
                    alignment: null,
                    ranked: (them?.factionRankIndex ?? 0) > 0
                }
            },
            data: { outcome: 'humiliation', spared: true }
        });
        if (!deed) return;
        this.worldDirty = true;

        for (const opens of deed.leaves?.opens ?? []) {
            const record = createObligation({ ...opens, triggeringEventId: deed.fact.id });
            writeObligation(this.db as unknown as DatabaseHandle, record);
            execution.calls.push({
                name: 'social.createObligation',
                action: 'attack',
                summary:
                    `${record.id}: ${record.holderId} holds a ${record.severity} ${record.kind} `
                    + `about ${record.subjectId} for ${record.cause}, off ${deed.fact.id}. `
                    + 'The favour side of a sparing. The grudge side was seeded by '
                    + '`seedObligations` and is not touched here.',
                ok: true
            });
        }

        // ── AND THE PLAYER IS TOLD WHAT THEY HAVE JUST BOUGHT ────────────
        //
        // `required`, because a player who is not told will read the prose as
        // the fight ending well. What actually happened is that somebody who
        // holds a grave account against them is walking away able to act on it,
        // and the engine says so rather than leaving it to be discovered.
        const owed = `${held.party.name} is alive and owes you for it.`;
        const open = `${held.party.name} also walks away holding what was done to them, `
            + 'and being spared is not the same as being forgiven.';
        execution.facts.lines.push(owed, open);
        execution.facts.required = [...(execution.facts.required ?? []), owed, open];
        execution.facts.structure.push(
            `spare: ${deed.fact.id} (debt_incurred, ${deed.weight}) priced by whatADeedLeaves at `
            + `cost 1.00, irreversible, ${watching} witness(es); it reached `
            + `${deed.leaves?.reached}. ${deed.leaves?.opens.length ?? 0} favour row(s). The `
            + 'grave grudge from `seedObligations` stands separately and unmodified.'
        );
    },

    /**
     * What the fight did to what the player was carrying.
     */
    whatTheFightBroke(
        this: GameService,
        cultivator: Cultivator,
        held: StandingFight,
        result: ConfrontationResult,
        execution: Execution
    ): void {
        for (const loss of result.brokenObjects) {
            // Theirs is the world's to write, and `whatItDidToThem` is where
            // an opponent's row is reached. This is the player's half only.
            if (loss.carrierId !== cultivator.id) continue;

            removeFromPouch(this.db, cultivator.id, loss.broke.objectId, 1);

            const at = this.atHand
                ? this.atHand.objects.findIndex(o => o.id === loss.broke.objectId)
                : -1;
            if (this.atHand && at >= 0 && !isRuined(this.atHand.objects[at])) {
                this.atHand.objects[at] = ruin(this.atHand.objects[at], {
                    onDay: Math.floor(this.atHand.currentDay),
                    source:
                        `Swung at ${held.party.name} by ${cultivator.name}, and did not survive it.`,
                    note: loss.broke.exposure.cause
                });
                // `act` persists on this flag before anything is narrated, so a
                // restart cannot lose the loss - the same guarantee a killing
                // gets one method down.
                this.worldDirty = true;
            }

            // AND SAY WHAT IS LEFT, NOT WHAT ALREADY HAPPENED
            const owner = at >= 0 ? this.atHand!.objects[at].ownerName : '';
            const line = `You are not carrying ${loss.broke.objectName} any more.`
                + (owner
                    ? ` What is left of it is a record, and ${owner} still owns that.`
                    : '');
            execution.facts.lines.push(line);
            execution.facts.required = [...(execution.facts.required ?? []), line];
            execution.facts.prose = [execution.facts.prose, line].join('\n');
            execution.facts.structure.push(
                `${loss.broke.objectName} (${loss.broke.objectId}) rated `
                + `${loss.broke.exposure.weaponPower}, swung into `
                + `${loss.broke.exposure.realmsInFull.toFixed(2)} realms above it at `
                + `${(loss.broke.exposure.chance * 100).toFixed(0)}%`
                + (loss.broke.roll === null
                    ? ' - certain, so nothing was rolled'
                    : ` against a roll of ${loss.broke.roll.toFixed(3)}`)
                + `. Pouch row removed; world row ${at >= 0 ? 'ruined and kept' : 'absent - a counted thing has none'}.`
            );
            execution.calls.push({
                name: 'world.ruin',
                action: held.verb,
                summary:
                    `${loss.broke.objectId} broke in ${cultivator.name}'s hand. Pouch row removed. `
                    + (at >= 0
                        ? 'World row ruined, keeping its owner, its claims and its whole provenance chain.'
                        : 'No world row: a counted thing has none, and there is nowhere to write the scar.'),
                ok: true
            });
        }
    },

    /**
     * What somebody hands over once they have yielded and been told to.
     */
    whatAYieldingHandedOver(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        execution: Execution
    ): void {
        const onDay = Math.floor(run.elapsedDays);
        const stored = this.repos.cultivators.getById(held.party.id);
        const npc = stored
            ? null
            : (this.atHand?.npcs ?? []).find(row => row.id === held.party.id);
        const factionId = stored ? stored.sectId : (npc?.factionId ?? null);

        // -- THE PURSE ----------------------------------------------------
        const lifted = this.whatALiftTook(cultivator, held.party);

        // -- AND THE THINGS -----------------------------------------------
        //
        // `isTracked` is the same single answer to which tier a row is in that
        // the library theft uses, so what a coercion takes and what a siphon
        // takes cannot start disagreeing.
        const world = this.atHand;
        const carried = world
            ? world.objects.filter(row =>
                row.possessorId === held.party.id && isTracked(row) && !isRuined(row))
            : [];
        for (const object of carried) {
            const moved = transferPossession(object, {
                onDay,
                toHolderId: cultivator.id,
                toHolderName: cultivator.name,
                how: 'stolen',
                source: held.party.name,
                note: `Handed over by ${held.party.name}, who had been beaten into `
                    + `submission by ${cultivator.name} and was standing there while it `
                    + 'changed hands.'
            });
            const at = world!.objects.findIndex(row => row.id === object.id);
            if (at >= 0) world!.objects[at] = moved;
        }
        if (carried.length > 0 || (lifted !== null && lifted.taken > 0)) this.worldDirty = true;

        // -- WHAT ACTUALLY CAME ACROSS, IN ONE SENTENCE -------------------
        //
        // Named rather than summarised, because the defect this closes was a
        // turn that read as a success and moved nothing. A player has to be
        // able to see the difference from the prose alone.
        const took = lifted?.taken ?? 0;
        const parts: string[] = [];
        if (took > 0) parts.push(`${took} spirit stone${took === 1 ? '' : 's'}`);
        if (carried.length > 0) parts.push(carried.map(row => row.name).join(', '));
        const line = parts.length === 0
            ? `${held.party.name} turns out their sleeves. There is nothing on them worth `
              + 'taking, and they knew it before you did.'
            : `${held.party.name} hands over ${parts.join(' and ')}. They do not look up while `
              + 'they do it.';
        execution.facts.lines.push(line);
        execution.facts.prose = [execution.facts.prose, line].join('\n');
        execution.facts.structure.push(
            `coerce/hand_over: ${took} stones moved off ${held.party.id}`
            + `${lifted === null ? ' (no row to take from)' : ''}, and ${carried.length} `
            + 'tracked object(s) reassigned by `transferPossession` with `how: stolen`. '
            + 'Ownership did not move, so `knownOwnershipBy` still names them.'
        );
        execution.calls.push({
            name: 'world.transferPossession',
            action: 'coerce',
            summary: line,
            ok: true
        });

        // Nothing was taken, so nothing was stolen. A person made to kneel has
        // been wronged and the fight already wrote that; opening a robbery on
        // an empty purse would be a second row about an event that did not
        // happen.
        if (parts.length === 0) return;

        // -- AND THE LEDGER -----------------------------------------------
        const verdict = whatTheyDoAboutBeingWronged({
            wrong: 'robbed',
            landed: true,
            inPublic: this.company(cultivator).total > 0,
            theirOrdinal: held.standingOrdinal ?? cultivator.realmOrdinal,
            yourOrdinal: cultivator.realmOrdinal,
            alignment: factionId ? (getSect(factionId)?.alignment ?? null) : null,
            theirName: held.party.name,
            yourName: cultivator.name
        });
        const cost = lifted !== null && lifted.hadBefore > 0
            ? lifted.taken / lifted.hadBefore
            : 0;
        const worthOfTheLoss = whatItWasWorth({
            cause: verdict.grudge.cause,
            paidBy: 'subject',
            cost,
            onDay,
            description: verdict.line
        });
        const severity = severityRank(worthOfTheLoss) > severityRank(verdict.grudge.severity)
            ? worthOfTheLoss
            : verdict.grudge.severity;
        const opened = createObligation({
            kind: 'grudge',
            id: `grudge_${held.party.id}_${cultivator.id}_${verdict.grudge.cause}`,
            holderId: held.party.id,
            subjectId: cultivator.id,
            cause: verdict.grudge.cause,
            severity,
            onDay,
            description: verdict.line,
            participants: [],
            tags: [
                'wrong:robbed',
                'under:coercion',
                'landed',
                `took:${took}`,
                ...carried.map(row => `object:${row.id}`)
            ]
        });
        writeObligation(this.db as unknown as DatabaseHandle, opened);
        execution.facts.structure.push(
            `${held.party.name} now holds a ${opened.severity} grudge about `
            + `${verdict.grudge.cause}, open until somebody settles it. Weighed as `
            + `${verdict.grudge.severity} by the deed and ${worthOfTheLoss} by what it cost `
            + `them (${Math.round(cost * 100)}% of what they had); the heavier stands.`
        );
        execution.calls.push({
            name: 'social.createObligation',
            action: 'coerce',
            summary:
                `${held.party.name} yielded and was stripped, and holds a ${opened.severity} `
                + `grudge about it against ${cultivator.name}. It costs points on every later `
                + 'approach to them.',
            ok: true
        });
    },

    /**
     * What somebody who has yielded is made to swallow.
     */
    whatWasPutDownTheirThroat(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        execution: Execution
    ): void {
        const onDay = Math.floor(run.elapsedDays);
        const carried = listPouch(this.db, cultivator.id).filter(row => row.kind === 'pill');

        if (carried.length === 0) {
            const line = `${held.party.name} is on their knees with their mouth open and you `
                + 'have nothing to put in it.';
            execution.facts.lines.push(line);
            execution.facts.prose = [execution.facts.prose, line].join('\n');
            execution.facts.structure.push(
                'coerce/swallow: no pill in the pouch. Nothing spent and nothing applied.'
            );
            return;
        }

        // The only one they are carrying, or nothing. Never guessed.
        const named = carried.length === 1 ? carried[0] : null;

        if (!named) {
            const names = carried.map(row => getPill(row.itemId)?.name ?? row.itemId).join(', ');
            const line = `You are carrying ${carried.length} different pills and did not say `
                + `which one. ${held.party.name} waits, which is the only thing left to them.`;
            execution.facts.lines.push(line);
            execution.facts.prose = [execution.facts.prose, line].join('\n');
            execution.facts.structure.push(
                `coerce/swallow: ${carried.length} pills carried (${names}) and none named. `
                + 'Nothing spent. The act does not choose between a healing pill and a '
                + 'hollowing pill on the player\'s behalf.'
            );
            return;
        }

        const pill = getPill(named.itemId);
        const pillName = getPill(named.itemId)?.name ?? named.itemId;
        removeFromPouch(this.db, cultivator.id, named.itemId, 1);
        this.worldDirty = true;

        const world = this.atHand;
        const row = (world?.npcs ?? []).find(npc => npc.id === held.party.id) ?? null;
        const effect = pill?.effect ?? null;

        let line: string;
        if (row && effect === 'end_the_soul') {
            row.soulState = 'fading';
            row.identityContinuity = 0;
            line = `${pillName} goes down, and ${held.party.name} is still looking at you when `
                + 'whatever was behind their eyes stops being there.';
        } else if (row && effect === 'hollow_the_soul') {
            const after = whatTheHandLeaves(
                { soulState: row.soulState, identityContinuity: row.identityContinuity, tags: row.tags },
                cultivator.id
            );
            row.soulState = after.soulState;
            row.identityContinuity = after.identityContinuity;
            row.tags = [...after.tags];
            writeObligation(this.db as unknown as DatabaseHandle, createObligation(
                whatBeingMadeIntoAThingOpens({
                    victimId: held.party.id,
                    holderId: cultivator.id,
                    holderName: cultivator.name,
                    victimName: held.party.name,
                    onDay,
                    knownTo: this.present(cultivator)
                        .filter(who => who.id !== held.party.id && who.id !== cultivator.id)
                        .map(who => who.id)
                })
            ));
            line = `${pillName} goes down. ${held.party.name} stops resisting, and then stops `
                + 'doing anything else that was theirs. What is standing there is in good '
                + 'repair and is yours.';
            execution.calls.push({
                name: 'social.createObligation',
                action: 'coerce',
                summary:
                    `${held.party.name} holds an unforgivable account against ${cultivator.name} `
                    + 'for being made into a thing. Taking the hand off does not settle it and '
                    + 'neither does dying: it passes to whoever holds it next.',
                ok: true
            });
        } else {
            line = `${pillName} goes down. ${held.party.name} swallows because there is nothing `
                + 'else left to do, and whatever it was for was not for them.';
        }

        execution.facts.lines.push(line);
        execution.facts.prose = [execution.facts.prose, line].join('\n');
        execution.facts.structure.push(
            `coerce/swallow: ${named.itemId} (${effect ?? 'no catalog row'}) spent off `
            + `${cultivator.name} and applied to ${held.party.id}`
            + `${row === null ? ', who has no world row, so only the pouch moved' : ''}.`
        );
        execution.calls.push({
            name: 'alchemy.forced',
            action: 'coerce',
            summary: line,
            ok: true
        });
    },

    /**
     * The label, the world row and the room, for a fight that has ended.
     *
     * Split from `concludeTheFight` only for length; it is the tail of it.
     */
    afterAFight(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        held: StandingFight,
        result: object,
        execution: Execution
    ): Execution {
        const party = { kind: 'cultivator' as const, id: held.party.id, name: held.party.name };
        const wanted = held.wanted;
        const intent = held.verb;
        const standing = held.standingOrdinal === null
            ? null
            : this.present(cultivator).find(row => row.id === held.party.id) ?? null;
        const terms = held.terms as BoutTerms;

        // WHAT THE COMPLIANCE WAS FOR
        if (intent === 'coerce') {
            const line =
                `What was wanted out of ${party.name}: ${(wanted ?? 'submit').replace(/_/g, ' ')}.`;
            execution.facts.lines.push(line);
            // IN `prose`, NOT IN `required`
            execution.facts.prose = [execution.facts.prose, line].join('\n');
            execution.facts.structure.push(
                `coerce: intent label "${wanted ?? 'submit'}", goal handed to the resolver `
                + '"coerce". Nothing in the engine branches on the label.'
            );
        }

        // AND WHAT IT DID TO THEM
        const room = this.present(cultivator)
            .filter(row => row.id !== party.id && row.id !== cultivator.id).length;
        const inTheWorld = this.whatItDidToThem(
            cultivator, held.theirRecord, result, terms, room
        );
        execution.calls.push(...inTheWorld.calls);

        // ── AND WHAT THE ROOM MAKES OF IT ────────────────────────────────
        //
        // After the resolve, never before it and never instead of it. Every
        // number this reads was decided by `combat_manage` and the survival
        // layer and is already written down; this only says who else now holds
        // something about it.
        const fallout = this.whatFollowedTheBout(
            run, cultivator, party, standing ?? null, terms, result,
            inTheWorld.died, inTheWorld.theirPeople, inTheWorld.opens, room
        );
        fallout.lines.unshift(...inTheWorld.lines);
        if (fallout.lines.length > 0) {
            // Into `prose` as well as `lines`, and this is not belt and braces.
            // `lines` is what a narrator may know and `prose` is the deterministic
            // rendering, and appending to only the first is how a consequence gets
            // computed, written to the ledger and never shown to anybody playing
            // without a model attached.
            execution.facts.lines.push(...fallout.lines);
            execution.facts.required = [...(execution.facts.required ?? []), ...fallout.lines];
            execution.facts.prose = [execution.facts.prose, ...fallout.lines].join('\n');
        }
        execution.calls.push(...fallout.calls);
        return execution;
    },

    /**
     * Carry what the resolver decided to the record that holds the person.
     */
    whatItDidToThem(
        this: GameService,
        cultivator: Cultivator,
        theirRecord: NpcRecord | null,
        result: object,
        /** What the two of them said it was. Carried through, never inferred. */
        terms: BoutTerms = 'open',
        /** How many others were standing there. Priced by the bout module. */
        witnesses = 0
    ): {
        died: boolean;
        /**
         * Who the dead left, in the world's own inheritance order.
         */
        theirPeople: readonly { id: string; relation: InheritanceRelation }[];
        /**
         * The accounts the world decided this fight opened.
         */
        opens: readonly ObligationInput[];
        lines: string[];
        calls: ToolCallRecord[];
    } {
        const nothing = {
            died: false,
            theirPeople: [] as { id: string; relation: InheritanceRelation }[],
            opens: [] as ObligationInput[],
            lines: [] as string[],
            calls: [] as ToolCallRecord[]
        };
        if (!theirRecord || !this.atHand || isGuidingErrorBody(result)) return nothing;

        const body = result as Record<string, unknown>;
        const outcome = body.outcome;
        if (typeof outcome !== 'string') return nothing;

        // The synthetic id the tool minted for a described body. Everything
        // about who lost is read against it rather than inferred from who won,
        // because a stalemate has a winner of neither.
        const them = body.opponent as { id?: unknown } | undefined;
        const theirRollId = typeof them?.id === 'string' ? them.id : null;
        const loserId = typeof body.loserId === 'string' ? body.loserId : null;

        // Parsed, not cast. These rows came from `summariseInjury` one call away
        // and are going onto a permanent record, so they go through the schema
        // that owns their shape - a body that does not parse writes no wounds
        // rather than writing invented ones.
        const reported = (body.injuries as { opponent?: unknown } | undefined)?.opponent;
        const parsed = InjurySchema.array().safeParse(reported ?? []);
        const wounds: Injury[] = parsed.success ? parsed.data : [];

        const wrote = whatTheConfrontationDidToThem(this.atHand, {
            npcId: theirRecord.id,
            byId: cultivator.id,
            byName: cultivator.name,
            day: Math.floor(this.atHand.currentDay),
            wounds,
            outcome: outcome as ConfrontationOutcome,
            lost: loserId !== null && theirRollId !== null && loserId === theirRollId,
            finished: body.finished === true,
            terms,
            witnesses
        });
        if (!wrote.wrote) return nothing;

        // A world changed inside one turn. `act` persists on this flag before
        // anything is narrated, so a restart cannot lose a killing.
        this.worldDirty = true;

        const calls: ToolCallRecord[] = [{
            name: 'world.whatTheConfrontationDidToThem',
            action: 'attack',
            summary:
                `${theirRecord.id} (${theirRecord.name}) in world state: `
                + `${wrote.wounds} wound ${wrote.wounds === 1 ? 'row' : 'rows'} written, `
                + `died=${wrote.died}, facts=${wrote.facts.length}`
                + (wrote.handoff?.primaryHeirId
                    ? `, heir=${wrote.handoff.primaryHeirId} inheriting `
                      + `${wrote.handoff.goalsInherited.length} goals`
                    : '')
                + `. outcome=${outcome}; finished=${body.finished === true}. No hit points are `
                + 'written back: the world holds a body and this carries only the wounds. See the header.',
            ok: true
        }];
        if (!parsed.success && Array.isArray(reported) && reported.length > 0) {
            // Loud rather than silent. A body that stopped parsing means the
            // resolver's projection changed shape, and a quietly unwounded world
            // is exactly the failure this whole method exists to end.
            calls.push({
                name: 'world.whatTheConfrontationDidToThem',
                action: 'attack',
                summary:
                    `${reported.length} reported opponent wounds did not parse as injuries and `
                    + 'were NOT written. The resolve body\'s shape has drifted from InjurySchema.',
                ok: false
            });
        }

        return {
            died: wrote.died,
            theirPeople: wrote.theyLeft,
            opens: wrote.opens,
            lines: wrote.lines,
            calls
        };
    },

    /**
     * Who else holds something about a fight, once it is over.
     */
    whatFollowedTheBout(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        party: { id: string; name: string },
        theirRow: RosterEntry | null,
        terms: BoutTerms,
        result: object,
        /**
         * Whether the world recorded the opponent's death, for an opponent the
         * world holds and the cultivators table does not.
         */
        diedInTheWorld = false,
        /**
         * Who the dead left, from `whatItDidToThem`.
         */
        theirPeople: readonly { id: string; relation: InheritanceRelation }[] = [],
        /**
         * The rows the world already decided, for an opponent it holds.
         */
        worldOpens: readonly ObligationInput[] = [],
        /** The room, computed once by the caller and shared with the world half. */
        roomSize: number | null = null
    ): { lines: string[]; calls: ToolCallRecord[] } {
        const nothing = { lines: [] as string[], calls: [] as ToolCallRecord[] };
        if (isGuidingErrorBody(result)) return nothing;

        const body = result as Record<string, unknown>;
        const outcome = body.outcome;
        if (typeof outcome !== 'string') return nothing;

        // Which of the two of them came off worst, read off the resolver's own
        // answer rather than inferred from the numbers. A stalemate and a
        // no-contest name nobody, and neither of them is anything to answer for.
        const loserId = typeof body.loserId === 'string' ? body.loserId : null;
        if (loserId === null) return nothing;

        // `died` is the survival layer's word, written before this ran, and it is
        // THE PLAYER's - `combat_manage.resolve` has always read that way and its
        // callers read it that way.
        const playerDied = body.died === true;
        const opponentDied = body.opponentDied === true || diedInTheWorld;
        const loserIsThePlayer = loserId === cultivator.id || playerDied;
        const loserDied = loserIsThePlayer ? playerDied : opponentDied;

        // Everybody standing here who is not one of the two of them. The room
        // is what `look` already lists, so this claims no witness the player
        // could not have seen for themselves. Supplied by the caller where the
        // world half was asked the same question, so the two agree by
        // construction rather than by both counting the same way.
        const witnesses = roomSize ?? this.present(cultivator)
            .filter(row => row.id !== party.id && row.id !== cultivator.id).length;

        const theirHouseId = loserIsThePlayer
            ? positionIn(this.repos, cultivator.id)?.sectId ?? null
            : theirRow?.sectId ?? this.repos.cultivators.getById(party.id)?.sectId ?? null;
        const theirHouse = theirHouseId ? this.repos.sects.getById(theirHouseId) : null;

        const followed = whatFollowsFromTheBout({
            terms,
            outcome: outcome as ConfrontationOutcome,
            loserDied,
            witnesses,
            theirHouse: theirHouse
                ? {
                    alignment: theirHouse.alignment,
                    // Somebody the house has invested in. A named rank is the
                    // engine's existing statement of that and the one
                    // `whenItIsDoneToOneOfOurs` already asks for.
                    ranked: loserIsThePlayer
                        ? positionIn(this.repos, cultivator.id) !== null
                        : (theirRow?.sectRank ?? null) !== null
                }
                : null,
            // Only where the OPPONENT is the one who died. A player's own heirs
            // are not a thing this layer holds - a run ends, and what it leaves
            // is `enshrineRun`'s question and the estate's, not this one's.
            theirPeople: loserIsThePlayer ? [] : theirPeople
        });

        if (followed.howFar === 'kept') return nothing;

        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];
        const onDay = Math.floor(run.elapsedDays);
        // Who went too far, and who it was done to. One of them is the player
        // and which one is not fixed: a bout the player loses badly is the same
        // event with the names the other way round.
        const actorId = loserIsThePlayer ? party.id : cultivator.id;
        const actorName = loserIsThePlayer ? party.name : cultivator.name;
        const hurtName = loserIsThePlayer ? cultivator.name : party.name;

        // AND EVERYONE WHO HEARS ABOUT IT KNOWS SOMETHING ABOUT YOU
        const deed = this.atHand
            ? aDeedEntersTheWorld(this.atHand, {
                kind: 'betrayal',
                weight: followed.against?.severity ?? 'slight',
                day: Math.floor(this.atHand.currentDay),
                locationId: this.worldPlaceOf(cultivator),
                place: placeName(cultivator),
                actors: [
                    { id: actorId, name: actorName, role: 'went past what was agreed' },
                    {
                        id: loserIsThePlayer ? cultivator.id : party.id,
                        name: hurtName,
                        role: 'it was done to'
                    }
                ],
                factionIds: theirHouseId ? [theirHouseId] : [],
                summary:
                    `${actorName} and ${hurtName} went out on ${terms} terms and `
                    + `${actorName} took it ${followed.howFar}.`
                    + (loserDied ? ` ${hurtName} did not get up.` : ''),
                unattributed:
                    'Two people went out to measure each other and only the arrangement came '
                    + 'back the way it went out.',
                data: {
                    boutTerms: terms,
                    howFar: followed.howFar,
                    outcome,
                    witnesses,
                    died: loserDied
                }
            })
            : null;
        if (deed) {
            this.worldDirty = true;
            lines.push(deed.line);
            calls.push({
                name: 'world.aDeedEntersTheWorld',
                action: 'attack',
                summary:
                    `${deed.fact.id} (betrayal, ${deed.weight}, magnitude `
                    + `${deed.fact.magnitude.toFixed(2)}, ${deed.fact.visibility}) written to the `
                    + `world's history on day ${deed.fact.day}, naming ${actorId} and `
                    + `${loserIsThePlayer ? cultivator.id : party.id}. `
                    + `${deed.fact.witnessIds.length} witness id(s). terms=${terms}; `
                    + `howFar=${followed.howFar}. The bout is now repeatable as news.`,
                ok: true
            });
        }

        // AND WHAT ANYBODY IS NOW OWED
        const opens = worldOpens.length > 0
            ? worldOpens
            : theAccountsAFightOpens({
                followed,
                parties: {
                    actor: { id: actorId, name: actorName },
                    loser: {
                        id: loserIsThePlayer ? cultivator.id : party.id,
                        name: hurtName
                    },
                    houseId: theirHouseId,
                    houseName: theirHouse?.name ?? null
                },
                onDay,
                // The ground-truth row this account rests on, so a reader in
                // forty years can get from the claim to the event and back.
                triggeringEventId: deed?.fact.id ?? null
            });

        if (opens.length > 0) {
            for (const row of opens) {
                writeObligation(this.db as unknown as DatabaseHandle, createObligation(row));
                calls.push({
                    name: row.kind === 'blood_feud'
                        ? 'social.createBloodFeud' : 'social.createGrudge',
                    action: 'attack',
                    summary:
                        `${row.holderId} now holds a ${row.severity} ${row.kind} about `
                        + `${row.subjectId} (${row.cause}), `
                        + `${(row.tags ?? []).includes('institutional') ? 'as house' : 'as kin'}. `
                        + `terms=${terms}; outcome=${outcome}; witnesses=${witnesses}. `
                        + `Decided ${worldOpens.length > 0 ? 'in the world layer' : 'here'}, `
                        + 'the same way a war death is. Written to obligations; permanent '
                        + 'until settled, and inheritable.',
                    ok: true
                });
            }

            // Said as a fact about the world rather than as a warning, and only
            // where the player can name the house. Not knowing who is coming is
            // itself the fact, and the discovery layer owns that rule.
            const known = theirHouseId !== null
                && this.knowledge.isAwareOf(cultivator.id, 'sect', theirHouseId);
            const family = opens.filter(row => !(row.tags ?? []).includes('institutional')).length;
            lines.push(
                theirHouseId && theirHouse
                    ? known
                        ? `${hurtName} was ${theirHouse.name}'s. ${followed.note}`
                        : `${hurtName} answered to somebody, and you do not know who. They will `
                          + 'be told what was agreed and what happened instead.'
                    // Nobody to complain to and somebody to come asking, which is
                    // the harder of the two and the one that had no sentence.
                    : `${hurtName} answered to nobody and left ${family === 1
                        ? 'somebody' : 'people'}. There is no house to petition and no house to `
                      + 'call it off, and what is written down is written down against you by '
                      + 'name.'
            );
        } else if (followed.brokenPromise) {
            lines.push(
                `${hurtName} answered to nobody, so there is nobody to come for it. That is a `
                + 'fact about who they were and not a thing you were spared.'
            );
        }

        // AND WHAT YOUR OWN PEOPLE MAKE OF IT
        const mine = loserIsThePlayer ? null : positionIn(this.repos, cultivator.id);
        if (mine && followed.ownHouseCost > 0) {
            const credit = creditIn(this.repos, cultivator.id, mine, run.elapsedDays, false);
            const spent = spendStanding(
                this.repos, cultivator.id, mine, credit, followed.ownHouseCost, run.elapsedDays
            );
            lines.push(
                `Your own people heard what it was supposed to be before they heard how it ended.`
            );
            calls.push({
                name: 'house.spendStanding',
                action: 'attack',
                summary:
                    `${mine.sectId} standing ${credit.standing.toFixed(2)} to `
                    + `${spent.landedAt.toFixed(2)} (raw ${followed.ownHouseCost}, spent `
                    + `${spent.spent.toFixed(2)}, backlash ${spent.level}). Charged for an agreed `
                    + `bout that ended ${followed.howFar}, not for the fight.`,
                ok: true
            });
        }

        return { lines, calls };
    }
};
