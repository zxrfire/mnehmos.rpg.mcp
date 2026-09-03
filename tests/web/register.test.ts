/**
 * The Standing Register renders what the catalogs hold.
 *
 * The register is a VIEW, so nothing here checks a world fact - the data suites
 * own those. What this suite pins down is the class of failure the register has
 * actually had, three times: a catalog lands, the sheet keeps building and
 * keeps passing, and the new material is simply not on the page. A silent
 * omission looks exactly like a page that is working.
 *
 * So the assertions are of two kinds:
 *
 *   REACHABILITY   every row of every catalog the register claims to show is
 *                  reachable in the built structure and present in the HTML.
 *
 *   ARRANGEMENT    the few places where how the sheet arranges things is itself
 *                  a claim about the world, and getting it wrong would print
 *                  something untrue: the artifact catalog in power order with
 *                  no banding, and a court roster that is NOT sorted into a
 *                  ladder its offices do not form.
 */

import { describe, it, expect } from 'vitest';
import { buildRegister, renderRegisterHtml, type WorldRegister } from '../../src/web/register';
import { ARTIFACTS, artifactsOwnedBy } from '../../src/data/cultivation/artifacts';
import { MEMBERS } from '../../src/data/cultivation/members';
import {
    APEX_INSTITUTIONS,
    COURTS,
    getApexInstitution,
    idsForFaction,
    strongestOfficerOf,
    FACTION_PARENTAGE
} from '../../src/data/cultivation/hierarchy';
import { TECHNIQUES, compareGrades } from '../../src/data/cultivation/techniques';
import {
    SECTS,
    SECT_ANCESTRY,
    DAO_HOUSES,
    auditAncestralClaim,
    getDaoHouse,
    contestedClaimsOf,
    intakeRouteOf,
    sectThreat
} from '../../src/data/cultivation/sects';
import { glossaryTerms } from '../../src/web/register-glossary';

const reg: WorldRegister = buildRegister();
const html: string = renderRegisterHtml(reg);

/**
 * Strip tags, and put the entities back, so an assertion about text is not
 * defeated by the markup or the escaping between two words.
 *
 * The decode is not cosmetic. `esc` turns a double quote into `&quot;`, and the
 * moment an entry started quoting the catalog's own distinct sentence - the
 * House of the Bound Word cannot say "I promise" in conversation - every
 * assertion that the sentence reached the page failed on correct escaping.
 */
function text(source: string): string {
    return source
        .replace(/<[^>]*>/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&middot;/g, '·')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');
}

const flat = text(html);

/**
 * The page's prose with its navigation removed.
 *
 * A field longer than a short paragraph is rendered as a lead and a disclosure
 * holding the rest, so the sheet now has a summary label sitting between the
 * two halves of a sentence run. `flat` keeps that label, which is right for
 * anything asking what a reader sees - and wrong for anything asking whether a
 * catalog field reached the page, because the label breaks the field in two.
 * This view drops the summaries so a split field reads contiguously again.
 */
const flatProse = text(html.replace(/<summary[^>]*>[\s\S]*?<\/summary>/g, ''));

/**
 * Just the artifact table, by its own caption.
 *
 * The page now carries several tables whose first column is a bare number -
 * the artifacts by power, the arts by the rung they are written for - so any
 * assertion about "the rows with a numeric first column" has to say which
 * table it means or it silently starts counting a different one.
 */
function artifactTableHtml(): string {
    const start = html.indexOf('<caption>Every artifact in the world');
    expect(start, 'the artifact table caption has changed').toBeGreaterThan(-1);
    const end = html.indexOf('</table>', start);
    return html.slice(start, end);
}

describe('the artifact catalog', () => {
    it('carries every artifact in the world', () => {
        expect(reg.artifacts).toHaveLength(ARTIFACTS.length);
        expect(reg.counts.artifacts).toBe(ARTIFACTS.length);
        for (const a of ARTIFACTS) {
            expect(reg.artifacts.find(x => x.id === a.id), `${a.id} missing`).toBeDefined();
        }
    });

    it('renders every artifact, with its power, on the page', () => {
        for (const a of reg.artifacts) {
            expect(flat, `${a.id} not rendered`).toContain(a.name);
            expect(flat, `${a.id} has no description`).toContain(a.description.slice(0, 40));
        }
    });

    it('stays in power order, strongest first', () => {
        const powers = reg.artifacts.map(a => a.power);
        expect([...powers].sort((x, y) => y - x)).toEqual(powers);
    });

    it('draws the strongest and the weakest object as the same kind of row', () => {
        // The design claim this page exists to make. If the top of the catalog
        // ever gets its own block, its own table or its own class, the first
        // and last rows stop being comparable and the sheet has started
        // asserting a tier the engine does not have.
        const first = reg.artifacts[0];
        const last = reg.artifacts[reg.artifacts.length - 1];
        expect(first.power).toBeGreaterThan(last.power);

        // Scoped to the artifact table rather than swept off the whole page.
        // The arts sheet uses the same numeric first column, so an unscoped
        // sweep counts technique rows as artifact rows and the assertion stops
        // meaning anything it was written to mean.
        const rows = artifactTableHtml().match(/<tr[^>]*>\s*<td class="pw">\d+<\/td>[\s\S]*?<\/tr>/g) ?? [];
        expect(rows.length).toBe(reg.artifacts.length);

        const shape = (row: string): string[] =>
            (row.match(/<td class="([a-z]+)"/g) ?? []).map(m => m.replace(/<td class="|"/g, ''));
        expect(shape(rows[0])).toEqual(shape(rows[rows.length - 1]));
    });

    it('reads the making ceiling off the catalog instead of asserting one', () => {
        // Deliberately not "the ceiling is 41". It has already moved once under
        // this page - it was a wide numeric gap between 42 and 22, the band was
        // filled in, and the structural line turned out to be provenance rather
        // than arithmetic. What is pinned is the derivation: the break sits
        // exactly where sent-down stops and made-here starts, and where the two
        // interleave the sheet draws nothing.
        const madeHere = (i: number) => reg.artifacts[i].tags.includes('forged');
        const sentDown = (i: number) => reg.artifacts[i].tags.includes('immortal-made');
        const indices = reg.artifacts.map((_, i) => i);
        const firstMade = indices.find(madeHere) ?? -1;
        const partitions = firstMade > 0
            && indices.slice(0, firstMade).every(i => sentDown(i) && !madeHere(i))
            && indices.slice(firstMade).every(i => madeHere(i) && !sentDown(i));

        const ceiling = reg.artifactCeiling;
        expect(ceiling !== null).toBe(partitions);
        if (!ceiling) {
            expect(flat).toContain('The two provenances interleave');
            return;
        }
        expect(ceiling.breakAt).toBe(firstMade);
        expect(ceiling.madeHere).toBe(reg.artifacts[firstMade].power);
        expect(ceiling.weakestSentDown).toBe(reg.artifacts[firstMade - 1].power);
        expect(ceiling.weakestSentDown).toBeGreaterThan(ceiling.madeHere);
        expect(flat).toContain(`nothing made here passes ${ceiling.madeHere}`);
    });

    it('keeps owner and holder as separate facts', () => {
        // Three of the strongest objects sit in a vault their owner also is,
        // and four are on people. Collapsing the two columns would render both
        // situations as the same sentence.
        const carried = reg.artifacts.filter(a => a.possessorId !== null && !a.inVault);
        const vaulted = reg.artifacts.filter(a => a.inVault);
        expect(carried.length).toBeGreaterThan(0);
        expect(vaulted.length).toBeGreaterThan(0);
        for (const a of vaulted) expect(a.possessorId).toBe(a.ownerId);
    });

    it('resolves a holder who is a person to the person carrying it', () => {
        // A holder id is only ever the catalog's own id for a body, so a row
        // whose holder is on the roll must come back as that person and never
        // as the raw key. The four withdrawn Seats are the case that matters -
        // they carry the strongest objects anybody down here can reach - and
        // they are checked by NAME rather than by the shape of an id, because
        // an id shape is what the register used to resolve against and it went
        // on reading correctly while nothing in the world answered to it.
        const onTheRoll = reg.artifacts.filter(
            a => a.possessorId !== null && !a.inVault && MEMBERS.some(m => m.id === a.possessorId)
        );
        expect(onTheRoll.length).toBeGreaterThan(0);
        for (const a of onTheRoll) {
            const person = MEMBERS.find(m => m.id === a.possessorId)!;
            expect(a.possessorName, `${a.id} left an unresolved holder id`).toBe(person.name);
            expect(a.possessorOrdinal).toBe(person.realmOrdinal);
            expect(flat).toContain(a.possessorName);
        }
        expect(onTheRoll.filter(a => /Seat$/.test(a.possessorName))).toHaveLength(4);
    });

    it('says so when an owner id does not resolve, instead of dropping the row', () => {
        // An owned artifact whose owner has no entry is a fault in the catalog.
        // The sheet is allowed to have one; it is not allowed to hide it, and a
        // row that vanished from every faction page while still being counted
        // is the exact failure this assertion exists for.
        for (const a of reg.artifacts) {
            const owned = reg.dossiers.find(d => d.artifacts.some(x => x.id === a.id));
            expect(a.ownerLinkId, `${a.id}`).toBe(owned?.id ?? null);
            if (a.ownerId === null) expect(owned).toBeUndefined();
        }
    });

    it('lists a faction its own artifacts under its own entry', () => {
        for (const d of reg.dossiers) {
            expect(d.artifacts.map(a => a.id))
                .toEqual(artifactsOwnedBy(d.id).map(a => a.id));
        }
        expect(reg.dossiers.some(d => d.artifacts.length > 0)).toBe(true);
    });
});

describe('court rosters', () => {
    it('carries every officer of every court', () => {
        expect(reg.courts).toHaveLength(COURTS.length);
        expect(reg.counts.courtOfficers)
            .toBe(COURTS.reduce((n, c) => n + c.roster.length, 0));
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            expect(built.officers.map(o => o.id)).toEqual(court.roster.map(o => o.id));
            for (const o of court.roster) {
                expect(flat, `${o.id} not rendered`).toContain(o.name);
                expect(flat, `${o.id} office not rendered`).toContain(o.title);
            }
        }
    });

    it('prints both standings, because neither of them contains the other', () => {
        for (const court of reg.courts) {
            for (const o of court.officers) {
                expect(o.ordinal).toBeGreaterThan(0);
                expect(o.apexRank.length).toBeGreaterThan(0);
                expect(flat, `${o.id} apex standing not rendered`).toContain(o.apexRank);
            }
        }
    });

    it('does not sort the offices into a ladder they do not form', () => {
        // The Sill Courier stands a mark above the Assessor inside the Survey
        // and eight rungs below him on the realm ladder. An ordinal sort would
        // put her at the bottom of her own court and invent a chain of command.
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            const ordinals = built.officers.map(o => o.ordinal);
            expect(ordinals).toEqual(court.roster.map(o => o.realmOrdinal));
        }
        const descending = reg.courts.some(c => {
            const ord = c.officers.map(o => o.ordinal);
            return ord.length > 2 && ord.every((n, i) => i === 0 || ord[i - 1] >= n);
        });
        const sillOrder = reg.courts.find(c => c.id === 'court-third-sill')!.officers.map(o => o.ordinal);
        expect(descending || sillOrder.some((n, i) => i > 0 && n > sillOrder[i - 1])).toBe(true);
    });

    it('flags the one officer the court ordinal is naming', () => {
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            const flagged = built.officers.filter(o => o.answersForTheCourt);
            expect(flagged).toHaveLength(1);
            expect(flagged[0].id).toBe(strongestOfficerOf(court).id);
            expect(flagged[0].ordinal).toBe(court.powerOrdinal);
        }
    });

    it('names the person the high band used to print as an office', () => {
        for (const court of COURTS) {
            if (court.powerOrdinal < 36) continue;
            const holder = strongestOfficerOf(court);
            const row = reg.high.find(p => p.factionName === court.name && p.state === 'acting');
            expect(row, `${court.id} has no acting row`).toBeDefined();
            expect(row!.name).toBe(holder.name);
            expect(row!.named).toBe(true);
        }
    });

    it('renders the note on why each court offices are named as they are', () => {
        for (const court of COURTS) {
            expect(flat, `${court.id} officesNote missing`)
                .toContain(text(court.officesNote).slice(0, 60).trim());
        }
    });
});

describe('a court that changed patrons', () => {
    it('renders the transfer note wherever the catalog carries one', () => {
        const moved = COURTS.filter(c => c.transferNote);
        expect(moved.length, 'no court records a transfer').toBeGreaterThan(0);
        for (const court of moved) {
            const built = reg.courts.find(c => c.id === court.id)!;
            expect(built.transferNote).toBe(court.transferNote);
            expect(flat, `${court.id} transfer note not rendered`)
                .toContain(text(court.transferNote!).slice(0, 60).trim());
        }
    });

    it('leaves the field null on a court that has always answered to one apex', () => {
        for (const court of COURTS) {
            if (court.transferNote) continue;
            expect(reg.courts.find(c => c.id === court.id)!.transferNote).toBeNull();
        }
    });

    it('files each court under the apex it answers to now', () => {
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            expect(built.apexId).toBe(court.apexId);
            expect(built.apexName).not.toBe(court.apexId);
            expect(flat, `${court.id} patron not rendered`).toContain(built.apexName);
        }
    });
});

describe('the pyramid comes from one source', () => {
    /** Every node in the org chart, flattened, in draw order. */
    const nodes = (() => {
        const out: typeof reg.stack = [];
        const walk = (n: typeof reg.stack[number]): void => {
            out.push(n);
            n.children.forEach(walk);
        };
        reg.stack.forEach(walk);
        return out;
    })();

    // The failure this suite exists for. The chart was being read out of
    // `COURTS` for the court nodes and out of `FACTION_PARENTAGE` for the sect
    // nodes, with nothing joining the two - so a body with a row in both
    // catalogs was drawn twice, as two neighbours at two different ordinals,
    // with its own tenants hanging off the copy.
    const embodied = COURTS.filter(c => c.embodiedByFactionId !== null);

    it('has such a body at all, or this suite is guarding nothing', () => {
        expect(embodied.length).toBeGreaterThan(0);
    });

    it('draws every body exactly once, under every id it answers to', () => {
        const seen = new Map<string, string[]>();
        for (const n of nodes) {
            // The canonical id for whatever this node is: the first id the
            // resolver gives back, so two rows of one body collapse together.
            const key = idsForFaction(n.id)[0];
            seen.set(key, [...(seen.get(key) ?? []), n.id]);
        }
        for (const [key, drawn] of seen) {
            expect(drawn, `${key} is drawn ${drawn.length} times: ${drawn.join(', ')}`)
                .toHaveLength(1);
        }
    });

    it('never draws a court and the sect that IS that court as neighbours', () => {
        const drawn = new Set(nodes.map(n => n.id));
        for (const court of embodied) {
            expect(
                drawn.has(court.id) && drawn.has(court.embodiedByFactionId!),
                `${court.id} and ${court.embodiedByFactionId} are both on the chart`
            ).toBe(false);
        }
    });

    it('opens that one node onto the faction entry behind it', () => {
        for (const court of embodied) {
            const node = nodes.find(n => idsForFaction(n.id).includes(court.id));
            expect(node, `${court.id} is not on the chart at all`).toBeDefined();
            expect(node!.linkId, `${court.id} node opens nothing`)
                .toBe(court.embodiedByFactionId);
        }
    });

    it('hangs the tenants on the node that is actually their landlord', () => {
        for (const court of embodied) {
            const node = nodes.find(n => idsForFaction(n.id).includes(court.id))!;
            // Everything the parentage table files under either of the body's
            // two ids has to be a child of the one node drawn for it.
            const ids = new Set(idsForFaction(court.id));
            const tenants = Object.values(FACTION_PARENTAGE)
                .filter(p => p.parentFactionId !== null && ids.has(p.parentFactionId))
                .map(p => p.factionId);
            for (const tenant of tenants) {
                expect(
                    node.children.some(ch => ch.id === tenant),
                    `${tenant} holds from ${court.id} and is drawn elsewhere`
                ).toBe(true);
            }
        }
    });

    it('files every court under the apex its own row names', () => {
        // The other half of the same rule, and the one the Third Sill moved
        // under: an apex's `courtIds` and a court's `apexId` are two statements
        // of one fact, and the sheet reads exactly one of them.
        for (const court of COURTS) {
            const apexNode = reg.stack.find(n => n.id === court.apexId);
            expect(apexNode, `${court.apexId} is not a root`).toBeDefined();
            expect(
                apexNode!.children.some(ch => idsForFaction(ch.id).includes(court.id)),
                `${court.id} is not under ${court.apexId}`
            ).toBe(true);
        }
    });
});

describe('what a faction entry actually says', () => {
    // The register spent a long time rendering every figure a faction has and
    // none of its prose. An entry that opens onto chips, a ceiling and a
    // territory line reads as a body the register has nothing to say about,
    // and the catalog had four or more sentences on every one of them.
    it('opens every entry with an assembled precis rather than a catalog field', () => {
        // Two wrong answers preceded this one and both are guarded against.
        // `territory` is a line about where the buildings are and says nothing
        // about the faction; `description` is narrative prose written to be
        // read rather than used. The precis is neither: it is four or five
        // sentences assembled from the fields a reader is deciding on.
        for (const d of reg.dossiers) {
            expect(d.synopsis.length, `${d.id} has no precis`).toBeGreaterThanOrEqual(3);
            expect(d.synopsis.length, `${d.id} precis is a paragraph`).toBeLessThanOrEqual(5);

            const joined = d.synopsis.join(' ');
            expect(joined, `${d.id} precis is just its territory`).not.toBe(d.territory);
            expect(d.description.startsWith(joined), `${d.id} precis is just its prose`).toBe(false);
            // SENTENCE BY SENTENCE RATHER THAN AS ONE RUN, and the change is
            // deliberate. The precis used to be printed as a single block
            // inside a fold, so asserting the joined string also asserted that
            // it was contiguous. The first sentence is the identity line and
            // it now leads the entry, unfolded, above the reputation - the
            // design owner asked for a plain "what is this" before anything
            // about how the body is spoken of - and the rest stays in the
            // fold. Both halves are still on the page; only the run is broken.
            for (const line of d.synopsis) {
                expect(flatProse, `${d.id} precis line not rendered: ${line.slice(0, 40)}`)
                    .toContain(line);
            }
        }
    });

    it('answers the four questions an entry is opened for', () => {
        // What it is, what it can field, who it answers to and who answers to
        // it, and the one thing that would change how you deal with it.
        //
        // Deliberately assertions about FACTS rather than about phrasing. The
        // version this replaces pinned the frames - "It fields 42", "the gate
        // opens at 13", "It wants ..." - which is how the precis came to be
        // four slots a house was poured into, and a suite that pins the slots
        // is a suite that forbids the fix.
        for (const d of reg.dossiers) {
            const joined = d.synopsis.join(' ');

            expect(joined, `${d.id} does not say what it can field`)
                .toContain(String(d.fielded.acting));

            if (d.fielded.ceiling !== null) {
                expect(joined, `${d.id} hides its one-off`)
                    .toContain(String(d.fielded.ceiling));
                expect(
                    /nobody outside|rivals can be assumed/.test(joined),
                    `${d.id} does not say whether the ceiling is known about`
                ).toBe(true);
            }

            // Who it answers to, or - on the three that answer to nobody - who
            // answers to them. Both directions are the same question.
            if (d.holdsFrom?.parentName) {
                expect(joined, `${d.id} does not name its patron`).toContain(d.holdsFrom.parentName);
            }
            if (d.apex && d.apex.answeredBy.length) {
                for (const s of d.apex.answeredBy) {
                    expect(joined, `${d.id} does not name ${s.id}, which answers to it`)
                        .toContain(s.name);
                }
            }

            if (d.ambition?.blockedBy.length) {
                for (const b of d.ambition.blockedBy) {
                    expect(joined, `${d.id} does not say ${b.id} is in the way`).toContain(b.name);
                }
            }
        }
    });

    it('leads with what the house is, never with where it is', () => {
        // The rejection this rewrite answers, as a test. The Long Cut opened
        // on a definition of what driven ground is, which taught a reader who
        // did not know the setting nothing and a reader who did nothing new.
        for (const d of reg.dossiers) {
            const first = d.synopsis[0];
            expect(first, `${d.id} has no opening sentence`).toBeTruthy();

            // Not the territory line, whole or in part. `territory` is one
            // sentence about where the buildings are.
            if (d.territory) {
                const opening = d.territory.split(/[,.]/)[0].trim();
                expect(
                    opening.length > 12 && first.startsWith(opening),
                    `${d.id} opens on its territory`
                ).toBe(false);
            }

            // And never on a field label. "Instability:" pasted in front of a
            // sentence was the specific thing that got the last version thrown
            // out, and a labelled slot is visible from across the room.
            for (const line of d.synopsis) {
                expect(line, `${d.id} opens a sentence on a field label: "${line}"`)
                    .not.toMatch(/^(Instability|Territory|Governance|Standing|Ambition|Capability|Practice|Grievance|Fear|Lateness|Best at|Produces|Counts in|So far|Wants)\b\s*:/i);
            }
        }
    });

    it('says what a house teaches, by name, off the arts catalog', () => {
        // The introduction the entries did not have. A dossier that gives a
        // rung and a landlord and never says what its people can do has
        // described an address.
        const teaching = reg.dossiers.filter(d => d.curriculum);
        expect(teaching.length, 'no faction has a curriculum').toBeGreaterThan(20);

        for (const d of teaching) {
            const c = d.curriculum!;
            const source = SECTS.find(s => s.id === d.id);
            if (source) {
                // One relation, one read. The entry's curriculum and the Arts
                // tab must be the same rows in the same order of grade, or a
                // house's stated library stops being the one anybody can go
                // and learn.
                expect(c.arts.map(a => a.id).sort(), `${d.id} curriculum drifted from the teach list`)
                    .toEqual([...source.teaches].sort());
                expect(c.signature?.id ?? null, `${d.id} signature drifted`)
                    .toBe(source.signatureTechniqueId ?? null);
            }

            for (const art of c.arts) {
                const row = reg.techniques.find(t => t.id === art.id)!;
                expect(row, `${d.id} teaches ${art.id}, which the arts sheet does not have`).toBeDefined();
                expect(art.grade).toBe(row.grade);
                expect(art.reach).toBe(row.reach);
                expect(art.requiredOrdinal).toBe(row.requiredOrdinal);
                expect(flat, `${d.id} does not render ${art.id}`).toContain(art.name);
            }

            // The hardest thing on the list is what the library is worth, and
            // it has to be named in the precis rather than counted.
            expect(d.synopsis.join(' '), `${d.id} does not name its best art`)
                .toContain(c.hardest!.name);
        }

        // A house that teaches nothing says so rather than showing a gap.
        const silent = reg.dossiers.filter(d => !d.curriculum && !d.apex);
        expect(silent.length, 'every house teaches something').toBeGreaterThan(0);
        for (const d of silent) {
            expect(d.synopsis.join(' '), `${d.id} is silent about teaching nothing`)
                .toMatch(/hands nothing over|titles cover/);
        }
    });

    it('states a reserve as its own number and never as a distance above', () => {
        // A reserve is routinely level with the house holding it and sometimes
        // under it - the Pavilion's protector stands at 41 against a living
        // head of 41 - so "N above" is false on both of those and on any
        // future one. The precis may print the rung and the shortfall a rival
        // would misprice by; it may not describe the seal as being above.
        for (const d of reg.dossiers) {
            const joined = d.synopsis.join(' ');
            expect(joined, `${d.id} renders a reserve as a distance above`)
                .not.toMatch(/\b\d+ (rungs? )?above the (house|head)/);
            const sl = d.people.sealed;
            if (sl) expect(joined, `${d.id} does not print the sealed rung`).toContain(String(sl.ordinal));
        }
        const level = reg.dossiers.filter(d => d.people.sealed?.ordinal === d.ordinal);
        expect(level.length, 'no seal is level with its house').toBeGreaterThan(0);
    });

    it('never leaves a spliced field cut off mid-clause', () => {
        // The failure this replaces produced "Standing inside the Guild is a
        // count of." - a fragment that reads as data loss rather than as a
        // summary. Nothing may end on a dangling preposition or conjunction.
        // Not "for" or "to": "money it has not accounted for." is an ordinary
        // sentence, and a guard that fails it would push the summary to say
        // something worse rather than catch anything real.
        const dangling = /\b(of|with|and|the|a|an|in|on|that|which|is|was|by|from|at|after|before)\.$/i;
        for (const d of reg.dossiers) {
            for (const sentence of d.synopsis) {
                expect(dangling.test(sentence.trim()), `${d.id}: "${sentence}"`).toBe(false);
            }
        }
    });

    it('splices a whole clause behind a colon, never behind a preposition', () => {
        // "Best at the Guild is a school with a shopfront" was the bug. A
        // field may come back as a noun phrase or as a full sentence and the
        // frame has to survive both, so these use a colon.
        for (const d of reg.dossiers) {
            for (const sentence of d.synopsis) {
                expect(sentence, `${d.id} splices a clause after a preposition`)
                    .not.toMatch(/\bBest at [A-Z]/);
                expect(sentence, `${d.id} splices a clause after a verb`)
                    .not.toMatch(/\bquietly stopped [A-Z]/);
            }
        }
    });

    it('leads with what it can field, not with what it is like', () => {
        // The framing the whole entry turns on. `acting` and `ceiling` are
        // deliberately different numbers and the second is the one that gets
        // somebody killed, so it is the first thing in the body - and where a
        // house has one, what waking it costs is beside it rather than absent.
        for (const d of reg.dossiers) {
            expect(d.fielded, `${d.id} has no assessment`).toBeTruthy();
            expect(d.fielded.acting).toBe(d.ordinal);
            expect(d.fielded.actingRank).toBe(d.rank);

            const threat = sectThreat(d.id);
            if (threat && threat.ceiling > threat.acting) {
                expect(d.fielded.ceiling, `${d.id} lost its ceiling`).toBe(threat.ceiling);
                expect(d.fielded.wakeCondition, `${d.id} ceiling with no trigger`).toBeTruthy();
            } else {
                // Never the same number twice: a house whose one-off is its
                // everyday is a house holding nothing back, and printing the
                // figure again would suggest it had something in reserve.
                expect(d.fielded.ceiling, `${d.id} ceiling equals acting`).toBeNull();
            }
        }
        const raised = reg.dossiers.filter(d => d.fielded.ceiling !== null);
        expect(raised.length, 'no faction holds anything back').toBeGreaterThan(0);
        for (const d of raised) {
            expect(flat, `${d.id} gap not stated`)
                .toContain(`${d.fielded.ceiling! - d.fielded.acting} rungs`);
        }
    });

    it('states the terms of the grant, not just the name of the landlord', () => {
        const granted = reg.dossiers.filter(d => d.holdsFrom?.terms);
        expect(granted.length).toBeGreaterThan(5);
        for (const d of granted) {
            const t = d.holdsFrom!.terms!;
            expect(flat, `${d.id} renewal not rendered`)
                .toContain(text(t.renewal).slice(0, 50).trim());
            for (const b of t.buys) {
                expect(flat, `${d.id} buys not rendered`).toContain(text(b).slice(0, 40).trim());
            }
        }
    });

    it('prints what a house is good at beside what it is known for', () => {
        // Never one without the other. A reader who hires the reputation gets
        // the wrong thing, and the gap is the usable fact.
        const withCharacter = reg.dossiers.filter(d => d.capability);
        expect(withCharacter.length).toBeGreaterThan(30);
        for (const d of withCharacter) {
            const c = d.capability!;
            for (const field of ['knownAs', 'actuallyGoodAt', 'theGap', 'unitOfValue'] as const) {
                expect(flat, `${d.id}.${field} not rendered`)
                    .toContain(text(c[field]).slice(0, 40).trim());
            }
        }
    });

    it('says how to get in, and what the rungs pay', () => {
        for (const d of reg.dossiers) {
            if (!d.wayIn) continue;
            expect(d.wayIn.ladder.length, `${d.id} has no ladder`).toBeGreaterThan(0);
            for (const rung of d.wayIn.ladder) {
                expect(flat, `${d.id} rung ${rung.rank} missing`).toContain(rung.rank);
            }
            if (d.wayIn.requirement) {
                expect(flat, `${d.id} requirement not rendered`)
                    .toContain(text(d.wayIn.requirement).slice(0, 40).trim());
            }
        }
    });

    it('flags what the catalogs disagree about instead of smoothing it', () => {
        // The single most useful line the register can carry about a house is
        // that its own claim does not hold, and the old entry had nowhere to
        // put it.
        const claimants = SECTS.filter(s => auditAncestralClaim(s.id));
        expect(claimants.length).toBeGreaterThan(0);
        for (const sect of claimants) {
            const audit = auditAncestralClaim(sect.id)!;
            const d = reg.dossiers.find(x => x.id === sect.id)!;
            const flag = d.flags.find(f => f.kind.startsWith('claim'));
            expect(flag, `${sect.id} claim not flagged`).toBeTruthy();
            expect(flag!.kind).toBe(audit.true ? 'claim stands' : 'claim is false');
            expect(flat, `${sect.id} flag not rendered`).toContain(flag!.text.slice(0, 40));
        }
        // A ceiling nobody outside knows about is intelligence, so it is said.
        for (const d of reg.dossiers) {
            if (d.fielded.ceiling === null || d.fielded.ceilingIsPublic) continue;
            expect(
                d.flags.some(f => f.kind === 'ceiling not public'),
                `${d.id} hidden ceiling not flagged`
            ).toBe(true);
        }
    });

    it('keeps the narrative prose collapsed, and never lets it open an entry', () => {
        // It used to be pinned to the foot of the entry. It now sits in the
        // first chunk, with the description, because a reader asking "who are
        // these people" wants the catalog's own words near the answer rather
        // than four screens below it - and that is only safe because it is
        // COLLAPSED. The rule the original test was really enforcing is that
        // prose written to be read must never be what a reader has to scroll
        // through to reach a fact, and a <details> satisfies that wherever it
        // sits.
        const articles = html.match(/<article class="dos[\s\S]*?<\/article>/g) ?? [];
        expect(articles.length, 'no entries rendered').toBeGreaterThan(0);
        for (const article of articles) {
            expect(article.indexOf('class="assess"'), 'an entry has no assessment')
                .toBeGreaterThan(-1);
            const context = article.indexOf('class="context"');
            if (context === -1) continue;

            // Collapsed, always, so it costs a reader who does not want it
            // nothing at all.
            expect(article.slice(context - 40, context), 'the prose is no longer collapsed')
                .toContain('<details');

            // And never the first thing in the entry: the passerby line is.
            const pass = article.indexOf('class="pass"');
            if (pass !== -1) {
                expect(pass, 'prose comes before what a passerby would say')
                    .toBeLessThan(context);
            }
        }
    });

    it('opens every entry on what a passerby would say', () => {
        // The first chunk, and the one the restructure turned on. A reader
        // arriving at a faction wants to know what it IS before anything else,
        // and the sheet used to open on an assembled precis of figures.
        for (const d of reg.dossiers) {
            expect(d.passerby, `${d.id} has nothing a passerby would say`).toBeTruthy();
            expect(d.passerby!.line.length, `${d.id} passerby line is too thin`)
                .toBeGreaterThan(30);
            expect(flat, `${d.id} passerby line not rendered`)
                .toContain(text(d.passerby!.line).slice(0, 60).trim());
        }
    });

    it('names the dao first on a dao house, and on nothing else', () => {
        // The thing a stranger would mention before anything: these are bodies
        // with no territory whose whole identity is one principle.
        const houses = reg.dossiers.filter(d => d.passerby?.dao);
        expect(houses.length, 'no dao house names its dao').toBeGreaterThan(3);
        for (const d of houses) {
            expect(d.passerby!.line.startsWith(`A house of ${d.passerby!.dao}`),
                `${d.id} does not lead with its dao`).toBe(true);
            expect(getDaoHouse(d.id), `${d.id} claims a dao and is not a dao house`).toBeTruthy();
        }
        for (const d of reg.dossiers.filter(x => !x.passerby?.dao)) {
            expect(getDaoHouse(d.id), `${d.id} is a dao house and does not name its dao`)
                .toBeFalsy();
        }
    });

    it('carries the catalog description on every entry', () => {
        for (const d of reg.dossiers) {
            expect(d.description, `${d.id} has no description`).toBeTruthy();
            expect(d.description.length, `${d.id} description is a stub`).toBeGreaterThan(200);
        }
    });

    it('renders that description, on every entry, as prose', () => {
        for (const d of reg.dossiers) {
            expect(flat, `${d.id} description not rendered`)
                .toContain(text(d.description).slice(0, 60).trim());
        }
    });

    it('leaves no entry that opens onto no sentences at all', () => {
        // The failure as a reader meets it, rather than as a field check: open
        // every faction entry on the page and count sentence-ending
        // punctuation in what is behind it.
        const articles = html.match(/<article class="dos[\s\S]*?<\/article>/g) ?? [];
        expect(articles.length).toBe(reg.dossiers.length);
        for (const article of articles) {
            const body = text(article);
            const sentences = (body.match(/[.!?](\s|$)/g) ?? []).length;
            expect(sentences, `an entry opens onto ${sentences} sentences`).toBeGreaterThan(3);
        }
    });

    it('gives every faction, apex and court a way in', () => {
        // The user's ask, as a sweep rather than a sample. Every sect and every
        // apex opens an entry; every court opens a panel.
        for (const sect of SECTS) {
            expect(html, `${sect.id} has no entry`).toContain(`id="faction-${sect.id}"`);
        }
        for (const apex of APEX_INSTITUTIONS) {
            const has = idsForFaction(apex.id).some(id => html.includes(`id="faction-${id}"`));
            expect(has, `${apex.id} has no entry`).toBe(true);
        }
        for (const court of COURTS) {
            expect(html, `${court.id} has no panel`).toContain(`id="court-${court.id}"`);
        }
    });

    it('opens a faction entry from wherever the sheet names one', () => {
        // Not only from the org chart. A name printed in the high band, in the
        // artifact owner column or in somebody's ambition is a name a reader
        // wants to follow, and all three used to be dead text.
        const linked = reg.high.filter(p => p.factionId !== null);
        expect(linked.length).toBeGreaterThan(0);
        for (const p of linked.slice(0, 12)) {
            const target = idsForFaction(p.factionId!).find(id => reg.dossiers.some(d => d.id === id));
            if (!target) continue;
            expect(html, `${p.factionId} not linked from the high band`)
                .toContain(`data-goto="faction-${target}"`);
        }

        const owned = reg.artifacts.filter(a => a.ownerLinkId !== null);
        expect(owned.length).toBeGreaterThan(0);
        for (const a of owned) {
            expect(html, `${a.id} owner not linked`)
                .toContain(`data-goto="faction-${a.ownerLinkId}"`);
        }

        const blocking = reg.dossiers
            .flatMap(d => d.ambition?.blockedBy ?? [])
            .filter(b => b.linkId !== null);
        expect(blocking.length).toBeGreaterThan(0);
        for (const b of blocking.slice(0, 12)) {
            expect(html, `${b.id} not linked from an ambition`)
                .toContain(`data-goto="faction-${b.linkId}"`);
        }
    });
});

describe('the entries that were weakest', () => {
    // Apexes and courts. Neither has a `FACTION_CHARACTER` row of its own, both
    // used to open on the field describing the ground they administer, and both
    // are the entries a reader has the fewest other sources for.

    const apexDossiers = reg.dossiers.filter(d => d.apex);

    it('tells a reader what an apex actually is before anything else', () => {
        expect(apexDossiers).toHaveLength(APEX_INSTITUTIONS.length);
        for (const d of apexDossiers) {
            const a = d.apex!;
            const first = d.synopsis[0];

            // How many of them there are, how old the position is, and whether
            // a beginner is permitted to know the name. `startingAwareness` is
            // the fact that governs the whole posture of two of the three and
            // it had never once reached the page.
            expect(first, `${d.id} does not place itself among the apexes`)
                .toContain(String(APEX_INSTITUTIONS.length === 3 ? 'three' : APEX_INSTITUTIONS.length));
            expect(a.ofHowMany).toBe(APEX_INSTITUTIONS.length);
            expect(a.startingAwareness).toBe(
                APEX_INSTITUTIONS.find(x => idsForFaction(d.id).includes(x.id))!.startingAwareness
            );
            const hidden = a.startingAwareness === 'unaware' || a.startingAwareness === 'whisper';
            expect(first, `${d.id} does not say whether it can be named`)
                .toMatch(hidden ? /cannot name it/ : /can name/);

            // And what kind of institution it is, which is how it ranks people.
            // Four titles covering every practitioner in five provinces says
            // more about the Long Cut than any figure on the sheet.
            const joined = d.synopsis.join(' ');
            expect(a.rankNote.length, `${d.id} has no rank note`).toBeGreaterThan(0);
            expect(a.lastRealmCount).toBeGreaterThan(0);
            expect(joined, `${d.id} does not say how many it has at the last realm`)
                .toMatch(/at the last realm/);
            expect(joined, `${d.id} does not say what the seat is pinned to`).toMatch(/pinned/);
        }
    });

    it('names everything that answers to an apex, from both catalogs', () => {
        // The two tables hold different halves and neither is a superset: a
        // court names its apex on its own row, and anything else points upward
        // from the parentage table. The Long Cut's only direct tenant lives in
        // the second, and reading one table lost it.
        for (const d of apexDossiers) {
            const ids = idsForFaction(d.id);
            const expected = new Set<string>();
            for (const court of COURTS) if (ids.includes(court.apexId)) expected.add(idsForFaction(court.id)[0]);
            for (const p of Object.values(FACTION_PARENTAGE)) {
                if (p.parentFactionId && ids.includes(p.parentFactionId)) expected.add(idsForFaction(p.factionId)[0]);
            }

            const got = new Set(d.apex!.answeredBy.map(s => idsForFaction(s.id)[0]));
            expect(got, `${d.id} subordinates`).toEqual(expected);
            for (const s of d.apex!.answeredBy) {
                expect(s.name, `${s.id} unresolved`).not.toBe(s.id);
                expect(flat, `${s.id} not rendered under ${d.id}`).toContain(s.name);
            }
        }
        const withSubs = apexDossiers.filter(d => d.apex!.answeredBy.length > 0);
        expect(withSubs.length, 'no apex has anything under it').toBe(apexDossiers.length);
    });

    it('does not render a grant that costs nothing as though it were a lease', () => {
        // The distinction the sheet was flattening. Two houses hold on terms
        // that take no stones and owe no disciples, and describing that with
        // the tribute vocabulary asserts an administration that is not there.
        const free = reg.dossiers.filter(d =>
            d.holdsFrom?.terms
            && d.holdsFrom.terms.tributeStonesPerYear === 0
            && d.holdsFrom.terms.disciplesPerCycle === 0);
        expect(free.length, 'no house holds on terms that cost nothing').toBeGreaterThan(0);
        for (const d of free) {
            const joined = d.synopsis.join(' ');
            expect(joined, `${d.id} does not say the grant costs nothing`)
                .toMatch(/no stones and no disciples/);
            // And the catalog's own account of why, rather than the sheet's.
            expect(joined, `${d.id} does not quote its renewal clause`)
                .toContain(text(d.holdsFrom!.terms!.renewal).slice(0, 30).trim());
        }

        // The other side of the same fact: where tribute is real it is printed.
        const paying = reg.dossiers.filter(d => (d.holdsFrom?.terms?.tributeStonesPerYear ?? 0) > 0);
        expect(paying.length).toBeGreaterThan(3);
        for (const d of paying) {
            expect(d.synopsis.join(' '), `${d.id} does not print what it pays`)
                .toContain(d.holdsFrom!.terms!.tributeStonesPerYear.toLocaleString());
        }
    });

    it('says how an institution nobody can join can be paid', () => {
        // The one question a reader has about a body they can never walk into.
        // A house with a gate answers it by having a gate; an apex does not,
        // and for a while the sheet could not answer it at all because neither
        // hidden apex had a row in the character catalog. Both have one now, so
        // the assertion is that the answer is used rather than that the gap is
        // reported - and the branch that reports a gap is still guarded below,
        // because a future apex could arrive without a row.
        // A house with a door answers the question by having a door, so this is
        // about the ones with none rather than about the tier.
        const doorless = apexDossiers.filter(d => d.wayIn === null);
        expect(doorless.length, 'every apex can be walked into').toBeGreaterThan(0);

        for (const d of doorless) {
            const joined = d.synopsis.join(' ');
            if (d.capability) {
                // Case-insensitive on the first letter only: the clause is
                // spliced mid-sentence, so a field written to stand alone
                // arrives lowercased.
                const first = text(d.capability.unitOfValue).split(/(?<=[.!?])\s/)[0].trim();
                expect(joined.toLowerCase(), `${d.id} does not say how it can be paid`)
                    .toContain(first.toLowerCase());
                expect(d.flags.some(f => f.kind === 'nothing recorded'), `${d.id} false gap`).toBe(false);
            } else {
                const flag = d.flags.find(f => f.kind === 'nothing recorded');
                expect(flag, `${d.id} hides the missing unit of value`).toBeTruthy();
                expect(flat, `${d.id} gap not rendered`).toContain(flag!.text.slice(0, 50));
            }
        }
    });

    it('opens a court panel on what the court is, not on what it administers', () => {
        for (const court of reg.courts) {
            expect(court.synopsis.length, `${court.id} has no precis`).toBeGreaterThanOrEqual(3);
            expect(court.synopsis.length, `${court.id} precis is a paragraph`).toBeLessThanOrEqual(5);

            const first = court.synopsis[0];
            expect(first.startsWith(court.administers.slice(0, 20)), `${court.id} opens on administers`)
                .toBe(false);

            // An office rather than a house, and how nameable it is - which is
            // inherited from the apex above it rather than being its own.
            expect(first, `${court.id} does not say whose office it is`).toContain(court.apexName);
            expect(first, `${court.id} does not say whether a beginner knows it`)
                .toMatch(/beginner/);

            const answering = court.officers.find(o => o.answersForTheCourt);
            const joined = court.synopsis.join(' ');
            if (answering) {
                expect(joined, `${court.id} does not name who answers`).toContain(answering.name);
                expect(joined, `${court.id} does not carry the second standing`)
                    .toContain(answering.apexRank);
            }
            expect(flatProse, `${court.id} precis not rendered`).toContain(text(joined).trim());
        }
    });
});

describe('two bodies that used to be one posting', () => {
    // THREE SHAPES, AND THIS IS THE THIRD. It began as a top-level `schism`
    // section built from a standalone record narrating both sides from outside.
    // Then it became a pair of partisan accounts, one on each body, arguing
    // about which of them was the real house, with a field on each saying
    // nothing settles it. Both are gone: the second shape presented an
    // institution that had SPLIT as an institution having an ARGUMENT.
    //
    // What is on the sheet now is one relationship with two sides, in the
    // section at the foot of each entry - the same shape every other pair of
    // bodies in the world gets - and the facts that used to be spread across
    // ten partisan fields sit on the bodies that hold them.
    it('carries the split as a relationship rather than as a pair of claims', () => {
        const kiln = reg.courts.find(c => c.id === 'court-kiln')!;
        const walked = reg.dossiers.find(d => d.id === 'sect-kiln-wardens')!;

        const ours = walked.relationships.find(r => r.otherId === 'court-kiln');
        const theirs = kiln.relationships.find(r => r.otherId === 'sect-kiln-wardens');
        expect(ours, 'the walking half does not record the other one').toBeDefined();
        expect(theirs, 'the standing half does not record the other one').toBeDefined();

        // One tie, two sides, and the facts are the same object.
        expect(ours!.id).toBe(theirs!.id);
        expect(ours!.what).toBe(theirs!.what);
        expect(ours!.stance).toBe('alongside');
        expect(theirs!.stance).toBe('alongside');
        // The feeling is allowed to differ and does. That is the content.
        expect(ours!.warmth).not.toBe(theirs!.warmth);
        expect(ours!.warmth).toBe(theirs!.theirWarmth);

        // And both sides are on the page, with a way from each to the other.
        expect(flat).toContain(text(ours!.what).slice(0, 60).trim());
        expect(ours!.anchor, 'no way from the walking half to the standing one').toBeTruthy();
    });

    it('has stopped adjudicating which of them is the house', () => {
        // The conceit that was removed, guarded so it cannot drift back in.
        // Nobody on this sheet argues that the other body is not real.
        expect(flat).not.toContain('Contested lineage');
        expect(flat).not.toContain('nothing in the world settles it');
    });

    it('names both halves of the split house on the page', () => {
        // Both entries are real and a player who deals with either should be
        // able to deal with the other. Neither name may quietly disappear.
        const kiln = COURTS.find(c => c.id === 'court-kiln');
        const rootSill = SECTS.find(s => s.id === 'sect-kiln-wardens');
        expect(kiln, 'the court half is gone from the catalog').toBeDefined();
        expect(rootSill, 'the sect half is gone from the catalog').toBeDefined();
        expect(flat).toContain(kiln!.name);
        expect(flat).toContain(rootSill!.name);
        // And they answer to different apexes, which is the whole of it.
        expect(FACTION_PARENTAGE[rootSill!.id].parentFactionId).not.toBe(kiln!.apexId);
    });
});

describe('a body with a row in two catalogs', () => {
    // The duplicate the user reported, and the over-correction that replaced
    // it. Merging the two nodes is right; deleting one of the two NAMES is not
    // - the province has called the Kiln Court that for nine hundred years and
    // the Root Sill is what the Deep Survey calls the posting, and which one is
    // real is exactly what the catalog says has never been settled.
    const embodied = COURTS.filter(c => c.embodiedByFactionId !== null);

    it('has such a body at all', () => {
        expect(embodied.length).toBeGreaterThan(0);
    });

    it('keeps both names on the page', () => {
        for (const court of embodied) {
            const sect = SECTS.find(s => s.id === court.embodiedByFactionId)!;
            expect(flat, `${court.id} lost its court name`).toContain(court.name);
            expect(flat, `${court.embodiedByFactionId} lost its house name`).toContain(sect.name);
        }
    });

    it('puts both names on the one entry rather than on two', () => {
        for (const court of embodied) {
            const sect = SECTS.find(s => s.id === court.embodiedByFactionId)!;
            const d = reg.dossiers.find(x => x.id === sect.id)!;
            expect(d.alsoKnownAs, `${sect.id} does not carry its court name`).toBe(court.name);

            const card = new RegExp(
                `<details class="ncard" id="faction-${sect.id}">([\\s\\S]*?)</details>`
            ).exec(html);
            expect(card, `${sect.id} has no card`).not.toBeNull();
            expect(text(card![1]), `${sect.id} card is missing a name`).toContain(sect.name);
            expect(text(card![1]), `${sect.id} card is missing its court name`)
                .toContain(court.name.replace(/^The\s+/i, ''));
        }
    });
});

describe('a court panel', () => {
    it('carries the fields the catalog holds rather than dropping them', () => {
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            expect(built.grantsInRegionId).toBe(court.grantsInRegionId);
            expect(built.embodiedByFactionId).toBe(court.embodiedByFactionId);
            expect(built.startingAwareness).toBe(court.startingAwareness);
            expect(Boolean(built.highWaterMark)).toBe(Boolean(court.highWaterMark));
        }
    });

    it('renders the high-water mark where a court has one', () => {
        const withMark = COURTS.filter(c => c.highWaterMark);
        expect(withMark.length, 'no court records a high-water mark').toBeGreaterThan(0);
        for (const court of withMark) {
            expect(flat, `${court.id} high-water mark not rendered`)
                .toContain(court.highWaterMark!.name);
            expect(flat, `${court.id} high-water note not rendered`)
                .toContain(text(court.highWaterMark!.note).slice(0, 60).trim());
        }
    });

    it('shows a court as exactly as nameable as the apex above it', () => {
        // A rule rather than a quirk, and the register has to be able to show
        // it holding. Both ends are carried so a future court that broke the
        // rule would be visible on the sheet instead of silently averaged away.
        for (const court of COURTS) {
            const built = reg.courts.find(c => c.id === court.id)!;
            const apex = getApexInstitution(court.apexId)!;
            expect(built.apexAwareness).toBe(apex.startingAwareness);
            expect(built.startingAwareness, `${court.id} disagrees with its apex`)
                .toBe(apex.startingAwareness);
        }
    });

    it('names no kind of move in the heading over a transfer note', () => {
        // Was "two courts do not answer where they used to". There is one, and
        // that is a correction rather than a loss: the other was the Third
        // Sill, which never moved at all and had a conversion note describing a
        // transfer that did not happen. The body that did move is the Root Sill
        // and it is a posting rather than a court, so its account lives on its
        // own entry, and how it stands with the half that stayed is one row in
        // the relationships section rather than a transfer note.
        //
        // What survives is the reason the heading is worded the way it is. The
        // one remaining note is a promotion inside a patron rather than a move
        // between them, and a heading that named a kind of move would be
        // asserting the wrong one - so it names none, and the note says which
        // in its own first sentence.
        const moved = reg.courts.filter(c => c.transferNote);
        expect(moved.length, 'nothing came to answer anywhere by anything but always having')
            .toBe(1);
        expect(moved[0].id, 'the one note left should be the promotion').toBe('court-azure-mist');
        expect(flat).not.toContain('It has changed patrons');
        expect(flat).toContain('How it came to answer here');

        // And the one administration that genuinely changed patrons is reachable
        // from the sheet, as a relationship between two independent bodies.
        const linked = [
            ...reg.courts.filter(c => c.relationships.some(r => r.kind === 'two_bodies_nobody_joins')),
            ...reg.dossiers.filter(d => d.relationships.some(r => r.kind === 'two_bodies_nobody_joins'))
        ].map(x => x.id).sort();
        expect(linked).toEqual(['court-kiln', 'sect-kiln-wardens']);
    });
});

describe('the arts', () => {
    it('carries every art in the world', () => {
        expect(reg.techniques).toHaveLength(TECHNIQUES.length);
        expect(reg.counts.techniques).toBe(TECHNIQUES.length);
        for (const t of TECHNIQUES) {
            expect(reg.techniques.find(x => x.id === t.id), `${t.id} missing`).toBeDefined();
        }
    });

    it('renders every art, with what it does, on the page', () => {
        for (const t of reg.techniques) {
            expect(flat, `${t.id} not rendered`).toContain(t.name);
            expect(flat, `${t.id} has no description`)
                .toContain(text(t.description).slice(0, 40).trim());
        }
    });

    /**
     * BY FORCE, THEN BY HOW HIGH IT IS WRITTEN, THEN BY NAME.
     *
     * This used to read the position in `GRADE_ORDER`, which the technique
     * catalog now documents as a LISTING order whose only virtue is being
     * arbitrary and stable - immortal and chaos are peers on the power ladder,
     * and `compareGrades` returns 0 between them. So an assertion built on
     * `indexOf` was asserting the ordering that correction removed.
     *
     * What the sort actually promises now is asserted instead, including the
     * tie-break, because a tie resolved by accident is the thing worth pinning:
     * a reader looking at two adjacent rows should be able to say why one is
     * above the other.
     */
    it('orders arts by force, then by the rung written for, then by name', () => {
        const list = reg.techniques;
        for (let i = 1; i < list.length; i++) {
            const [prev, next] = [list[i - 1], list[i]];
            const byForce = compareGrades(next.grade, prev.grade);
            expect(byForce, `${prev.name} then ${next.name}`).toBeLessThanOrEqual(0);
            if (byForce !== 0) continue;
            if (next.requiredOrdinal !== prev.requiredOrdinal) {
                expect(next.requiredOrdinal, `${prev.name} then ${next.name}`)
                    .toBeLessThan(prev.requiredOrdinal);
                continue;
            }
            expect(prev.name.localeCompare(next.name), `${prev.name} then ${next.name}`)
                .toBeLessThanOrEqual(0);
        }
    });

    it('puts the two peer grades adjacent rather than one above the other', () => {
        // The tie is real and it is the point. Immortal and chaos arts
        // interleave by the rung they are written for, which is a reason a
        // reader can see, rather than by whichever the catalog listed first.
        const peers = reg.techniques.filter(t => compareGrades(t.grade, 'chaos') === 0);
        expect(new Set(peers.map(t => t.grade)).size).toBe(2);
        const ords = peers.map(t => t.requiredOrdinal);
        expect([...ords].sort((a, b) => b - a)).toEqual(ords);
    });

    it('derives who teaches an art from the sect catalog and nowhere else', () => {
        for (const t of reg.techniques) {
            const expected = SECTS
                .filter(s => s.teaches.includes(t.id))
                .map(s => s.id)
                .sort();
            expect(t.taughtBy.map(f => f.id).sort(), `${t.id} teachers wrong`)
                .toEqual(expected);
        }
    });

    it('agrees with itself read from either end', () => {
        // The two directions are one relation. If they can disagree, one of
        // them is a second copy of the teach lists and will drift from them.
        for (const house of reg.teaching) {
            for (const art of house.arts) {
                const t = reg.techniques.find(x => x.id === art.id)!;
                expect(
                    t.taughtBy.some(f => f.id === house.id),
                    `${house.id} teaches ${art.id} and the art does not say so`
                ).toBe(true);
            }
        }
        for (const t of reg.techniques) {
            for (const f of t.taughtBy) {
                const house = reg.teaching.find(h => h.id === f.id)!;
                expect(
                    house.arts.some(a => a.id === t.id),
                    `${f.id} is listed on ${t.id} and does not teach it`
                ).toBe(true);
            }
        }
    });

    it('names no art its own catalog does not have', () => {
        // A teach list pointing at an id with no row is a house promising
        // something nobody can learn. Surfaced on the page rather than dropped.
        for (const house of reg.teaching) {
            expect(house.unknownArtIds, `${house.id} teaches a missing art`).toEqual([]);
        }
    });

    it('leaves an art without a teacher only where it is not a taught art', () => {
        // The one join across the two catalogs that can rot silently. An art
        // whose provenance says somebody demonstrates it, with nobody left who
        // does, is a hole; an art out of a ruin or a grave having no teacher is
        // the design, and is what makes a grave worth opening.
        const untaught = reg.techniques.filter(t => !t.taughtBy.length);
        expect(reg.counts.untaughtTechniques).toBe(untaught.length);
        for (const t of untaught) {
            // Or it is HELD rather than taught, which is the third state and
            // the one the two hidden apexes are in. A road to the top of the
            // ladder inside a body with no sect row can have no teach list by
            // construction, and reading that as an orphan says nobody in the
            // world can hand it over when in fact it is lent, on terms, by a
            // named house with somebody standing in the book's own band.
            if (t.heldBy) {
                expect(t.transmission, `${t.id} is held and read rather than shown`).toBe('shown');
                expect(t.heldBy.teachers, `${t.id} is held by nobody who can teach it`)
                    .toBeGreaterThan(0);
                continue;
            }
            expect(t.transmission, `${t.id} is shown and nobody shows it`).toBe('read');
        }
    });

    it('says how many people an art lands on, and never leaves it blank', () => {
        // Absent in the catalog means single, so the column is never unknown.
        // A blank here would read as missing data on the one field that
        // separates an art that kills a man from one that clears a courtyard.
        expect(html).toContain('<th>Reach</th>');
        for (const t of reg.techniques) {
            expect(['single', 'several', 'field'], `${t.id} reach is ${t.reach}`)
                .toContain(t.reach);
            const source = TECHNIQUES.find(x => x.id === t.id)!;
            expect(t.reach).toBe(source.reach ?? 'single');
        }
        const wide = reg.techniques.filter(t => t.reach !== 'single');
        expect(wide.length, 'no art reaches past one person').toBeGreaterThan(0);
        for (const t of wide) {
            expect(flat, `${t.id} reach not rendered`).toContain(t.reach);
        }
    });

    it('links a teacher back to its own entry rather than printing a name', () => {
        const taught = reg.techniques.find(t => t.taughtBy.length)!;
        expect(html).toContain(`data-goto="faction-${taught.taughtBy[0].id}"`);
    });
});

describe('a sealed ancestor', () => {
    const hosts = Object.entries(SECT_ANCESTRY).filter(([, r]) => r.dormant);

    it('carries every seal in the world', () => {
        expect(reg.sealed).toHaveLength(hosts.length);
        for (const [, record] of hosts) {
            expect(flat, `${record.dormant!.name} not rendered`).toContain(record.dormant!.name);
        }
    });

    it('prints the answers where the house has them and nothing where it does not', () => {
        for (const [hostId, record] of hosts) {
            const d = record.dormant!;
            const built = reg.sealed.find(x => x.hostId === hostId)!;
            const pairs: [string | undefined, string | null][] = [
                [d.whoHeIs, built.whoTheyAre],
                [d.sealedBeforeTheCrossing, built.sealedBefore],
                [d.andHeKnowsWhatHeIsFor, built.knowsWhatFor],
                [d.andTheResourcesWentSomewhere, built.resourcesWent]
            ];
            for (const [source, carried] of pairs) {
                expect(carried).toBe(source ?? null);
                // A house that cannot answer is in a materially different
                // position from one that can, so the sheet must not invent one.
                if (source) {
                    expect(flat, `${hostId}: answer not rendered`).toContain(source.slice(0, 40));
                }
            }
        }
        expect(reg.sealed.some(x => x.whoTheyAre), 'no seal is vouched for at all').toBe(true);
    });

    it('never assumes a reserve outranks the house holding it', () => {
        // This was wrong in the data and in two tests before it was caught. A
        // seal level with the living head raises no ceiling, so none is shown,
        // and nothing in the register may read `sealed` as `stronger`.
        for (const d of reg.dossiers) {
            const sl = d.people.sealed;
            if (!sl) continue;
            if (sl.ordinal <= d.ordinal) {
                expect(d.ceiling, `${d.id} invented a ceiling`).toBeNull();
            } else {
                expect(d.ceiling).toBe(sl.ordinal);
            }
        }
        const level = reg.dossiers.filter(d => d.people.sealed?.ordinal === d.ordinal);
        expect(level.length, 'no seal is level with its house').toBeGreaterThan(0);
        expect(flat).toContain('level with the house');
    });

    it('joins the seal record to the roll on the rung, not on the name', () => {
        // The same person is spelled differently in the two catalogs - "The
        // Mirror" against "The First Sovereign, called the Mirror" - so a
        // string join drops some and duplicates others.
        for (const [hostId, record] of hosts) {
            const d = reg.dossiers.find(x => x.id === hostId);
            if (!d) continue;
            expect(record.ancestors.some(a => a.fate === 'dormant'),
                `${hostId} seal is not on the roll`).toBe(true);
            expect(d.people.sealedOnTheRoll, `${hostId} lost its roll account`).toBeTruthy();
            expect(flat, `${hostId} roll account not rendered`)
                .toContain(d.people.sealedOnTheRoll!.slice(0, 40));
        }
    });
});

describe('one house under two ids', () => {
    // The Pavilion has a row in the apex catalog and a row in the sect catalog.
    // Every table on this sheet was written against one id or the other, so a
    // register keyed on a single id drops half of its own entry - and the
    // name-matching that used to paper over that would break on a rename.
    const twoIds = APEX_INSTITUTIONS.filter(a => a.factionId !== null);

    it('gives such a house exactly one entry', () => {
        expect(twoIds.length, 'no apex has a sect row').toBeGreaterThan(0);
        expect(new Set(reg.dossiers.map(d => d.id)).size).toBe(reg.dossiers.length);
        for (const apex of twoIds) {
            const under = reg.dossiers.filter(d => d.id === apex.id || d.id === apex.factionId);
            expect(under, `${apex.id} is filed ${under.length} times`).toHaveLength(1);
        }
    });

    it('keeps everything filed under either id on that one entry', () => {
        for (const apex of twoIds) {
            const d = reg.dossiers.find(x => idsForFaction(x.id).includes(apex.id))!;
            expect(d, `${apex.id} has no entry`).toBeDefined();
            // Recorded against the apex id.
            expect(d.apex, `${apex.id} lost its apex block`).toBeTruthy();
            // Recorded against the sect id.
            expect(d.people.active.length, `${apex.id} lost its members`).toBeGreaterThan(0);
            expect(d.artifacts.length, `${apex.id} lost its artifacts`).toBeGreaterThan(0);
        }
    });

    it('routes the org chart through the same resolver', () => {
        const walk = (n: typeof reg.stack[number]): string[] =>
            [n.linkId ?? '', ...n.children.flatMap(walk)];
        const linked = new Set(reg.stack.flatMap(walk));
        for (const apex of twoIds) {
            const expected = idsForFaction(apex.id).find(id => reg.dossiers.some(d => d.id === id));
            expect(linked.has(expected!), `${apex.id} node opens nothing`).toBe(true);
        }
    });
});

describe('the key', () => {
    it('defines every vocabulary the sheet has started printing', () => {
        // Rule 2 of the glossary's own contract, as a test, in both directions.
        // Adding a column without a term is how the register acquires words
        // only its author can read.
        // Substring rather than exact match. A term is allowed to head itself
        // more fully than the column names it - the sheet prints "(vault)" and
        // the Key heads that entry "In a vault" - so pinning the exact string
        // fails on a clearer heading rather than on a missing one.
        const terms = glossaryTerms().map(t => t.term.toLowerCase());
        for (const term of [
            'power', 'the ceiling', 'vault', 'held by', 'owner', 'standing', 'no entry',
            'office', 'apex rank', 'answers for the court',
            'vouched for', 'level with the house', 'gate',
            // The court panel, after the pyramid was joined onto one source.
            'came to answer here', 'a beginner', 'also called', 'got furthest',
            // The arts sheet.
            'grade', 'channel', 'shown', 'read', 'taught by', 'signature',
            'no copy anywhere', 'elementless', 'rung ceiling on objects',
            // The dossier assessment.
            'can field now', 'could field once', 'the gap', 'what it costs',
            'produces', 'counts in', 'actually good at', 'face value',
            // What a house can actually do, and what a court divides up.
            'teaches', 'what it apportions'
        ]) {
            expect(
                terms.some(t => t.includes(term)),
                `${term} is printed and not defined`
            ).toBe(true);
        }
        for (const t of glossaryTerms()) {
            expect(flat, `${t.term} is defined but the Key does not render it`).toContain(t.term);
        }
    });
});

describe('what a faction is reaching for', () => {
    const withAmbition = SECTS.filter(s => s.ambition);

    it('renders every ambition in the catalog', () => {
        expect(withAmbition.length).toBeGreaterThan(20);
        for (const sect of withAmbition) {
            const d = reg.dossiers.find(x => x.id === sect.id);
            expect(d?.ambition, `${sect.id} ambition dropped`).toBeTruthy();
            expect(flat, `${sect.id} wants not rendered`)
                .toContain(sect.ambition!.wants.slice(0, 40));
            expect(flat, `${sect.id} cost not rendered`)
                .toContain(sect.ambition!.wouldCost.slice(0, 40));
            expect(flat, `${sect.id} movedOn not rendered`)
                .toContain(sect.ambition!.movedOn.slice(0, 40));
        }
    });

    it('names whoever is in the way rather than printing an id', () => {
        for (const d of reg.dossiers) {
            for (const b of d.ambition?.blockedBy ?? []) {
                expect(b.name, `${d.id} blocked by an unresolved ${b.id}`).not.toBe(b.id);
            }
        }
    });

    it('shows both sides of a contested claim', () => {
        const contested = reg.dossiers.filter(d => (d.ambition?.contestedWith.length ?? 0) > 0);
        expect(contested.length).toBeGreaterThan(0);
        for (const d of contested) {
            // Symmetric by construction, and the register reads it from both
            // directions: a claim printed from one side only reads as an
            // assertion instead of as two parties on one object.
            expect(d.ambition!.contestedWith.map(o => o.id).sort())
                .toEqual(contestedClaimsOf(d.id).map(o => o.id).sort());
            for (const other of d.ambition!.contestedWith) {
                expect(other.wants.length).toBeGreaterThan(0);
                expect(flat, `${d.id} vs ${other.id}: other side not rendered`)
                    .toContain(other.name);
            }
        }
    });

    it('keeps the four abstentions as entries rather than as holes', () => {
        const silent = reg.dossiers.filter(d => !d.ambition && SECTS.some(s => s.id === d.id));
        expect(silent.length).toBe(SECTS.length - withAmbition.length);
        for (const d of silent) expect(flat).toContain(d.name);
    });
});

describe('the dao houses', () => {
    it('reads the door as adoption rather than as an ordinal or a closed gate', () => {
        for (const house of DAO_HOUSES) {
            const d = reg.dossiers.find(x => x.id === house.id)!;
            expect(d.intake).toBe('adoption');
            expect(intakeRouteOf(house.id)).toBe('adoption');
        }
        // The bug this replaces: a house printed its admission ordinal when
        // `recruits` was true and 'closed' when it was false, and neither is
        // what happens to somebody who wants in. The entry now says so twice -
        // as a chip on the closed card, and in the way-in block, where it also
        // says what the ordinal beside it actually means.
        expect(flat).toContain('adoption only');
        for (const house of DAO_HOUSES) {
            const d = reg.dossiers.find(x => x.id === house.id)!;
            expect(d.wayIn?.intake, `${house.id} door`).toBe('adoption');
            expect(d.admissionOrdinal).toBeGreaterThanOrEqual(0);
        }
        expect(flat).toContain('is the rung a family member is expected to reach');
    });

    it('renders the family name and the whole admission', () => {
        for (const house of DAO_HOUSES) {
            const d = reg.dossiers.find(x => x.id === house.id)!;
            expect(d.house?.surname).toBe(house.houseSurname);
            expect(flat, `${house.id} surname missing`).toContain(house.houseSurname);
            for (const field of ['prodigyIn', 'marriage', 'surrendered', 'naming', 'lastTaken', 'costOfTheForm'] as const) {
                expect(flat, `${house.id}.${field} not rendered`)
                    .toContain(house.admission[field].slice(0, 40));
            }
        }
    });

    it('leaves an ordinary sect gate as its admission ordinal', () => {
        const open = reg.dossiers.filter(d => d.intake === 'open');
        expect(open.length).toBeGreaterThan(0);
        for (const d of open) expect(flat).toContain(`gate ${d.admissionOrdinal}`);
    });
});

describe('the page itself', () => {
    it('carries the game top bar with a working way out', () => {
        // Rejected twice for a bar that only resembled the game's. One bar, the
        // same brand block, and a close control that is a real link so it still
        // works with scripting off.
        expect((html.match(/class="opbar"/g) ?? [])).toHaveLength(1);
        expect(html).toContain('The Cultivation Ladder');
        expect(html).toContain('<span class="opbar__badge"');
        expect(html).toContain('id="op-close"');
        expect(html).toMatch(/<a class="opbar__close"[^>]*href="\/"/);
        expect(html).toContain('Back to the game');
    });

    it('puts every section inside a pane a tab can reach', () => {
        const panes = [...html.matchAll(/data-pane="([a-z]+)"/g)].map(m => m[1]);
        const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]);
        expect(new Set(panes)).toEqual(new Set(tabs));
        expect(tabs).toContain('objects');

        // The immortal objects block used to sit outside every pane, which made
        // it render underneath all three tabs at once.
        const beforeFirstPane = html.slice(
            html.indexOf('<nav class="tabs"'),
            html.indexOf('<div class="pane"')
        );
        expect(beforeFirstPane).not.toContain('<section');
        const afterLastPane = html.slice(html.lastIndexOf('</div>\n\n<footer'));
        expect(afterLastPane).not.toContain('<section');
    });

    it('escapes catalog text rather than trusting it', () => {
        expect(html).not.toMatch(/<td class="q">[^<]*<script/);
        // An apostrophe in a description must survive as an apostrophe.
        expect(flat).toContain('Somebody\'s, once.');
    });
});
