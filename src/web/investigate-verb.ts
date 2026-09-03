/**
 * Looking closely at a thing, and being told only what you could tell.
 *
 * `investigate` is the widest target resolver in the package - a place, a
 * record, an object, a person, a ruin, the ground itself - and it is the verb
 * where the discovery gate does the most work. What comes back is filtered
 * through what this cultivator has a record for, so a close look can never be
 * the thing that hands over a name, and a name that resolves to nothing gets a
 * refusal that lists what IS on record nearby rather than a blank.
 *
 * ── HOW THIS IS ATTACHED ─────────────────────────────────────────────────
 *
 * A `GameService` method living in another file, merged onto the prototype at
 * the bottom of `game.ts` with its signature merged into the class
 * declaration. `this.investigate(...)` resolves and typechecks exactly as it
 * did when the body sat in the class, and every line of the body below is the
 * line it was. `src/web/README.md` has the argument for the shape and the
 * warning about the `private` keyword.
 */

import {
    whatALookAtSomebodyReaches
} from '../engine/social/what-a-look-at-somebody-reaches.js';
import { howTheGroundReads } from '../engine/world/what-a-place-still-has-in-the-ground.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    MATCH_THRESHOLD,
    matchScore,
    resolveAnything,
    worldLocationFor
} from './entities.js';
import { whatIsWrongWithThisGround } from './ground-status-lines.js';
import { factsForInvestigation, factsForLook, factsForRefusal, placeName } from './facts.js';
import { refused, structureCalls } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';



export const investigateVerb = {
    /**
     * Examining something.
     *
     * Reads state and reports it. The subject must resolve to a real row or a
     * real catalog entry, so a player cannot examine a person the world does
     * not contain and receive a description of them.
     *
     * TODO(world): once `assessCapability` is wired, run the `understand`
     * predicate over the subject so that an inscription above the cultivator's
     * comprehension yields partial or wrong readings rather than the full
     * record. Comprehension is archaeology, and it should be able to fail.
     */
    investigate(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Execution {
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return this.freeAction(
                run, 'investigate',
                factsForLook(cultivator, ambient, this.company(cultivator))
            );
        }

        const scope = this.scopeFor(cultivator);
        // Ruins are load-bearing: origin.md closes on them being the one door
        // in this world that opens on nerve rather than standing, and the only
        // route a poor cultivator has. "The ruins" is how a player refers to
        // the one they are standing near, and it is not a proper name, so it
        // resolved to nothing and the most obvious sentence about the most
        // important feature in the game did nothing at all.
        const subject = this.ruinAtHand(query, cultivator)
            // ── AND THE GROUND SOMEBODY IS ACTUALLY STANDING ON ──────────
            //
            // The same defect as "the ruins", one noun over, and it hid a whole
            // subsystem. `resolveKnownPlace` matches the current location BY
            // NAME, so "I examine Wheatgate" resolves and "I examine the
            // province", "what is the ground here like" and "I look over this
            // place" resolve to nothing - and the refusal then reads as though
            // the player had asked for an object that is not here.
            //
            // What that cost: `howTheGroundReads` has exactly one call site and
            // it is behind this resolution, so a player who worked a district
            // out could not be told. Its own comment says why that matters -
            // the yields quietly fall and a worked-out district is
            // indistinguishable from bad luck. Found by playing: four foraging
            // turns in a row, all four successful, nothing anywhere saying the
            // ground was drawing down.
            ?? this.groundAtHand(query, cultivator)
            ?? resolveAnything(this.repos, query, cultivator, scope);
        if (!subject) {
            // ── A NAME THEY HOLD IS NOT A PLACE THAT HAS NO SUCH THING ───
            //
            // FOUND BY PLAYING, one town from somebody known since childhood.
            // "I look at Fang Nuoshan", typed in Fourhands with Fang Nuoshan in
            // Sixmile, came back as *"You go over Fourhands looking for it and
            // it is not the kind of place that has one"* - and the inspector
            // line printed underneath it read *"Unresolved subject "Fang
            // Nuoshan": no knowledge record and nothing co-located. Known to
            // this cultivator, or standing here: ... Fang Nuoshan"*.
            //
            // **The refusal denied a record it listed in its own next breath.**
            // `what do I know of Fang Nuoshan` answered fully one command later.
            //
            // Two things were wrong and only the second is about resolution.
            // `resolveCultivator` searches the run's own roster plus whoever is
            // standing here, and a world NPC who is neither - anybody met once
            // and walked away from, anybody merely heard of, anybody DEAD - is
            // in neither list however well the holder knows them. And the
            // refusal is place-shaped, about a person.
            //
            // ── WHY THE ANSWER IS HERE AND NOT IN THE RESOLVER ───────────
            //
            // Because `resolveAnything` is shared. `askAround` and `demandOf`
            // pass a question's TOPIC through it, and `withinStratum` reads a
            // subject with no recorded ordinal as within reach - so a stratum of
            // this kind arriving there would have an unattached stranger recite
            // the facts back, which for a record-only person is the PLAYER'S OWN
            // MEMORY in somebody else's mouth. The gap is real and general; the
            // answer to it is this verb's, because this verb is the one that was
            // asked.
            //
            // ── AND IT TEACHES NOTHING, WHICH IS WHAT MAKES IT SAFE ──────
            //
            // Read from the holder's own awareness rows and from nothing else,
            // exactly like `recall`, so a name nobody has said still resolves to
            // nothing. It deliberately does NOT go through `noteEncounter`:
            // reading your own memory does not put you in a room with somebody,
            // and writing a `witnessed` row here would promote a whisper to
            // `encountered` and quietly falsify the reference axis the look read
            // below depends on. Nothing is written at all.
            //
            // Refused rather than executed, because the look did not happen -
            // and the refusal names the route by walking the first step of it.
            const heldName = this.knowledge
                .awareness(cultivator.id, 'cultivator')
                .find(row => matchScore(query, row.name) >= MATCH_THRESHOLD);
            if (heldName) {
                const reaches = whatALookAtSomebodyReaches(heldName.stage, heldName.name);
                // The record's own sentence, verbatim. `AwarenessRow.statement`
                // says why: for most rows in that table it is the whole of what
                // somebody has, and a reader composing a phrase of its own here
                // would be inventing a memory on the holder's behalf.
                const bare = `${heldName.name} exists.`;
                return refused('engine.resolveEntity', 'investigate', factsForRefusal(
                    `${heldName.name} is not here.`,
                    // "not here" and never "somewhere else". Whether they are
                    // one town over or dead is not something this cultivator
                    // has been told, and the whole of the knowledge layer is
                    // that the engine does not tell them - a look that reached
                    // nothing cannot be the thing that reports a death.
                    `You look for ${heldName.name} and ${heldName.name} is not here. What `
                    + 'you have of them is what you were already carrying.'
                    + (heldName.statement && heldName.statement !== bare
                        ? ` ${heldName.statement}`
                        : '')
                    + ` ${reaches.line} ${reaches.ceiling}`,
                    `Unresolved subject "${query}": held as a knowledge record at stage `
                    + `${heldName.stage} (${reaches.reference}) and neither on the run's roster `
                    + 'nor standing here, so no row could be read. Answered out of the holder\'s '
                    + 'own rows and nothing else; nothing was written and no stage moved.'
                ));
            }

            // Worded so that it does not confirm existence either. "You have
            // never heard of it" and "it is not there" have to look the same
            // from inside, or the refusal itself becomes the answer key. And it
            // is written as a scene, because an error message reaching the
            // player is a scene that failed to get written.
            return refused('engine.resolveEntity', 'investigate', factsForRefusal(
                'Nothing here answers to it.',
                // Searching a place fails differently from addressing a person.
                // This used to hand back the conversational brush-off, so "I
                // explore the ruins" was answered with somebody looking up from
                // their work - which named a stranger the player had not met and
                // described a social act nobody had attempted.
                //
                // ── AND IT SAYS NOTHING ABOUT WHAT KIND OF THING IT WAS ──
                //
                // It used to read "it is not the kind of PLACE that has one",
                // which is a claim about the subject: a person's name refused in
                // those words tells the player the engine took it for a
                // feature. The branch above now owns every name this cultivator
                // actually holds, so what is left here is a word that has
                // reached nothing at all, and the refusal has to stay silent
                // about which kind of nothing - that is the same rule the
                // paragraph above states and the old wording quietly broke.
                `You go over ${placeName(cultivator)} looking for it and nothing here answers ` +
                'to it. Either it is somewhere else, or it is nowhere, and standing ' +
                'here turning it over is not going to settle which.',
                `Unresolved subject "${query}": no knowledge record and nothing co-located. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        // ── WHAT THE READER ALREADY HAD, READ BEFORE LOOKING CHANGES IT ──
        //
        // Taken here and not below, because `noteEncounter` writes a
        // `witnessed` row and `stageCeilingFor('witnessed')` is the top of the
        // ladder: asked afterwards, every face in the world comes back `known`
        // and the reference axis says nothing at all.
        const heldBefore = subject.kind === 'cultivator'
            ? this.knowledge.stageOf(cultivator.id, 'cultivator', subject.id)
            : null;

        // Examining a thing is a source. Record it with its provenance rather
        // than letting the knowledge exist only in the transcript.
        const learned = this.noteEncounter(
            cultivator, run, subject, 'witnessed', `Examined at ${placeName(cultivator)}.`
        );

        // `subject.facts` is what was perceived and goes to the narrator.
        // `subject.structure` is the schema behind it - governance, ordinals,
        // grades - and goes only to the inspector below. A category handed to a
        // narrator becomes a briefing, and there is no briefing in this world.
        const facts = factsForInvestigation(cultivator, ambient, subject.name, subject.facts);
        facts.structure.push(...subject.structure);

        // ── WHAT IS STILL IN THE GROUND HERE ─────────────────────────────
        //
        // A player has to be able to ask what a place still has and get a real
        // answer. Without this the stock is a simulation nobody can see: the
        // yields quietly fall and there is no sentence anywhere saying why, so
        // a worked-out district is indistinguishable from bad luck.
        if (subject.kind === 'place' && this.atHand) {
            const row = worldLocationFor(this.atHand, subject.name);
            if (row) {
                const day = Math.floor(this.atHand.currentDay);
                const said = howTheGroundReads(row, day);
                facts.lines.push(said);
                facts.prose = `${facts.prose}\n\n${said}`;

                // ── AND WHETHER ANYTHING IS WRONG WITH IT ────────────────
                //
                // The area-status layer, reached through the module that owns
                // the read. `ground-status-lines.ts` IS this block, lifted out
                // so that `look` and `investigate` cannot answer one question
                // two ways - and it had sat there with no caller in `src/` ever
                // since, while this file went on carrying the copy verbatim.
                // Two readings of one layer disagree the day either changes,
                // which is the whole reason that file exists.
                //
                // The stage rule is argued out over there and is not restated
                // here: capped at `encountered`, because being in a thing gives
                // you the signs and the CAUSE has to be got from somebody who
                // has it; floored at `encountered`, because somebody looking at
                // the ground under their own feet has been in it.
                //
                // `standingHere` stays a caller's fact on purpose. Asking after
                // somewhere else is asking, and only this file knows which of
                // the two the player did.
                const standingHere = placeName(cultivator) === row.name
                    || this.worldPlaceOf(cultivator) === row.id;
                const wrong = whatIsWrongWithThisGround({
                    statuses: this.atHand.statuses,
                    locations: this.atHand.locations,
                    locationId: row.id,
                    day,
                    heldStage: this.knowledge.stageOf(cultivator.id, 'place', row.id),
                    standingHere
                });
                if (wrong.lines.length > 0) {
                    facts.lines.push(...wrong.lines);
                    facts.prose = `${facts.prose}\n\n${wrong.lines.join(' ')}`;
                }
                facts.structure.push(
                    `whatIsGoingOnHere: ${wrong.lines.length} line(s) at stage ${wrong.stage} over `
                    + `${this.atHand.statuses.length} area status(es) in the world.`
                );
            }
        }
        // ── AND WHEN WHAT WAS LOOKED AT IS A PERSON ──────────────────────
        //
        // "I look at <somebody>" used to answer with the ambient band and the
        // weather, because the parser dropped the object of the sentence. It
        // reaches here now, and this is the half that makes the arrival worth
        // anything: `trust.md` rules that what a reader gets out of a person
        // turns on two INDEPENDENT things about the reader - realm for what
        // they can perceive, worldview for what they have a reference for - and
        // only the first of them was ever printed. The party read above is the
        // perceptual half. This is the other one, off the ladder in
        // `discovery.ts`, and it is not restated here: see
        // `engine/social/what-a-look-at-somebody-reaches.ts`.
        //
        // The ceiling is said out loud on purpose. `WHAT_GIVES_A_CHANGED_BEAST_
        // AWAY` in the catalog rules that the deepest thing there is to notice
        // about anybody surfaces in ordinary conversation over time and NEVER
        // in a look - and that it is not a fact about beasts, but about anybody
        // whose records are empty where yours are full. A read that stopped at
        // the rung would let a narrator imply there was more in the picture
        // than the engine put there.
        if (heldBefore !== null) {
            const reaches = whatALookAtSomebodyReaches(heldBefore, subject.name);
            facts.lines.push(reaches.line, reaches.ceiling);
            // Both channels, for the two readers: `lines` is what a model may
            // use, `prose` is what the deterministic narrator ships verbatim.
            // Written to only one, this said nothing at all in no-model mode -
            // which is the mode the defect was found in.
            facts.prose = `${facts.prose}\n\n${reaches.line} ${reaches.ceiling}`;
            facts.structure.push(
                `Look at a person: reference axis at stage ${reaches.stage} - `
                + `${reaches.reference} The perceptual axis is the party read above, and `
                + 'trust.md rules that the two must not be collapsed into one number.'
            );
        }

        if (learned) {
            facts.lines.push(
                `${subject.name} is now a name this cultivator holds, learned by looking at it.`
            );
        }

        const execution = this.freeAction(run, 'investigate', facts);
        execution.calls = [
            {
                name: 'engine.readState',
                action: 'investigate',
                summary: `Resolved "${query}" to ${subject.kind} ${subject.id}. Read only: no time passed, nothing changed.`,
                ok: true
            },
            ...structureCalls(subject.structure)
        ];
        if (learned) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_surfaced',
                summary: `${subject.name} recorded as known (source: witnessed, at ${placeName(cultivator)}).`,
                ok: true
            });
        }
        return execution;
    }
};
