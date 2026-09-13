/**
 * A report brought, weighed, and a sentence handed down. Played, no model.
 *
 * Run:  npx tsx scripts/probe-a-room-hands-something-down.ts
 */

import { makeGameInWorld } from '../tests/web/harness.js';
import { SECTS } from '../src/data/cultivation/index.js';
import { getMembersOf } from '../src/data/cultivation/members.js';
import { createObligation } from '../src/engine/social/grudges.js';
import { writeOneObligation, ledgerAbout } from '../src/storage/repos/obligation.repo.js';
import { AGAINST_THEIR_OWN } from '../src/engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { complaintsBroughtTo } from '../src/web/false-decree-reports.js';

const HOUSE = SECTS
    .filter(s => s.recruits && s.alignment === 'righteous')
    .reduce((best, s) =>
        s.admissionOrdinal < best.admissionOrdinal
        || (s.admissionOrdinal === best.admissionOrdinal && s.id < best.id) ? s : best);

const line = (s = '') => console.log(s);

async function main(): Promise<void> {
    const harness = await makeGameInWorld({
        seed: 'hands-down-probe', worldSeed: 'hands-down-w'
    }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 21 WHERE id = ?').run(cultivator.id);
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, HOUSE.ranks.length - 2);

    const other = getMembersOf(HOUSE.id).find(m => m.rankIndex === 0) ?? getMembersOf(HOUSE.id)[0];
    const me = harness.repos.cultivators.getById(cultivator.id)!;
    harness.repos.cultivators.create({
        ...me, id: other.id, name: other.name, kind: 'npc', spiritStones: 4000
    });
    harness.repos.sects.addMember(HOUSE.id, other.id, 0);
    harness.repos.sects.addContribution(HOUSE.id, other.id, 2000);

    const what = 'they gave an order in the house\'s name that was not theirs to give';
    writeOneObligation(harness.db, createObligation({
        kind: 'grudge', holderId: HOUSE.id, subjectId: other.id, cause: 'betrayal',
        severity: 'serious', onDay: 0,
        description: `${what}. A witness took it to the room complaints go to.`,
        participants: [HOUSE.id],
        tags: [AGAINST_THEIR_OWN, 'house_does:questioned_about_the_source']
    }));

    line(`HOUSE      ${HOUSE.name} (${HOUSE.alignment})`);
    line(`THE ROOM   held by Wen Shu, rank ${HOUSE.ranks[HOUSE.ranks.length - 2]}`);
    line(`IN FRONT   ${other.name}, ${complaintsBroughtTo(harness.repos, HOUSE.id).length} open`);
    line(`HOLDING    ${harness.repos.sects.getMembership(other.id)!.contribution} contribution, `
        + `${harness.repos.cultivators.getById(other.id)!.spiritStones} stones`);

    for (const said of ['what has been brought to me', `I uphold the complaint against ${other.name}`]) {
        line();
        line('> ' + said);
        const turn = await harness.game.act(said);
        line();
        line((turn.narration ?? '(nothing)').trim());
        for (const row of (turn.facts?.structure ?? []) as string[]) line('    [' + row + ']');
    }

    line();
    line(`AFTER      ${harness.repos.sects.getMembership(other.id)!.contribution} contribution, `
        + `${harness.repos.cultivators.getById(other.id)!.spiritStones} stones`);
    for (const row of ledgerAbout(harness.db as never, other.id)) {
        line(`   ${row.kind} ${row.status} [${row.tags.join(', ')}] ${row.description}`);
    }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
