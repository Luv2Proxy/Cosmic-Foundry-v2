const TAU = Math.PI * 2;

const RESOURCES = [
  "Rock",
  "Iron Ore",
  "Copper Ore",
  "Silicon",
  "Ice",
  "Metal Plates",
  "Copper Wire",
  "Steel",
  "Silicon Wafers",
  "Circuits",
  "Motors",
  "Processors",
  "Nanotubes",
  "Quantum Chips",
  "Dark Matter Cores",
  "Mechanical Parts",
  "Research Data",
  "Cosmic Matter",
];

const BUILDINGS = {
  miningDrill: {
    name: "Mining Drill",
    color: "#f4aa5a",
    cost: { Rock: 10 },
    upgradeCost: { "Metal Plates": 12 },
    power: 2,
    allowed: ["mountain", "volcanic", "desert"],
    tick: (b, planet, mul) => {
      const zoneBonus = b.zone === "mountain" ? 1.4 : b.zone === "volcanic" ? 1.2 : 1;
      const levelBonus = 1 + (b.level - 1) * 0.35;
      gainResource(planet, "Iron Ore", 0.6 * zoneBonus * levelBonus * mul);
      gainResource(planet, "Rock", 0.45 * zoneBonus * levelBonus * mul);
      if (planet.state.flags.copperUnlocked) {
        gainResource(planet, "Copper Ore", 0.34 * zoneBonus * levelBonus * mul);
      }
      if (b.config.mode === "silicon") {
        gainResource(planet, "Silicon", 0.22 * levelBonus * mul);
      }
    },
  },
  smelter: {
    name: "Smelter",
    color: "#ff6f6f",
    cost: { Rock: 14, "Iron Ore": 8 },
    upgradeCost: { "Metal Plates": 16, Steel: 8 },
    power: 4,
    allowed: ["mountain", "volcanic", "desert", "ice"],
    tick: (b, planet, mul) => {
      const levelBonus = 1 + (b.level - 1) * 0.3;
      if (consumeResource(planet, "Iron Ore", 0.75)) gainResource(planet, "Metal Plates", 0.62 * levelBonus * mul);
      if (consumeResource(planet, "Rock", 0.3)) gainResource(planet, "Steel", 0.2 * levelBonus * mul);
      if (planet.state.flags.copperUnlocked && consumeResource(planet, "Copper Ore", 0.35)) {
        gainResource(planet, "Copper Wire", 0.5 * levelBonus * mul);
      }
      if (planet.state.flags.siliconUnlocked && consumeResource(planet, "Silicon", 0.33)) {
        gainResource(planet, "Silicon Wafers", 0.3 * levelBonus * mul);
      }
    },
  },
  factory: {
    name: "Factory",
    color: "#8ac7ff",
    cost: { "Metal Plates": 18, "Copper Wire": 12 },
    upgradeCost: { Processors: 3, Motors: 5 },
    power: 7,
    allowed: ["desert", "mountain", "ice"],
    tick: (b, planet, mul) => {
      const levelBonus = 1 + (b.level - 1) * 0.3;
      if (consumeResource(planet, "Metal Plates", 0.65) && consumeResource(planet, "Copper Wire", 0.75)) {
        gainResource(planet, "Mechanical Parts", 0.42 * levelBonus * mul);
      }
      if (consumeResource(planet, "Copper Wire", 0.55) && consumeResource(planet, "Steel", 0.32)) {
        gainResource(planet, "Motors", 0.2 * levelBonus * mul);
      }
      if (consumeResource(planet, "Mechanical Parts", 0.5) && consumeResource(planet, "Silicon Wafers", 0.38)) {
        gainResource(planet, "Processors", 0.17 * levelBonus * mul);
      }
      if (consumeResource(planet, "Processors", 0.12) && consumeResource(planet, "Silicon Wafers", 0.24)) {
        gainResource(planet, "Quantum Chips", 0.08 * levelBonus * mul);
      }
    },
  },
  powerGenerator: {
    name: "Power Generator",
    color: "#67ff9f",
    cost: { Rock: 16, "Metal Plates": 6 },
    upgradeCost: { Steel: 12, Motors: 3 },
    power: -18,
    allowed: ["desert", "mountain", "volcanic"],
    tick: (b, planet) => {
      const levelBonus = 1 + (b.level - 1) * 0.4;
      const zoneBonus = b.zone === "desert" ? 1.35 : b.zone === "volcanic" ? 1.16 : 1;
      planet.energyProduced += 0.45 * zoneBonus * levelBonus;
    },
  },
  storageDepot: {
    name: "Storage Depot",
    color: "#b39ddb",
    cost: { Rock: 12 },
    upgradeCost: { "Metal Plates": 10, Steel: 5 },
    power: 1,
    allowed: ["mountain", "desert", "ice", "volcanic"],
    tick: (b, planet) => {
      const levelBonus = 1 + (b.level - 1) * 0.5;
      planet.storageCap += 260 * levelBonus;
    },
  },
  droneHub: {
    name: "Drone Hub",
    color: "#40e0d0",
    cost: { "Metal Plates": 22, Motors: 3 },
    upgradeCost: { Processors: 5, "Metal Plates": 40 },
    power: 8,
    allowed: ["desert", "ice", "mountain"],
    tick: (b, planet) => {
      const levelBonus = 1 + (b.level - 1);
      planet.droneCapacity += 2 * levelBonus;
    },
  },
  researchLab: {
    name: "Research Lab",
    color: "#ffb3ff",
    cost: { "Metal Plates": 12, "Silicon Wafers": 5 },
    upgradeCost: { Processors: 6, "Quantum Chips": 2 },
    power: 6,
    allowed: ["desert", "ice", "mountain", "volcanic"],
    tick: (b, planet, mul) => {
      const levelBonus = 1 + (b.level - 1) * 0.35;
      gainResource(planet, "Research Data", 0.85 * levelBonus * mul);
      if (consumeResource(planet, "Research Data", 0.75) && consumeResource(planet, "Processors", 0.04)) {
        gainResource(planet, "Nanotubes", 0.08 * levelBonus * mul);
      }
    },
  },
};

const RESEARCH = [
  {
    id: "copperProcessing",
    name: "Copper Processing",
    cost: { Rock: 70, "Iron Ore": 40 },
    description: "Unlock copper extraction and wire refining.",
    apply: (state) => {
      state.flags.copperUnlocked = true;
    },
  },
  {
    id: "siliconWafers",
    name: "Silicon Wafers",
    cost: { Silicon: 75, "Metal Plates": 80 },
    description: "Enable wafer conversion in smelters.",
    apply: (state) => {
      state.flags.siliconUnlocked = true;
    },
  },
  {
    id: "droneLogistics",
    name: "Drone Logistics",
    cost: { Processors: 10, Motors: 18 },
    description: "Drones fly faster and increase throughput.",
    apply: (state) => {
      state.globalProductionMult += 0.2;
    },
  },
  {
    id: "interplanetary",
    name: "Interplanetary Launch",
    cost: { Processors: 30, "Quantum Chips": 4 },
    description: "Unlock colonization of additional planets.",
    apply: (state) => {
      state.flags.interplanetaryUnlocked = true;
    },
  },
  {
    id: "dysonSwarm",
    name: "Dyson Swarm Theory",
    cost: { "Quantum Chips": 10, Nanotubes: 30 },
    description: "Unlock orbital megastructure actions.",
    apply: (state) => {
      state.flags.dysonUnlocked = true;
      state.energyPermanentBonus += 40;
    },
  },
];

const PLANETS = [
  { name: "Astra Prime", zones: ["mountain", "desert", "ice", "volcanic"] },
  { name: "Cinder V", zones: ["volcanic", "desert"] },
  { name: "Frost Helix", zones: ["ice", "mountain"] },
];

const ZONE_COLORS = {
  mountain: "#556b7b",
  desert: "#7f6a42",
  ice: "#7aa6d6",
  volcanic: "#6c4d57",
};

const state = {
  resources: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
  rates: {},
  researched: new Set(),
  selectedBuild: null,
  selectedBuildingId: null,
  connectionMode: false,
  connectionStartId: null,
  planets: [makePlanet(0)],
  activePlanetIndex: 0,
  camera: { rotation: 0.1, zoom: 1, panX: 0, panY: 0 },
  dragging: false,
  dragDistance: 0,
  lastMouse: null,
  storageCap: 1200,
  droneCapacity: 2,
  energyPermanentBonus: 0,
  globalProductionMult: 1,
  flags: { copperUnlocked: false, siliconUnlocked: false, interplanetaryUnlocked: false, dysonUnlocked: false },
  cosmicReformations: 0,
  tickCount: 0,
};

state.resources.Rock = 50;
state.resources["Iron Ore"] = 16;
state.resources.Silicon = 8;

function makePlanet(index) {
  const archetype = PLANETS[index % PLANETS.length];
  const cells = [];
  const latSteps = 14;
  const lonSteps = 28;
  let idCounter = 0;
  for (let lat = 0; lat < latSteps; lat += 1) {
    for (let lon = 0; lon < lonSteps; lon += 1) {
      const zone = archetype.zones[(lat + lon * 3 + index) % archetype.zones.length];
      cells.push({ id: idCounter++, lat, lon, zone, buildingId: null });
    }
  }
  return {
    state,
    id: `planet-${index}`,
    name: archetype.name,
    cells,
    buildings: [],
    connections: [],
    drones: [],
    satellites: 0,
    orbitalFactories: 0,
    producedThisTick: {},
    consumedThisTick: {},
    storageCap: 0,
    droneCapacity: 0,
  };
}

function getActivePlanet() {
  return state.planets[state.activePlanetIndex];
}

function gainResource(planet, name, amount) {
  const add = Math.max(0, amount || 0);
  state.resources[name] = Math.min(state.storageCap, (state.resources[name] || 0) + add);
  planet.producedThisTick[name] = (planet.producedThisTick[name] || 0) + add;
}

function consumeResource(planet, name, amount) {
  if ((state.resources[name] || 0) >= amount) {
    state.resources[name] -= amount;
    planet.consumedThisTick[name] = (planet.consumedThisTick[name] || 0) + amount;
    return true;
  }
  return false;
}

function formatNumber(n) {
  if (n === undefined) return "0";
  if (n >= 1e30) return `${(n / 1e30).toFixed(2)}e30+`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  return n.toFixed(1);
}

const canvas = document.getElementById("planetCanvas");
const ctx = canvas.getContext("2d");
const resourceList = document.getElementById("resourceList");
const buildMenu = document.getElementById("buildMenu");
const researchList = document.getElementById("researchList");
const planetActions = document.getElementById("planetActions");
const statusText = document.getElementById("statusText");
const selectionText = document.getElementById("selectionText");
const selectionActions = document.getElementById("selectionActions");
const energyText = document.getElementById("energyText");
const automationText = document.getElementById("automationText");
const planetLabel = document.getElementById("planetLabel");
const cameraLabel = document.getElementById("cameraLabel");
const connectModeBtn = document.getElementById("connectModeBtn");

function getBuilding(planet, id) {
  return planet.buildings.find((b) => b.id === id);
}

function setStatus(msg) {
  statusText.textContent = msg;
}

document.getElementById("manualMineBtn").addEventListener("click", () => {
  gainResource(getActivePlanet(), "Rock", 1 + state.cosmicReformations * 0.4);
  setStatus("Manual mining extracted rock.");
});

connectModeBtn.addEventListener("click", () => {
  state.connectionMode = !state.connectionMode;
  if (!state.connectionMode) state.connectionStartId = null;
  renderBuildMenu();
  setStatus(state.connectionMode ? "Connection tool enabled." : "Connection tool disabled.");
});

document.getElementById("prestigeBtn").addEventListener("click", () => {
  const total = Object.values(state.resources).reduce((a, b) => a + (b || 0), 0);
  if (total < 1500) return setStatus("Need at least 1500 total resources before Cosmic Reformation.");
  const gained = Math.max(1, Math.floor(Math.log10(total) * 2));
  state.resources["Cosmic Matter"] += gained;
  state.cosmicReformations += 1;
  state.globalProductionMult = 1 + state.resources["Cosmic Matter"] * 0.03;
  state.energyPermanentBonus += gained * 2;
  const keep = state.resources["Cosmic Matter"];
  Object.keys(state.resources).forEach((k) => {
    if (k !== "Cosmic Matter") state.resources[k] = 0;
  });
  state.resources["Cosmic Matter"] = keep;
  state.planets = [makePlanet(0)];
  state.activePlanetIndex = 0;
  state.selectedBuild = null;
  state.selectedBuildingId = null;
  renderSelection();
  setStatus(`Cosmic Reformation complete. +${gained} Cosmic Matter.`);
});

function setupUI() {
  renderBuildMenu();
  renderResearch();
  renderPlanetActions();
  renderResources();
  renderSelection();
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";
  Object.entries(BUILDINGS).forEach(([id, def]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${def.name}</strong><div class="small">Cost: ${Object.entries(def.cost).map(([k, v]) => `${k} ${v}`).join(", ")}</div>`;
    btn.addEventListener("click", () => {
      state.connectionMode = false;
      state.connectionStartId = null;
      state.selectedBuild = state.selectedBuild === id ? null : id;
      renderBuildMenu();
    });
    buildMenu.appendChild(btn);
  });
  connectModeBtn.textContent = `Connection Tool: ${state.connectionMode ? "ON" : "OFF"}`;
  connectModeBtn.className = state.connectionMode ? "active" : "";
}

function renderResearch() {
  researchList.innerHTML = "";
  for (const r of RESEARCH) {
    const done = state.researched.has(r.id);
    const btn = document.createElement("button");
    btn.disabled = done;
    btn.innerHTML = `<strong>${r.name}</strong><div class='small'>${r.description}</div><div class='small'>${Object.entries(r.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}</div>`;
    btn.addEventListener("click", () => {
      if (done) return;
      if (!Object.entries(r.cost).every(([k, v]) => (state.resources[k] || 0) >= v)) {
        return setStatus(`Insufficient resources for ${r.name}.`);
      }
      const p = getActivePlanet();
      Object.entries(r.cost).forEach(([k, v]) => consumeResource(p, k, v));
      state.researched.add(r.id);
      r.apply(state);
      setStatus(`Research completed: ${r.name}`);
      renderResearch();
    });
    researchList.appendChild(btn);
  }
}

function renderPlanetActions() {
  planetActions.innerHTML = "";
  const actions = [
    {
      label: "Switch Planet",
      run: () => {
        state.activePlanetIndex = (state.activePlanetIndex + 1) % state.planets.length;
        state.selectedBuildingId = null;
        renderSelection();
      },
    },
    {
      label: "Colonize New Planet",
      tip: "Requires Interplanetary research + Processors 20",
      run: () => {
        if (!state.flags.interplanetaryUnlocked) return setStatus("Need Interplanetary Launch research.");
        if (!consumeResource(getActivePlanet(), "Processors", 20)) return setStatus("Need 20 Processors.");
        state.planets.push(makePlanet(state.planets.length));
        setStatus(`New colony founded: ${state.planets[state.planets.length - 1].name}`);
      },
    },
    {
      label: "Build Orbital Factory",
      tip: "Metal Plates 200, Processors 25",
      run: () => {
        const p = getActivePlanet();
        if (consumeResource(p, "Metal Plates", 200) && consumeResource(p, "Processors", 25)) {
          p.orbitalFactories += 1;
          return setStatus("Orbital factory added.");
        }
        return setStatus("Insufficient resources for orbital factory.");
      },
    },
  ];

  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.innerHTML = `<strong>${a.label}</strong>${a.tip ? `<div class='small'>${a.tip}</div>` : ""}`;
    btn.addEventListener("click", a.run);
    planetActions.appendChild(btn);
  });
}

function renderSelection() {
  const p = getActivePlanet();
  selectionActions.innerHTML = "";
  if (!state.selectedBuildingId) {
    selectionText.textContent = "Nothing selected.";
    return;
  }
  const b = getBuilding(p, state.selectedBuildingId);
  if (!b) {
    state.selectedBuildingId = null;
    selectionText.textContent = "Nothing selected.";
    return;
  }
  const def = BUILDINGS[b.type];
  selectionText.textContent = `${def.name} | Level ${b.level} | ${b.config.enabled ? "Enabled" : "Disabled"} | Mode: ${b.config.mode}`;

  const toggle = document.createElement("button");
  toggle.textContent = b.config.enabled ? "Disable Building" : "Enable Building";
  toggle.addEventListener("click", () => {
    b.config.enabled = !b.config.enabled;
    renderSelection();
  });

  const upgrade = document.createElement("button");
  upgrade.innerHTML = `<strong>Upgrade</strong><div class='small'>${Object.entries(def.upgradeCost)
    .map(([k, v]) => `${k} ${Math.ceil(v * b.level)}`)
    .join(", ")}</div>`;
  upgrade.addEventListener("click", () => {
    const cost = Object.fromEntries(Object.entries(def.upgradeCost).map(([k, v]) => [k, Math.ceil(v * b.level)]));
    if (!Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v)) {
      return setStatus("Insufficient resources for upgrade.");
    }
    Object.entries(cost).forEach(([k, v]) => consumeResource(p, k, v));
    b.level += 1;
    setStatus(`${def.name} upgraded to level ${b.level}.`);
    renderSelection();
  });

  const mode = document.createElement("button");
  mode.textContent = `Switch Mode (${b.config.mode})`;
  mode.addEventListener("click", () => {
    b.config.mode = b.config.mode === "balanced" ? "silicon" : "balanced";
    renderSelection();
  });

  selectionActions.append(toggle, upgrade, mode);
}

function renderResources() {
  resourceList.innerHTML = "";
  Object.entries(state.resources)
    .filter(([, val]) => val > 0.01)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => {
      const rate = state.rates[name] || 0;
      const div = document.createElement("div");
      div.className = "small";
      div.textContent = `${name}: ${formatNumber(value)} (${rate >= 0 ? "+" : ""}${formatNumber(rate)}/s)`;
      resourceList.appendChild(div);
    });
  const p = getActivePlanet();
  energyText.textContent = `Grid: ${formatNumber(p.energyProduced || 0)} / ${formatNumber(p.energyDemand || 0)} MW (${(p.powerRatio || 1) < 1 ? "brownout" : "stable"})`;
  automationText.textContent = `Drones: ${p.drones.length}/${p.droneCapacity || state.droneCapacity} | Buildings: ${p.buildings.length} | Links: ${p.connections.length} | Planets: ${state.planets.length}`;
}

function handlePlacement(cell) {
  const p = getActivePlanet();
  if (!state.selectedBuild) return false;
  const def = BUILDINGS[state.selectedBuild];
  if (!def.allowed.includes(cell.zone)) return setStatus(`${def.name} cannot be placed in ${cell.zone} zones.`), true;
  if (cell.buildingId != null) return setStatus("Cell occupied."), true;
  if (!Object.entries(def.cost).every(([k, v]) => (state.resources[k] || 0) >= v)) return setStatus("Not enough resources."), true;

  Object.entries(def.cost).forEach(([k, v]) => {
    state.resources[k] -= v;
  });
  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const building = { id, type: state.selectedBuild, cellId: cell.id, zone: cell.zone, anim: Math.random() * TAU, level: 1, config: { enabled: true, mode: "balanced" } };
  p.buildings.push(building);
  cell.buildingId = id;
  state.selectedBuildingId = id;
  renderSelection();
  setStatus(`${def.name} deployed.`);
  return true;
}

function handleSelectOrConnect(cell) {
  const p = getActivePlanet();
  if (cell.buildingId == null) {
    state.selectedBuildingId = null;
    state.connectionStartId = null;
    renderSelection();
    return setStatus(`Empty ${cell.zone} terrain cell.`);
  }

  const b = getBuilding(p, cell.buildingId);
  if (!b) return;

  if (state.connectionMode) {
    if (!state.connectionStartId) {
      state.connectionStartId = b.id;
      return setStatus(`Connection start selected: ${BUILDINGS[b.type].name}. Choose destination building.`);
    }
    if (state.connectionStartId === b.id) return setStatus("Cannot connect building to itself.");

    const duplicate = p.connections.some((c) => (c.from === state.connectionStartId && c.to === b.id) || (c.from === b.id && c.to === state.connectionStartId));
    if (duplicate) {
      state.connectionStartId = null;
      return setStatus("Connection already exists.");
    }

    p.connections.push({ from: state.connectionStartId, to: b.id, throughput: 1, mode: "belt" });
    state.connectionStartId = null;
    return setStatus("Manual logistics connection created.");
  }

  state.selectedBuildingId = b.id;
  renderSelection();
  setStatus(`${BUILDINGS[b.type].name} selected.`);
}

function spawnDrone(planet) {
  if (planet.drones.length >= planet.droneCapacity || planet.connections.length === 0) return;
  const edge = planet.connections[Math.floor(Math.random() * planet.connections.length)];
  planet.drones.push({ from: edge.from, to: edge.to, t: Math.random(), speed: 0.18 + Math.random() * 0.2 });
}

function updateDrones(dt, planet) {
  while (planet.drones.length < Math.min(planet.droneCapacity, planet.connections.length)) spawnDrone(planet);
  planet.drones.forEach((d) => {
    d.t += d.speed * dt;
    if (d.t >= 1) {
      d.t = 0;
      const edge = planet.connections[Math.floor(Math.random() * planet.connections.length)];
      if (edge) {
        d.from = edge.from;
        d.to = edge.to;
      }
      gainResource(planet, "Copper Wire", 0.15 * state.globalProductionMult);
    }
  });
}

function runConnections(planet) {
  for (const link of planet.connections) {
    const from = getBuilding(planet, link.from);
    const to = getBuilding(planet, link.to);
    if (!from || !to) continue;

    if (from.type === "miningDrill" && to.type === "smelter") {
      if (consumeResource(planet, "Iron Ore", 0.3 * link.throughput)) {
        gainResource(planet, "Metal Plates", 0.22 * link.throughput * state.globalProductionMult);
      }
    }
    if (from.type === "smelter" && to.type === "factory") {
      if (consumeResource(planet, "Metal Plates", 0.25 * link.throughput)) {
        gainResource(planet, "Mechanical Parts", 0.2 * link.throughput * state.globalProductionMult);
      }
    }
    if (to.type === "storageDepot") {
      gainResource(planet, "Rock", 0.03 * link.throughput * state.globalProductionMult);
    }
  }
}

function simulate(dt) {
  for (const planet of state.planets) {
    planet.producedThisTick = {};
    planet.consumedThisTick = {};
    planet.storageCap = 1200 + state.planets.length * 400;
    planet.droneCapacity = 2 + state.cosmicReformations * 2;
    planet.energyProduced = state.energyPermanentBonus + planet.satellites * 2 + planet.orbitalFactories * 1.2;
    planet.energyDemand = 0;

    for (const b of planet.buildings) {
      const def = BUILDINGS[b.type];
      planet.energyDemand += Math.max(def.power, 0);
      if (def.power < 0) planet.energyProduced += Math.abs(def.power) * (1 + (b.level - 1) * 0.4);
    }

    planet.powerRatio = Math.min(1, planet.energyProduced / Math.max(1, planet.energyDemand));

    for (const b of planet.buildings) {
      if (!b.config.enabled || Math.random() > planet.powerRatio) continue;
      BUILDINGS[b.type].tick(b, planet, state.globalProductionMult);
    }

    runConnections(planet);

    if (planet.orbitalFactories > 0) {
      gainResource(planet, "Dark Matter Cores", 0.03 * planet.orbitalFactories * state.globalProductionMult);
      gainResource(planet, "Quantum Chips", 0.04 * planet.orbitalFactories * state.globalProductionMult);
    }

    updateDrones(dt, planet);
  }

  state.storageCap = Math.max(...state.planets.map((p) => p.storageCap));
  state.droneCapacity = Math.max(...state.planets.map((p) => p.droneCapacity));

  const active = getActivePlanet();
  state.rates = {};
  Object.keys(state.resources).forEach((res) => {
    const produced = active.producedThisTick[res] || 0;
    const consumed = active.consumedThisTick[res] || 0;
    state.rates[res] = (produced - consumed) * 2;
  });

  renderResources();
  state.tickCount += 1;
}

function worldToScreen(lat, lon) {
  const w = canvas.width;
  const h = canvas.height;
  const r = Math.min(w, h) * 0.34 * state.camera.zoom;
  const xNorm = (lon / 28 - 0.5) * TAU + state.camera.rotation;
  const yNorm = (lat / 14 - 0.5) * Math.PI;
  const x = Math.sin(xNorm) * Math.cos(yNorm);
  const y = Math.sin(yNorm);
  const z = Math.cos(xNorm) * Math.cos(yNorm);
  const perspective = 0.45 + (z + 1) * 0.35;
  return { x: w / 2 + state.camera.panX + x * r * perspective, y: h / 2 + state.camera.panY + y * r, z, visible: z > -0.25 };
}

function drawPlanet() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const planet = getActivePlanet();

  const gradient = ctx.createRadialGradient(canvas.width / 2 - 100, canvas.height / 2 - 120, 40, canvas.width / 2, canvas.height / 2, 420);
  gradient.addColorStop(0, "#223f65");
  gradient.addColorStop(1, "#0b1320");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellSize = 14 * state.camera.zoom;
  const drawCells = planet.cells
    .map((cell) => ({ cell, pos: worldToScreen(cell.lat + 0.5, cell.lon + 0.5) }))
    .filter((x) => x.pos.visible)
    .sort((a, b) => a.pos.z - b.pos.z);

  for (const { cell, pos } of drawCells) {
    ctx.fillStyle = ZONE_COLORS[cell.zone];
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, cellSize, cellSize * 0.55, 0, 0, TAU);
    ctx.fill();

    if (cell.buildingId) {
      const b = getBuilding(planet, cell.buildingId);
      if (!b) continue;
      const def = BUILDINGS[b.type];
      b.anim += 0.12;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 4 - Math.sin(b.anim) * 1.5, cellSize * (0.33 + b.level * 0.04), 0, TAU);
      ctx.fill();
    }
  }

  drawConnections(planet);
  drawDrones(planet);

  if (state.selectedBuild) {
    const hover = getHoveredCell(lastMouseX, lastMouseY);
    if (hover) {
      const p = worldToScreen(hover.lat + 0.5, hover.lon + 0.5);
      ctx.strokeStyle = "#7ef9ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cellSize * 1.1, cellSize * 0.7, 0, 0, TAU);
      ctx.stroke();
    }
  }

  planetLabel.textContent = `Planet: ${planet.name} | Orbital factories: ${planet.orbitalFactories} | Satellites: ${planet.satellites}`;
  cameraLabel.textContent = `Rotate: ${(state.camera.rotation % TAU).toFixed(2)} Zoom: ${state.camera.zoom.toFixed(2)} ${state.connectionMode ? "| Connect mode" : ""}`;
}

function drawConnections(planet) {
  ctx.lineWidth = 2;
  planet.connections.forEach((c, i) => {
    const from = getBuilding(planet, c.from);
    const to = getBuilding(planet, c.to);
    if (!from || !to) return;
    const fromCell = planet.cells[from.cellId];
    const toCell = planet.cells[to.cellId];
    const a = worldToScreen(fromCell.lat + 0.5, fromCell.lon + 0.5);
    const b = worldToScreen(toCell.lat + 0.5, toCell.lon + 0.5);
    if (!a.visible || !b.visible) return;
    ctx.strokeStyle = i % 2 ? "#4eb5ff88" : "#62ffaa88";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const t = (performance.now() * 0.0003 + i * 0.1) % 1;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });
}

function drawDrones(planet) {
  planet.drones.forEach((d) => {
    const from = getBuilding(planet, d.from);
    const to = getBuilding(planet, d.to);
    if (!from || !to) return;
    const aCell = planet.cells[from.cellId];
    const bCell = planet.cells[to.cellId];
    const a = worldToScreen(aCell.lat + 0.5, aCell.lon + 0.5);
    const b = worldToScreen(bCell.lat + 0.5, bCell.lon + 0.5);
    if (!a.visible || !b.visible) return;
    const x = a.x + (b.x - a.x) * d.t;
    const y = a.y + (b.y - a.y) * d.t;
    ctx.fillStyle = "#9dfff6";
    ctx.beginPath();
    ctx.arc(x, y - 8, 3.5, 0, TAU);
    ctx.fill();
  });
}

let lastMouseX = 0;
let lastMouseY = 0;

function getHoveredCell(mx, my) {
  const planet = getActivePlanet();
  const cellSize = 14 * state.camera.zoom;
  let best = null;
  let bestDist = Infinity;
  for (const cell of planet.cells) {
    const p = worldToScreen(cell.lat + 0.5, cell.lon + 0.5);
    if (!p.visible) continue;
    const dist = Math.hypot(p.x - mx, p.y - my);
    if (dist < cellSize && dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  }
  return best;
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  state.dragging = true;
  state.dragDistance = 0;
  state.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener("mouseup", () => {
  state.dragging = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  lastMouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  lastMouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
  if (!state.dragging) return;
  const dx = e.clientX - state.lastMouse.x;
  const dy = e.clientY - state.lastMouse.y;
  state.dragDistance += Math.abs(dx) + Math.abs(dy);
  state.lastMouse = { x: e.clientX, y: e.clientY };
  state.camera.rotation += dx * 0.005;
  state.camera.panY += dy * 0.15;
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  state.camera.zoom *= e.deltaY < 0 ? 1.06 : 0.94;
  state.camera.zoom = Math.max(0.6, Math.min(2.3, state.camera.zoom));
});

canvas.addEventListener("click", () => {
  if (state.dragDistance > 8) return;
  const cell = getHoveredCell(lastMouseX, lastMouseY);
  if (!cell) return;
  const placed = handlePlacement(cell);
  if (!placed) handleSelectOrConnect(cell);
  renderResources();
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "q") state.camera.rotation -= 0.12;
  if (e.key.toLowerCase() === "e") state.camera.rotation += 0.12;
  if (e.key.toLowerCase() === "a") state.camera.panX -= 14;
  if (e.key.toLowerCase() === "d") state.camera.panX += 14;
});

function loop(ts) {
  if (!loop.last) loop.last = ts;
  const dt = Math.min(0.2, (ts - loop.last) / 1000);
  loop.last = ts;
  if (state.tickCount % 6 === 0) simulate(dt);
  drawPlanet();
  requestAnimationFrame(loop);
}

setupUI();
requestAnimationFrame(loop);
