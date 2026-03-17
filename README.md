# Cosmic Foundry — Custom 3D Planet Engine Rewrite

This version is a full rewrite with a **custom in-project 3D planet engine** (canvas-based), focused on making factory logic actually work.

## Major fixes

- Buildings now process correctly with strict pipeline:
  - **Conveyor reads source `output`**
  - **Conveyor writes destination `input`** (or wallet for Storage)
  - Crafting consumes `input` and creates crafted `output`
- This fixes the previous issue where items were effectively passed through without producing crafted outputs.

## Visual / interaction changes

- 3D circular planet with rotation + tilt + zoom controls
- Visible ore nodes as **colored splotches + crystal meshes**
- 3D-styled buildings and animated conveyor payloads
- Building placement anywhere on planet surface
- **Miner still restricted to ore nodes only**

## Manual gathering

- Gather Rock
- Gather Wood
- Gather Biomass

Biomass is consumed by Biomass Burners to generate power.

## Data-driven modular setup

The game is defined via `DEF` in `game.js`:

- `DEF.resources`
- `DEF.buildings`
- `DEF.recipes`
- `DEF.nodes`

Add new content by extending those definitions.

## Guidance

Right panel includes a “next objective” plus checklist so it is clear what to do at each step.
