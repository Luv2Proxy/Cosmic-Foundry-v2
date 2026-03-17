# Cosmic Foundry — Babylon.js 3D Planet Rewrite

This version now uses **Babylon.js** as requested.

## What changed

- Replaced the prior rendering path with Babylon.js scene/camera/light/mesh pipeline.
- Planet is a true 3D sphere with orbit camera controls.
- Ore nodes render as colored mesh **splotches + crystal meshes**.
- Buildings are 3D meshes and can be placed **anywhere on the planet**.
- **Miner placement remains ore-node-only**.

## Crafting logic fix

Factory flow is now strict and correct:

- Buildings craft from `input` using selected recipe.
- Crafted items are written to `output`.
- Conveyors move **source `output` -> destination `input`**.
- Storage converts incoming items into wallet resources.

This prevents raw input pass-through behavior.

## Manual gathering

- Gather Rock
- Gather Wood
- Gather Biomass

Biomass Burners consume Biomass to generate energy.

## Modular content

Content is centralized in `DEF` in `game.js`:

- `DEF.resources`
- `DEF.buildings`
- `DEF.recipes`
- `DEF.nodes`

Add new buildings/recipes/resources by extending these definitions.
