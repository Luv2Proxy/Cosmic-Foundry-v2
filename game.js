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
  "Cosmic Matter",
];

const BUILDINGS = {
  miningDrill: {
    name: "Mining Drill",
    color: "#f4aa5a",
    cost: { Rock: 12 },
    power: 2,
    allowed: ["mountain", "volcanic", "desert"],
    tick: (b, p) => {
      const terrainYield = b.zone === "mountain" ? 1.4 : b.zone === "volcanic" ? 1.2 : 1;
      gainResource(p, "Iron Ore", 0.65 * terrainYield * p.globalProductionMult);
      gainResource(p, "Rock", 0.5 * terrainYield * p.globalProductionMult);
    },
  },
  smelter: {
    name: "Smelter",
    color: "#ff6f6f",
    cost: { Rock: 15, "Iron Ore": 8 },
    power: 4,
    allowed: ["mountain", "volcanic", "desert", "ice"],
    tick: (b, p) => {
      if (consumeResource(p, "Iron Ore", 0.8)) gainResource(p, "Metal Plates", 0.6 * p.globalProductionMult);
      if (consumeResource(p, "Rock", 0.35)) gainResource(p, "Steel", 0.2 * p.globalProductionMult);
    },
  },
  factory: {
    name: "Factory",
    color: "#8ac7ff",
    cost: { "Metal Plates": 20, "Copper Wire": 10 },
    power: 7,
    allowed: ["desert", "mountain", "ice"],
    tick: (b, p) => {
      if (consumeResource(p, "Metal Plates", 0.7) && consumeResource(p, "Copper Wire", 0.8)) {
        gainResource(p, "Mechanical Parts", 0.45 * p.globalProductionMult);
      }
      if (consumeResource(p, "Mechanical Parts", 0.5) && consumeResource(p, "Silicon Wafers", 0.4)) {
        gainResource(p, "Processors", 0.18 * p.globalProductionMult);
      }
    },
  },
  powerGenerator: {
    name: "Power Generator",
    color: "#67ff9f",
    cost: { Rock: 16, "Metal Plates": 6 },
    power: -18,
    allowed: ["desert", "mountain", "volcanic"],
    tick: (b, p) => {
      const bonus = b.zone === "desert" ? 1.35 : b.zone === "volcanic" ? 1.15 : 1;
      p.energyProduced += 0.5 * bonus;
    },
  },
  storageDepot: {
    name: "Storage Depot",
    color: "#b39ddb",
    cost: { Rock: 10, "Metal Plates": 4 },
    power: 1,
    allowed: ["mountain", "desert", "ice", "volcanic"],
    tick: (b, p) => {
      p.storageCap += 300;
    },
  },
  droneHub: {
    name: "Drone Hub",
    color: "#40e0d0",
    cost: { "Metal Plates": 25, Motors: 3 },
    power: 8,
    allowed: ["desert", "ice", "mountain"],
    tick: (b, p) => {
      p.droneCapacity += 4;
      if (consumeResource(p, "Metal Plates", 0.2)) gainResource(p, "Copper Wire", 0.5 * p.globalProductionMult);
    },
  },
  researchLab: {
    name: "Research Lab",
    color: "#ffb3ff",
    cost: { "Metal Plates": 12, "Silicon Wafers": 6 },
    power: 6,
    allowed: ["desert", "ice", "mountain", "volcanic"],
    tick: (b, p) => {
      gainResource(p, "Research Data", 0.9 * p.globalProductionMult);
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
    cost: { Silicon: 80, "Metal Plates": 80 },
    description: "Enable wafer conversion in smelters.",
    apply: (state) => {
      state.flags.siliconUnlocked = true;
    },
  },
  {
    id: "droneLogistics",
    name: "Drone Logistics",
    cost: { Processors: 12, Motors: 20 },
    description: "Drones fly faster and auto-balance throughput.",
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
  { name: "Astra Prime", zones: ["mountain", "desert", "ice", "volcanic"], richness: { "Iron Ore": 1.2, Silicon: 1.0, Ice: 1.2 } },
  { name: "Cinder V", zones: ["volcanic", "desert"], richness: { "Iron Ore": 1.6, Silicon: 0.7, Ice: 0.2 } },
  { name: "Frost Helix", zones: ["ice", "mountain"], richness: { "Iron Ore": 0.8, Silicon: 1.3, Ice: 2.0 } },
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
  planets: [makePlanet(0)],
  activePlanetIndex: 0,
  camera: { rotation: 0.1, zoom: 1, panX: 0, panY: 0 },
  dragging: false,
  lastMouse: null,
  storageCap: 1200,
  droneCapacity: 2,
  energyPermanentBonus: 0,
  globalProductionMult: 1,
  flags: {
    copperUnlocked: false,
    siliconUnlocked: false,
    interplanetaryUnlocked: false,
    dysonUnlocked: false,
  },
  cosmicReformations: 0,
  tickCount: 0,
};

state.resources.Rock = 30;
state.resources["Iron Ore"] = 8;
state.resources.Silicon = 3;

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
    id: `planet-${index}`,
    name: archetype.name,
    archetype,
    cells,
    buildings: [],
    drones: [],
    satellites: 0,
    orbitalFactories: 0,
  };
}

function gainResource(planet, name, amount) {
  const safeAmount = Math.max(0, amount || 0);
  if (name === "Mechanical Parts" || name === "Research Data") {
    if (!(name in state.resources)) state.resources[name] = 0;
  }
  const cap = state.storageCap;
  state.resources[name] = Math.min(cap, (state.resources[name] || 0) + safeAmount);
  planet.producedThisTick[name] = (planet.producedThisTick[name] || 0) + safeAmount;
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
const energyText = document.getElementById("energyText");
const automationText = document.getElementById("automationText");
const planetLabel = document.getElementById("planetLabel");
const cameraLabel = document.getElementById("cameraLabel");

document.getElementById("manualMineBtn").addEventListener("click", () => {
  const p = getActivePlanet();
  gainResource(p, "Rock", 1 + state.cosmicReformations * 0.3);
});

document.getElementById("prestigeBtn").addEventListener("click", () => {
  const total = Object.values(state.resources).reduce((a, b) => a + (b || 0), 0);
  if (total < 1500) {
    statusText.textContent = "Need at least 1500 total resources before Cosmic Reformation.";
    return;
  }
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
  statusText.textContent = `Cosmic Reformation complete. +${gained} Cosmic Matter.`;
});

function getActivePlanet() {
  return state.planets[state.activePlanetIndex];
}

function setupUI() {
  renderBuildMenu();
  renderResearch();
  renderPlanetActions();
  renderResources();
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";
  Object.entries(BUILDINGS).forEach(([id, def]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${def.name}</strong><div class="small">Cost: ${Object.entries(def.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}</div>`;
    btn.addEventListener("click", () => {
      state.selectedBuild = state.selectedBuild === id ? null : id;
      renderBuildMenu();
    });
    buildMenu.appendChild(btn);
  });
}

function renderResearch() {
  researchList.innerHTML = "";
  RESEARCH.forEach((r) => {
    const btn = document.createElement("button");
    const done = state.researched.has(r.id);
    btn.disabled = done;
    btn.innerHTML = `<strong>${r.name}</strong><div class="small">${r.description}</div><div class="small">${Object.entries(r.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}</div>`;
    btn.addEventListener("click", () => {
      if (done) return;
      if (Object.entries(r.cost).every(([k, v]) => (state.resources[k] || 0) >= v)) {
        const p = getActivePlanet();
        Object.entries(r.cost).forEach(([k, v]) => consumeResource(p, k, v));
        state.researched.add(r.id);
        r.apply(state);
        statusText.textContent = `Research completed: ${r.name}`;
      } else {
        statusText.textContent = `Insufficient resources for ${r.name}`;
      }
      renderResearch();
    });
    researchList.appendChild(btn);
  });
}

function renderPlanetActions() {
  planetActions.innerHTML = "";

  const planetSwitch = document.createElement("button");
  planetSwitch.textContent = "Switch Planet";
  planetSwitch.addEventListener("click", () => {
    state.activePlanetIndex = (state.activePlanetIndex + 1) % state.planets.length;
  });
  planetActions.appendChild(planetSwitch);

  const colonize = document.createElement("button");
  colonize.innerHTML = "<strong>Colonize New Planet</strong><div class='small'>Requires Interplanetary research + Processors 20</div>";
  colonize.addEventListener("click", () => {
    const p = getActivePlanet();
    if (!state.flags.interplanetaryUnlocked) {
      statusText.textContent = "Need Interplanetary Launch research.";
      return;
    }
    if (!consumeResource(p, "Processors", 20)) {
      statusText.textContent = "Need 20 Processors to launch colonization ship.";
      return;
    }
    state.planets.push(makePlanet(state.planets.length));
    statusText.textContent = `New colony founded: ${state.planets[state.planets.length - 1].name}`;
  });
  planetActions.appendChild(colonize);

  const orbital = document.createElement("button");
  orbital.innerHTML = "<strong>Build Orbital Factory</strong><div class='small'>Metal Plates 200, Processors 25</div>";
  orbital.addEventListener("click", () => {
    const p = getActivePlanet();
    if (consumeResource(p, "Metal Plates", 200) && consumeResource(p, "Processors", 25)) {
      p.orbitalFactories += 1;
      statusText.textContent = "Orbital factory added.";
    } else {
      statusText.textContent = "Insufficient resources for orbital factory.";
    }
  });
  planetActions.appendChild(orbital);

  const dyson = document.createElement("button");
  dyson.innerHTML = "<strong>Deploy Dyson Swarm Collectors</strong><div class='small'>Quantum Chips 5, Nanotubes 40</div>";
  dyson.addEventListener("click", () => {
    const p = getActivePlanet();
    if (!state.flags.dysonUnlocked) {
      statusText.textContent = "Need Dyson Swarm Theory research.";
      return;
    }
    if (consumeResource(p, "Quantum Chips", 5) && consumeResource(p, "Nanotubes", 40)) {
      p.satellites += 12;
      state.energyPermanentBonus += 80;
      statusText.textContent = "Dyson collectors deployed around star.";
    } else {
      statusText.textContent = "Insufficient resources for Dyson deployment.";
    }
  });
  planetActions.appendChild(dyson);
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
  energyText.textContent = `Grid: ${formatNumber(p.energyProduced)} / ${formatNumber(p.energyDemand)} MW   (${p.powerRatio < 1 ? "brownout" : "stable"})`;
  automationText.textContent = `Drones: ${p.drones.length}/${state.droneCapacity} | Buildings: ${p.buildings.length} | Planets: ${state.planets.length} | Reformations: ${state.cosmicReformations}`;
}

function handlePlacement(cell) {
  const p = getActivePlanet();
  if (!state.selectedBuild) {
    if (cell.buildingId != null) {
      const b = p.buildings.find((x) => x.id === cell.buildingId);
      state.selectedBuildingId = b?.id || null;
      selectionText.textContent = b ? `${BUILDINGS[b.type].name} on ${cell.zone} zone` : "Nothing selected.";
    } else {
      state.selectedBuildingId = null;
      selectionText.textContent = `Empty ${cell.zone} terrain cell.`;
    }
    return;
  }
  const def = BUILDINGS[state.selectedBuild];
  if (!def.allowed.includes(cell.zone)) {
    statusText.textContent = `${def.name} cannot be placed in ${cell.zone} zones.`;
    return;
  }
  if (cell.buildingId != null) {
    statusText.textContent = "Cell occupied.";
    return;
  }
  const affordable = Object.entries(def.cost).every(([k, v]) => (state.resources[k] || 0) >= v);
  if (!affordable) {
    statusText.textContent = "Not enough resources.";
    return;
  }
  Object.entries(def.cost).forEach(([k, v]) => {
    state.resources[k] -= v;
  });
  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const building = { id, type: state.selectedBuild, cellId: cell.id, zone: cell.zone, anim: Math.random() * TAU };
  p.buildings.push(building);
  cell.buildingId = id;
  statusText.textContent = `${def.name} deployed.`;
  if (p.buildings.length >= 2) spawnDrone(p);
}

function spawnDrone(planet) {
  if (planet.drones.length >= state.droneCapacity) return;
  const a = planet.buildings[Math.floor(Math.random() * planet.buildings.length)];
  const b = planet.buildings[Math.floor(Math.random() * planet.buildings.length)];
  if (!a || !b || a.id === b.id) return;
  planet.drones.push({ from: a.cellId, to: b.cellId, t: Math.random(), speed: 0.18 + Math.random() * 0.2 });
}

function updateDrones(dt, planet) {
  while (planet.drones.length < Math.min(state.droneCapacity, Math.floor(planet.buildings.length / 2))) {
    spawnDrone(planet);
  }
  planet.drones.forEach((d) => {
    d.t += d.speed * dt;
    if (d.t >= 1) {
      d.t = 0;
      const next = planet.buildings[Math.floor(Math.random() * planet.buildings.length)];
      if (next) {
        d.from = d.to;
        d.to = next.cellId;
      }
      gainResource(planet, "Copper Wire", 0.2 * state.globalProductionMult);
    }
  });
}

function simulate(dt) {
  state.planets.forEach((planet) => {
    planet.producedThisTick = {};
    planet.consumedThisTick = {};
    planet.energyProduced = state.energyPermanentBonus + planet.satellites * 2 + planet.orbitalFactories * 1.2;
    planet.energyDemand = 0;
    state.storageCap = 1200 + state.planets.length * 400;
    state.droneCapacity = 2 + state.cosmicReformations * 2;

    for (const b of planet.buildings) {
      const def = BUILDINGS[b.type];
      planet.energyDemand += Math.max(def.power, 0);
      if (def.power < 0) planet.energyProduced += Math.abs(def.power);
    }

    planet.powerRatio = Math.min(1, planet.energyProduced / Math.max(1, planet.energyDemand));

    for (const b of planet.buildings) {
      if (Math.random() > planet.powerRatio) continue;
      const def = BUILDINGS[b.type];
      def.tick(b, planet);

      if (b.type === "miningDrill" && state.flags.copperUnlocked) {
        gainResource(planet, "Copper Ore", 0.4 * planet.archetype.richness["Iron Ore"] * state.globalProductionMult);
      }
      if (b.type === "smelter" && state.flags.copperUnlocked && consumeResource(planet, "Copper Ore", 0.4)) {
        gainResource(planet, "Copper Wire", 0.5 * state.globalProductionMult);
      }
      if (b.type === "smelter" && state.flags.siliconUnlocked && consumeResource(planet, "Silicon", 0.35)) {
        gainResource(planet, "Silicon Wafers", 0.32 * state.globalProductionMult);
      }
      if (b.type === "factory" && consumeResource(planet, "Copper Wire", 0.6) && consumeResource(planet, "Steel", 0.35)) {
        gainResource(planet, "Motors", 0.2 * state.globalProductionMult);
      }
      if (b.type === "factory" && consumeResource(planet, "Processors", 0.15) && consumeResource(planet, "Silicon Wafers", 0.25)) {
        gainResource(planet, "Quantum Chips", 0.08 * state.globalProductionMult);
      }
      if (b.type === "researchLab" && consumeResource(planet, "Research Data", 0.8) && consumeResource(planet, "Processors", 0.05)) {
        gainResource(planet, "Nanotubes", 0.08 * state.globalProductionMult);
      }
    }

    if (planet.orbitalFactories > 0) {
      gainResource(planet, "Dark Matter Cores", 0.03 * planet.orbitalFactories * state.globalProductionMult);
      gainResource(planet, "Quantum Chips", 0.04 * planet.orbitalFactories * state.globalProductionMult);
    }

    updateDrones(dt, planet);
  });

  const activePlanet = getActivePlanet();
  state.rates = {};
  Object.keys(state.resources).forEach((res) => {
    const produced = activePlanet.producedThisTick[res] || 0;
    const consumed = activePlanet.consumedThisTick[res] || 0;
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

  const visible = z > -0.25;
  const perspective = 0.45 + (z + 1) * 0.35;

  return {
    x: w / 2 + state.camera.panX + x * r * perspective,
    y: h / 2 + state.camera.panY + y * r,
    z,
    visible,
  };
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
  const drawCells = [];

  for (const cell of planet.cells) {
    const pos = worldToScreen(cell.lat + 0.5, cell.lon + 0.5);
    if (!pos.visible) continue;
    drawCells.push({ cell, pos });
  }

  drawCells.sort((a, b) => a.pos.z - b.pos.z);

  for (const { cell, pos } of drawCells) {
    ctx.fillStyle = ZONE_COLORS[cell.zone];
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, cellSize, cellSize * 0.55, 0, 0, TAU);
    ctx.fill();

    if (cell.buildingId) {
      const b = planet.buildings.find((x) => x.id === cell.buildingId);
      if (b) {
        const def = BUILDINGS[b.type];
        b.anim += 0.12;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 4 - Math.sin(b.anim) * 1.5, cellSize * 0.4, 0, TAU);
        ctx.fill();
      }
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
  cameraLabel.textContent = `Rotate: ${(state.camera.rotation % TAU).toFixed(2)}  Zoom: ${state.camera.zoom.toFixed(2)}`;
}

function drawConnections(planet) {
  const links = [];
  for (let i = 1; i < planet.buildings.length; i += 1) {
    const a = planet.buildings[i - 1];
    const b = planet.buildings[i];
    if (!a || !b) continue;
    const aCell = planet.cells[a.cellId];
    const bCell = planet.cells[b.cellId];
    if (!aCell || !bCell) continue;
    const pa = worldToScreen(aCell.lat + 0.5, aCell.lon + 0.5);
    const pb = worldToScreen(bCell.lat + 0.5, bCell.lon + 0.5);
    if (pa.visible && pb.visible) links.push([pa, pb]);
  }

  ctx.lineWidth = 2;
  links.forEach(([a, b], i) => {
    ctx.strokeStyle = i % 2 ? "#4eb5ff88" : "#62ffaa88";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const t = (performance.now() * 0.0003 + i * 0.12) % 1;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });
}

function drawDrones(planet) {
  planet.drones.forEach((d) => {
    const from = planet.cells[d.from];
    const to = planet.cells[d.to];
    if (!from || !to) return;
    const a = worldToScreen(from.lat + 0.5, from.lon + 0.5);
    const b = worldToScreen(to.lat + 0.5, to.lon + 0.5);
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
    const dx = p.x - mx;
    const dy = p.y - my;
    const dist = Math.hypot(dx, dy);
    if (dist < cellSize && dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  }
  return best;
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    state.dragging = true;
    state.lastMouse = { x: e.clientX, y: e.clientY };
  }
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
  const cell = getHoveredCell(lastMouseX, lastMouseY);
  if (cell) handlePlacement(cell);
});

function loop(ts) {
  if (!loop.last) loop.last = ts;
  const dt = Math.min(0.2, (ts - loop.last) / 1000);
  loop.last = ts;

  if (state.tickCount % 6 === 0) simulate(dt);

  drawPlanet();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "q") state.camera.rotation -= 0.12;
  if (e.key.toLowerCase() === "e") state.camera.rotation += 0.12;
  if (e.key.toLowerCase() === "a") state.camera.panX -= 14;
  if (e.key.toLowerCase() === "d") state.camera.panX += 14;
});

setupUI();
requestAnimationFrame(loop);
