/**
 * Character state slice - the live sheet, auto-built every invoke.
 *
 * Pulls the character row and inventory directly from the DB. Format is terse
 * and parseable so the LLM can reason about its options without the DM typing
 * it out every turn.
 *
 * Position and action economy (per-turn state) are deliberately NOT included -
 * the DM passes those via the `situation` string at invoke time. This slice
 * covers what is stable across the turn.
 *
 * The spellcasting and legendary-action blocks were removed with the D&D magic
 * and combat engines. An NPC's arts, qi and rank are cultivation state and are
 * read from the cultivator row, not from here.
 */

import { CharacterRepository } from '../../../storage/repos/character.repo.js';
import { InventoryRepository } from '../../../storage/repos/inventory.repo.js';
import { Character, NPC } from '../../../schema/character.js';

const HEADER = '--- YOUR CHARACTER ---';
const INV_LIMIT = 10; // notable items shown

function modifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

function bloodied(hp: number, maxHp: number): string {
    if (hp <= 0) return 'DOWN';
    if (hp <= maxHp / 2) return 'BLOODIED';
    return '';
}

function formatConditions(character: Character | NPC): string {
    if (!character.conditions || character.conditions.length === 0) return 'none';
    return character.conditions.map(c => {
        const dur = c.duration ? ` (${c.duration}r)` : '';
        const src = c.source ? ` <- ${c.source}` : '';
        return `${c.name}${dur}${src}`;
    }).join(', ');
}

function formatStats(character: Character | NPC): string {
    const s = character.stats;
    return [
        `STR ${s.str} (${modifier(s.str)})`,
        `DEX ${s.dex} (${modifier(s.dex)})`,
        `CON ${s.con} (${modifier(s.con)})`,
        `INT ${s.int} (${modifier(s.int)})`,
        `WIS ${s.wis} (${modifier(s.wis)})`,
        `CHA ${s.cha} (${modifier(s.cha)})`
    ].join('  ');
}

function formatSaves(character: Character | NPC): string | null {
    const saves = character.saveProficiencies;
    if (!saves || saves.length === 0) return null;
    return saves.map(s => s.toUpperCase()).join(', ');
}

function formatSkills(character: Character | NPC): string | null {
    const skills = character.skillProficiencies;
    if (!skills || skills.length === 0) return null;
    const formatted = skills.map(s => s.replace(/_/g, ' '));
    return formatted.join(', ');
}

function formatInventory(items: ReturnType<InventoryRepository['getInventoryWithDetails']>['items']): { equipped: string; carried: string } {
    const equipped = items
        .filter(i => i.equipped)
        .map(i => i.item.name)
        .join(', ') || 'nothing';

    const carriedRaw = items
        .filter(i => !i.equipped)
        .slice(0, INV_LIMIT);
    const carried = carriedRaw.length === 0
        ? 'nothing notable'
        : carriedRaw.map(i => i.quantity > 1 ? `${i.item.name} x${i.quantity}` : i.item.name).join(', ');

    return { equipped, carried };
}

export interface CharacterStateSliceDeps {
    characterRepo: CharacterRepository;
    inventoryRepo: InventoryRepository;
}

export function buildCharacterStateSlice(
    characterId: string,
    deps: CharacterStateSliceDeps
): string | null {
    const character = deps.characterRepo.findById(characterId);
    if (!character) return null;

    const lines: string[] = [HEADER];

    // Identity line
    lines.push(`${character.name} - ${character.race ?? 'Human'} ${character.characterClass ?? 'commoner'}, level ${character.level}`);

    // Vital stats line
    const bloodTag = bloodied(character.hp, character.maxHp);
    const blood = bloodTag ? `  [${bloodTag}]` : '';
    lines.push(`HP: ${character.hp}/${character.maxHp}${blood}`);

    // Conditions
    lines.push(`Conditions: ${formatConditions(character)}`);

    // Resistances / immunities (only if present)
    if (character.resistances && character.resistances.length > 0) {
        lines.push(`Resistant to: ${character.resistances.join(', ')}`);
    }
    if (character.immunities && character.immunities.length > 0) {
        lines.push(`Immune to: ${character.immunities.join(', ')}`);
    }
    if (character.vulnerabilities && character.vulnerabilities.length > 0) {
        lines.push(`Vulnerable to: ${character.vulnerabilities.join(', ')}`);
    }

    // Ability scores
    lines.push(`Stats: ${formatStats(character)}`);

    // Saves + skills (only if proficient)
    const saves = formatSaves(character);
    if (saves) lines.push(`Save proficiencies: ${saves}`);
    const skills = formatSkills(character);
    if (skills) lines.push(`Skill proficiencies: ${skills}`);
    if (character.expertise && character.expertise.length > 0) {
        lines.push(`Expertise: ${character.expertise.join(', ')}`);
    }

    // Inventory (only if any items)
    try {
        const inv = deps.inventoryRepo.getInventoryWithDetails(characterId);
        if (inv.items.length > 0) {
            const { equipped, carried } = formatInventory(inv.items);
            lines.push('');
            lines.push('Inventory:');
            lines.push(`  Equipped: ${equipped}`);
            lines.push(`  Carried: ${carried}`);
            if (inv.currency.gold || inv.currency.silver || inv.currency.copper) {
                lines.push(`  Currency: ${inv.currency.gold}gp / ${inv.currency.silver}sp / ${inv.currency.copper}cp`);
            }
        }
    } catch {
        // Inventory queries can fail on minimal test fixtures - silently skip
    }

    return lines.join('\n');
}
