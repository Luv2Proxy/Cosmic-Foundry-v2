# Cosmic Foundry — 3D Modular Factory Planet

This prototype is now focused on a **3D circular planet** with visible ore crystals, 3D-styled buildings and conveyors, a starter quest tree, and data-driven content definitions.

## What Changed

- **Visible ore nodes** are rendered as crystal meshes (not flat markers).
- **3D-like building rendering** on the planetary surface.
- **3D conveyor visualization** with animated moving payloads.
- **Quest Tree** to guide player progression and clarify what to do next.
- **Objective panel** with current recommended action.
- **Modular architecture** through centralized `DEFINITIONS`:
  - `DEFINITIONS.resources`
  - `DEFINITIONS.buildings`
  - `DEFINITIONS.recipes`
  - `DEFINITIONS.oreNodes`
  - `DEFINITIONS.quests`

## Controls

- Drag: rotate / tilt planet
- Mouse wheel: zoom
- Build menu: select building and click valid placement
- Conveyor tool: click source building, then destination building
- Manual Gather Rock for early startup
- Select building to upgrade and cycle recipes

## How To Extend Content

To add new content, update `DEFINITIONS` in `game.js`:

1. Add resource key in `resources`.
2. Add building in `buildings` (optionally with `recipeType`).
3. Add recipes in `recipes[recipeType]` with `{ in, out }`.
4. Add ore nodes in `oreNodes`.
5. Add quest entries in `quests` with a custom `isDone(state)` function.

This allows rapid iteration without changing the core simulation loop.
