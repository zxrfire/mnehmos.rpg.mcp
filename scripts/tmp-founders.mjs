import fs from 'node:fs';
const f = 'src/web/register.ts';
const raw = fs.readFileSync(f, 'utf-8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let s = raw.split(/\r?\n/).join('\n');
const need = a => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 60)); };

need('    for (const w of WANDERERS) {');
s = s.replace('    for (const w of WANDERERS) {', `    // The apexes were founded by people who crossed, and the Court has produced
    // six. None of them are in SECT_ANCESTRY, because none of those bodies is a
    // sect - so the ascended half of this page was missing everybody who
    // actually built the top of the world.
    //
    // Unnamed for now, and summarised per body rather than repeated six times
    // as identical rows, because a count is what the catalog holds.
    //
    // Whether they are still up there is derived rather than guessed: an
    // answering channel means somebody above the Lid is picking up. That is what
    // the channel IS. A body whose channel still answers has at least one
    // founder alive on the other side.
    for (const standing of LINEAGE_STANDINGS) {
        const alreadyNamed = (SECT_ANCESTRY[standing.factionId]?.ancestors ?? [])
            .filter(a => a.fate === 'ascended').length;
        const unnamed = standing.count - alreadyNamed;
        if (unnamed <= 0) continue;

        const channel = IMMORTAL_CHANNELS.find(c => c.factionId === standing.factionId);
        const answering = channel?.kind === 'answering_channel';
        const ordinal = REALM_TIERS[REALM_TIERS.length - 1].ordinalStart;

        out.push({
            name: unnamed === 1 ? 'the founder' : \`\${unnamed} who crossed\`,
            named: false,
            ordinal,
            rank: rankName(ordinal),
            state: answering ? 'ascended' : 'ascended, unheard',
            alive: answering,
            factionName: nameOf(standing.factionId),
            factionOrdinal: getSect(standing.factionId)?.powerOrdinal
                ?? getApexInstitution(standing.factionId)?.powerOrdinal
                ?? 0,
            note: (standing.mostRecentCrossingYearsAgo === null
                ? ''
                : \`Most recent crossing \${standing.mostRecentCrossingYearsAgo.toLocaleString()} years ago. \`)
                + (answering
                    ? 'The channel still answers, which is how the sheet knows somebody is up there: an answering channel is somebody picking up.'
                    : 'Nothing has answered in a long time, and the sheet does not claim to know why.')
                + ' Names are not recorded here yet.'
        });
    }

    for (const w of WANDERERS) {`);

// the imports the block needs
need("import { IMMORTAL_CHANNELS, LINEAGE_STANDINGS } from '../data/cultivation/crossings.js';");

fs.writeFileSync(f, s.split('\n').join(eol));
console.log('apex and Court founders reach the people page');
