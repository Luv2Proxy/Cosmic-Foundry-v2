const TAU = Math.PI * 2;

const RESOURCES = ["Rock", "Iron Ore", "Copper Ore", "Limestone", "Iron Ingot", "Copper Ingot", "Iron Plate", "Wire", "Concrete"];

const BUILDINGS = {
  miner: { name: "Miner", color: "#f6c177", power: 3, cost: { Rock: 10 }, nodeOnly: true },
  smelter: { name: "Smelter", color: "#ef6f6c", power: 5, cost: { Rock: 12 }, nodeOnly: false },
  constructor: { name: "Constructor", color: "#8ecae6", power: 6, cost: { Rock: 16 }, nodeOnly: false },
  storage: { name: "Storage", color: "#b39ddb", power: 1, cost: { Rock: 10 }, nodeOnly: false },
  power: { name: "Biomass Burner", color: "#80ed99", power: -18, cost: { Rock: 14 }, nodeOnly: false },
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
  wallet: Object.fromEntries(["Rock", ...RESOURCES.filter((r) => r !== "Rock")].map((r) => [r, 0])),
  rates: {},
  selectedBuild: null,
  conveyorMode: false,
  conveyorStart: null,
  selectedBuildingId: null,
  rotation: 0.15,
  tilt: 0,
  zoom: 1,
  dragging: false,
  dragDistance: 0,
  lastMouse: null,
  nodes: makeNodes(),
  buildings: [],
  conveyors: [],
  energyProduced: 0,
  energyDemand: 0,
  powerRatio: 1,
  tick: 0,
};
state.wallet.Rock = 120;

function makeNodes() {
  const defs = [
    [0.1, 0.2, "Iron Ore"],
    [-0.3, 1.0, "Copper Ore"],
    [0.42, 2.2, "Limestone"],
    [-0.15, 2.9, "Iron Ore"],
    [0.3, 4.0, "Copper Ore"],
    [-0.45, 5.0, "Limestone"],
  ];
  return defs.map((d, i) => ({ id: `n${i}`, lat: d[0], lon: d[1], type: d[2], minerId: null }));
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

const researchList = document.getElementById("researchList");
researchList.innerHTML = "<div class='small'>3D circular planet mode active.</div>";
document.getElementById("planetActions").innerHTML = "<div class='small'>Drag to rotate planet, wheel to zoom.</div>";
document.getElementById("prestigeBtn").style.display = "none";
document.getElementById("manualMineBtn").textContent = "Manual Gather Rock (+4)";
document.getElementById("manualMineBtn").addEventListener("click", () => {
  state.wallet.Rock += 4;
  setStatus("Gathered rock.");
});

connectModeBtn.addEventListener("click", () => {
  state.conveyorMode = !state.conveyorMode;
  state.selectedBuild = null;
  state.conveyorStart = null;
  renderBuildMenu();
  setStatus(state.conveyorMode ? "Conveyor mode ON" : "Conveyor mode OFF");
});

function setStatus(msg) {
  statusText.textContent = msg;
}

function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => (state.wallet[k] || 0) >= v);
}
function spend(cost) {
  Object.entries(cost).forEach(([k, v]) => (state.wallet[k] -= v));
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
  return { x: w / 2 + x * R * perspective, y: h / 2 + y * R + state.tilt, z, visible: z > -0.18 };
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";
  Object.entries(BUILDINGS).forEach(([id, d]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${d.name}</strong><div class='small'>${Object.entries(d.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")} | ${d.nodeOnly ? "Ore node" : "Planet surface"}</div>`;
    btn.onclick = () => {
      state.selectedBuild = state.selectedBuild === id ? null : id;
      state.conveyorMode = false;
      state.conveyorStart = null;
      renderBuildMenu();
    };
    buildMenu.appendChild(btn);
  });
  connectModeBtn.className = state.conveyorMode ? "active" : "";
  connectModeBtn.textContent = `Conveyor Tool: ${state.conveyorMode ? "ON" : "OFF"}`;
}

function renderSelection() {
  selectionActions.innerHTML = "";
  const b = state.buildings.find((x) => x.id === state.selectedBuildingId);
  if (!b) {
    selectionText.textContent = "Nothing selected.";
    return;
  }
  selectionText.textContent = `${BUILDINGS[b.type].name} | Lv.${b.level} | Mode: ${b.mode}`;

  const up = document.createElement("button");
  const cost = { Rock: 10 * b.level };
  up.innerHTML = `<strong>Upgrade</strong><div class='small'>Rock ${cost.Rock}</div>`;
  up.onclick = () => {
    if (!canAfford(cost)) return setStatus("Not enough Rock.");
    spend(cost);
    b.level += 1;
    renderSelection();
    setStatus("Building upgraded.");
  };
  selectionActions.appendChild(up);

  if (b.type === "smelter" || b.type === "constructor") {
    const cycle = document.createElement("button");
    cycle.textContent = `Cycle Recipe (${b.mode})`;
    cycle.onclick = () => {
      const ks = Object.keys(RECIPES[b.type]);
      b.mode = ks[(ks.indexOf(b.mode) + 1) % ks.length];
      renderSelection();
    };
    selectionActions.appendChild(cycle);
  }
}

function renderResources() {
  resourceList.innerHTML = "";
  Object.entries(state.wallet).forEach(([k, v]) => {
    const div = document.createElement("div");
    div.className = "small";
    div.textContent = `${k}: ${v.toFixed(1)} (${(state.rates[k] || 0).toFixed(2)}/s)`;
    resourceList.appendChild(div);
  });
  energyText.textContent = `Power ${state.energyProduced.toFixed(1)} / ${state.energyDemand.toFixed(1)} MW (${state.powerRatio < 1 ? "underpowered" : "stable"})`;
  automationText.textContent = `Buildings: ${state.buildings.length} | Conveyors: ${state.conveyors.length} | Miners: ${state.nodes.filter((n) => n.minerId).length}/${state.nodes.length}`;
}

function pickNode(x, y) {
  let best = null;
  let d = 999;
  state.nodes.forEach((n) => {
    const p = project(n.lat, n.lon);
    if (!p.visible) return;
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 20 && dist < d) {
      d = dist;
      best = n;
    }
  });
  return best;
}

function pickBuilding(x, y) {
  let best = null;
  let d = 999;
  state.buildings.forEach((b) => {
    const p = project(b.lat, b.lon);
    if (!p.visible) return;
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 18 && dist < d) {
      d = dist;
      best = b;
    }
  });
  return best;
}

function createBuilding(type, lat, lon, nodeId = null) {
  return { id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, lat, lon, nodeId, level: 1, mode: type === "smelter" ? "iron" : type === "constructor" ? "plate" : "default", inv: {} };
}

function handlePlacement(x, y) {
  if (!state.selectedBuild) return false;
  const type = state.selectedBuild;
  const def = BUILDINGS[type];
  if (!canAfford(def.cost)) return setStatus("Insufficient resources."), true;

  if (def.nodeOnly) {
    const node = pickNode(x, y);
    if (!node) return setStatus("Miner must be placed on an ore node."), true;
    if (node.minerId) return setStatus("Node already occupied."), true;
    const b = createBuilding(type, node.lat, node.lon, node.id);
    state.buildings.push(b);
    node.minerId = b.id;
    spend(def.cost);
    state.selectedBuildingId = b.id;
    renderSelection();
    return setStatus(`Miner placed on ${node.type}.`), true;
  }

  const pCenter = { x: canvas.width / 2, y: canvas.height / 2 };
  const r = Math.min(canvas.width, canvas.height) * 0.34 * state.zoom;
  const dx = x - pCenter.x;
  const dy = y - pCenter.y;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dist - r) > 90) return setStatus("Place this building near the planet edge ring."), true;

  const lat = Math.max(-1.2, Math.min(1.2, dy / r));
  const lon = Math.atan2(dx, Math.sqrt(Math.max(0.0001, r * r - dx * dx - dy * dy))) - state.rotation;
  const nearby = state.buildings.some((b) => Math.abs(b.lat - lat) < 0.08 && Math.abs(b.lon - lon) < 0.12);
  if (nearby) return setStatus("Too close to another building."), true;

  const b = createBuilding(type, lat, lon);
  state.buildings.push(b);
  spend(def.cost);
  state.selectedBuildingId = b.id;
  renderSelection();
  return setStatus(`${def.name} placed on circular planet edge.`), true;
}

function handleConveyor(x, y) {
  const b = pickBuilding(x, y);
  if (!b) return setStatus("Select a building."), true;
  if (!state.conveyorStart) {
    state.conveyorStart = b.id;
    return setStatus("Conveyor source selected."), true;
  }
  if (state.conveyorStart === b.id) return setStatus("Cannot link to itself."), true;
  if (state.conveyors.some((c) => c.from === state.conveyorStart && c.to === b.id)) {
    state.conveyorStart = null;
    return setStatus("Conveyor already exists."), true;
  }
  state.conveyors.push({ from: state.conveyorStart, to: b.id, t: Math.random() });
  state.conveyorStart = null;
  return setStatus("Conveyor built."), true;
}

function handleSelect(x, y) {
  const b = pickBuilding(x, y);
  state.selectedBuildingId = b?.id || null;
  renderSelection();
  setStatus(b ? `Selected ${BUILDINGS[b.type].name}.` : "Nothing selected.");
}

function addInv(b, k, v) { b.inv[k] = (b.inv[k] || 0) + v; }
function takeInv(b, k, v) { if ((b.inv[k] || 0) < v) return false; b.inv[k] -= v; return true; }

function processBuilding(b, ratio) {
  const speed = ratio * (1 + (b.level - 1) * 0.2);
  if (b.type === "miner") {
    const node = state.nodes.find((n) => n.id === b.nodeId);
    if (node) addInv(b, node.type, 0.55 * speed);
    return;
  }
  if (b.type === "smelter") {
    const r = RECIPES.smelter[b.mode];
    const input = Object.keys(r.in)[0];
    const output = Object.keys(r.out)[0];
    if (takeInv(b, input, 1 * speed)) addInv(b, output, 1 * speed);
    return;
  }
  if (b.type === "constructor") {
    const r = RECIPES.constructor[b.mode];
    if (!Object.entries(r.in).every(([k, v]) => (b.inv[k] || 0) >= v * speed)) return;
    Object.entries(r.in).forEach(([k, v]) => (b.inv[k] -= v * speed));
    Object.entries(r.out).forEach(([k, v]) => addInv(b, k, v * speed));
  }
}

function moveConveyor(c, ratio) {
  const from = state.buildings.find((b) => b.id === c.from);
  const to = state.buildings.find((b) => b.id === c.to);
  if (!from || !to) return;
  const item = Object.entries(from.inv).find(([, q]) => q > 0.2);
  if (!item) return;
  const [name] = item;
  const amount = 0.45 * ratio;
  if (!takeInv(from, name, amount)) return;
  if (to.type === "storage") state.wallet[name] = (state.wallet[name] || 0) + amount;
  else addInv(to, name, amount);
}

function simulate() {
  const before = structuredClone(state.wallet);
  state.energyProduced = 0;
  state.energyDemand = 0;
  state.buildings.forEach((b) => {
    const p = BUILDINGS[b.type].power;
    if (p < 0) state.energyProduced += Math.abs(p) * (1 + (b.level - 1) * 0.35);
    else state.energyDemand += p;
  });
  state.powerRatio = Math.min(1, state.energyProduced / Math.max(1, state.energyDemand));

  state.buildings.forEach((b) => processBuilding(b, state.powerRatio));
  state.conveyors.forEach((c) => moveConveyor(c, state.powerRatio));

  state.rates = {};
  Object.keys(state.wallet).forEach((k) => (state.rates[k] = (state.wallet[k] - before[k]) * 5));
  renderResources();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width,
    h = canvas.height;
  const R = Math.min(w, h) * 0.34 * state.zoom;

  const bg = ctx.createRadialGradient(w / 2 - 100, h / 2 - 120, 60, w / 2, h / 2, 450);
  bg.addColorStop(0, "#203a5f");
  bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#2f4f77";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 + state.tilt, R, 0, TAU);
  ctx.fill();

  // edge band for requested edge placement visualization
  ctx.strokeStyle = "#7bb7ff66";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 + state.tilt, R - 8, 0, TAU);
  ctx.stroke();

  const nodeOrder = state.nodes
    .map((n) => ({ n, p: project(n.lat, n.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z);

  nodeOrder.forEach(({ n, p }) => {
    const c = { "Iron Ore": "#a9b3bd", "Copper Ore": "#ffb367", Limestone: "#d8f5ea" };
    ctx.fillStyle = c[n.type];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#dce7ff";
    ctx.font = "11px sans-serif";
    ctx.fillText(n.type, p.x - 25, p.y + 24);
  });

  state.conveyors.forEach((c, i) => {
    const aB = state.buildings.find((b) => b.id === c.from);
    const bB = state.buildings.find((b) => b.id === c.to);
    if (!aB || !bB) return;
    const a = project(aB.lat, aB.lon);
    const b = project(bB.lat, bB.lon);
    if (!a.visible || !b.visible) return;
    ctx.strokeStyle = "#8ad4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    c.t = (c.t + 0.015) % 1;
    const x = a.x + (b.x - a.x) * c.t;
    const y = a.y + (b.y - a.y) * c.t;
    ctx.fillStyle = i % 2 ? "#fff" : "#8bffc7";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });

  state.buildings
    .map((b) => ({ b, p: project(b.lat, b.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ b, p }) => {
      ctx.fillStyle = BUILDINGS[b.type].color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 + b.level, 0, TAU);
      ctx.fill();
      if (state.selectedBuildingId === b.id) {
        ctx.strokeStyle = "#7ef9ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17 + b.level, 0, TAU);
        ctx.stroke();
      }
    });

  planetLabel.textContent = "Circular 3D Planet | Satisfactory-style nodes + conveyors";
  cameraLabel.textContent = `Rotation ${state.rotation.toFixed(2)} | Zoom ${state.zoom.toFixed(2)} ${state.conveyorMode ? "| Conveyor mode" : ""}`;
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  state.dragging = true;
  state.dragDistance = 0;
  state.lastMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener("mouseup", () => (state.dragging = false));
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
  state.zoom *= e.deltaY < 0 ? 1.06 : 0.94;
  state.zoom = Math.max(0.6, Math.min(1.9, state.zoom));
});
canvas.addEventListener("click", (e) => {
  if (state.dragDistance > 8) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  if (state.conveyorMode) return void handleConveyor(x, y);
  const placed = handlePlacement(x, y);
  if (!placed) handleSelect(x, y);
});

function loop() {
  state.tick += 1;
  if (state.tick % 12 === 0) simulate();
  draw();
  requestAnimationFrame(loop);
}

renderBuildMenu();
renderResources();
renderSelection();
setStatus("3D circular planet mode ready.");
requestAnimationFrame(loop);
