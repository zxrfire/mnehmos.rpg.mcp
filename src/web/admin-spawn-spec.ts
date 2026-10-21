/** ADMIN reads requested facts; the spawn handler validates and writes them. */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { LLMProvider } from '../agent/provider/types.js';
import { MAX_ORDINAL, REALM_TIERS } from '../engine/cultivation/realms.js';
import { SECTS } from '../data/cultivation/sects.js';
import { HOUSE_TYPE_NOUNS, theHouseNameSaid } from './what-a-house-is-called.js';
import { ordinalNamed } from '../server/consolidated/admin-said-as-a-sentence.js';
import { extractJsonObject } from './actions.js';

export const AdminSpawnSpecSchema = z.object({
    ordinal: z.number().int().min(0).max(MAX_ORDINAL).optional().describe('Cultivation realm, not a house rank. For a realm without a subrank use its first ordinal: '
        + REALM_TIERS.map(tier => `${tier.name}: ${tier.subRanks.map((rank, i) => `${rank}=${tier.ordinalStart + i}`).join(', ')}`).join('; ')),
    sex: z.enum(['female', 'male']).optional().describe('female: girl, woman or lady; male: boy, man or fellow.'),
    age: z.number().finite().nonnegative().optional().describe('Explicit age in years only. Omit for young or adult without a number; the handler defaults to 20.'),
    house: z.string().min(1).max(120).nullable().optional().describe('Named house membership. null means rogue cultivator, no house or unaffiliated. Omit if unspecified.'),
    rank: z.string().min(1).max(100).optional().describe('A rank on a house roll, never a cultivation realm.'),
    species: z.string().min(1).max(80).optional(),
    name: z.string().min(1).max(100).optional(),
    temperament: z.enum(['generous', 'stingy', 'reticent', 'expressive', 'proud', 'unassuming']).optional()
        .describe('generous: readily shares; stingy: keeps possessions; reticent: reserved; expressive: forthcoming; proud: values face; unassuming: little concern for face.'),
    disposition: z.enum(['hostile', 'wary', 'indifferent', 'friendly', 'close', 'sworn_sibling']).optional()
        .describe('hostile: enemy or means harm; wary: suspicious or cautious; indifferent: neither friendly nor hostile; friendly: nice, kind or helpful now, without changing character; close: best friend or old companion, a strong real tie; sworn_sibling: sworn brother or sister, close with the real oath and lineage bond. Generous describes temperament, not disposition.'),
    toward: z.string().min(1).optional().describe('Whom disposition concerns: me for the player, or a named real world person.'),
    alignment: z.enum(['righteous', 'neutral', 'demonic']).optional()
        .describe('righteous: righteous leaning; neutral: neutral leaning; demonic: demonic leaning, the nearest value for evil (report that guess). Selects a house of this leaning unless explicitly unaffiliated; personal alignment is read from actual deeds.'),
    location: z.string().optional(),
    seal: z.object({
        kind: z.enum(['qi', 'slave']).describe('qi: locks qi; slave: absolute compulsion by the holder.'),
        holder: z.string().min(1).describe('me: the player; otherwise the stated name of a real world person.')
    }).strict().optional(),
    guesses: z.array(z.object({ word: z.string(), field: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]) }).strict()).optional()
        .describe('Report every nearest-value guess: the original word, field and chosen allowed value. Exact values require no guess note.'),
    unusedWords: z.array(z.string()).optional()
}).strict();

/** The handler and model both extend/read this shape; no hand-written property list. */
export const adminSpawnJsonSchema = zodToJsonSchema(AdminSpawnSpecSchema, { $refStrategy: 'none' });

export type AdminSpawnSpec = z.infer<typeof AdminSpawnSpecSchema>;

/** A bare ordinal and explicit legacy pairs keep the existing spawn path. */
export function needsSpawnReading(request: string, args: Record<string, unknown>): boolean {
    if (['sex', 'age', 'house', 'rank', 'temperament', 'seal', 'disposition', 'alignment', 'toward'].some(k => args[k] !== undefined)) return true;
    const prose = request.replace(/\b[a-z_]+=(?:"[^"]*"|'[^']*'|\S+)/gi, '');
    let remainder = prose.toLowerCase()
        .replace(/\b(?:spawn_encounter|spawn_npc|spawn_person|spawn_cultivator|stage_encounter)\b/g, '')
        .replace(/\b(?:spawn|an?|the|encounter|of|at|ordinal|npc|person|cultivator|enemy|opponent|in|front|me)\b/g, '')
        .replace(/\d+/g, '').trim();
    for (const word of ordinalNamed(prose)?.words ?? []) remainder = remainder.replace(new RegExp(`\\b${word}\\b`, 'i'), '').trim();
    return remainder.length > 0;
}

/** Explicit numeric pairs end at their number; following prose belongs to the reader. */
export function explicitSpawnArgs(args: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(args).map(([key, value]) => {
        const field = AdminSpawnSpecSchema.shape[key as keyof typeof AdminSpawnSpecSchema.shape];
        if (field?.unwrap() instanceof z.ZodNumber && typeof value === 'string') {
            const first = value.trim().split(/\s+/)[0]!;
            if (first !== '' && Number.isFinite(Number(first))) return [key, Number(first)];
        }
        return [key, value];
    }));
}

/** The supported word table, used when no model answers. */
function readWithoutAModel(input: string): AdminSpawnSpec {
    let rest = input.trim();
    const spec: AdminSpawnSpec = {};
    const guess = (word: string, field: 'disposition' | 'temperament' | 'alignment', value: string) => {
        (spec.guesses ??= []).push({ word, field, value });
    };
    const take = (pattern: RegExp): RegExpExecArray | null => {
        const match = pattern.exec(rest);
        if (match) rest = rest.slice(0, match.index) + ' ' + rest.slice(match.index + match[0].length);
        return match;
    };
    const name = take(/\b(?:[Nn]amed|[Cc]alled|[Nn]ame\s*[=:]?)\s*(?:"([^"]+)"|'([^']+)'|([\w'-]+(?:\s+[A-Z][\w'-]+)*))/);
    if (name) spec.name = name[1] ?? name[2] ?? name[3];
    const seal = take(/\b(?:a\s+)?(slave|qi)[ -]sealed\s+(?:to|by)\s+(me|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*)\b/)
        ?? take(/\b(?:a\s+)?(slave|qi)\s+seal(?:ed)?\s+(?:to|by)\s+(me|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*)\b/);
    if (seal) spec.seal = { kind: seal[1]!.toLowerCase() as 'qi' | 'slave', holder: seal[2]! };
    if (!seal && take(/\bwhose qi I have sealed\b/i)) spec.seal = { kind: 'qi', holder: 'me' };
    const exactDisposition = take(/\b(hostile|wary|indifferent|friendly|close|sworn[ _]sibling)\b/i);
    if (exactDisposition) spec.disposition = exactDisposition[1]!.toLowerCase().replace(' ', '_') as AdminSpawnSpec['disposition'];
    const close = take(/\b(best friend|old companion|sworn brother|sworn sister)\b(?:\s+(?:to|of|with)\s+(me|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*))?/);
    if (close && !exactDisposition) {
        spec.disposition = /^sworn/.test(close[1]!) ? 'sworn_sibling' : 'close';
        if (close[2]) spec.toward = close[2];
        if (!['close', 'sworn sibling'].includes(close[1]!)) guess(close[1]!, 'disposition', spec.disposition);
    }
    const disposition = take(/\b(hostile|enemy|wary|suspicious|cautious|indifferent|friendly|nice|kind|helpful)\b/i);
    if (disposition && !close && !exactDisposition) spec.disposition = /^(nice|kind|helpful|friendly)$/i.test(disposition[1]!) ? 'friendly'
        : /^(wary|suspicious|cautious)$/i.test(disposition[1]!) ? 'wary' : /^enemy$/i.test(disposition[1]!) ? 'hostile'
            : disposition[1]!.toLowerCase() as 'hostile' | 'indifferent';
    const exactAlignment = take(/\b(righteous|neutral|demonic)\b/i);
    const nearbyAlignment = take(/\b(evil)\b/i);
    const alignment = exactAlignment ?? nearbyAlignment;
    if (alignment) spec.alignment = /^evil$/i.test(alignment[1]!) ? 'demonic' : alignment[1]!.toLowerCase() as 'righteous' | 'neutral' | 'demonic';
    if (disposition && !close && !exactDisposition && !['hostile', 'wary', 'indifferent', 'friendly'].includes(disposition[1]!.toLowerCase()))
        guess(disposition[1]!, 'disposition', spec.disposition!);
    if (alignment && !['righteous', 'neutral', 'demonic'].includes(alignment[1]!.toLowerCase()))
        guess(alignment[1]!, 'alignment', spec.alignment!);
    const ordinal = take(/\bordinal\s*[=:]?\s*(-?\d+(?:\.\d+)?)\b/i);
    if (ordinal) spec.ordinal = Number(ordinal[1]);
    if (spec.disposition && !spec.toward) {
        const toward = take(/\b(?:toward|towards|to)\s+(me|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*)\b/);
        if (toward) spec.toward = toward[1];
    }
    const location = take(/\b(?:location\s*[=:]?\s*|(?:at|in)\s+)(?:"([^"]+)"|'([^']+)')/i);
    if (location) spec.location = location[1] ?? location[2];
    const age = take(/\b(?:age(?:d)?\s*[=:]?\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*(?:years? old|year-old))\b/i);
    if (age) spec.age = Number(age[1] ?? age[2]);
    if (!ordinal) {
        const named = ordinalNamed(rest) ?? ordinalNamed(rest.replace(/\bFoundation\b/i, 'Foundation Establishment'));
        if (named) {
            spec.ordinal = named.ordinal;
            for (const word of named.words) take(new RegExp(`\\b${word}\\b`, 'i'));
        }
    }
    const sex = take(/\b(female|girl|woman|lady|male|boy|man|fellow)\b/i);
    if (sex) spec.sex = /^(female|girl|woman|lady)$/i.test(sex[1]!) ? 'female' : 'male';
    const temperament = take(/\b(generous|stingy|reticent|expressive|proud|unassuming)\b/i);
    if (temperament) spec.temperament = temperament[1]!.toLowerCase() as AdminSpawnSpec['temperament'];
    const nearbyTemperament = take(/\b(cheerful|greedy|haughty|quiet)\b/i);
    if (nearbyTemperament && !temperament) {
        spec.temperament = ({ cheerful: 'expressive', greedy: 'stingy', haughty: 'proud', quiet: 'reticent' } as const)
            [nearbyTemperament[1]!.toLowerCase() as 'cheerful' | 'greedy' | 'haughty' | 'quiet'];
        guess(nearbyTemperament[1]!, 'temperament', spec.temperament);
    }
    const beast = take(/\b(?:transformed from|changed from)\s+(?:an?\s+)?([\w-]+)/i)
        ?? take(/\b([\w-]+)\s+that\s+(?:took human form|transformed)\b/i);
    if (beast) spec.species = beast[1];
    const species = take(/\b(?:species|beast)\s*[=:]?\s+([\w-]+)/i);
    if (species) spec.species = species[1];

    const knownHouse = theHouseNameSaid(rest);
    if (knownHouse) {
        spec.house = knownHouse;
        take(new RegExp(`\\b(?:the\\s+)?${knownHouse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
    }
    const ranks = [...new Set(SECTS.flatMap(s => s.ranks))].sort((a, b) => b.length - a.length);
    for (const rank of ranks) {
        if (take(new RegExp(`\\b${rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))) {
            spec.rank = rank;
            break;
        }
    }
    const explicitRank = take(/\b(?:rank|rung)\s*[=:]?\s*(?:"([^"]+)"|([^,;]+))/i);
    if (explicitRank) spec.rank = (explicitRank[1] ?? explicitRank[2])!.trim();
    rest = rest.replace(/\b(?:spawn_encounter|spawn_npc|spawn_person|spawn_cultivator|stage_encounter|spawn|encounter|npc|cultivator|person|enemy|opponent|an?|the|of|at|from|in|front|me|with)\b/gi, ' ');
    if (!spec.house) {
        const house = take(new RegExp(`\\b((?:[\\w'-]+\\s+)*(?:${HOUSE_TYPE_NOUNS.join('|')}))\\b`, 'i'));
        if (house) spec.house = house[1]!.trim().replace(/\s+/g, ' ');
    }
    // An unnamed disciple rung is still a requested rung, and must be validated.
    if (!spec.rank) {
        const rank = take(/\b((?:[\w'-]+\s+)?(?:disciple|elder|servant|seat))\b/i);
        if (rank) spec.rank = rank[1]!.trim();
    }
    spec.unusedWords = rest.split(/\s+/).map(w => w.replace(/^[,.;:]+|[,.;:]+$/g, '')).filter(Boolean);
    return spec;
}

/** Same provider, model and timeout as phase one; malformed replies use the table. */
export async function readAdminSpawnSpec(
    input: string,
    provider?: { provider: LLMProvider; model: string; signal?: AbortSignal }
): Promise<AdminSpawnSpec> {
    if (provider) {
        try {
            const result = await provider.provider.call({
                model: provider.model, signal: provider.signal, temperature: 0, maxTokens: 800,
                messages: [
                    { role: 'system', content: 'You read an ADMIN spawn request into facts, never an outcome. '
                        + 'Return only one JSON object. Omit unspecified fields; do not invent a name, ordinal, age or house. '
                        + 'Mapping a stated realm or subrank through the ordinal schema is reading it, not inventing an ordinal. Read the whole request, including prose after explicit pairs. '
                        + 'Preserve unknown house and rank names so the engine can refuse them. '
                        + 'A girl is female, a boy is male. A fox transformed into a person has species="fox". '
                        + 'An exact allowed value always wins in its field. For words with no exact fit, best-guess the nearest allowed value in the most fitting field: '
                        + 'cheerful means temperament expressive; kind means disposition friendly; greedy means temperament stingy; haughty means temperament proud; quiet means temperament reticent. '
                        + 'Report every guess in guesses; exact matches need no note. unusedWords is only for facts no field covers, such as a red robe or scar. JSON Schema: '
                        + JSON.stringify(adminSpawnJsonSchema) },
                    { role: 'user', content: input }
                ]
            });
            const parsed = AdminSpawnSpecSchema.safeParse(extractJsonObject(result.text));
            if (parsed.success) {
                const fallback = readWithoutAModel(input);
                // Exact values in the sentence outrank the model's nearest-value interpretation.
                for (const field of ['disposition', 'temperament', 'alignment'] as const) {
                    const schema = AdminSpawnSpecSchema.shape[field].unwrap();
                    const exact = schema.options.find(value => fallback[field] === value
                        && new RegExp(`\\b${value.replace('_', '[ _]')}\\b`, 'i').test(input));
                    if (exact) Object.assign(parsed.data, { [field]: exact });
                }
                const guesses = [...(parsed.data.guesses ?? []), ...(fallback.guesses ?? [])]
                    .filter(guess => {
                        const value = guess.field.split('.').reduce<unknown>((at, key) =>
                            at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined, parsed.data);
                        return value === guess.value;
                    })
                    .filter((guess, at, all) => all.findIndex(other => other.word === guess.word && other.field === guess.field) === at);
                return { ...parsed.data, ...(guesses.length ? { guesses } : {}) };
            }
        } catch { /* The same supported words remain usable without a provider. */ }
    }
    // Bounds are checked by the handler so a refusal carries the requested number.
    return readWithoutAModel(input);
}
