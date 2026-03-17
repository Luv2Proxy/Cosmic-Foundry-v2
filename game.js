const TAU = Math.PI * 2;

const DEF = {
  resources: ["Rock", "Wood", "Biomass", "Iron Ore", "Copper Ore", "Limestone", "Iron Ingot", "Copper Ingot", "Iron Plate", "Wire", "Concrete"],
  buildings: {
    miner: { name: "Miner", cost: { Rock: 12 }, color: "#f6c177", nodeOnly: true, power: 3, recipeType: null },
    smelter: { name: "Smelter", cost: { Rock: 15 }, color: "#ef6f6c", nodeOnly: false, power: 6, recipeType: "smelter" },
    constructor: { name: "Constructor", cost: { Rock: 20, "Iron Ingot": 4 }, color: "#8ecae6", nodeOnly: false, power: 7, recipeType: "constructor" },
    storage: { name: "Storage", cost: { Rock: 12 }, color: "#b39ddb", nodeOnly: false, power: 1, recipeType: null },
    biomassBurner: { name: "Biomass Burner", cost: { Rock: 18, Wood: 8 }, color: "#80ed99", nodeOnly: false, power: -24, recipeType: null },
  },
  recipes: {
    smelter: {
      ironIngot: { label: "Iron Ingot", in: { "Iron Ore": 1 }, out: { "Iron Ingot": 1 } },
      copperIngot: { label: "Copper Ingot", in: { "Copper Ore": 1 }, out: { "Copper Ingot": 1 } },
    },
    constructor: {
      ironPlate: { label: "Iron Plate", in: { "Iron Ingot": 2 }, out: { "Iron Plate": 1 } },
      wire: { label: "Wire", in: { "Copper Ingot": 1 }, out: { Wire: 2 } },
      concrete: { label: "Concrete", in: { Limestone: 3 }, out: { Concrete: 1 } },
    },
  },
  nodes: [
    { lat: 0.25, lon: 0.2, type: "Iron Ore", richness: 1.1, color: "#b8c2cf" },
    { lat: -0.2, lon: 1.3, type: "Copper Ore", richness: 1.0, color: "#ffb26b" },
    { lat: 0.4, lon: 2.2, type: "Limestone", richness: 1.2, color: "#b7f5df" },
    { lat: -0.1, lon: 3.0, type: "Iron Ore", richness: 0.9, color: "#b8c2cf" },
    { lat: 0.33, lon: 4.15, type: "Copper Ore", richness: 1.1, color: "#ffb26b" },
    { lat: -0.35, lon: 5.0, type: "Limestone", richness: 1.0, color: "#b7f5df" },
  ],
};

class Planet3DEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rotation = 0.2;
    this.tilt = 0;
    this.zoom = 1;
  }

  get radius() {
    return Math.min(this.canvas.width, this.canvas.height) * 0.33 * this.zoom;
  }

  get center() {
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 + this.tilt };
  }

  project(lat, lon) {
    const a = lon + this.rotation;
    const x = Math.cos(lat) * Math.sin(a);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(a);
    const p = 0.5 + (z + 1) * 0.3;
    const c = this.center;
    return { x: c.x + x * this.radius * p, y: c.y + y * this.radius, z, visible: z > -0.2 };
  }

  unprojectFromScreen(x, y) {
    const c = this.center;
    const nx = (x - c.x) / this.radius;
    const ny = (y - c.y) / this.radius;
    const r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    const nz = Math.sqrt(Math.max(0, 1 - r2));

    // inverse rotation
    const xr = nx;
    const yr = ny;
    const zr = nz;
    const a = -this.rotation;
    const wx = xr * Math.cos(a) - zr * Math.sin(a);
    const wz = xr * Math.sin(a) + zr * Math.cos(a);
    const wy = yr;

    return { lat: Math.asin(wy), lon: Math.atan2(wx, wz) };
  }

  drawPlanet() {
    const { ctx } = this;
    const c = this.center;
    const r = this.radius;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const bg = ctx.createRadialGradient(c.x - 90, c.y - 120, 50, c.x, c.y, 480);
    bg.addColorStop(0, "#223b60");
    bg.addColorStop(1, "#0b1220");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const g = ctx.createRadialGradient(c.x - r * 0.25, c.y - r * 0.4, r * 0.08, c.x, c.y, r);
    g.addColorStop(0, "#567ca8");
    g.addColorStop(1, "#2b4569");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fill();
  }
}

const state = {
  wallet: Object.fromEntries(DEF.resources.map((r) => [r, 0])),
  rates: {},
  selectedBuild: null,
  conveyorMode: false,
  conveyorStartId: null,
  selectedBuildingId: null,
  nodes: DEF.nodes.map((n, i) => ({ id: `node-${i}`, ...n, minerId: null })),
  buildings: [],
  conveyors: [],
  energyProduced: 0,
  energyDemand: 0,
  powerRatio: 1,
  tick: 0,
  objectives: [
    { text: "Gather Wood + Biomass + Rock", done: (s) => s.wallet.Rock >= 20 && s.wallet.Wood >= 10 && s.wallet.Biomass >= 6 },
    { text: "Place Miner on an ore node splotch", done: (s) => s.buildings.some((b) => b.type === "miner") },
    { text: "Place Smelter and connect Miner -> Smelter", done: (s) => s.conveyors.some((c) => s.getBuilding(c.from)?.type === "miner" && s.getBuilding(c.to)?.type === "smelter") },
    { text: "Craft with Constructor", done: (s) => s.wallet["Iron Plate"] + s.wallet.Wire + s.wallet.Concrete >= 8 },
  ],
  completed: new Set(),
  getBuilding(id) {
    return this.buildings.find((b) => b.id === id);
  },
};
state.wallet.Rock = 140;
state.wallet.Wood = 20;
state.wallet.Biomass = 10;

const els = {
  canvas: document.getElementById("planetCanvas"),
  status: document.getElementById("statusText"),
  resourceList: document.getElementById("resourceList"),
  energy: document.getElementById("energyText"),
  objective: document.getElementById("objectiveText"),
  buildMenu: document.getElementById("buildMenu"),
  connect: document.getElementById("connectModeBtn"),
  selection: document.getElementById("selectionText"),
  selectionActions: document.getElementById("selectionActions"),
  planetLabel: document.getElementById("planetLabel"),
  cameraLabel: document.getElementById("cameraLabel"),
};

const engine = new Planet3DEngine(els.canvas);
const ctx = engine.ctx;
let drag = { active: false, moved: 0, x: 0, y: 0 };

function setStatus(t) {
  els.status.textContent = t;
}

function canAfford(cost) {
  return Object.entries(cost).every(([r, v]) => (state.wallet[r] || 0) >= v);
}

function spend(cost) {
  Object.entries(cost).forEach(([r, v]) => (state.wallet[r] -= v));
}

function getRecipeKeys(type) {
  const rt = DEF.buildings[type].recipeType;
  return rt ? Object.keys(DEF.recipes[rt]) : [];
}

function createBuilding(type, lat, lon, nodeId = null) {
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    lat,
    lon,
    nodeId,
    level: 1,
    mode: getRecipeKeys(type)[0] || "default",
    input: {},
    output: {},
  };
}

function pickBuilding(x, y) {
  let best = null;
  let min = Infinity;
  state.buildings.forEach((b) => {
    const p = engine.project(b.lat, b.lon);
    if (!p.visible) return;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 20 && d < min) {
      best = b;
      min = d;
    }
  });
  return best;
}

function placeBuilding(x, y) {
  if (!state.selectedBuild) return false;
  const type = state.selectedBuild;
  const def = DEF.buildings[type];
  if (!canAfford(def.cost)) return setStatus("Not enough resources."), true;

  if (def.nodeOnly) {
    const node = state.nodes.find((n) => {
      const p = engine.project(n.lat, n.lon);
      return p.visible && Math.hypot(p.x - x, p.y - y) < 24;
    });
    if (!node) return setStatus("Miner must be placed on ore splotch."), true;
    if (node.minerId) return setStatus("Node already has miner."), true;
    const b = createBuilding(type, node.lat, node.lon, node.id);
    state.buildings.push(b);
    node.minerId = b.id;
    spend(def.cost);
    state.selectedBuildingId = b.id;
    renderSelection();
    return setStatus(`Placed Miner on ${node.type}.`), true;
  }

  const ll = engine.unprojectFromScreen(x, y);
  if (!ll) return setStatus("Click on planet surface to place building."), true;
  const tooClose = state.buildings.some((b) => {
    const pa = engine.project(b.lat, b.lon);
    return pa.visible && Math.hypot(pa.x - x, pa.y - y) < 28;
  });
  if (tooClose) return setStatus("Too close to existing building."), true;

  const b = createBuilding(type, ll.lat, ll.lon);
  state.buildings.push(b);
  spend(def.cost);
  state.selectedBuildingId = b.id;
  renderSelection();
  setStatus(`Placed ${def.name} anywhere on planet.`);
  return true;
}

function placeConveyor(x, y) {
  const hit = pickBuilding(x, y);
  if (!hit) return setStatus("Conveyors must connect buildings."), true;
  if (!state.conveyorStartId) {
    state.conveyorStartId = hit.id;
    return setStatus("Conveyor source selected."), true;
  }
  if (state.conveyorStartId === hit.id) return setStatus("Cannot connect to itself."), true;
  if (state.conveyors.some((c) => c.from === state.conveyorStartId && c.to === hit.id)) {
    state.conveyorStartId = null;
    return setStatus("Conveyor already exists."), true;
  }
  state.conveyors.push({ from: state.conveyorStartId, to: hit.id, t: Math.random() });
  state.conveyorStartId = null;
  return setStatus("Conveyor placed (OUTPUT -> INPUT)."), true;
}

function addOut(b, r, q) {
  b.output[r] = (b.output[r] || 0) + q;
}

function processBuilding(b, ratio) {
  const speed = ratio * (1 + (b.level - 1) * 0.2);
  if (b.type === "miner") {
    const n = state.nodes.find((x) => x.id === b.nodeId);
    if (n) addOut(b, n.type, 0.65 * n.richness * speed);
    return;
  }

  const rt = DEF.buildings[b.type].recipeType;
  if (!rt) return;
  const recipe = DEF.recipes[rt][b.mode];
  if (!recipe) return;

  const can = Object.entries(recipe.in).every(([r, v]) => (b.input[r] || 0) >= v * speed);
  if (!can) return;

  Object.entries(recipe.in).forEach(([r, v]) => {
    b.input[r] -= v * speed;
  });
  Object.entries(recipe.out).forEach(([r, v]) => {
    addOut(b, r, v * speed);
  });
}

function moveConveyor(c, ratio) {
  const from = state.getBuilding(c.from);
  const to = state.getBuilding(c.to);
  if (!from || !to) return;

  const item = Object.entries(from.output).find(([, q]) => q > 0.2);
  if (!item) return;

  const [name] = item;
  const amt = 0.5 * ratio;
  if ((from.output[name] || 0) < amt) return;
  from.output[name] -= amt;

  if (to.type === "storage") state.wallet[name] = (state.wallet[name] || 0) + amt;
  else to.input[name] = (to.input[name] || 0) + amt;
}

function updatePower() {
  state.energyDemand = 0;
  state.energyProduced = 0;
  state.buildings.forEach((b) => {
    const p = DEF.buildings[b.type].power;
    if (p >= 0) state.energyDemand += p;
    else {
      if (state.wallet.Biomass > 0.03) {
        state.wallet.Biomass -= 0.03;
        state.energyProduced += Math.abs(p);
      }
    }
  });
  state.powerRatio = Math.min(1, state.energyProduced / Math.max(1, state.energyDemand));
}

function updateSimulation() {
  const before = structuredClone(state.wallet);
  updatePower();
  state.buildings.forEach((b) => processBuilding(b, state.powerRatio));
  state.conveyors.forEach((c) => {
    moveConveyor(c, state.powerRatio);
    c.t = (c.t + 0.016) % 1;
  });

  state.rates = {};
  Object.keys(state.wallet).forEach((r) => {
    state.rates[r] = (state.wallet[r] - before[r]) * 5;
  });

  state.objectives.forEach((o, i) => {
    if (o.done(state)) state.completed.add(i);
  });
}

function drawOreCrystal(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.65, y - size * 0.1);
  ctx.lineTo(x + size * 0.4, y + size * 0.75);
  ctx.lineTo(x - size * 0.4, y + size * 0.75);
  ctx.lineTo(x - size * 0.65, y - size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffffff66";
  ctx.stroke();
}

function drawBuilding3D(p, color, level, selected) {
  const s = 10 + level * 1.7;
  ctx.fillStyle = "#00000033";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 0.6, s * 0.8, s * 0.35, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(p.x - s * 0.7, p.y - s * 0.8, s * 1.4, s * 1.2);
  ctx.fillStyle = "#ffffff20";
  ctx.fillRect(p.x - s * 0.7, p.y - s * 0.8, s * 1.4, s * 0.3);

  if (selected) {
    ctx.strokeStyle = "#7ef9ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s + 4, 0, TAU);
    ctx.stroke();
  }
}

function draw() {
  engine.drawPlanet();
  const c = engine.center;
  const r = engine.radius;

  ctx.strokeStyle = "#80bbff66";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r - 4, 0, TAU);
  ctx.stroke();

  // ore splotches + crystals
  state.nodes
    .map((n) => ({ n, p: engine.project(n.lat, n.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ n, p }) => {
      ctx.fillStyle = `${n.color}77`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 20, 11, 0, 0, TAU);
      ctx.fill();
      drawOreCrystal(p.x, p.y, 10, n.color);
    });

  state.conveyors.forEach((cv, i) => {
    const aB = state.getBuilding(cv.from);
    const bB = state.getBuilding(cv.to);
    if (!aB || !bB) return;
    const a = engine.project(aB.lat, aB.lon);
    const b = engine.project(bB.lat, bB.lon);
    if (!a.visible || !b.visible) return;
    ctx.strokeStyle = "#89d7ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const px = a.x + (b.x - a.x) * cv.t;
    const py = a.y + (b.y - a.y) * cv.t;
    drawOreCrystal(px, py, 4, i % 2 ? "#ffffff" : "#77ffc3");
  });

  state.buildings
    .map((b) => ({ b, p: engine.project(b.lat, b.lon) }))
    .filter((x) => x.p.visible)
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ b, p }) => drawBuilding3D(p, DEF.buildings[b.type].color, b.level, b.id === state.selectedBuildingId));

  els.planetLabel.textContent = "3D Planet Engine | Place anywhere (miners on ore nodes only)";
  els.cameraLabel.textContent = `Rot ${engine.rotation.toFixed(2)} Zoom ${engine.zoom.toFixed(2)} ${state.conveyorMode ? "| Conveyor mode" : ""}`;
}

function renderBuildMenu() {
  els.buildMenu.innerHTML = "";
  Object.entries(DEF.buildings).forEach(([id, d]) => {
    const btn = document.createElement("button");
    btn.className = state.selectedBuild === id ? "active" : "";
    btn.innerHTML = `<strong>${d.name}</strong><div class='small'>${Object.entries(d.cost)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")} | ${d.nodeOnly ? "Ore node only" : "Anywhere on planet"}</div>`;
    btn.onclick = () => {
      state.selectedBuild = state.selectedBuild === id ? null : id;
      state.conveyorMode = false;
      state.conveyorStartId = null;
      renderBuildMenu();
    };
    els.buildMenu.appendChild(btn);
  });
  els.connect.className = state.conveyorMode ? "active" : "";
  els.connect.textContent = `Conveyor Tool: ${state.conveyorMode ? "ON" : "OFF"}`;
}

els.connect.onclick = () => {
  state.conveyorMode = !state.conveyorMode;
  state.selectedBuild = null;
  state.conveyorStartId = null;
  renderBuildMenu();
  setStatus(state.conveyorMode ? "Conveyor mode enabled." : "Conveyor mode disabled.");
};

function renderSelection() {
  els.selectionActions.innerHTML = "";
  const b = state.getBuilding(state.selectedBuildingId);
  if (!b) {
    els.selection.textContent = "Nothing selected.";
    return;
  }

  const rt = DEF.buildings[b.type].recipeType;
  const recipeLabel = rt ? DEF.recipes[rt][b.mode].label : "N/A";
  els.selection.textContent = `${DEF.buildings[b.type].name} | Lv.${b.level} | Recipe: ${recipeLabel}`;

  const up = document.createElement("button");
  const cost = { Rock: 10 * b.level };
  up.innerHTML = `<strong>Upgrade</strong><div class='small'>Rock ${cost.Rock}</div>`;
  up.onclick = () => {
    if (!canAfford(cost)) return setStatus("Not enough Rock.");
    spend(cost);
    b.level += 1;
    renderSelection();
  };
  els.selectionActions.appendChild(up);

  if (rt) {
    const cycle = document.createElement("button");
    cycle.textContent = `Cycle Recipe (${recipeLabel})`;
    cycle.onclick = () => {
      const keys = Object.keys(DEF.recipes[rt]);
      b.mode = keys[(keys.indexOf(b.mode) + 1) % keys.length];
      renderSelection();
    };
    els.selectionActions.appendChild(cycle);
  }
}

function renderSide() {
  els.resourceList.innerHTML = "";
  Object.entries(state.wallet).forEach(([k, v]) => {
    const div = document.createElement("div");
    div.className = "small";
    div.textContent = `${k}: ${v.toFixed(1)} (${(state.rates[k] || 0).toFixed(2)}/s)`;
    els.resourceList.appendChild(div);
  });
  els.energy.textContent = `Power ${state.energyProduced.toFixed(1)} / ${state.energyDemand.toFixed(1)} MW (${state.powerRatio < 1 ? "underpowered" : "stable"})`;
  const next = state.objectives.findIndex((_, i) => !state.completed.has(i));
  els.objective.textContent = `${next >= 0 ? `Next: ${state.objectives[next].text}` : "All starter objectives complete."}\n\n${state.objectives
    .map((o, i) => `${state.completed.has(i) ? "✅" : "⬜"} ${o.text}`)
    .join("\n")}`;
}

function toCanvasPos(ev) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * els.canvas.width,
    y: ((ev.clientY - rect.top) / rect.height) * els.canvas.height,
  };
}

els.canvas.addEventListener("mousedown", (ev) => {
  if (ev.button !== 0) return;
  drag.active = true;
  drag.moved = 0;
  drag.x = ev.clientX;
  drag.y = ev.clientY;
});
window.addEventListener("mouseup", () => {
  drag.active = false;
});
window.addEventListener("mousemove", (ev) => {
  if (!drag.active) return;
  const dx = ev.clientX - drag.x;
  const dy = ev.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = ev.clientX;
  drag.y = ev.clientY;
  engine.rotation += dx * 0.005;
  engine.tilt += dy * 0.18;
});
els.canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  engine.zoom *= ev.deltaY < 0 ? 1.05 : 0.95;
  engine.zoom = Math.max(0.65, Math.min(2, engine.zoom));
});
els.canvas.addEventListener("click", (ev) => {
  if (drag.moved > 8) return;
  const { x, y } = toCanvasPos(ev);

  if (state.conveyorMode) {
    placeConveyor(x, y);
    return renderSide();
  }

  const placed = placeBuilding(x, y);
  if (!placed) {
    const hit = pickBuilding(x, y);
    state.selectedBuildingId = hit?.id || null;
    renderSelection();
    if (hit) setStatus(`Selected ${DEF.buildings[hit.type].name}.`);
  }
  renderSide();
});

document.getElementById("gatherRockBtn").onclick = () => {
  state.wallet.Rock += 4;
  setStatus("Gathered Rock.");
  renderSide();
};
document.getElementById("gatherWoodBtn").onclick = () => {
  state.wallet.Wood += 3;
  setStatus("Gathered Wood.");
  renderSide();
};
document.getElementById("gatherBiomassBtn").onclick = () => {
  state.wallet.Biomass += 2;
  setStatus("Gathered Biomass.");
  renderSide();
};

function loop() {
  requestAnimationFrame(loop);
  state.tick += 1;
  if (state.tick % 12 === 0) {
    updateSimulation();
    renderSide();
  }
  draw();
}

renderBuildMenu();
renderSelection();
renderSide();
setStatus("3D engine active. Buildings now craft outputs correctly.");
loop();
