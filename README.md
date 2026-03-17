# Cosmic Foundry (2D Factory Build)

This version pivots to a **2D Satisfactory-style factory prototype**:

- Buildings are placed on **edge slots** around the map.
- **Ore nodes** (Iron, Copper, Limestone) exist in-map.
- **Miners must be placed directly on ore nodes**.
- **Conveyors are manually placed** between buildings.
- Conveyors route ore/components into **Smelters**, **Constructors**, or **Storage**.

## Run

Open `index.html` in a browser.

## Controls

- Select a building from **Build Menu**, then click valid placement:
  - Miner: ore node only
  - Smelter / Constructor / Storage / Power: edge slot only
- Toggle **Conveyor Tool**:
  - click source building
  - click destination building
- Click a building to select it and use **upgrade** / **recipe mode** controls.
- **Manual Gather Rock** gives starter build currency.

## Crafting Flow (Satisfactory-inspired)

- Iron Ore → Smelter (iron recipe) → Iron Ingot → Constructor (plate recipe) → Iron Plate
- Copper Ore → Smelter (copper recipe) → Copper Ingot → Constructor (wire recipe) → Wire
- Limestone → Constructor (concrete recipe) → Concrete

Storage acts as a sink that adds incoming items to your wallet/resources.
