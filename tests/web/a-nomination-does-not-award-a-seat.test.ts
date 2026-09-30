/**
 * The retired nomination producer claimed that a seat went to the asker without
 * an appointment or any membership change. The live petition instead explains
 * which houses' names are read and refuses the application. It creates neither
 * a membership nor a debt or grudge for an outcome that never happened.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { thePostings, whoCouldNominateInto } from '../../src/engine/social-leverage/who-can-put-your-name-up-for-a-posting';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

describe('a nomination is not an awarded seat', () => {
    it('explains the road without writing an appointment or its fallout', async () => {
        const posting = thePostings()[0]!;
        const carrier = whoCouldNominateInto(posting.bodyId).find(c => c.howFar === 'read')!;
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ action: 'petition', target: carrier.nominatorName, topic: posting.bodyName })],
            narrations: ['The opening.', 'The answer.']
        });
        const { game, repos, db } = await makeGameInWorld({
            worldSeed: 'nomination-is-not-an-appointment', seed: 'nomination-request', provider
        });
        await game.newRun('Aspirant');
        const { cultivator } = game.state();
        game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'sect', id: carrier.nominatorId, name: carrier.nominatorName,
            onDay: 0, sourceKind: 'told', stage: 'placed', statement: `${carrier.nominatorName} has been named.`
        });
        const before = ledgerAbout(db, cultivator.id);
        const membership = repos.sects.getMembership(cultivator.id);
        const result = await game.act(`I ask ${carrier.nominatorName} to nominate me for ${posting.bodyName}`);
        expect(result.toolCalls.some(call => call.name === 'engine.nomination' && !call.ok)).toBe(true);
        expect(result.toolCalls.find(call => call.name === 'engine.nomination')!.summary).toContain('no procedure');
        expect(repos.sects.getMembership(cultivator.id)).toEqual(membership);
        expect(ledgerAbout(db, cultivator.id)).toEqual(before);
    });
});
