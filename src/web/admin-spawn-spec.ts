/** ADMIN reads requested facts; the spawn handler validates and writes them. */
import { z } from 'zod';
import type { LLMProvider } from '../agent/provider/types.js';
import { MAX_ORDINAL } from '../engine/cultivation/realms.js';
import { SECTS } from '../data/cultivation/sects.js';
import { HOUSE_TYPE_NOUNS, theHouseNameSaid } from './what-a-house-is-called.js';
import { ordinalNamed } from '../server/consolidated/admin-said-as-a-sentence.js';
import { extractJsonObject } from './actions.js';

export const AdminSpawnSpecSchema = z.object({
    ordinal: z.number().int().min(0).max(MAX_ORDINAL).optional(),
    sex: z.enum(['female', 'male']).optional(),
    age: z.number().finite().nonnegative().optional(),
    house: z.string().min(1).max(120).optional(),
    rank: z.string().min(1).max(100).optional(),
    species: z.string().min(1).max(80).optional(),
    name: z.string().min(1).max(100).optional(),
    temperament: z.enum(['generous', 'stingy', 'reticent', 'expressive', 'proud', 'unassuming']).optional(),
    unusedWords: z.array(z.string()).optional()
}).strict();

export type AdminSpawnSpec = z.infer<typeof AdminSpawnSpecSchema>;

/** A bare ordinal and explicit legacy pairs keep the existing spawn path. */
export function needsSpawnReading(request: string, args: Record<string, unknown>): boolean {
    if (['sex', 'age', 'house', 'rank', 'temperament'].some(k => args[k] !== undefined)) return true;
    const prose = request.split(/\b[a-z_]+=/i)[0]!;
    let remainder = prose.toLowerCase()
        .replace(/\b(?:spawn_encounter|spawn_npc|spawn_person|spawn_cultivator|stage_encounter)\b/g, '')
        .replace(/\b(?:spawn|an?|the|encounter|of|at|ordinal|npc|person|cultivator|enemy|opponent|in|front|me)\b/g, '')
        .replace(/\d+/g, '').trim();
    for (const word of ordinalNamed(prose)?.words ?? []) remainder = remainder.replace(new RegExp(`\\b${word}\\b`, 'i'), '').trim();
    return remainder.length > 0;
}

/** The supported word table, used when no model answers. */
function readWithoutAModel(input: string): AdminSpawnSpec {
    let rest = input.trim();
    const spec: AdminSpawnSpec = {};
    const take = (pattern: RegExp): RegExpExecArray | null => {
        const match = pattern.exec(rest);
        if (match) rest = rest.slice(0, match.index) + ' ' + rest.slice(match.index + match[0].length);
        return match;
    };
    const ordinal = take(/\bordinal\s*[=:]?\s*(-?\d+(?:\.\d+)?)\b/i);
    if (ordinal) spec.ordinal = Number(ordinal[1]);
    const name = take(/\b(?:[Nn]amed|[Cc]alled|[Nn]ame\s*[=:]?)\s*(?:"([^"]+)"|'([^']+)'|([\w'-]+(?:\s+[A-Z][\w'-]+)*))/);
    if (name) spec.name = name[1] ?? name[2] ?? name[3];
    const age = take(/\b(?:age(?:d)?\s*[=:]?\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*(?:years? old|year-old))\b/i);
    if (age) spec.age = Number(age[1] ?? age[2]);
    if (!ordinal) {
        const named = ordinalNamed(rest);
        if (named) {
            spec.ordinal = named.ordinal;
            for (const word of named.words) take(new RegExp(`\\b${word}\\b`, 'i'));
        }
    }
    const sex = take(/\b(female|girl|woman|lady|male|boy|man|fellow)\b/i);
    if (sex) spec.sex = /^(female|girl|woman|lady)$/i.test(sex[1]!) ? 'female' : 'male';
    const temperament = take(/\b(generous|stingy|reticent|expressive|proud|unassuming)\b/i);
    if (temperament) spec.temperament = temperament[1]!.toLowerCase() as AdminSpawnSpec['temperament'];
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
                        + 'Preserve unknown house and rank names so the engine can refuse them. '
                        + 'A girl is female, a boy is male. A fox transformed into a person has species="fox". '
                        + 'Use unusedWords for requests outside the schema. JSON Schema: '
                        + JSON.stringify({ type: 'object', additionalProperties: false, properties: {
                            ordinal: { type: 'integer', minimum: 0, maximum: MAX_ORDINAL },
                            sex: { enum: ['female', 'male'] }, age: { type: 'number', minimum: 0 },
                            house: { type: 'string' }, rank: { type: 'string' }, species: { type: 'string' },
                            name: { type: 'string' }, temperament: { enum: AdminSpawnSpecSchema.shape.temperament.unwrap().options },
                            unusedWords: { type: 'array', items: { type: 'string' } }
                        } }) },
                    { role: 'user', content: input }
                ]
            });
            const parsed = AdminSpawnSpecSchema.safeParse(extractJsonObject(result.text));
            if (parsed.success) return parsed.data;
        } catch { /* The same supported words remain usable without a provider. */ }
    }
    // Bounds are checked by the handler so a refusal carries the requested number.
    return readWithoutAModel(input);
}
