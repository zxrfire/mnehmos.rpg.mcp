/**
 * Hitting somebody, and everything the world does about it afterwards.
 *
 * `attack` decides nothing. It resolves the target, hands the exchange to
 * `combat_manage.resolve` - which owns power assessment, edges, the wounds and
 * the obligations that come out the far side - and then reports. The rest of
 * this module is the far side: what the blows did to a body, whether anybody
 * heard, who answers for it, and what the killing MEANT, which is where every
 * consequence in this game actually comes from.
 *
 * The agreed bout is the whole argument in one place. `terms` reaches exactly
 * one thing, `whatFollowedTheBout`, and never the resolver: a bout is combat
 * with both sides meaning to be gentle, and the agreement lives in what the
 * outcome meant rather than in what the blows did. Kill somebody in one and
 * the blows landed as blows land - what is different is that there were
 * witnesses, they had people, and everybody now knows something about you.
 *
 * ── HOW THIS IS ATTACHED ─────────────────────────────────────────────────
 *
 * These are `GameService` methods living in another file, merged onto the
 * prototype at the bottom of `game.ts` with their signatures merged into the
 * class declaration. `this.attack(...)` resolves and typechecks exactly as it
 * did when the bodies sat in the class, and every line of every body below is
 * the line it was. `src/web/README.md` has the argument for the shape and the
 * warning about the `private` keyword.
 *
 * The three module-level declarations were `private static` members. A static
 * has no instance, which is what module scope already means, so they are
 * declarations here rather than properties of the object.
 */

import { getApexInstitution, getCourt } from '../data/cultivation/hierarchy.js';
import { getTechnique } from '../data/cultivation/index.js';
import { requireRegion } from '../data/cultivation/regions.js';
import { sectThreat } from '../data/cultivation/sects.js';
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
import { createObligation } from '../engine/social/grudges.js';
import type { InheritanceRelation, ObligationInput } from '../engine/social/grudges.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { type NpcRecord, bodyStandingOn, maxBodyOf } from '../engine/world/npc-state.js';
import { whatTheyRecogniseAboutIt } from '../engine/world/artifact-recognition.js';
import { isRuined, revealOwnership, ruin } from '../engine/world/possessions.js';
import { theNameTheVerbDropped } from './the-name-the-verb-dropped.js';
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
import { isGuidingErrorBody, removeFromPouch } from '../server/consolidated/cultivation-support.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ActionName } from './actions.js';
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

/**
 * Priority at which a want is the whole of why somebody is standing there.
 *
 * A goal this high is not a preference, it is the thing they are for, and
 * somebody whose life is one errand does not kneel to the person standing
 * between them and it. Read off `NpcGoal.priority`, which the roster has
 * carried since it was written - "what this person drops everything else
 * for" is that field's own description of itself.
 */
const WOULD_RATHER_DIE_PRIORITY = 0.8;

/**
 * Standing at which somebody answers rather than yields.
 *
 * A tie this bad is a feud, and a feud is the state in which being made to
 * kneel is worse than being finished. `NpcRelationship.standing` is the
 * same axis another agent used this session for whether somebody accepts an
 * arranged match, and it is used the same way here on purpose: one reading
 * of "will this person go along with something they did not choose",
 * consulted twice, rather than two scales that will drift.
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
 *
 * "somebody of my own realm", "a disciple of my rank", "someone my equal" -
 * all of them are a request for a fair fight rather than for a particular
 * body, and answering them with whoever happened to be nearest is what made
 * every duel in the game either suicide or a refusal.
 *
 * Deliberately requires the possessive or the word `equal`: "a Nascent Soul
 * cultivator" names a height too and names a DIFFERENT one, and must go on
 * resolving the way it always has.
 */
const SOMEBODY_OF_MY_OWN_HEIGHT =
    /\b(?:my (?:own )?(?:realm|rank|rung|level|height|standing)|my equal|an equal|someone equal|of equal (?:rank|realm)|the same (?:realm|rank|rung) as me|my own kind)\b/i;

export const combatVerbs = {
    /**
     * Hitting somebody.
     *
     * Routed to `combat_manage.resolve`, which owns power assessment, edges,
     * the exchange, the wounds and the obligations that come out the far side.
     * Nothing about the outcome is decided here, and nothing about it may be:
     * this is the single most consequential thing a player can do in one turn
     * and a second opinion about who wins would be the drift the whole design
     * is built to prevent.
     *
     * The target must resolve to a real person who is actually present. A
     * confrontation with somebody the player cannot see is not a scene, and
     * fuzzy-matching a description into a name would pick the fight for them.
     *
     * `terms` says whether the two of them arranged this, and it reaches
     * exactly one thing: `whatFollowedTheBout`, on the far side of the resolve.
     * It is not passed to `combat_manage`, it does not touch `goal`, and there
     * is deliberately no branch on it above this line. A bout is combat with
     * both sides agreeing to be gentle; the agreement lives in what the outcome
     * MEANT and never in what the blows did.
     */
    /**
     * Whether the person being coerced yields, or would rather die.
     *
     * ── WHY THIS IS HERE AND NOT IN THE ENGINE ───────────────────────────
     *
     * Because there is no will-to-submit stat and there must not be one.
     * Submission is a fact about who somebody is, and every fact about who
     * somebody is already lives on the roster - so the layer that HOLDS the
     * roster does the reading and hands the engine an answer with the record it
     * was taken off attached. `resolveConfrontation` takes it and never
     * computes it, which is what stops a compliance number appearing.
     *
     * Two clauses, and both name a row rather than a trait:
     *
     *   the want   an active goal at `WOULD_RATHER_DIE_PRIORITY` or above,
     *              aimed at the person doing this. Somebody whose whole life is
     *              getting at you does not kneel to you.
     *   the tie    standing at or under `ANSWERS_RATHER_THAN_YIELDS` toward
     *              them, which is a feud, and a feud is the state where being
     *              made to kneel is worse than being finished.
     *
     * Everybody else yields, because most people beaten badly enough do. That
     * is a DEFAULT and not a rule, which is what keeps the interesting case
     * reachable rather than making submission a button.
     *
     * ── AND IT RUNS ONE WAY, WHICH IS THE ONE PLACE THE SYMMETRY BENDS ───
     *
     * The engine reads an NPC's character. It does not read the PLAYER's,
     * because the player has one and the character has not lost it - AGENTS.md
     * is explicit that the engine may take a choice only where the character
     * genuinely has none, and somebody being beaten has not lost their
     * judgement. So when the player is on the receiving end the answer is
     * theirs to give, which is an offer rather than a reading. That half is not
     * built here: nothing in the played game coerces the player yet, and
     * building the reading for them instead of the offer would be exactly the
     * softening the rule forbids.
     */
    /**
     * The art this cultivator is actually fighting with.
     * ── WHAT IT PICKS, AND WHY IT IS NOT A CHOICE TAKEN FROM THE PLAYER ──
     *
     * The best-mastered art they are permitted to use, ties broken on id so the
     * pick is total and stable. That is not the engine deciding tactics for
     * them: a cultivator in a real fight brings what they are best at, and a
     * player who wants a different art can say so - `train_technique` and
     * `learn_technique` are what change this answer. What would be a decision
     * taken from them is the opposite, which is what was happening: everybody
     * fought bare whatever they had spent decades on.
     */
    /**
     * The art they would actually run with, which is not the one they fight with.
     *
     * `attemptFlight` prices a movement art higher than anything else somebody
     * can be carrying - up to 0.4 on a chance that starts at 0.45 - and it is
     * the whole reason qinggong manuals sell. Read separately from
     * `artTheyWouldFightWith` because that one sorts by mastery across every
     * art and would hand a flight the player's best SWORD.
     */
    artTheyWouldRunWith(this: GameService, cultivator: Cultivator): Technique | null {
        return this.repos.techniques.listKnown(cultivator.id)
            .filter(art => art.category === 'movement' && art.requiredOrdinal <= cultivator.realmOrdinal)
            .sort((a, b) => b.mastery - a.mastery || (a.id < b.id ? -1 : 1))[0] ?? null;
    },

    /**
     * The ground a fight is standing on, and the roads off it.
     *
     * Only this province's other places. A flight is a short thing - you get
     * clear of the person in front of you and reach the next thing there is -
     * and offering a province eleven days away as somewhere to run would be a
     * road nobody could take with somebody's blade at their back.
     *
     * `travelDays` is deliberately not invented for these. Nothing in the
     * catalog prices a road INSIDE a province, which `whereCouldTheyGo` already
     * records having got wrong once with a fabricated zero, so the days here are
     * the one honest thing available: `1`, said as what it is - the next place,
     * not a measured road. An empty list is a legitimate state and the engine
     * says so rather than inventing somewhere.
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
     *
     * Read off records the world already keeps and nothing else: who is in the
     * square, what the relationship row says, and whether this is a house's own
     * ground. There is no would-they-come number anywhere and this does not
     * invent one - `whoAnsweredTheShout` asks the categorical gap and the
     * standing, both of which already exist.
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
         *
         * Taken now that a fight is held across turns: `assessPower` reads
         * ambient, and every round of a fight standing on a spirit tide has to
         * be priced on the ground it is actually being fought on rather than on
         * whatever the first round happened to see.
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
         *
         * A LABEL. Nothing in the engine branches on it - the goal handed to
         * the resolver is `coerce` whatever it says - and it is carried so the
         * record and the narrator can state what was wanted rather than having
         * to guess it from the outcome.
         */
        wanted?: string,
        /**
         * The player's own sentence, for the case where phase 1 picked the verb
         * and dropped the object. Read ONLY when `target` is missing, and only
         * to find a name the player themselves wrote. See
         * `the-name-the-verb-dropped.ts` for why that is not a discovery leak.
         */
        said?: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        let query = (target ?? '').trim();

        // ── THE NAME THE VERB DROPPED ────────────────────────────────────
        //
        // Reported from play, with the target standing in the square: "I
        // coerce claire to hand over her stuff, all of it" arrived as
        // `coerce()` with an empty target and was refused for naming nobody.
        // From a chair that reads as people not persisting between turns.
        //
        // Recovered before the refusal rather than inside it, so everything
        // below - the faction branch, the resolution, the whole bout - runs on
        // the recovered name exactly as it would on a typed one.
        // The recovered name is not announced separately: it becomes `query`,
        // so every ruling below names the person it resolved to exactly as it
        // would have if the player's target had survived phase 1. The player
        // sees who was fought, which is the fact that matters.
        if (query.length < 2) {
            const who = theNameTheVerbDropped(said, this.present(cultivator));
            if (who) query = who.name;
        }

        if (query.length < 2) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named for a confrontation. Nothing was resolved and ' +
                'no exchange was run.'
            ));
        }

        // ── a house is not a person ──
        //
        // `combat_manage.resolve` takes an opponent, and a faction is not one -
        // so "I attack the Nine Abyss Flame Sect" resolved to nothing and came
        // back `Unresolved party "Nine Abyss Flame Sect" for a confrontation`,
        // identically at every rung from a rogue to an apex head. That reads as
        // a considered refusal and is not one: standing was never consulted,
        // because the noun never resolved.
        //
        // What is actually true is a fact about the world rather than about the
        // resolver, and both halves of it are already modelled. You cannot
        // fight a house, because a house is not standing anywhere - you fight
        // somebody in it, which is the confrontation resolver, or you set your
        // house against theirs, which is `posture` and opens at the head. So
        // the refusal says that, names both routes, and prices the target out
        // of `sectThreat` where the player can name them.
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

        // ── SOMEBODY OF MY OWN HEIGHT ────────────────────────────────────
        //
        // `somebodyAtHand` answers a gesture with whoever is NEAREST, which for
        // a fight is the wrong body: the nearest person is usually far above,
        // and the categorical-gap rule then correctly declines. So every route
        // into combat was suicide or a refusal and a player never fought
        // anybody, in a setting where a bout between equals is how a disciple
        // measures themselves.
        //
        // A peer phrase asks for a HEIGHT rather than a person, so it is
        // answered with the closest match on the ladder among the people
        // actually here. It never invents anybody: an empty square still falls
        // through to the same refusal below.
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

        // ── THE PERSON THE WORLD ACTUALLY HOLDS ──────────────────────────
        //
        // Where there is no row there is usually still a RECORD, and it is the
        // one the world has been keeping: their attributes, and what they are
        // carrying from every fight, crossing and tribulation before this one.
        // Describing them as a bare name and an ordinal handed the resolver a
        // stunt double - might 2, insight 2, unwounded - so a man who was
        // crippled here last week stood up fresh, and no wound this layer wrote
        // could ever be read back. Only the fields `OpponentSchema` already has
        // are filled; nothing about the tool's surface changes for this.
        const theirRecord = !onRecord && this.atHand
            ? this.atHand.npcs.find(npc => npc.id === party.id) ?? null
            : null;

        // ── SWINGING AT SOMEBODY YOU ARE ALREADY FIGHTING ────────────────
        //
        // "I hit him again", "I spar with him", "I keep at it" - all of them are
        // an ordinary round of the fight that is already standing, and none of
        // them opens a second one. Without this, a player attacking the same
        // person twice got a FRESH fight each time: both sides back on full,
        // the round count back to zero, and a fight that could never be won or
        // lost because it restarted every turn.
        //
        // Checked here rather than in `whatTheySaidInTheFight`, because that
        // reader answers on the words alone and "I spar with someone of my own
        // rank" is a sentence about who to fight rather than about what to do
        // this round. Which person it resolves to is this method's question and
        // it has just answered it.
        const alreadyFighting = theFightStillStands(this.fight, run.id, cultivator.id)
            ? this.fight
            : null;
        if (alreadyFighting && alreadyFighting.party.id === party.id) {
            return await this.answerTheFight(
                run, cultivator, ambient, alreadyFighting, { kind: 'strike' }
            );
        }

        // ── AND THE BODY THEY ARE ACTUALLY STANDING IN ───────────────────
        //
        // `bodyStandingOn` is what the world says is left in them today, mended
        // forward from the day it was last true; `maxBodyOf` is the pool their
        // rung buys. The world's OWN bouts have read both since NPCs were given
        // a persisted body - `gatherings.ts`, at `BOUT_BODY` - and the played
        // path did not, so a cultivator who paid a crossing toll last spring
        // stood up whole for the player and worn for everybody else. That is the
        // "a player can do everything an NPC can" rule running backwards: the
        // toll made the world's fights honest and the player's harder than
        // anybody else's.
        //
        // Both are passed rather than only `hp`, because `combatantFromOpponent`
        // derives the maximum off the CLAMPED might below - so passing a wound
        // count without the pool it belongs to would price the fraction against
        // the wrong denominator.
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

        // ── AND NOW IT IS A FIGHT RATHER THAN A RESULT ───────────────────
        //
        // Design owner: "combat should also of course resolve across multiple
        // turns to give the player agency (fleeing, how, to where, using what
        // ability, or item?). if you fought and it resolves in one turn and you
        // died it would be unsatisfying cuz there's nothing you can do about
        // it."
        //
        // So this opens a fight and holds it. The physics are unchanged and are
        // the same function `resolveConfrontation` runs - see
        // `unfinished-fight.ts` - and the ENDING still goes through
        // `settleAFight`, which is the persistence path a one-call fight has
        // always used. What changed is who decides each round.
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
                // ── WHETHER THEY WOULD RATHER DIE ────────────────────────
                //
                // Design owner: "depending on some character traits some would
                // rather die." Read HERE rather than in the engine, and read off
                // records the world already keeps, because there is no
                // will-to-submit number anywhere and there must not be one - see
                // `how-far-you-went-to-make-them-comply.ts`.
                //
                // Only asked when it can matter. A coercion is the one goal
                // whose ending turns on it, and passing it on every fight would
                // put a reading in the log of a fight it decided nothing about.
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
     * What the person in front of them made of the thing in their hand.
     *
     * ── THE RULING ───────────────────────────────────────────────────────
     *
     * `docs/world/things/items.md`: **a famous thing is recognised the way a
     * famous art is** - unevenly, by people with reason to know it. Carrying
     * one is a statement, and not always one you want to make; somebody who
     * recognises it knows something you did not tell them.
     *
     * The check is `artifact-recognition.ts`, which is the art check pointed at
     * an object and imports its two axes rather than restating them. Nothing is
     * decided here.
     *
     * ── WHY A FIGHT IS WHERE THIS LANDS FIRST ────────────────────────────
     *
     * All three of the ruling's consequences are about being SEEN carrying
     * something, and a fight is where a carried object is unambiguously on
     * show: held up, swung, at arm's length, at somebody with every reason to
     * look at it. A blade in a pouch is not a statement. A blade in your hand
     * is.
     *
     * It is also the one place the turn has already established what they are
     * holding - `CombatantInput.weapon`, priced two methods up - so this reads
     * a fact the turn already has rather than going to look for one.
     *
     * A player walking into a room is the WIDER consumer and this is not it.
     * That read belongs beside `look`, and it wants the same call.
     *
     * ── AND RECOGNISING IT IS AN EVENT, NOT A SENTENCE ───────────────────
     *
     * `AGENTS.md`: a fact reaches a person, and reaching them is an event. So
     * where the reading lands, `revealOwnership` writes it down - this is that
     * function's first caller, and its field `knownOwnershipBy` was already the
     * check's own strongest input. Somebody who has seen your stolen blade goes
     * on knowing tomorrow, which is the whole of why carrying one is dangerous.
     *
     * ── WHAT DOES NOT REACH IT, AND CORRECTLY ────────────────────────────
     *
     * A counted thing has no row and no history, so there is nothing to know. A
     * granted copy has no row either - `items.md` says a granted thing is a
     * copy and nothing in the world should read as though a register moved -
     * and it falls out of the same lookup with no branch saying so. Neither is
     * a gap; both are the object having nothing to be recognised as.
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
     *
     * Everything mechanical is `takeAFightTurn`'s. What this does is write the
     * result where a player can read it, and hand a finished fight to the one
     * conclusion both entrances use.
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

        // ── WHAT THE ROUND DID, AND WHERE THAT LEAVES THEM ───────────────
        //
        // Onto `lines` AND `prose` AND `required`, and none of the three is
        // belt and braces. `composeNarrationUser` sends `lines` alone, so a
        // fact written only to `structure` reaches an operator reading the log
        // and nobody playing; `prose` is what the deterministic narrator ships;
        // and `required` is for facts a player cannot play without. The state of
        // a fight you are standing in is the definition of one - the whole of
        // the ruling is that you can see you are losing before you have lost,
        // and a fight whose state only an operator can read is the one-call
        // fight again with extra turns.
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
     *
     * AGENTS.md: do not ban. A player who types "I cultivate" with a blade
     * coming at them has attempted something, and the honest answer is that the
     * blade arrives and then they do it - not a refusal telling them to answer
     * the question first, which is the modal jail the crossroads header already
     * rejects for its own fork.
     *
     * The round is taken as a `guard`, and that is the one judgement in here: a
     * player who was not answering the fight was not swinging either, and
     * charging them a full exchange they never chose would be the engine
     * deciding they had attacked somebody.
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
     *
     * The one conclusion. `settleAFight` writes the wounds, the feud, the lesson
     * and the death gate in a single transaction; `whatItDidToThem` carries the
     * findings to the world row; `whatFollowedTheBout` says who else now holds
     * something about it. All three ran before this method existed, in `attack`,
     * against a fight settled in one call - and they run here unchanged, because
     * what a fight left cannot depend on how many turns the player spent in it.
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

        // ── A ROUTE OUT OF A HOPELESS FIGHT IS NOT OPTIONAL ──────────────
        //
        // `summariseToolBody` already put these on `lines` and therefore on
        // `prose`, which is enough for the deterministic narrator. `required` is
        // what stops a MODEL narrator from writing a well-turned paragraph about
        // being outclassed and dropping the four sentences that say what to do
        // instead - which is the same fact-written-and-never-shown failure the
        // fight's own state line is on `required` for.
        //
        // Only on a no-contest. After a fight somebody actually had, the options
        // are not what the turn was about and printing them would read as the
        // engine lecturing somebody who just won.
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

        return this.afterAFight(run, cultivator, held, settled, execution);
    },

    /**
     * What the fight did to what the player was carrying.
     *
     * ── THE GAP THIS CLOSES ──────────────────────────────────────────────
     *
     * `result.brokenObjects` is filled by the same resolver that fills it for
     * an NPC bout, and nothing in the played game read it. A player's blade
     * came apart inside the resolution - the fight was even repriced without
     * it, mid-round, which is the whole point of the mechanic - and it was
     * still whole in their pouch when the turn ended. `applyBoutBreakages` in
     * `gatherings.ts` and `writeBackWhatBroke` in `war-melee.ts` are the
     * world's two halves of this writeback; the player had none.
     *
     * It lives here for the reason `whatItDidToThem` does: this is the only
     * layer holding both stores. The resolver is pure with respect to
     * equipment and says so, and `combat_manage` has no world handle.
     *
     * ── TWO WRITES, BECAUSE A HOLDING IS WRITTEN DOWN TWICE ──────────────
     *
     *   THE POUCH ROW  is what they are carrying, and it goes.
     *   THE WORLD ROW  is the object, and it is RUINED rather than deleted.
     *
     * `docs/world/things/items.md`'s "spent is not gone": the row keeps its
     * name, its owner, its claims and every link of its provenance, and gains
     * one more saying where it ended and who was standing there. A house whose
     * artifact a stranger broke should have a record that says so, and an
     * object that vanishes cleanly from the record is one nobody can ever be
     * asked about.
     *
     * ── AND THE SECOND WRITE IS ABSENT FOR SOME OBJECTS, ON PURPOSE ──────
     *
     * Only a tracked thing has a row. The catalog's ordinary weapons are
     * `mundane` kinds standing in for several hundred of the thing, and
     * `artifact-placement.ts` deliberately seats none of them - a tracked row
     * per notched sabre is ledger rubble. A counted thing cannot be damaged;
     * it stops existing, and there is nowhere to write the scar. So the pouch
     * write is unconditional and the ruin is whatever the world happens to
     * hold, which is the counted/tracked line arriving on its own rather than
     * a branch anybody wrote. Do not add one.
     *
     * ── OWNERSHIP IS NOT TOUCHED ─────────────────────────────────────────
     *
     * Breaking somebody's thing does not transfer it, and `ruin` leaves
     * `ownerId` exactly where it was. That is the same rule the acquisition
     * side keeps: holding a thing and owning it are two facts, and a pouch row
     * is not a claim on the world's register.
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

            // ── AND SAY WHAT IS LEFT, NOT WHAT ALREADY HAPPENED ──────────
            //
            // The round the object went in already narrated it coming apart -
            // `resolveExchange` puts it in its own `narrationHint` and
            // `takeAFightTurn` composes the round's line out of those. Saying
            // it again here would be the same fact twice in one turn, which
            // reads as a dump.
            //
            // What is new is what the player is holding now and what the record
            // says. An empty hand is a fact they have to play the next fight
            // with, and who still owns the pieces is the thread somebody could
            // follow - which is the whole reason the row is kept rather than
            // deleted, and it is invisible unless it is said.
            //
            // Into `prose` and `required` as well as `lines`, and this is not
            // belt and braces. `lines` is what a model MAY know and `prose` is
            // what the deterministic narrator ships, so a fact written to only
            // the first is computed and shown to nobody playing without a model
            // attached. A player who is not told they are unarmed goes on
            // playing as though they are not.
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

        // ── WHAT THE COMPLIANCE WAS FOR ──────────────────────────────────
        //
        // A label and only a label: no line of engine code read it, the goal
        // handed to the resolver was `coerce` whatever it said, and the outcome
        // was decided before this. It is said out loud because the alternative
        // is a narrator inferring what somebody wanted out of what they got,
        // which is the model deciding a fact about the world.
        if (intent === 'coerce') {
            const line =
                `What was wanted out of ${party.name}: ${(wanted ?? 'submit').replace(/_/g, ' ')}.`;
            execution.facts.lines.push(line);
            // ── IN `prose`, NOT IN `required` ────────────────────────
            //
            // Owner, reading it in play: "this is not required - we know this
            // cuz of what we did and the description." Right on both counts.
            // The sentence used to go on to explain that force was applied to
            // get compliance and could fail the way a fight fails - which the
            // player had just typed and the outcome had just shown - and
            // `required` is for facts a player cannot play WITHOUT. Somebody
            // knows what they demanded.
            //
            // It stays in `prose`, which is a different question: `prose` is
            // what the deterministic narrator ships, so dropping it there
            // would make a coercion read as an ordinary brawl for anybody
            // playing without a model - and that is the verb not existing.
            execution.facts.prose = [execution.facts.prose, line].join('\n');
            execution.facts.structure.push(
                `coerce: intent label "${wanted ?? 'submit'}", goal handed to the resolver `
                + '"coerce". Nothing in the engine branches on the label.'
            );
        }

        // ── AND WHAT IT DID TO THEM ──────────────────────────────────────
        //
        // The other side of the boundary, crossed here because this is the only
        // layer that holds both stores. `combat_manage` wrote the player's half
        // and, for an opponent with a row, theirs; for everybody else it wrote
        // nothing, which is most of the people a player ever swings at. This
        // carries the findings it already made to the record that holds them.
        // Nothing is re-decided - see the module header - and it runs after the
        // resolve for the same reason the fallout does.
        // Everybody standing here who is not one of the two of them. Computed
        // ONCE and handed to both halves, because both ask
        // `whatFollowsFromTheBout` the same question and two different witness
        // counts would be two different answers to it.
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
            // `lines` is what a narrator may know and `prose` is the
            // deterministic rendering, and appending to only the first is how a
            // consequence gets computed, written to the ledger and never shown
            // to anybody playing without a model attached.
            //
            // And `required`, which is reserved for facts a player cannot play
            // without. This is one: the whole of the ruling is that the world
            // answers, so a narrator that drops the line leaves a player
            // believing they got away with it - which is the invisible version
            // of softening and is worse than the visible kind.
            execution.facts.lines.push(...fallout.lines);
            execution.facts.required = [...(execution.facts.required ?? []), ...fallout.lines];
            execution.facts.prose = [execution.facts.prose, ...fallout.lines].join('\n');
        }
        execution.calls.push(...fallout.calls);
        return execution;
    },

    /**
     * Carry what the resolver decided to the record that holds the person.
     *
     * ── THE BOUNDARY, AND WHY IT IS CROSSED HERE ─────────────────────────
     *
     * `combat_manage.resolve` persists its opponent's half only for an opponent
     * with a row in the `cultivators` table. Everybody else - which is most of a
     * square, and effectively all of the people a player actually spars with -
     * is DESCRIBED to it, because there is no id to pass, and everything it then
     * decided about them was thrown away on the way out. Beat somebody bloody
     * and they were whole the next turn; kill them and they were standing there.
     *
     * Neither side could close that alone. The tool owns one store, runs its
     * writes in one synchronous transaction, and has no run handle at all when
     * it is driven off the MCP surface - so it cannot reach an async per-run
     * world. The world layer has never heard of a run or a played cultivator.
     * This method is the only place that holds both, so this is where the two
     * are joined, and it does no deciding of its own: it reads the findings out
     * of the body the resolver returned and hands them to the world layer's own
     * write path.
     *
     * ── WHAT IT DOES NOT CARRY ───────────────────────────────────────────
     *
     * Hit points, and that sentence used to end "because the world does not
     * store them". It does now: `NpcCultivation.hp` with a `bodyOnDay` anchor,
     * mended forward by `bodyStandingOn`, which is how a crossing toll is
     * carried. The played path READS it - see the body block in `attack` - so a
     * cultivator the world wore down is met worn down.
     *
     * Writing it back is the half that is still missing, and it is named here
     * rather than left to be discovered: a player can wear somebody down inside
     * a fight and the wear does not reach the world row afterwards, so the same
     * person is whole again the next time anybody meets them. Wounds are carried
     * in full and are the durable half; the bar is not. Closing it means
     * deciding what a bout SHOULD leave on a body that heals in about five and a
     * half years, which is a ruling rather than a patch.
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
         *
         * Carried out of here rather than re-derived downstream because
         * `settleNpcDeath` has already answered it - on the record as it stood
         * at death, which is the only moment the answer is right - and a second
         * walk of the lineage after `markDead` would be asking about a corpse.
         * Empty for anybody who lived and for anybody who left nobody.
         */
        theirPeople: readonly { id: string; relation: InheritanceRelation }[];
        /**
         * The accounts the world decided this fight opened.
         *
         * Decided THERE and not here, which is the whole of the design owner's
         * ruling that a war death is a grudge like any other: `war-melee.ts`
         * and this path both write their dead through
         * `whatTheConfrontationDidToThem`, so the rows come out of the one
         * place both of them already meet. Empty for an opponent the world does
         * not hold - see `whatFollowedTheBout`, which covers that half.
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
            theirPeople: wrote.handoff?.heirs ?? [],
            opens: wrote.opens,
            lines: wrote.lines,
            calls
        };
    },

    /**
     * Who else holds something about a fight, once it is over.
     *
     * ── THE RULING ───────────────────────────────────────────────────────
     *
     * AGENTS.md: **"Kill somebody during an agreed bout and you will obviously
     * face consequences."** Nothing above this line prevents it and nothing
     * above this line softened it. The bout ran through the same resolver a
     * killing runs through, with the same exchanges, the same wounds and the
     * same death gate, and this is where - and the only place where - the
     * difference between having agreed and not having agreed is charged.
     *
     * ── WHAT WAS ACTUALLY MISSING ────────────────────────────────────────
     *
     * All of it. "I spar with him" and "I pin him" both parsed to `subdue` and
     * were indistinguishable from that point on; `seedObligations` keys on the
     * outcome alone, so a bout that ruined somebody wrote exactly the record a
     * mugging writes; and a killing wrote NOTHING, because the resolver is
     * right that the dead hold nothing and nobody else was ever asked. A house
     * could lose a member in a friendly bout and the ledger would not contain
     * the fact.
     *
     * ── WHAT IT WRITES ───────────────────────────────────────────────────
     *
     * Two ordinary rows in tables that already exist, both in the direction the
     * rest of the codebase writes - the aggrieved party HOLDS it, the offender
     * is the SUBJECT of it - so every query that reads obligations finds them,
     * inheritance carries them, and a descendant three generations on can still
     * be carrying it:
     *
     *   THEIR HOUSE   an obligation row against whoever went too far. The loser
     *                 already has their own record from the resolver and this
     *                 does not touch it; where the loser is dead they have no
     *                 record at all, which is exactly the hole this fills.
     *   YOUR HOUSE    standing, through `spendStanding`, which is the same
     *                 arithmetic every other act inside a house runs on. Only
     *                 where the player is the one who went too far, because a
     *                 house ledger is a thing the played cultivator has and an
     *                 NPC in a square does not.
     *
     * Nothing is invented for this and nothing is grave-specific or bout-
     * specific in either table. `attentionFor` writes a robbery the same way.
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
         *
         * The resolve body's own `opponentDied` covers the other half. Both are
         * the survival layer's answer about the same person reaching this by
         * different routes, because the person is stored in different places.
         */
        diedInTheWorld = false,
        /**
         * Who the dead left, from `whatItDidToThem`.
         *
         * ── THE HOLE THIS CLOSES, MEASURED ───────────────────────────────
         *
         * Played, on a pinned world: a cultivator killed two people in front of
         * eight witnesses and `obligations` held ZERO rows afterwards. The
         * killings were in the world - `aDeedEntersTheWorld` wrote both facts -
         * and the world's own report named an heir on the way past
         * (`heir=npc-232`). Nobody held an account against the player for
         * either, because `whatFollowsFromTheBout` had only ever been asked
         * about the loser's HOUSE, and neither of them had one.
         *
         * So the heaviest thing a player could do to somebody was the one thing
         * that opened no account, while robbing them opened one reliably. That
         * is the agency rule's softening in its most invisible form.
         *
         * `whatADeedLeaves` has always said what should happen - *heavy, and
         * they have people: their family carries it at the same weight* - and
         * its field for it is `principalCannotHoldIt`. This is that field,
         * arriving where the bout is priced so the severity is still decided
         * exactly once, in the module that owns the table.
         */
        theirPeople: readonly { id: string; relation: InheritanceRelation }[] = [],
        /**
         * The rows the world already decided, for an opponent it holds.
         *
         * Used verbatim where there are any. The world path is the one both a
         * war and a played killing come through, so taking its answer here is
         * what makes the two the same event - and re-deciding it would be the
         * second opinion the whole ledger is built to prevent.
         *
         * Empty for an opponent with a `cultivators` row and no world record,
         * and that half is written below through the SAME builder. Two callers,
         * one decider; the branch is on where the person is stored, which is a
         * fact this file has always had to know.
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

        // `died` is the survival layer's word, written before this ran, and it
        // is THE PLAYER's - `combat_manage.resolve` has always read that way and
        // its callers read it that way.
        //
        // The opponent's has two homes because the opponent does. Somebody with
        // a cultivator row is answered by the tool's own death gate and arrives
        // as `opponentDied`; somebody the world holds is answered on the far
        // side of the boundary and arrives as `diedInTheWorld`. Both are the
        // same ruling by the same layer about the same event.
        //
        // This is what the header's ruling was waiting for. Until an opponent
        // could die at all, `loserDied` could only ever be false for the person
        // a player actually spars with, so the killed-somebody-in-an-agreed-bout
        // consequence was unreachable against the entire population a player
        // meets. It is reachable now, and nothing else about the charge changed.
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

        // ── AND EVERYONE WHO HEARS ABOUT IT KNOWS SOMETHING ABOUT YOU ────
        //
        // AGENTS.md's own worked example ends on that sentence, and it was the
        // one half of the ruling that had no mechanism: the obligation row said
        // a house was owed something, and the WORLD did not contain the bout.
        // Nobody could repeat it, no digest carried it, and a stranger asking
        // around about this cultivator in forty years found the ledger empty of
        // the event that the account rests on.
        //
        // Written whatever `followed.against` came to, because how far past the
        // terms it went is not the same question as whether anybody has a claim.
        // A bout that went too far against somebody who answers to nobody opens
        // no account at all - `followed.brokenPromise` is exactly that case -
        // and the world should still contain it. AGENTS.md: write the fact and
        // no grudge.
        //
        // The severity is `whatFollowsFromTheBout`'s where it decided one, and
        // it is not re-decided here. Where it decided none, the fact still needs
        // a weight, and the honest floor is the lowest band: nobody is owed
        // anything, so nothing about it is grave to anybody but the person it
        // happened to.
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

        // ── AND WHAT ANYBODY IS NOW OWED ─────────────────────────────────
        //
        // One decider, two sources, and the branch is on where the person is
        // stored rather than on what kind of fight it was. The world holds most
        // of the people a player swings at and has already decided their rows -
        // through the same function `war-melee.ts` writes its dead with, which
        // is the whole of the ruling that a war death is a grudge like any
        // other. The handful of opponents who exist only as a `cultivators` row
        // are built here, through the identical builder.
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

        // ── AND WHAT YOUR OWN PEOPLE MAKE OF IT ──────────────────────────
        //
        // Only when the player is the one who went too far. A house that put a
        // disciple in a friendly bout and got a body back has been told
        // something about that disciple, and standing is where a house keeps
        // what it thinks. `spendStanding` runs the house's own arithmetic - the
        // discount a following buys, the floor - so nothing here invents a
        // curve; this supplies the raw figure and says where it came from.
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
