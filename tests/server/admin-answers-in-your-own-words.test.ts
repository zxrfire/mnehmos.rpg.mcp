/**
 * ADMIN, addressed the way somebody actually addresses it.
 *
 * Five real sessions were refused by this surface and only one of them was a
 * missing capability. Two were phrasing, one was a missing item type, and one
 * was an error message that pointed at nothing:
 *
 *   ADMIN spawn NPC tribulation transcender in front of me
 *   ADMIN I run into a 45 weapon
 *   ADMIN I am ordinal 44
 *   ADMIN SPAWN A CORE FORMATION GIRL
 *   ADMIN grant_item itemId=<any artifact>
 *
 * Each is a case below. What is under test is NOT that a sentence produces
 * prose - it is that the sentence reaches an EXISTING action with the arguments
 * it names, and that nothing here can reach an outcome. `docs/admin.md` holds
 * the mapping these assert.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb } from '../../src/storage/index.js';
import {
    adminResult,
    handleAdminManage,
    parseAdminCommand
} from '../../src/server/consolidated/admin-manage.js';
import { readAdminSentence, isSentenceRefusal, ordinalNamed } from '../../src/server/consolidated/admin-said-as-a-sentence.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import {
    carriedArtifact,
    ensureCultivationDb,
    listPouch
} from '../../src/server/consolidated/cultivation-support.js';
import { getArtifact } from '../../src/data/cultivation/artifacts.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { othersPresent } from '../../src/web/hearsay.js';
import { OBJECT_CEILING_BELOW_THE_LID } from '../../src/engine/cultivation/realms.js';

const admin = async (args: Record<string, unknown>) => (await adminResult(args)) as any;

/** Whatever a typed ADMIN line resolves to, routed exactly as `game.ts` routes it. */
async function typed(line: string) {
    const parsed = parseAdminCommand(line);
    return admin({ ...parsed.args, action: parsed.action });
}

async function newRun() {
    const created = await handleCultivationManage(
        { action: 'create_cultivator', name: 'Shen Yue', seed: 'admin-words', location: 'Sweptground' },
        { sessionId: 'test' }
    );
    const text = created.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return JSON.parse(match ? match[1] : text);
}

describe('ADMIN answers in the words it was addressed in', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
        process.env.ADMIN_MODE = 'true';
    });

    afterEach(() => {
        delete process.env.ADMIN_MODE;
        closeDb();
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('a rung may be named rather than numbered', () => {
        it('reads a realm name as the first rung of its band', () => {
            expect(ordinalNamed('Core Formation')?.ordinal).toBe(17);
            expect(ordinalNamed('tribulation transcender')?.ordinal).toBe(41);
        });

        it('reads a bare number, and a sub-rank exactly', () => {
            expect(ordinalNamed('a 45 weapon')?.ordinal).toBe(45);
            expect(ordinalNamed('Core Formation Mid')?.ordinal).toBe(18);
        });

        it('reads the initials the design owner actually types', () => {
            // "TT" is what they call Tribulation Transcendence throughout, and
            // `ADMIN I AM TT` was refused. Derived from REALM_TIERS, never
            // tabulated, so a renamed realm abbreviates correctly on its own.
            expect(ordinalNamed('I AM TT')?.ordinal).toBe(41);
            expect(ordinalNamed('spawn a CF cultivator')?.ordinal).toBe(17);
        });

        it('never abbreviates Immortal to "I", which is in every sentence', () => {
            // A one-letter initial would swallow the commonest pronoun there
            // is. The two-letter minimum is what stops it, and this is the
            // case that minimum exists for.
            expect(ordinalNamed('I want something')).toBeNull();
        });

        it('is accepted by the SCHEMA, not only by the sentence layer', async () => {
            await newRun();
            // The MCP path: a model calls the tool with a realm name because
            // that is what the game prints everywhere. It used to be rejected
            // with "expected number, received string".
            const result = await admin({ action: 'set_realm', ordinal: 'Core Formation' });
            expect(result.error).toBeUndefined();
            expect(result.toOrdinal).toBe(17);
        });

        it('refuses a name the ladder does not have, rather than guessing a rung', async () => {
            await newRun();
            const result = await admin({ action: 'set_realm', ordinal: 'Chief Wizard' });
            expect(result.error).toBeDefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('the five sessions that were refused', () => {
        it('"spawn NPC tribulation transcender in front of me" makes a real person at 41', async () => {
            await newRun();
            const result = await typed('spawn NPC tribulation transcender in front of me');
            expect(result.error).toBeUndefined();
            expect(result.spawned).toBe(true);
            expect(result.opponent.realmOrdinal ?? result.gateLifted.opponentOrdinal).toBe(41);
            // Half a realm name must not survive into what the world calls them.
            expect(String(result.opponent.name).toLowerCase()).not.toBe('tribulation');
        });

        it('"SPAWN A CORE FORMATION GIRL" reaches spawn_encounter at 17', async () => {
            await newRun();
            const result = await typed('SPAWN A CORE FORMATION GIRL');
            expect(result.error).toBeUndefined();
            expect(result.gateLifted.opponentOrdinal).toBe(17);
            // The engine has no sex field, so the description reaches the one
            // place it honestly can - the name - and nothing else differs.
            expect(result.opponent.name).toContain('girl');
        });

        it('"I am ordinal 44" reaches set_realm, and only through advanceRealm', async () => {
            await newRun();
            const result = await typed('I am ordinal 44');
            expect(result.error).toBeUndefined();
            expect(result.toOrdinal).toBe(44);
            expect(result.progressCleared).toBe(true);
            expect(result.peakOrdinal).toBe(44);
        });

        it('"I run into a 45 weapon" puts a real catalogued object in the real pouch', async () => {
            const created = await newRun();
            const result = await typed('I run into a 45 weapon');
            expect(result.error).toBeUndefined();
            expect(result.item.kind).toBe('artifact');
            expect(result.item.ordinal).toBe(45);
            // Not invented: it is a row in the catalog, by its own id.
            expect(getArtifact(result.item.id)).toBeDefined();

            const repos = ensureCultivationDb();
            const held = carriedArtifact(repos.db, created.cultivator.id);
            expect(held?.id).toBe(result.item.id);
            expect(held?.power).toBe(45);
        });

        it('grants an artifact by its catalog name too', async () => {
            await newRun();
            const result = await admin({ action: 'grant_item', name: 'The Standing Edge' });
            expect(result.error).toBeUndefined();
            expect(result.item.id).toBe('artifact-the-standing-edge');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('a rated object is singular, and stays out of counted stock', () => {
        it('grants exactly one however many were asked for', async () => {
            await newRun();
            const result = await admin({ action: 'grant_item', ordinal: 45, kind: 'artifact', quantity: 99 });
            expect(result.quantity).toBe(1);
        });

        it('does not appear in the counted pouch, which every reader treats as pills and herbs', async () => {
            const created = await newRun();
            await admin({ action: 'grant_item', ordinal: 45, kind: 'artifact' });
            // The regression this guards: widening PouchItemKind without
            // widening this made `projectPouch` stamp the artifact `herb` and
            // the player's own pouch listing printed
            // "Herbs: 1 x hollow-unwritten-length".
            expect(listPouch(ensureCultivationDb().db, created.cultivator.id)).toHaveLength(0);
        });

        it('reports that the world says an object above the ceiling cannot stay - and that nothing enforces it', async () => {
            await newRun();
            const result = await admin({ action: 'grant_item', ordinal: 46, kind: 'artifact' });
            expect(result.item.ordinal).toBeGreaterThan(OBJECT_CEILING_BELOW_THE_LID);
            // ADMIN must never simulate a law to make a demonstration work. It
            // arranges the situation and says plainly that the departure rule
            // has no caller for a player-held object.
            expect(result.aboveTheCeiling).not.toBeNull();
            expect(result.aboveTheCeiling.whatActuallyHappens).toContain('evaluateLayerCrossing');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('what is inferred is printed back, and ambiguity refuses', () => {
        it('carries the equivalent key=value line', () => {
            const parsed = parseAdminCommand('I run into a 45 weapon');
            expect(parsed.action).toBe('grant_item');
            const rider = parsed.args['__inferredFromASentence'];
            expect(typeof rider).toBe('string');
            const inferred = JSON.parse(rider as string);
            expect(inferred.asTyped).toContain('grant_item');
            expect(inferred.asTyped).toContain('ordinal=45');
        });

        it('lets an explicit key=value beat the inference', () => {
            const parsed = parseAdminCommand('spawn an npc ordinal=30');
            expect(parsed.action).toBe('spawn_encounter');
            expect(parsed.args.ordinal).toBe(30);
        });

        it('refuses a line naming two different kinds of thing rather than picking one', () => {
            const reading = readAdminSentence('give me a weapon and a pill');
            expect(isSentenceRefusal(reading)).toBe(true);
            if (isSentenceRefusal(reading)) expect(reading.reason).toBe('two_subjects');
        });

        it('answers a line that names no capability with the capability sheet', async () => {
            await newRun();
            const result = await typed('make my breakthrough succeed');
            expect(result.error).toBe('admin_sentence_unreadable');
            // A refusal must name what would work.
            expect(Array.isArray(result.canDo)).toBe(true);
            expect(result.canDo.length).toBeGreaterThan(0);
            expect(JSON.stringify(result.cannotDo)).toContain('force_success');
        });

        it('leaves a single unknown word to the fuzzy matcher, which is good at typos', async () => {
            await newRun();
            const parsed = parseAdminCommand('rostr');
            expect(parsed.action).toBe('rostr');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('a spawned person exists in the played game', () => {
        it('is nameable, which is what makes who-is-here mention them at all', async () => {
            const created = await newRun();
            const result = await admin({ action: 'spawn_encounter', ordinal: 19 });
            expect(result.error).toBeUndefined();

            // The defect: the row was written correctly, at the player's exact
            // location, alive - and `company()` in game.ts splits the people
            // present on whether the player holds a knowledge record, so an
            // opponent nobody had heard of rendered as an anonymous band
            // reading. `spawn_site` had solved this for places already.
            const gate = new KnowledgeGate(ensureCultivationDb().db);
            const opponentId = result.opponent.id;
            expect(gate.isAwareOf(created.cultivator.id, 'cultivator', opponentId)).toBe(true);
            expect(gate.canPointAt(created.cultivator.id, 'cultivator', opponentId)).toBe(true);
        });

        it('stands where the player stands, so the co-location read finds them', async () => {
            const created = await newRun();
            await admin({ action: 'spawn_encounter', ordinal: 19 });
            const repos = ensureCultivationDb();
            const pc = repos.cultivators.getById(created.cultivator.id)!;
            const here = othersPresent(repos, pc, null);
            expect(here.some(row => row.realmOrdinal === 19)).toBe(true);
        });

        it('carries the hostility on the record, and writes no grudge for it', async () => {
            await newRun();
            const result = await admin({ action: 'spawn_encounter', ordinal: 19 });
            expect(result.disposition).toBe('hostile');
            // Answered when asked, not volunteered - and said so rather than
            // left to be discovered.
            expect(result.dispositionReaches.notSaid).toContain('no grudge was written');
        });

        it('names the ratio in words instead of printing twelve decimal places', async () => {
            await newRun();
            const result = await admin({ action: 'spawn_encounter', ordinal: 19 });
            // 0.000244140625 was what this printed. The figure is worth keeping
            // and the precision is worth none of it.
            expect(String(result.gateLifted.powerRatio)).not.toMatch(/\d{6}/);
            expect(result.gateLifted.howTheyCompare).toContain('worth about');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('a pair with the equals sign left out', () => {
        it('reads ENCOUNTER ORDINAL 19, which named the action and lost the rung', async () => {
            await newRun();
            // The parser leaves the leading word as typed - the ROUTER resolves
            // `encounter` to `spawn_encounter` through its alias table - so the
            // thing to assert here is the argument that was being dropped, and
            // then that the whole line really does spawn somebody.
            const parsed = parseAdminCommand('ENCOUNTER ORDINAL 19');
            expect(parsed.args.ordinal).toBe(19);

            const result = await typed('ENCOUNTER ORDINAL 19');
            expect(result.error).toBeUndefined();
            expect(result.gateLifted.opponentOrdinal).toBe(19);
        });

        it('runs a value to the NEXT field, so a multi-word value needs no quoting', () => {
            const parsed = parseAdminCommand('spawn_encounter name Yun Shizhen disposition wary');
            expect(parsed.args.name).toBe('Yun Shizhen');
            expect(parsed.args.disposition).toBe('wary');
        });

        it('does not let the field names become the name', () => {
            // `grant_item ordinal 45 kind artifact` came out as
            // `name=grant_item ordinal kind` - the field names themselves in
            // the field the world calls somebody by.
            const parsed = parseAdminCommand('grant_item ordinal 45 kind artifact');
            expect(parsed.args.ordinal).toBe(45);
            expect(parsed.args.kind).toBe('artifact');
            expect(parsed.args.name).toBeUndefined();
        });

        it('lets an explicit key=value still win', () => {
            const parsed = parseAdminCommand('spawn_encounter ordinal 19 ordinal=30');
            expect(parsed.args.ordinal).toBe(30);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('the awareness gate, lifted wide', () => {
        it('makes every place nameable as ordinary knowledge rows', async () => {
            const created = await newRun();
            const before = await admin({ action: 'grant_knowledge', kind: 'place' });
            expect(before.learned).toBeGreaterThan(0);

            const gate = new KnowledgeGate(ensureCultivationDb().db);
            expect(gate.isAwareOf(created.cultivator.id, 'place', 'Nine Peaks')).toBe(true);

            // A floor, not a replacement: calling twice writes nothing.
            const again = await admin({ action: 'grant_knowledge', kind: 'place' });
            expect(again.learned).toBe(0);
        });

        it('makes every house nameable, and lifts nothing else', async () => {
            const created = await newRun();
            const result = await admin({ action: 'grant_knowledge', kind: 'sect' });
            expect(result.learned).toBeGreaterThan(0);
            const gate = new KnowledgeGate(ensureCultivationDb().db);
            expect(gate.isAwareOf(created.cultivator.id, 'sect', SECTS[0].id)).toBe(true);
            // The whole point: a name is not an admission.
            expect(result.note).toContain('does not open its door');
        });

        it('takes one by name, and refuses a name nothing answers to', async () => {
            await newRun();
            const one = await admin({ action: 'grant_knowledge', name: 'Nine Peaks' });
            expect(one.error).toBeUndefined();
            expect(one.offered).toBe(1);

            const miss = await admin({ action: 'grant_knowledge', name: 'Atlantis' });
            expect(miss.error).toBe('nothing_of_that_name');
            expect(miss.hint).toContain('does not author');
        });

        it('is reached by the words the owner actually used', async () => {
            // "give" is an alias of grant_item, so this was refused with
            // "nothing in the pill, herb or artifact catalogs answers to
            // 'me knowledge of every sect'". An alias is not a named action:
            // the operator used an ordinary verb and the NOUN says what they
            // meant, so a generic verb yields to an explicit subject.
            const sects = parseAdminCommand('give me knowledge of every sect');
            expect(sects.action).toBe('grant_knowledge');
            expect(sects.args.kind).toBe('sect');

            const places = parseAdminCommand('I know every location');
            expect(places.action).toBe('grant_knowledge');
            expect(places.args.kind).toBe('place');
        });

        it('does not let that rule steal a sentence from grant_item', () => {
            // The other half of the same rule: "give me a 45 weapon" still
            // means an object, because the noun still decides.
            const parsed = parseAdminCommand('give me a 45 weapon');
            expect(parsed.action).toBe('grant_item');
            expect(parsed.args.ordinal).toBe(45);
        });

        it('is audited, so the ledger keeps excluding the run', async () => {
            await newRun();
            await admin({ action: 'grant_knowledge', kind: 'sect' });
            const trail = await admin({ action: 'audit_log' });
            expect(trail.runFlagged).toBe(true);
            expect(trail.entries.some((e: any) => e.action.endsWith('grant_knowledge'))).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('help, and refusals that name what would work', () => {
        it('lists every action with what it does and what it takes', async () => {
            const result = await admin({ action: 'help' });
            expect(result.help).toBe(true);
            expect(result.purpose).toContain('set preconditions');
            expect(result.documentation).toBe('docs/admin.md');
            const spawn = result.actions.find((a: any) => a.action === 'spawn_encounter');
            expect(spawn.takes).toContain('ordinal');
            expect(spawn.does).toContain('PERSON');
        });

        it('never offers an outcome-setting action, and says where each honest route is', async () => {
            const result = await admin({ action: 'help' });
            const sheet = JSON.stringify(result).toLowerCase();
            expect(sheet).not.toContain('set_hp"');
            expect(sheet).not.toContain('force_success"');
            const asked = result.cannotDo.map((e: any) => e.asked).join(' ');
            expect(asked).toContain('set_hp');
            for (const entry of result.cannotDo) expect(entry.instead.length).toBeGreaterThan(20);
        });

        it('says which arguments an action takes when one is missing', async () => {
            await newRun();
            const result = await admin({ action: 'spawn_encounter' });
            expect(result.error).toBe('validation_error');
            expect(result.message).toContain('ordinal');
            expect(result.accepts).toContain('ordinal');
        });

        it('refuses advance_days with no span, and names the lines that work', async () => {
            await newRun();
            const result = await admin({ action: 'advance_days' });
            expect(result.error).toBe('no_span_given');
            expect(result.hint).toContain('rations=');
        });

        it('splits into sections, because all of it at once is a wall', async () => {
            const parsed = parseAdminCommand('help refusals');
            expect(parsed.action).toBe('help');
            // Prose after a NAMED action is that action's main argument. Without
            // this, "help refusals" reached help with no arguments at all and
            // printed the default sheet, ignoring the word that was typed.
            expect(parsed.args.about).toBe('refusals');
            const result = await admin({ ...parsed.args, action: parsed.action });
            expect(result.section).toBe('refusals');
        });

        it('renders as plain text - no markup survives the surface it lands on', async () => {
            // `web/app.js` HTML-escapes a narrator entry and splits it on BLANK
            // LINES. There is no markdown renderer on that path, so asterisks,
            // backticks, pipes and "- " bullets arrive as literal characters.
            const response = await handleAdminManage({ action: 'help' });
            const text = response.content[0].text;
            expect(text).not.toMatch(/\*\*/);
            expect(text).not.toContain('`');
            expect(text).not.toContain('|');
            expect(text).not.toMatch(/^- /m);
            // And a blank line really is the only separator, so anything meant
            // to stand alone has one around it.
            expect(text).toContain('\n\n');
        });

        it('renders a refusal as plain text too, and does not print the list twice', async () => {
            await newRun();
            const response = await handleAdminManage({ action: 'blorp' });
            const text = response.content[0].text;
            expect(text).not.toMatch(/\*\*/);
            expect(text).not.toContain('`');
            expect(text.match(/The actions are:/g) ?? []).toHaveLength(1);
            // "validActions" is a JSON field name, not something anybody types.
            expect(text).not.toContain('validActions');
        });

        it('is off entirely without ADMIN_MODE, help included', async () => {
            delete process.env.ADMIN_MODE;
            const result = await admin({ action: 'help' });
            expect(result.error).toBe('admin_mode_disabled');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('the law does not move', () => {
        it('flags the run and audits the artifact grant, so the ledger can exclude it', async () => {
            await newRun();
            await typed('I run into a 45 weapon');
            const trail = await admin({ action: 'audit_log' });
            expect(trail.runFlagged).toBe(true);
            const grant = trail.entries.find((e: any) => e.action.endsWith('grant_item'));
            expect(grant).toBeDefined();
            expect(grant.details.kind).toBe('artifact');
        });

        it('has no action anywhere that takes an outcome as input', async () => {
            const result = await admin({ action: 'help' });
            for (const name of result.actions.map((a: any) => a.action)) {
                expect(name).not.toMatch(/^(set_hp|revive|kill|force|declare|heal)/);
            }
        });
    });
});
