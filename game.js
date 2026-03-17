const TAU = Math.PI * 2;

const DEFINITIONS = {
  resources: ["Rock", "Iron Ore", "Copper Ore", "Limestone", "Iron Ingot", "Copper Ingot", "Iron Plate", "Wire", "Concrete"],
  buildings: {
    miner: { name: "Miner", color: "#f6c177", power: 3, cost: { Rock: 10 }, nodeOnly: true, recipeType: null },
    smelter: { name: "Smelter", color: "#ef6f6c", power: 5, cost: { Rock: 12 }, nodeOnly: false, recipeType: "smelter" },
    constructor: { name: "Constructor", color: "#8ecae6", power: 6, cost: { Rock: 16 }, nodeOnly: false, recipeType: "constructor" },
    storage: { name: "Storage", color: "#b39ddb", power: 1, cost: { Rock: 10 }, nodeOnly: false, recipeType: null },
    power: { name: "Biomass Burner", color: "#80ed99", power: -18, cost: { Rock: 14 }, nodeOnly: false, recipeType: null },
  },
  recipes: {
    smelter: {
      iron: { label: "Iron Ingot", in: { "Iron Ore": 1 }, out: { "Iron Ingot": 1 } },
      copper: { label: "Copper Ingot", in: { "Copper Ore": 1 }, out: { "Copper Ingot": 1 } },
    },
    constructor: {
      plate: { label: "Iron Plate", in: { "Iron Ingot": 2 }, out: { "Iron Plate": 1 } },
      wire: { label: "Wire", in: { "Copper Ingot": 1 }, out: { Wire: 2 } },
      concrete: { label: "Concrete", in: { Limestone: 3 }, out: { Concrete: 1 } },
    },
  },
  oreNodes: [
    { lat: 0.14, lon: 0.3, type: "Iron Ore", richness: 1 },
    { lat: -0.26, lon: 1.1, type: "Copper Ore", richness: 1 },
    { lat: 0.42, lon: 2.0, type: "Limestone", richness: 1.2 },
    { lat: -0.13, lon: 2.9, type: "Iron Ore", richness: 1 },
    { lat: 0.28, lon: 4.1, type: "Copper Ore", richness: 0.95 },
    { lat: -0.44, lon: 5.2, type: "Limestone", richness: 1.1 },
  ],
  quests: [
    { id: "gather", title: "Gather Resources", hint: "Use Manual Gather Rock until you have 20 Rock.", isDone: (s) => s.wallet.Rock >= 20 },
    { id: "miner", title: "Place First Miner", hint: "Select Miner and click an ore crystal on the planet.", isDone: (s) => s.buildings.some((b) => b.type === "miner") },
    {
      id: "smelter",
      title: "Smelt Ore",
      hint: "Place a Smelter on the edge ring and connect Miner -> Smelter with conveyor.",
      isDone: (s) => s.wallet["Iron Ingot"] >= 5 || s.wallet["Copper Ingot"] >= 5,
    },
    {
      id: "constructor",
      title: "Craft Components",
      hint: "Place Constructor and route ingots into it. Produce Iron Plate, Wire, or Concrete.",
      isDone: (s) => s.wallet["Iron Plate"] >= 5 || s.wallet.Wire >= 8 || s.wallet.Concrete >= 5,
    },
    {
      id: "power",
      title: "Stabilize Power",
      hint: "Build at least one Biomass Burner to keep your factory from slowing down.",
      isDone: (s) => s.buildings.some((b) => b.type === "power"),
    },
  ],
};

const state = {
  wallet: Object.fromEntries(DEFINITIONS.resources.map((r) => [r, 0])),
  rates: {},
  selectedBuild: null,
  conveyorMode: false,
  conveyorStart: null,
  selectedBuildingId: null,
  rotation: 0.16,
  tilt: 0,
  zoom: 1,
  dragging: false,
  dragDistance: 0,
  lastMouse: null,
  nodes: DEFINITIONS.oreNodes.map((n, i) => ({ ...n, id: `node-${i}`, minerId: null })),
  buildings: [],
  conveyors: [],
  energyProduced: 0,
  energyDemand: 0,
  powerRatio: 1,
  tick: 0,
  questsCompleted: new Set(),
};
state.wallet.Rock = 120;

const canvas = document.getElementById("planetCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const resourceList = document.getElementById("resourceList");
const energyText = document.getElementById("energyText");
const automationText = document.getElementById("automationText");
const objectiveText = document.getElementById("objectiveText");
const buildMenu = document.getElementById("buildMenu");
const connectModeBtn = document.getElementById("connectModeBtn");
const questTree = document.getElementById("questTree");
const selectionText = document.getElementById("selectionText");
const selectionActions = document.getElementById("selectionActions");
const planetLabel = document.getElementById("planetLabel");
const cameraLabel = document.getElementById("cameraLabel");

document.getElementById("prestigeBtn").style.display = "none";
document.getElementById("manualMineBtn").addEventListener("click", () => {
  state.wallet.Rock += 4;
  setStatus("Gathered Rock manually.");
  renderSidePanels();
});

function setStatus(msg) {
  statusText.textContent = msg;
}

function project(lat, lon) {
  const w = canvas.width;
  const h = canvas.height;
  const R = Math.min(w, h) * 0.34 * state.zoom;
  const a = lon + state.rotation;
  const x = Math.cos(lat) * Math.sin(a);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(a);
  const perspective = 0.52 + (z + 1) * 0.28;
  return { x: w / 2 + x * R * perspective, y: h / 2 + y * R + state.tilt, z, visible: z > -0.22 };
}

function canAfford(cost) {
  return Object.entries(cost).every(([r, v]) => (state.wallet[r] || 0) >= v);
}
function spend(cost) {
  Object.entries(cost).forEach(([r, v]) => (state.wallet[r] -= v));
}

function getRecipeKeys(buildingType) {
  const recipeType = DEFINITIONS.buildings[buildingType].recipeType;
  return recipeType ? Object.keys(DEFINITIONS.recipes[recipeType]) : [];
}

function createBuilding(type, lat, lon, nodeId = null) {
  const keys = getRecipeKeys(type);
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    lat,
    lon,
    nodeId,
    level: 1,
    mode: keys[0] || "default",
    inv: {},
  };
}

function pickNode(mx, my) {
  let hit = null;
  let best = Infinity;
  state.nodes.forEach((n) => {
    const p = project(n.lat, n.lon);
    if (!p.visible) return;
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < 20 && d < best) {
      best = d;
      hit = n;
    }
  });
  return hit;
}

function pickBuilding(mx, my) {
  let hit = null;
  let best = Infinity;
  state.buildings.forEach((b) => {
    const p = project(b.lat, b.lon);
    if (!p.visible) return;
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < 19 && d < best) {
      best = d;
      hit = b;
    }
  });
  return hit;
}

function placeBuilding(mx, my) {
  if (!state.selectedBuild) return false;

  const def = DEFINITIONS.buildings[state.selectedBuild];
  if (!canAfford(def.cost)) {
    setStatus(`Not enough resources for ${def.name}.`);
    return true;
  }

  if (def.nodeOnly) {
    const node = pickNode(mx, my);
    if (!node) return setStatus("Miners must be placed directly on ore crystals."), true;
    if (node.minerId) return setStatus("Ore node already has a miner."), true;
    const b = createBuilding(state.selectedBuild, node.lat, node.lon, node.id);
    node.minerId = b.id;
    state.buildings.push(b);
    spend(def.cost);
    state.selectedBuildingId = b.id;
    setStatus(`Placed Miner on ${node.type}.`);
    renderSelection();
    return true;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + state.tilt;
  const planetR = Math.min(canvas.width, canvas.height) * 0.34 * state.zoom;
  const d = Math.hypot(mx - centerX, my - centerY);
  if (Math.abs(d - planetR) > 92) {
    setStatus("Place this building on the bright edge ring of the planet.");
    return true;
  }

  const lat = Math.max(-1.2, Math.min(1.2, (my - centerY) / planetR));
  const lon = Math.atan2(mx - centerX, Math.sqrt(Math.max(0.0001, planetR * planetR - (mx - centerX) ** 2 - (my - centerY) ** 2))) - state.rotation;

  const occupied = state.buildings.some((b) => Math.abs(b.lat - lat) < 0.08 && Math.abs(b.lon - lon) < 0.12);
  if (occupied) return setStatus("Too close to another building."), true;

  const b = createBuilding(state.selectedBuild, lat, lon);
  state.buildings.push(b);
  spend(def.cost);
  state.selectedBuildingId = b.id;
  setStatus(`Placed ${def.name} on planetary edge.`);
  renderSelection();
  return true;
}

function placeConveyor(mx, my) {
  const hit = pickBuilding(mx, my);
  if (!hit) return setStatus("Conveyor endpoints must be buildings."), true;
  if (!state.conveyorStart) {
    state.conveyorStart = hit.id;
    return setStatus("Selected conveyor source."), true;
  }
  if (state.conveyorStart === hit.id) return setStatus("Cannot connect building to itself."), true;
  const exists = state.conveyors.some((c) => c.from === state.conveyorStart && c.to === hit.id);
  if (exists) {
    state.conveyorStart = null;
    return setStatus("Conveyor already exists."), true;
  }
  state.conveyors.push({ from: state.conveyorStart, to: hit.id, t: Math.random() });
  state.conveyorStart = null;
  setStatus("Conveyor built.");
  return true;
}

function addInv(building, res, amount) {
  building.inv[res] = (building.inv[res] || 0) + amount;
}
function takeInv(building, res, amount) {
  if ((building.inv[res] || 0) < amount) return false;
  building.inv[res] -= amount;
  return true;
}

function processBuilding(building, ratio) {
  const speed = ratio * (1 + (building.level - 1) * 0.2);
  if (building.type === "miner") {
    const node = state.nodes.find((n) => n.id === building.nodeId);
    if (node) addInv(building, node.type, 0.55 * speed * node.richness);
    return;
  }

  const recipeType = DEFINITIONS.buildings[building.type].recipeType;
  if (!recipeType) return;

  const recipe = DEFINITIONS.recipes[recipeType][building.mode];
  if (!recipe) return;

  const canCraft = Object.entries(recipe.in).every(([r, v]) => (building.inv[r] || 0) >= v * speed);
  if (!canCraft) return;

  Object.entries(recipe.in).forEach(([r, v]) => {
    building.inv[r] -= v * speed;
  });
  Object.entries(recipe.out).forEach(([r, v]) => addInv(building, r, v * speed));
}

function moveConveyor(conveyor, ratio) {
  const from = state.buildings.find((b) => b.id === conveyor.from);
  const to = state.buildings.find((b) => b.id === conveyor.to);
  if (!from || !to) return;

  const item = Object.entries(from.inv).find(([, qty]) => qty > 0.2);
  if (!item) return;

  const [resName] = item;
  const amount = 0.45 * ratio;
  if (!takeInv(from, resName, amount)) return;

  if (to.type === "storage") {
    state.wallet[resName] = (state.wallet[resName] || 0) + amount;
  } else {
    addInv(to, resName, amount);
  }
}

function updateSimulation() {
  const before = structuredClone(state.wallet);

  state.energyProduced = 0;
  state.energyDemand = 0;
  state.buildings.forEach((b) => {
    const p = DEFINITIONS.buildings[b.type].power;
    if (p < 0) state.energyProduced += Math.abs(p) * (1 + (b.level - 1) * 0.3);
    else state.energyDemand += p;
  });

  state.powerRatio = Math.min(1, state.energyProduced / Math.max(1, state.energyDemand));

  state.buildings.forEach((b) => processBuilding(b, state.powerRatio));
  state.conveyors.forEach((c) => moveConveyor(c, state.powerRatio));

  state.rates = {};
  Object.keys(state.wallet).forEach((r) => {
    state.rates[r] = (state.wallet[r] - before[r]) * 5;
  });

  updateQuests();
}

function updateQuests() {
  DEFINITIONS.quests.forEach((q) => {
    if (!state.questsCompleted.has(q.id) && q.isDone(state)) {
      state.questsCompleted.add(q.id);
      setStatus(`Quest complete: ${q.title}`);
    }
  });
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";
  Object.entries(DEFINITIONS.buildings).forEach(([id, def]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${def.name}</strong><div class='small'>${Object.entries(def.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")} | ${def.nodeOnly ? "Ore Node" : "Edge Ring"}</div>`;
    btn.onclick = () => {
      state.selectedBuild = state.selectedBuild === id ? null : id;
      state.conveyorMode = false;
      state.conveyorStart = null;
      renderBuildMenu();
      setStatus(state.selectedBuild ? `Build mode: ${def.name}` : "Build mode cleared.");
    };
    buildMenu.appendChild(btn);
  });

  connectModeBtn.className = state.conveyorMode ? "active" : "";
  connectModeBtn.textContent = `Conveyor Tool: ${state.conveyorMode ? "ON" : "OFF"}`;
}

connectModeBtn.addEventListener("click", () => {
  state.conveyorMode = !state.conveyorMode;
  state.selectedBuild = null;
  state.conveyorStart = null;
  renderBuildMenu();
  setStatus(state.conveyorMode ? "Conveyor tool enabled." : "Conveyor tool disabled.");
});

function renderQuestTree() {
  questTree.innerHTML = "";
  DEFINITIONS.quests.forEach((q) => {
    const done = state.questsCompleted.has(q.id);
    const item = document.createElement("div");
    item.className = "small";
    item.textContent = `${done ? "✅" : "⬜"} ${q.title} — ${q.hint}`;
    questTree.appendChild(item);
  });

  const next = DEFINITIONS.quests.find((q) => !state.questsCompleted.has(q.id));
  objectiveText.textContent = next ? `${next.title}: ${next.hint}` : "All starter quests complete. Expand and optimize your chain.";
}

function renderSelection() {
  selectionActions.innerHTML = "";
  const b = state.buildings.find((x) => x.id === state.selectedBuildingId);
  if (!b) {
    selectionText.textContent = "Nothing selected.";
    return;
  }

  const recipeType = DEFINITIONS.buildings[b.type].recipeType;
  const recipeLabel = recipeType ? DEFINITIONS.recipes[recipeType][b.mode].label : "N/A";
  selectionText.textContent = `${DEFINITIONS.buildings[b.type].name} | Lv.${b.level} | Recipe: ${recipeLabel}`;

  const upgrade = document.createElement("button");
  const cost = { Rock: 10 * b.level };
  upgrade.innerHTML = `<strong>Upgrade</strong><div class='small'>Rock ${cost.Rock}</div>`;
  upgrade.onclick = () => {
    if (!canAfford(cost)) return setStatus("Not enough Rock to upgrade."), undefined;
    spend(cost);
    b.level += 1;
    setStatus("Building upgraded.");
    renderSelection();
    renderSidePanels();
  };
  selectionActions.appendChild(upgrade);

  if (recipeType) {
    const cycle = document.createElement("button");
    cycle.textContent = `Cycle Recipe (${recipeLabel})`;
    cycle.onclick = () => {
      const ks = Object.keys(DEFINITIONS.recipes[recipeType]);
      const idx = ks.indexOf(b.mode);
      b.mode = ks[(idx + 1) % ks.length];
      renderSelection();
    };
    selectionActions.appendChild(cycle);
  }
}

function renderSidePanels() {
  resourceList.innerHTML = "";
  Object.entries(state.wallet).forEach(([name, value]) => {
    const row = document.createElement("div");
    row.className = "small";
    row.textContent = `${name}: ${value.toFixed(1)} (${(state.rates[name] || 0).toFixed(2)}/s)`;
    resourceList.appendChild(row);
  });

  energyText.textContent = `Power ${state.energyProduced.toFixed(1)} / ${state.energyDemand.toFixed(1)} MW (${state.powerRatio < 1 ? "underpowered" : "stable"})`;
  automationText.textContent = `Buildings: ${state.buildings.length} | Conveyors: ${state.conveyors.length} | Miners: ${state.nodes.filter((n) => n.minerId).length}/${state.nodes.length}`;
  renderQuestTree();
}

function drawOreCrystal(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.65, y - size * 0.1);
  ctx.lineTo(x + size * 0.38, y + size * 0.75);
  ctx.lineTo(x - size * 0.38, y + size * 0.75);
  ctx.lineTo(x - size * 0.65, y - size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBuilding3D(building, p) {
  const color = DEFINITIONS.buildings[building.type].color;
  const size = 10 + building.level * 1.8;

  ctx.fillStyle = "#00000033";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + size * 0.8, size * 0.8, size * 0.4, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(p.x - size * 0.7, p.y - size * 0.8, size * 1.4, size * 1.2);

  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(p.x - size * 0.7, p.y - size * 0.8, size * 1.4, size * 0.35);

  if (state.selectedBuildingId === building.id) {
    ctx.strokeStyle = "#7ef9ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size + 4, 0, TAU);
    ctx.stroke();
  }
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  const R = Math.min(w, h) * 0.34 * state.zoom;

  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w / 2 - 90, h / 2 - 110, 50, w / 2, h / 2, 460);
  bg.addColorStop(0, "#213b61");
  bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const planetGrad = ctx.createRadialGradient(w / 2 - R * 0.3, h / 2 - R * 0.4 + state.tilt, R * 0.1, w / 2, h / 2 + state.tilt, R);
  planetGrad.addColorStop(0, "#5075a5");
  planetGrad.addColorStop(1, "#2d476d");
  ctx.fillStyle = planetGrad;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 + state.tilt, R, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "#85bcff66";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 + state.tilt, R - 6, 0, TAU);
  ctx.stroke();

  const nodeColors = { "Iron Ore": "#c7d0d8", "Copper Ore": "#ffba72", Limestone: "#b7f5df" };
  const nodeRender = state.nodes
    .map((n) => ({ n, p: project(n.lat, n.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z);

  nodeRender.forEach(({ n, p }) => {
    drawOreCrystal(p.x, p.y, 11, nodeColors[n.type]);
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "11px sans-serif";
    ctx.fillText(n.type, p.x - 24, p.y + 23);
  });

  state.conveyors.forEach((c, idx) => {
    const from = state.buildings.find((b) => b.id === c.from);
    const to = state.buildings.find((b) => b.id === c.to);
    if (!from || !to) return;
    const a = project(from.lat, from.lon);
    const b = project(to.lat, to.lon);
    if (!a.visible || !b.visible) return;

    ctx.strokeStyle = "#89d7ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    c.t = (c.t + 0.012) % 1;
    const x = a.x + (b.x - a.x) * c.t;
    const y = a.y + (b.y - a.y) * c.t;
    drawOreCrystal(x, y, 4, idx % 2 ? "#ffffff" : "#77ffc3");
  });

  const buildingRender = state.buildings
    .map((b) => ({ b, p: project(b.lat, b.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z);

  buildingRender.forEach(({ b, p }) => drawBuilding3D(b, p));

  planetLabel.textContent = "3D Circular Planet | Ore crystals + modular factories";
  cameraLabel.textContent = `Rotation ${state.rotation.toFixed(2)} | Zoom ${state.zoom.toFixed(2)} ${state.conveyorMode ? "| Conveyor Tool" : ""}`;
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
  if (!state.dragging) return;
  const dx = e.clientX - state.lastMouse.x;
  const dy = e.clientY - state.lastMouse.y;
  state.dragDistance += Math.abs(dx) + Math.abs(dy);
  state.lastMouse = { x: e.clientX, y: e.clientY };
  state.rotation += dx * 0.005;
  state.tilt += dy * 0.2;
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  state.zoom *= e.deltaY < 0 ? 1.05 : 0.95;
  state.zoom = Math.max(0.65, Math.min(2.0, state.zoom));
});

canvas.addEventListener("click", (e) => {
  if (state.dragDistance > 8) return;
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const my = ((e.clientY - rect.top) / rect.height) * canvas.height;

  if (state.conveyorMode) return void placeConveyor(mx, my);
  const placed = placeBuilding(mx, my);
  if (!placed) {
    const b = pickBuilding(mx, my);
    state.selectedBuildingId = b?.id || null;
    renderSelection();
    setStatus(b ? `Selected ${DEFINITIONS.buildings[b.type].name}.` : "Nothing selected.");
  }

  renderSidePanels();
});

function loop() {
  state.tick += 1;
  if (state.tick % 12 === 0) {
    updateSimulation();
    renderSidePanels();
  }
  draw();
  requestAnimationFrame(loop);
}

renderBuildMenu();
renderSelection();
renderSidePanels();
setStatus("3D modular mode ready. Follow quests on the right.");
requestAnimationFrame(loop);
