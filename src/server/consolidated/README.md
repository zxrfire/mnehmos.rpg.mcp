<!-- tier: 3 -->

# The MCP tool surface

Every tool the runtime agent can call, one file per tool. This is the boundary the
[authority rule](../../../context.md) is enforced at: **a model reaches the engine only
through a contract in here**, and each one validates its arguments before anything touches
the database.

The tools are CONSOLIDATED on purpose - `batch_manage` says so in its own header, replacing
six tools with one taking six actions. That keeps the context a model has to hold small
enough to reason over, which is the same argument [`src/web/README.md`](../../web/README.md)
makes for the closed action enum. Adding a tool is therefore a deliberate act: prefer an
action on an existing one.

Two things that surprise people:

- **`cultivation-support.ts` is not a tool.** It is the repository bundle everything here
  shares, and it is where `ensureCultivationDb` lives.
- **The D&D-era tools are still here** - combat, spells, characters, parties. The substrate
  was retained when the engine forked to xianxia; see the fork note in
  [`AGENTS.md`](../../../AGENTS.md). A tool named for a 5e concept is usually the generic
  machine underneath it rather than dead weight, but check before building beside one.

| file | what it is |
|---|---|
| [`admin-manage.ts`](./admin-manage.ts) | Consolidated Admin Tool - `admin_manage` |
| [`admin-said-as-a-sentence.ts`](./admin-said-as-a-sentence.ts) | ADMIN, typed the way a person actually types it. |
| [`agent-manage.ts`](./agent-manage.ts) | Consolidated agent_manage tool |
| [`alchemy-manage.ts`](./alchemy-manage.ts) | Consolidated Alchemy Tool - `alchemy_manage` |
| [`batch-manage.ts`](./batch-manage.ts) | Consolidated batch_manage tool Replaces: batch_create_characters, batch_create_npcs, batch_distribute_items, execute_workflow, list_templates, get_template 6 tools → 1 tool with 6 actions |
| [`character-record.ts`](./character-record.ts) | Creating a character row. |
| [`combat-manage.ts`](./combat-manage.ts) | Consolidated Combat Tool - `combat_manage` |
| [`contracts.ts`](./contracts.ts) | - |
| [`cultivation-contracts.ts`](./cultivation-contracts.ts) | Tool contracts for the cultivation surface. |
| [`cultivation-manage.ts`](./cultivation-manage.ts) | Consolidated Cultivation Tool - `cultivation_manage` |
| [`cultivation-mortal.ts`](./cultivation-mortal.ts) | The low-realm loop: what a poor cultivator does between breakthroughs. |
| [`cultivation-perception.ts`](./cultivation-perception.ts) | The two questions a narrator has to be able to ask before it writes a line. |
| [`cultivation-support.ts`](./cultivation-support.ts) | Shared plumbing for the cultivation MCP tool surface. |
| [`forcing-an-attempt-to-land.ts`](./forcing-an-attempt-to-land.ts) | Forcing an attempt to land - what ADMIN reaches inside an ordinary verb. |
| [`index.ts`](./index.ts) | Consolidated Tools Index Every consolidated tool, action-routed with fuzzy matching and guiding errors. |
| [`inventory-manage.ts`](./inventory-manage.ts) | Consolidated Inventory Management Tool Replaces 9 separate tools: give_item, remove_item, transfer_item, use_item, extinguish_light, equip_item, unequip_item, get_inventory, get_inventory_detailed |
| [`item-manage.ts`](./item-manage.ts) | Consolidated Item Management Tool Replaces 6 separate tools: create_item_template, get_item, list_items, search_items, update_item, delete_item |
| [`math-manage.ts`](./math-manage.ts) | Consolidated Math Management Tool Replaces 5 separate tools: dice_roll, probability_calculate, algebra_solve, algebra_simplify, physics_projectile |
| [`narrative-manage.ts`](./narrative-manage.ts) | Consolidated Narrative Management Tool |
| [`npc-manage.ts`](./npc-manage.ts) | Consolidated NPC Management Tool Replaces 7 separate tools for NPC relationship and memory tracking: get_npc_relationship, update_npc_relationship, record_conversation_memory, get_conversation_history, get_recent_interactions, get_npc_context, interact_socially |
| [`perception-manage.ts`](./perception-manage.ts) | perception_manage - the Operator's constraint-perception lens. |
| [`run-manage.ts`](./run-manage.ts) | Consolidated Run Tool - `run_manage` |
| [`scene-manage.ts`](./scene-manage.ts) | scene_manage - DM-committed shared narrative state. |
| [`secret-manage.ts`](./secret-manage.ts) | Consolidated Secret Management Tool |
| [`sect-guest.ts`](./sect-guest.ts) | The guest roll: `sect_manage({ action: 'guest' })`. |
| [`sect-leadership.ts`](./sect-leadership.ts) | Authority inside a house: ordering the rungs below, and running the place. |
| [`sect-manage.ts`](./sect-manage.ts) | Consolidated Sect Tool - `sect_manage` |
| [`sect-politics.ts`](./sect-politics.ts) | Sect politics: the half of a sect that is not a stipend. |
| [`sect-probation.ts`](./sect-probation.ts) | The far end of a published door: reading a probation, and applying what the house decided. |
| [`session-manage.ts`](./session-manage.ts) | Consolidated session_manage tool Replaces: initialize_session, get_narrative_context 2 tools → 1 tool with 2 actions |
| [`spatial-manage.ts`](./spatial-manage.ts) | Consolidated Spatial Management Tool Replaces 5 separate tools for spatial/room operations: look_at_surroundings, generate_room_node, get_room_exits, move_character_to_room, list_rooms |
| [`technique-manage.ts`](./technique-manage.ts) | Consolidated Technique Tool - `technique_manage` |
| [`travel-manage.ts`](./travel-manage.ts) | Consolidated travel_manage tool Replaces: travel_to_location, loot_encounter, rest_party 3 tools → 1 tool with 3 actions |
| [`turn-manage.ts`](./turn-manage.ts) | Consolidated Turn Management Tool Replaces 5 separate tools: init_turn_state, get_turn_status, submit_turn_actions, mark_ready, poll_turn_results |
| [`where-a-cultivator-is-standing.ts`](./where-a-cultivator-is-standing.ts) | Where a cultivator is standing, as a province and a place. |
| [`world-manage.ts`](./world-manage.ts) | Consolidated World Management Tool Replaces 7 separate tools for world lifecycle management: create_world, get_world, list_worlds, delete_world, update_world_environment, generate_world, get_world_state |
| [`world-map.ts`](./world-map.ts) | Consolidated World Map Tool Replaces 7 separate tools for world map operations: get_world_map_overview, get_region_map, get_world_tiles, apply_map_patch, preview_map_patch, find_valid_poi_location, suggest_poi_locations |
