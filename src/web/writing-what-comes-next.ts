/**
 * Writing the next stage of a manual yourself, which nothing could do.
 *
 * `writeNextStage` in `engine/cultivation/acquisition.ts` is a complete
 * mechanism - the gate, the price, the stage row, the new ceiling - and it had
 * no caller anywhere in `src/` or `scripts/`. Nor did `precedentAt`, nor
 * `derivationYears`. Meanwhile `acquisition` offered the player
 * `{ route: 'derived', how: 'Writing what comes next yourself' }` and
 * `assessAcquisition` duly reported on it, so the game named a road and had no
 * verb that walked it. This is the second time that exact shape has been found
 * here; `furnace-technique.ts` was the first, and `AGENTS.md` records it.
 *
 * ── NOTHING HERE DECIDES ANYTHING THAT WAS NOT ALREADY DECIDED ───────────
 *
 * Every gate is a call into what already answers the question:
 *
 *   reachOf        WHAT THEY ARE HOLDING. Volumes and stages folded into one
 *                  ceiling, which is also what `rateTermsFor` cultivates against.
 *   canExtend      WHETHER THE ROAD PERMITS IT, and it is the only bar in the
 *                  game that a leaning cannot clear.
 *   precedentAt    WHAT STANDS AT THAT HEIGHT to compose against, counted over
 *                  the manual's OWN ROAD - see {@link precedentForTheRoadOf}.
 *   writeNextStage THE STAGE AND THE PRICE. A pure function of the run seed,
 *                  the cultivator, the manual and the road.
 *   writeStage     WHERE IT LIVES AFTERWARDS, and it grants the author the
 *                  stage in the same transaction.
 *
 * ── THE PRICE IS YEARS, AND ONLY YEARS ───────────────────────────────────
 *
 * No stones, no rank, no standing in a house, and no roll. The module header
 * this verb serves calls it the one door money cannot open and that is enforced
 * here by there being nothing to spend: the whole cost is the span handed to
 * `shortSkip`, which runs the food clock, the encounter window and the world
 * tick over it like any other stretch.
 *
 * The years BANK rather than having to be consecutive - see
 * {@link derivationDaysKey}. Nothing in this game sits nineteen years
 * uninterrupted, so all-or-nothing per sitting would have made the verb
 * unreachable in practice while looking correct in a unit test.
 */

import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { daoOf } from '../engine/cultivation/dao.js';
import {
    asShare,
    derivationShareOfALife,
    precedentAt,
    thinnessAt,
    writeNextStage,
    writtenTo,
    type ExtendableManual,
    type Precedent
} from '../engine/cultivation/acquisition.js';
import { MAX_ORDINAL, rankName, realmForOrdinal } from '../engine/cultivation/realms.js';
import { TECHNIQUES, capOf, getTechnique } from '../data/cultivation/techniques.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { MATCH_THRESHOLD, matchScore } from './entities.js';
import { derivationDaysKey } from './flag-keys.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { stagesHeldBy, stagesWrittenSince, writeStage } from './stages.js';
import { refused } from './tool-result-prose.js';
import { WRITING_FOCUS } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

type CatalogArt = (typeof TECHNIQUES)[number];

/** How far the catalog says an art carries, with the top of the ladder for an
 *  art that never stops - a book that does not stop stands at every height. */
function reachOfTheCatalogRow(art: CatalogArt): number {
    const cap = art.cap ?? capOf(art);
    return cap === null ? MAX_ORDINAL : cap;
}

/**
 * What stands at or above this rung ON THE MANUAL'S OWN ROAD.
 *
 * The count `precedentAt` was always meant to take, and the cut that survived
 * the one-kind-of-art ruling. Deriving is composing against what has been
 * written, and what has been written on the sword road is not precedent for
 * somebody extending an alchemy canon - so the road is the filter rather than
 * "is this a cultivation manual", which no longer picks anything out.
 *
 * The source manual itself can never be in the count: its ceiling is the rung
 * BELOW the target by construction.
 *
 * AND A BOOK ON NO ROAD IS COUNTED AGAINST EVERYTHING. Seventeen cultivation
 * manuals in the catalog name neither a road nor an element - the block-printed
 * primer everybody starts with is one - and narrowing to a road they do not have
 * gives zero, which `canExtend` reads as `no_precedent` and reports as *nobody
 * has been here*. That would be the engine blaming the world for a gap in a row.
 */
export function precedentForTheRoadOf(
    manual: { subjects?: readonly string[] | null; element?: string | null },
    targetOrdinal: number
): Precedent {
    const roads = new Set(manual.subjects ?? []);
    const element = manual.element ?? null;
    const onTheRoad = roads.size === 0 && element === null
        ? TECHNIQUES
        : TECHNIQUES.filter(art =>
            (art.subjects ?? []).some(road => roads.has(road))
            || (element !== null && art.element === element));
    return precedentAt(onTheRoad.map(reachOfTheCatalogRow), targetOrdinal);
}

/**
 * What a cultivator could do about each refusal.
 *
 * The house rule, and the derivation check already carries the fact - what it
 * does not carry is the move. A player told the meaning does not arrive has to
 * learn whether the obstacle is the road, the book or the years, because those
 * are three different lives.
 */
function whatWouldChangeIt(reason: string | null): string {
    switch (reason) {
        case 'no_matching_dao':
            return 'What would change it is comprehension, and comprehension comes from what '
                + 'happens to a person. Go and have something happen to you on this road.';
        case 'leaning_only':
            return 'What would change it is depth on the road you are already on. A leaning '
                + 'reads; only somebody who has made the road their own can say where it goes '
                + 'next. Nothing about this book or these years moves that.';
        case 'wrong_dao':
            return 'What would change it is a different book. Extend one written on the road '
                + 'you actually walked; no depth on this road ever produces the other.';
        case 'not_extendable':
            return 'What would change it is nothing you can do to this book. Another manual on '
                + 'the same road can be carried further.';
        case 'nothing_above':
            return 'What would change it is nothing. There is no rung above this one to write '
                + 'for.';
        case 'no_precedent':
            return 'What would change it is somebody standing at that height first, on this '
                + 'road, and writing something down. Until then there is nothing to compose '
                + 'against.';
        default:
            return 'What would change it is stated above.';
    }
}

export const derivationVerbs = {
    /**
     * Write the continuation of a manual you already practise.
     *
     * Refuses wherever the act is incoherent, and every refusal names the fact
     * that would change the answer. Where it is coherent the years are spent
     * through the ordinary skip, the stage is written onto the SOURCE manual -
     * it does not mint a second book - and the author is granted it.
     */
    async writeWhatComesNext(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        named: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();

        const held = cultivator.knownTechniques
            .map(id => getTechnique(id))
            .filter((art): art is NonNullable<typeof art> => !!art);

        if (held.length === 0) {
            return refused('engine.writeNextStage', 'derive', factsForRefusal(
                'There is no book to carry further.',
                'Writing the continuation of a method means writing the continuation of a '
                + 'method. Without one there is nothing to continue, and what you would be '
                + 'doing is founding a road rather than extending one.',
                `derive: no art known by ${cultivator.id}. Nothing spent.`
            ));
        }

        // THE SAME PICKER `acquisition` USES, so the sentence that asks how a
        // book goes further and the sentence that carries it further land on
        // the same book. A second way of choosing would let the read report on
        // one manual and the act extend another.
        const wanted = (named ?? '').trim();
        const byName = wanted.length >= 3
            ? held.find(art => matchScore(wanted, art.name) > MATCH_THRESHOLD)
            : undefined;
        const stalled = held
            .map(art => ({ art, reach: this.reachOf(cultivator, art) }))
            .filter(row => row.reach.cap !== null && cultivator.realmOrdinal >= row.reach.cap)
            .sort((a, b) => (b.reach.cap ?? 0) - (a.reach.cap ?? 0))[0];
        const manual = byName ?? stalled?.art ?? held[0];

        if (wanted.length >= 3 && !byName) {
            return refused('engine.writeNextStage', 'derive', factsForRefusal(
                `You do not practise anything called ${wanted}.`,
                'A continuation is written out of a method somebody has walked, so the only '
                + `books on the table are the ones already in you: ${held.map(a => a.name).join(', ')}.`,
                `derive: "${wanted}" matched none of ${held.map(a => a.id).join(', ')} above `
                + `${MATCH_THRESHOLD}. Nothing spent.`
            ));
        }

        const reach = this.reachOf(cultivator, manual);

        // A BOOK YOU CANNOT READ TO THE END HAS NO END TO WRITE PAST.
        if (reach.condition !== 'complete') {
            return refused('engine.effectiveCapOf', 'derive', factsForRefusal(
                `${manual.name} is not whole in your hands.`,
                `${reach.line} What comes after the last page cannot be written by somebody `
                + 'who has not reached it. Find what is missing first.',
                `derive: ${manual.id} condition=${reach.condition}, `
                + `${reach.volumesHeld}/${reach.volumesTotal} volumes, missing `
                + `${reach.missing.join(', ') || 'none'}. Nothing spent.`
            ));
        }

        const alreadyWritten = stagesWrittenSince(this.repos, manual.id);
        const mine = stagesHeldBy(this.repos, cultivator.id, manual.id);
        if (mine < alreadyWritten) {
            const ahead = writtenTo(
                { cap: manual.cap ?? capOf(manual) }, alreadyWritten
            );
            return refused('engine.writeNextStage', 'derive', factsForRefusal(
                `${manual.name} already goes further than you do.`,
                `Somebody has written it as far as ${ahead === null ? 'the top of the ladder' : rankName(ahead)}`
                + `, and you stand ${alreadyWritten - mine} stage`
                + `${alreadyWritten - mine === 1 ? '' : 's'} short of that. What you would be `
                + 'writing exists. What would change it is being taught what is already there, '
                + 'or reading a copy of it.',
                `derive: ${manual.id} has ${alreadyWritten} stage(s) written since the catalog `
                + `and ${cultivator.id} stands on ${mine}. Nothing spent.`
            ));
        }

        const catalogCap = manual.cap ?? capOf(manual);
        const source: ExtendableManual = {
            id: manual.id,
            name: manual.name,
            requiredOrdinal: manual.requiredOrdinal,
            cap: catalogCap,
            volumes: manual.volumes ?? null,
            grade: manual.grade,
            element: manual.element ?? null,
            subjects: manual.subjects ?? [],
            category: manual.category ?? null,
            notExtendableReason: manual.notDerivableReason ?? null
        };

        const reached = writtenTo(source, mine);
        // The rung the stage would carry a reader to, which is also the rung the
        // work is priced against. `writeNextStage` refuses a manual that has
        // nowhere above it, so this is only a pointer for the precedent count.
        const target = Math.min(MAX_ORDINAL, (reached ?? MAX_ORDINAL) + 1);
        const precedent = precedentForTheRoadOf(source, target);
        const dao = daoOf(cultivator.insights ?? []);

        const result = writeNextStage({
            runSeed: run.seed,
            cultivatorId: cultivator.id,
            source,
            dao,
            precedent,
            stagesWrittenSince: mine
        });

        if (!result.written) {
            return refused('engine.writeNextStage', 'derive', factsForRefusal(
                `${manual.name} stops where it stops, and you cannot write past it.`,
                `${result.line} ${whatWouldChangeIt(result.check.reason)}`,
                `derive: canExtend refused ${manual.id} on ${result.check.reason} - standing `
                + `${result.check.heldStanding} against ${result.check.requiredStanding}, `
                + `${precedent.artsAtOrAbove} art(s) on this road at or above `
                + `${rankName(target)}. Nothing spent.`
            ));
        }

        const years = result.years;
        const days = Math.max(1, Math.round(years * DAYS_PER_YEAR));
        const share = derivationShareOfALife(precedent, result.newCap);

        // WHAT IS ALREADY IN IT. See {@link derivationDaysKey}: no stretch in
        // this game survives nineteen years uninterrupted, so the work is a
        // manuscript somebody goes back to rather than one sitting.
        const key = derivationDaysKey(manual.id);
        const alreadyIn = Math.max(0, Number(readFlag(this.db, cultivator.id, key) ?? 0) || 0);
        const outstanding = Math.max(1, days - alreadyIn);

        const spent = await this.shortSkip(
            run, cultivator, ambient, WRITING_FOCUS,
            `Writing what comes after ${manual.name}`, outstanding, 'seclusion'
        );

        // A STAGE IS A WHOLE UNIT OF METHOD OR IT IS NOTES, which is the same
        // rule a lesson cut short keeps - and it is not the same as demanding
        // the years be consecutive. `daysActuallySpent` cuts every stretch at
        // its first encounter: measured on a played run, the first attempt at
        // this manual lived 450 days of 6,935. All-or-nothing per sitting made
        // the verb unreachable in practice, so the days bank and the stage
        // lands when they are all in.
        const lived = spent.timeSkip?.simulatedDays ?? outstanding;
        const banked = alreadyIn + lived;
        if (banked < days) {
            writeFlag(this.db, cultivator.id, key, String(banked));
            const facts = factsForToolResult(
                `${manual.name} stops where it stopped, and the work is not finished.`,
                [
                    `The stage wants ${years} years and ${Math.round(banked / DAYS_PER_YEAR)} of `
                    + `them are in it. ${manual.name} still ends at `
                    + `${reached === null ? 'nowhere' : rankName(reached)}. The notes keep; `
                    + 'going back to them is how it gets finished.',
                    ...spent.facts.lines
                ]
            );
            facts.structure.push(
                `derive: ${lived} of ${outstanding} outstanding day(s) lived; ${banked} of `
                + `${days} banked against ${manual.id}. No stage written; the ceiling is `
                + 'unchanged.'
            );
            return {
                facts,
                events: spent.events,
                timeSkip: spent.timeSkip,
                breakthrough: null,
                outcome: 'executed',
                calls: [
                    {
                        name: 'web.derivationDays',
                        action: 'derive',
                        summary:
                            `${banked} of ${days} day(s) are in the next stage of ${manual.id}. `
                            + 'Nothing written yet.',
                        ok: false
                    },
                    ...spent.calls
                ]
            };
        }

        // The manuscript is finished, so the banked days go with it.
        writeFlag(this.db, cultivator.id, key, '0');

        // ── AND THE MANUAL GOES ONE RUNG FURTHER ─────────────────────────
        //
        // One write, and it is the manual's rather than a new row: `writeStage`
        // appends the stage and grants the author it in the same transaction,
        // so the ceiling `rateTermsFor` reads is higher from the next turn on
        // and survives a reload, because it is in SQLite rather than in a
        // field on this object.
        const written = writeStage(this.repos, {
            manualId: manual.id,
            authorId: cultivator.id,
            // THE DAY THE STRETCH ENDED, off the world clock the skip has just
            // moved. `run.elapsedDays` is the same clock plus the run's start day
            // and is what answers where there is no world loaded at all.
            onDay: Math.floor(this.atHand?.currentDay ?? run.elapsedDays + days),
            opacity: result.stage.opacity
        });

        const calls: ToolCallRecord[] = [
            {
                name: 'engine.precedentAt',
                action: 'derive',
                summary:
                    `${precedent.artsAtOrAbove} art(s) on this road reach ${rankName(target)}; `
                    + `thinness ${thinnessAt(precedent).toFixed(2)}.`,
                ok: true
            },
            {
                name: 'engine.writeNextStage',
                action: 'derive',
                summary:
                    `stage ${written.stageNumber} of ${manual.id}, opacity `
                    + `${written.opacity.toFixed(2)}: cap `
                    + `${reached === null ? 'uncapped' : reached} -> ${result.newCap}. `
                    + `${years} year(s), ${asShare(share)} of the `
                    + `${realmForOrdinal(result.newCap).lifespanYears} years `
                    + `${rankName(result.newCap)} grants.`,
                ok: true
            },
            {
                name: 'web.writeStage',
                action: 'derive',
                summary:
                    `technique_stages(${manual.id}, ${written.stageNumber}) written by `
                    + `${cultivator.id} on day ${written.writtenOnDay}; cultivator_stages moved `
                    + `to ${stagesHeldBy(this.repos, cultivator.id, manual.id)}.`,
                ok: true
            },
            ...spent.calls
        ];

        const facts = factsForToolResult(
            `${manual.name} carries to ${rankName(result.newCap)} now, and nobody wrote it but you.`,
            [result.line, ...spent.facts.lines]
        );
        facts.structure.push(
            `derive: ${manual.id} stage ${written.stageNumber} written; effective cap for `
            + `${cultivator.id} is ${result.newCap}. ${days} day(s) spent through shortSkip.`
        );

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    }
};
