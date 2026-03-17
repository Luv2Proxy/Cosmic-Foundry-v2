const RESOURCES = ["Iron Ore", "Copper Ore", "Limestone", "Iron Ingot", "Copper Ingot", "Iron Plate", "Wire", "Concrete"];

const BUILDINGS = {
  miner: { name: "Miner", color: "#f6c177", cost: { Rock: 8 }, power: 3, edgeOnly: false },
  smelter: { name: "Smelter", color: "#ef6f6c", cost: { Rock: 12 }, power: 5, edgeOnly: true },
  constructor: { name: "Constructor", color: "#8ecae6", cost: { Rock: 16, "Iron Ingot": 6 }, power: 6, edgeOnly: true },
  storage: { name: "Storage", color: "#b39ddb", cost: { Rock: 10 }, power: 1, edgeOnly: true },
  power: { name: "Biomass Burner", color: "#80ed99", cost: { Rock: 14 }, power: -18, edgeOnly: true },
};

const RECIPES = {
  smelter: {
    iron: { in: { "Iron Ore": 1 }, out: { "Iron Ingot": 1 } },
    copper: { in: { "Copper Ore": 1 }, out: { "Copper Ingot": 1 } },
  },
  constructor: {
    plate: { in: { "Iron Ingot": 2 }, out: { "Iron Plate": 1 } },
    wire: { in: { "Copper Ingot": 1 }, out: { Wire: 2 } },
    concrete: { in: { Limestone: 3 }, out: { Concrete: 1 } },
  },
};

const state = {
  selectedBuild: null,
  conveyorMode: false,
  conveyorStart: null,
  selectedBuildingId: null,
  status: "Welcome to Cosmic Foundry (2D Satisfactory-style prototype).",
  wallet: { Rock: 100, "Iron Ore": 0, "Copper Ore": 0, Limestone: 0, "Iron Ingot": 0, "Copper Ingot": 0, "Iron Plate": 0, Wire: 0, Concrete: 0 },
  rates: {},
  energyProduced: 0,
  energyDemand: 0,
  powerRatio: 1,
  buildings: [],
  conveyors: [],
  nodes: makeNodes(),
  edgeSlots: makeEdgeSlots(),
  tick: 0,
};

function makeNodes() {
  return [
    { id: "n1", x: 440, y: 220, type: "Iron Ore", minerId: null },
    { id: "n2", x: 640, y: 170, type: "Copper Ore", minerId: null },
    { id: "n3", x: 760, y: 350, type: "Limestone", minerId: null },
    { id: "n4", x: 520, y: 420, type: "Iron Ore", minerId: null },
    { id: "n5", x: 310, y: 350, type: "Copper Ore", minerId: null },
  ];
}

function makeEdgeSlots() {
  const slots = [];
  const left = 120;
  const top = 90;
  const right = 1080;
  const bottom = 650;
  let i = 0;

  for (let x = left + 80; x <= right - 80; x += 120) slots.push({ id: `s${i++}`, x, y: top, buildingId: null });
  for (let y = top + 80; y <= bottom - 80; y += 110) slots.push({ id: `s${i++}`, x: right, y, buildingId: null });
  for (let x = right - 80; x >= left + 80; x -= 120) slots.push({ id: `s${i++}`, x, y: bottom, buildingId: null });
  for (let y = bottom - 80; y >= top + 80; y -= 110) slots.push({ id: `s${i++}`, x: left, y, buildingId: null });
  return slots;
}

const canvas = document.getElementById("planetCanvas");
const ctx = canvas.getContext("2d");
const resourceList = document.getElementById("resourceList");
const buildMenu = document.getElementById("buildMenu");
const selectionText = document.getElementById("selectionText");
const selectionActions = document.getElementById("selectionActions");
const energyText = document.getElementById("energyText");
const automationText = document.getElementById("automationText");
const statusText = document.getElementById("statusText");
const planetLabel = document.getElementById("planetLabel");
const cameraLabel = document.getElementById("cameraLabel");
const connectModeBtn = document.getElementById("connectModeBtn");

document.getElementById("researchList").innerHTML = "<div class='small'>Research disabled in this Satisfactory-style build.</div>";
document.getElementById("planetActions").innerHTML = "<div class='small'>Single 2D factory region active.</div>";
document.getElementById("manualMineBtn").textContent = "Manual Gather Rock (+4)";

document.getElementById("manualMineBtn").addEventListener("click", () => {
  state.wallet.Rock += 4;
  setStatus("Gathered loose rock for early construction.");
});

document.getElementById("prestigeBtn").style.display = "none";

connectModeBtn.addEventListener("click", () => {
  state.conveyorMode = !state.conveyorMode;
  state.conveyorStart = null;
  state.selectedBuild = null;
  renderBuildMenu();
  setStatus(state.conveyorMode ? "Conveyor mode ON: click source then destination building." : "Conveyor mode OFF.");
});

function setStatus(msg) {
  state.status = msg;
  statusText.textContent = msg;
}

function createBuilding(type, x, y, opts = {}) {
  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    type,
    x,
    y,
    level: 1,
    mode: opts.mode || (type === "smelter" ? "iron" : type === "constructor" ? "plate" : "default"),
    nodeId: opts.nodeId || null,
    inv: {},
  };
}

function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => (state.wallet[k] || 0) >= v);
}

function spend(cost) {
  Object.entries(cost).forEach(([k, v]) => {
    state.wallet[k] -= v;
  });
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";
  Object.entries(BUILDINGS).forEach(([id, def]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${def.name}</strong><div class='small'>${Object.entries(def.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}${def.edgeOnly ? " | Edge slot only" : " | Ore node only"}</div>`;
    btn.addEventListener("click", () => {
      state.selectedBuild = state.selectedBuild === id ? null : id;
      state.conveyorMode = false;
      state.conveyorStart = null;
      renderBuildMenu();
    });
    buildMenu.appendChild(btn);
  });
  connectModeBtn.className = state.conveyorMode ? "active" : "";
  connectModeBtn.textContent = `Conveyor Tool: ${state.conveyorMode ? "ON" : "OFF"}`;
}

function renderResources() {
  resourceList.innerHTML = "";
  Object.entries(state.wallet)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, amount]) => {
      const div = document.createElement("div");
      div.className = "small";
      div.textContent = `${name}: ${amount.toFixed(1)} (${(state.rates[name] || 0).toFixed(2)}/s)`;
      resourceList.appendChild(div);
    });
  energyText.textContent = `Power: ${state.energyProduced.toFixed(1)} / ${state.energyDemand.toFixed(1)} MW (${state.powerRatio < 1 ? "underpowered" : "stable"})`;
  automationText.textContent = `Buildings: ${state.buildings.length} | Conveyors: ${state.conveyors.length} | Miners on nodes: ${state.nodes.filter((n) => n.minerId).length}/${state.nodes.length}`;
}

function renderSelection() {
  selectionActions.innerHTML = "";
  if (!state.selectedBuildingId) {
    selectionText.textContent = "Nothing selected.";
    return;
  }
  const b = state.buildings.find((x) => x.id === state.selectedBuildingId);
  if (!b) {
    state.selectedBuildingId = null;
    selectionText.textContent = "Nothing selected.";
    return;
  }

  selectionText.textContent = `${BUILDINGS[b.type].name} | Lv.${b.level} | Mode: ${b.mode}`;

  const upBtn = document.createElement("button");
  const upCost = { Rock: 10 * b.level };
  upBtn.innerHTML = `<strong>Upgrade</strong><div class='small'>Rock ${upCost.Rock}</div>`;
  upBtn.addEventListener("click", () => {
    if (!canAfford(upCost)) return setStatus("Not enough Rock to upgrade.");
    spend(upCost);
    b.level += 1;
    setStatus(`${BUILDINGS[b.type].name} upgraded to level ${b.level}.`);
    renderSelection();
  });
  selectionActions.appendChild(upBtn);

  if (b.type === "smelter" || b.type === "constructor") {
    const modeBtn = document.createElement("button");
    modeBtn.textContent = `Cycle Recipe (${b.mode})`;
    modeBtn.addEventListener("click", () => {
      const recipeSet = Object.keys(RECIPES[b.type]);
      const idx = recipeSet.indexOf(b.mode);
      b.mode = recipeSet[(idx + 1) % recipeSet.length];
      renderSelection();
    });
    selectionActions.appendChild(modeBtn);
  }
}

function pointDist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function pickNode(x, y) {
  return state.nodes.find((n) => pointDist(x, y, n.x, n.y) < 24) || null;
}

function pickSlot(x, y) {
  return state.edgeSlots.find((s) => pointDist(x, y, s.x, s.y) < 20) || null;
}

function pickBuilding(x, y) {
  return state.buildings.find((b) => pointDist(x, y, b.x, b.y) < 20) || null;
}

function handlePlacement(x, y) {
  if (!state.selectedBuild) return false;
  const type = state.selectedBuild;
  const def = BUILDINGS[type];
  if (!canAfford(def.cost)) return setStatus("Insufficient resources for building."), true;

  if (type === "miner") {
    const node = pickNode(x, y);
    if (!node) return setStatus("Miners must be placed on ore nodes."), true;
    if (node.minerId) return setStatus("Node already has a miner."), true;
    const building = createBuilding(type, node.x, node.y, { nodeId: node.id });
    node.minerId = building.id;
    state.buildings.push(building);
    spend(def.cost);
    state.selectedBuildingId = building.id;
    renderSelection();
    return setStatus(`Placed Miner on ${node.type} node.`), true;
  }

  const slot = pickSlot(x, y);
  if (!slot) return setStatus("This building must be placed on an edge slot."), true;
  if (slot.buildingId) return setStatus("Edge slot occupied."), true;

  const building = createBuilding(type, slot.x, slot.y);
  slot.buildingId = building.id;
  state.buildings.push(building);
  spend(def.cost);
  state.selectedBuildingId = building.id;
  renderSelection();
  setStatus(`Placed ${def.name} on edge.`);
  return true;
}

function handleConveyorClick(x, y) {
  const building = pickBuilding(x, y);
  if (!building) return setStatus("Conveyors must connect building-to-building."), true;

  if (!state.conveyorStart) {
    state.conveyorStart = building.id;
    return setStatus(`Conveyor source selected: ${BUILDINGS[building.type].name}`), true;
  }
  if (state.conveyorStart === building.id) return setStatus("Cannot connect building to itself."), true;

  const exists = state.conveyors.some((c) => c.from === state.conveyorStart && c.to === building.id);
  if (exists) {
    state.conveyorStart = null;
    return setStatus("Conveyor already exists."), true;
  }

  state.conveyors.push({ from: state.conveyorStart, to: building.id, t: Math.random() });
  state.conveyorStart = null;
  setStatus("Conveyor built.");
  return true;
}

function handleSelection(x, y) {
  const b = pickBuilding(x, y);
  if (!b) {
    state.selectedBuildingId = null;
    renderSelection();
    return setStatus("Nothing selected."), true;
  }
  state.selectedBuildingId = b.id;
  renderSelection();
  setStatus(`Selected ${BUILDINGS[b.type].name}.`);
  return true;
}

function addInv(b, item, qty) {
  b.inv[item] = (b.inv[item] || 0) + qty;
}

function takeInv(b, item, qty) {
  if ((b.inv[item] || 0) < qty) return false;
  b.inv[item] -= qty;
  return true;
}

function processBuilding(b, ratio) {
  const speed = ratio * (1 + (b.level - 1) * 0.25);
  if (b.type === "miner") {
    const node = state.nodes.find((n) => n.id === b.nodeId);
    if (node) addInv(b, node.type, 0.55 * speed);
    return;
  }

  if (b.type === "smelter") {
    const r = RECIPES.smelter[b.mode];
    const inName = Object.keys(r.in)[0];
    const outName = Object.keys(r.out)[0];
    if (takeInv(b, inName, 1 * speed)) addInv(b, outName, 1 * speed);
    return;
  }

  if (b.type === "constructor") {
    const r = RECIPES.constructor[b.mode];
    const ok = Object.entries(r.in).every(([k, v]) => (b.inv[k] || 0) >= v * speed);
    if (!ok) return;
    Object.entries(r.in).forEach(([k, v]) => {
      b.inv[k] -= v * speed;
    });
    Object.entries(r.out).forEach(([k, v]) => addInv(b, k, v * speed));
    return;
  }
}

function moveConveyor(c, ratio) {
  const from = state.buildings.find((b) => b.id === c.from);
  const to = state.buildings.find((b) => b.id === c.to);
  if (!from || !to) return;

  const transferable = Object.entries(from.inv).find(([, qty]) => qty > 0.2);
  if (!transferable) return;
  const [item] = transferable;
  const amount = 0.45 * ratio;
  if (!takeInv(from, item, amount)) return;

  if (to.type === "storage") {
    state.wallet[item] = (state.wallet[item] || 0) + amount;
    return;
  }
  addInv(to, item, amount);
}

function simulate() {
  state.tick += 1;
  const before = structuredClone(state.wallet);

  state.energyProduced = 0;
  state.energyDemand = 0;

  for (const b of state.buildings) {
    const p = BUILDINGS[b.type].power;
    if (p < 0) state.energyProduced += Math.abs(p) * (1 + (b.level - 1) * 0.35);
    else state.energyDemand += p;
  }

  state.powerRatio = Math.min(1, state.energyProduced / Math.max(1, state.energyDemand));

  for (const b of state.buildings) processBuilding(b, state.powerRatio);
  for (const c of state.conveyors) moveConveyor(c, state.powerRatio);

  state.rates = {};
  Object.keys(state.wallet).forEach((k) => {
    state.rates[k] = (state.wallet[k] - before[k]) * 5;
  });

  renderResources();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#132238";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const map = { x: 120, y: 90, w: 960, h: 560 };
  ctx.fillStyle = "#20344f";
  ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.strokeStyle = "#5d84b8";
  ctx.lineWidth = 3;
  ctx.strokeRect(map.x, map.y, map.w, map.h);

  state.edgeSlots.forEach((s) => {
    ctx.fillStyle = s.buildingId ? "#5b6a80" : "#2a4769";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  state.nodes.forEach((n) => {
    const colors = { "Iron Ore": "#9aa7b0", "Copper Ore": "#ffb26b", Limestone: "#d6f1e8" };
    ctx.fillStyle = colors[n.type] || "#fff";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1220";
    ctx.font = "11px sans-serif";
    ctx.fillText(n.type, n.x - 30, n.y + 32);
  });

  state.conveyors.forEach((c, i) => {
    const from = state.buildings.find((b) => b.id === c.from);
    const to = state.buildings.find((b) => b.id === c.to);
    if (!from || !to) return;
    ctx.strokeStyle = "#86d0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    c.t = (c.t + 0.015) % 1;
    const x = from.x + (to.x - from.x) * c.t;
    const y = from.y + (to.y - from.y) * c.t;
    ctx.fillStyle = i % 2 ? "#ffffff" : "#72ffb4";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });

  state.buildings.forEach((b) => {
    const def = BUILDINGS[b.type];
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 14 + b.level, 0, Math.PI * 2);
    ctx.fill();

    if (state.selectedBuildingId === b.id) {
      ctx.strokeStyle = "#7ef9ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 20 + b.level, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  planetLabel.textContent = "2D Factory Region | Edge-building layout | Satisfactory-style chains";
  cameraLabel.textContent = state.conveyorMode ? "Conveyor mode active" : "Build mode";
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

  if (state.conveyorMode) {
    handleConveyorClick(x, y);
    return;
  }
  const placed = handlePlacement(x, y);
  if (!placed) handleSelection(x, y);
});

function loop() {
  if (state.tick % 12 === 0) simulate();
  draw();
  requestAnimationFrame(loop);
}

renderBuildMenu();
renderResources();
renderSelection();
setStatus(state.status);
requestAnimationFrame(loop);
