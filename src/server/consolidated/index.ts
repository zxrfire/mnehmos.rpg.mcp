/**
 * Consolidated Tools Index
 *
 * Every consolidated tool, action-routed with fuzzy matching and guiding
 * errors. The D&D-era combat, spellcasting and character-sheet tools were
 * retired with the engines behind them; combat is now `combat_manage` over the
 * cultivation layer.
 *
 * A second pass removed six more that were registered and unreachable:
 * `quest_manage`, `party_manage`, `strategy_manage`, `theft_manage`,
 * `corpse_manage` and `improvisation_manage`. Each was imported by this file
 * and by nothing else. `quest_manage` was worse than unused - the design is
 * explicit that this world generates situations rather than quests, and a
 * registered tool for tracked objectives with rewards is an invitation to do
 * the one thing the charter forbids.
 */

// Batch 1 - Simple CRUD
export { SecretManageTool, handleSecretManage } from './secret-manage.js';
export { NarrativeManageTool, handleNarrativeManage } from './narrative-manage.js';

// Batch 3 - Inventory
export { ItemManageTool, handleItemManage } from './item-manage.js';
export { InventoryManageTool, handleInventoryManage } from './inventory-manage.js';

// Batch 5 - World/Spatial
export { WorldManageTool, handleWorldManage } from './world-manage.js';
export { WorldMapTool, handleWorldMap } from './world-map.js';
export { SpatialManageTool, handleSpatialManage } from './spatial-manage.js';

// Batch 6a - NPC/Social
export { NpcManageTool, handleNpcManage } from './npc-manage.js';

// Batch 6b - Utility
export { MathManageTool, handleMathManage } from './math-manage.js';
export { TurnManageTool, handleTurnManage } from './turn-manage.js';

// Batch 6c - Session/Travel/Batch
export { SessionManageTool, handleSessionManage } from './session-manage.js';
export { TravelManageTool, handleTravelManage } from './travel-manage.js';
export { BatchManageTool, handleBatchManage } from './batch-manage.js';

// Batch 7 - Agent (LLM-driven NPCs)
export { AgentManageTool, handleAgentManage } from './agent-manage.js';

// Batch 8 - Constraint-Perception (Layer-1 Operator subsystem)
export { PerceptionManageTool, handlePerceptionManage } from './perception-manage.js';

// Batch 9 - Scene (DM-committed shared narrative state, auto-injected into agent prompts)
export { SceneManageTool, handleSceneManage } from './scene-manage.js';

// Batch 10 - Cultivation (xianxia surface: the LLM narrates, the engine decides)
export { CultivationManageTool, handleCultivationManage } from './cultivation-manage.js';
export { RunManageTool, handleRunManage } from './run-manage.js';
export { TechniqueManageTool, handleTechniqueManage } from './technique-manage.js';
export { AlchemyManageTool, handleAlchemyManage } from './alchemy-manage.js';
export { SectManageTool, handleSectManage } from './sect-manage.js';
export { AdminManageTool, handleAdminManage } from './admin-manage.js';
export { CombatManageTool, handleCombatManage } from './combat-manage.js';

/**
 * Array of all consolidated tool definitions for easy iteration
 */
import { SecretManageTool, handleSecretManage } from './secret-manage.js';
import { NarrativeManageTool, handleNarrativeManage } from './narrative-manage.js';
import { ItemManageTool, handleItemManage } from './item-manage.js';
import { InventoryManageTool, handleInventoryManage } from './inventory-manage.js';
import { WorldManageTool, handleWorldManage } from './world-manage.js';
import { WorldMapTool, handleWorldMap } from './world-map.js';
import { SpatialManageTool, handleSpatialManage } from './spatial-manage.js';
import { NpcManageTool, handleNpcManage } from './npc-manage.js';
import { MathManageTool, handleMathManage } from './math-manage.js';
import { TurnManageTool, handleTurnManage } from './turn-manage.js';
import { SessionManageTool, handleSessionManage } from './session-manage.js';
import { TravelManageTool, handleTravelManage } from './travel-manage.js';
import { BatchManageTool, handleBatchManage } from './batch-manage.js';
import { AgentManageTool, handleAgentManage } from './agent-manage.js';
import { PerceptionManageTool, handlePerceptionManage } from './perception-manage.js';
import { SceneManageTool, handleSceneManage } from './scene-manage.js';
import { CultivationManageTool, handleCultivationManage } from './cultivation-manage.js';
import { RunManageTool, handleRunManage } from './run-manage.js';
import { TechniqueManageTool, handleTechniqueManage } from './technique-manage.js';
import { AlchemyManageTool, handleAlchemyManage } from './alchemy-manage.js';
import { SectManageTool, handleSectManage } from './sect-manage.js';
import { AdminManageTool, handleAdminManage } from './admin-manage.js';
import { CombatManageTool, handleCombatManage } from './combat-manage.js';
import { defineToolContract } from './contracts.js';
import { defineCultivationToolContract } from './cultivation-contracts.js';
import type { ToolContract } from '../tool-metadata.js';

export const ConsolidatedTools: ToolContract[] = [
    defineToolContract(SecretManageTool, handleSecretManage),
    defineToolContract(NarrativeManageTool, handleNarrativeManage),
    defineToolContract(ItemManageTool, handleItemManage),
    defineToolContract(InventoryManageTool, handleInventoryManage),
    defineToolContract(WorldManageTool, handleWorldManage),
    defineToolContract(WorldMapTool, handleWorldMap),
    defineToolContract(SpatialManageTool, handleSpatialManage),
    defineToolContract(NpcManageTool, handleNpcManage),
    defineToolContract(MathManageTool, handleMathManage),
    defineToolContract(TurnManageTool, handleTurnManage),
    defineToolContract(SessionManageTool, handleSessionManage),
    defineToolContract(TravelManageTool, handleTravelManage),
    defineToolContract(BatchManageTool, handleBatchManage),
    defineToolContract(AgentManageTool, handleAgentManage),
    defineToolContract(PerceptionManageTool, handlePerceptionManage),
    defineToolContract(SceneManageTool, handleSceneManage),
    // Cultivation surface. Registered through its own descriptor table so the
    // neutral one stays untouched; the contract shape is identical.
    defineCultivationToolContract(CultivationManageTool, handleCultivationManage),
    defineCultivationToolContract(RunManageTool, handleRunManage),
    defineCultivationToolContract(TechniqueManageTool, handleTechniqueManage),
    defineCultivationToolContract(AlchemyManageTool, handleAlchemyManage),
    defineCultivationToolContract(SectManageTool, handleSectManage),
    defineCultivationToolContract(AdminManageTool, handleAdminManage),
    defineCultivationToolContract(CombatManageTool, handleCombatManage),
];
