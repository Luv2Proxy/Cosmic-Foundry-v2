# Cosmic Foundry

Cosmic Foundry is a browser-based incremental automation game prototype where you grow from manual mining into a planetary and interplanetary industry.

## Run

Open `index.html` in a modern browser.

## Core Features Implemented

- **Interactive planet surface visualization** with curved terrain cells and camera controls (rotate, zoom, pan).
- **Direct building placement** on terrain with zone validation and overlap prevention.
- **Manual logistics links** between placed buildings plus **animated drones** carrying resources.
- **Resource chains** from raw extraction to late-game resources like Quantum Chips and Dark Matter Cores.
- **Energy simulation** with production, demand, and brownouts that throttle buildings.
- **Automation progression** with drone hubs, research upgrades, and orbital production.
- **Building management** with per-building selection, enable/disable toggles, upgrade levels, and mode configuration.
- **Research tree** unlocking copper, silicon, interplanetary expansion, and Dyson swarm mechanics.
- **Planet expansion** including colonization, orbital factories, and satellite collectors.
- **Prestige system**: Cosmic Reformation converts progress into permanent Cosmic Matter bonuses.

## Controls

- **Mouse drag**: rotate planet and pan surface.
- **Mouse wheel**: zoom.
- **Click build button + click terrain cell**: place building.
- **Connection Tool**: click source building then destination building to create a manual logistics connection.
- **Click terrain cell without build mode**: inspect placement.
- **Keyboard**: `Q/E` rotate, `A/D` pan.

## Architecture Overview

The implementation is intentionally data-driven and split by subsystem inside `game.js`:

- **Renderer**: planet projection, terrain visualization, building/drones animations.
- **Placement system**: terrain constraints, cost checks, occupancy checks.
- **Resource simulation**: per-building production recipes and per-tick resource rates.
- **Logistics simulation**: links and drone path interpolation.
- **Energy grid**: demand/production + power ratio effects.
- **Research + prestige systems**: unlock gates and permanent multipliers.
- **Planet model**: supports multiple colonies with varying terrain/resource richness.

The `BUILDINGS`, `RESEARCH`, and `PLANETS` definitions are declarative to keep future expansion easy.
