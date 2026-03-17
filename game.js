(function () {
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
      { lat: 0.22, lon: 0.15, type: "Iron Ore", richness: 1.1, color: "#b8c2cf" },
      { lat: -0.18, lon: 0.9, type: "Copper Ore", richness: 1.0, color: "#ffb26b" },
      { lat: 0.38, lon: 1.65, type: "Limestone", richness: 1.2, color: "#b7f5df" },
      { lat: -0.28, lon: 2.4, type: "Iron Ore", richness: 0.95, color: "#b8c2cf" },
      { lat: 0.3, lon: 3.4, type: "Copper Ore", richness: 1.1, color: "#ffb26b" },
      { lat: -0.35, lon: 4.2, type: "Limestone", richness: 1.0, color: "#b7f5df" },
    ],
  };

  const state = {
    wallet: Object.fromEntries(DEF.resources.map((r) => [r, 0])),
    rates: {},
    selectedBuild: null,
    conveyorMode: false,
    conveyorStartId: null,
    selectedBuildingId: null,
    nodes: DEF.nodes.map((n, i) => ({ id: `node-${i}`, ...n, minerId: null, marker: null })),
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

  const engine = new BABYLON.Engine(els.canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.04, 0.07, 0.12, 1);

  const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, 1.1, 11, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(els.canvas, true);
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 16;

  new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(1, 1, 0), scene).intensity = 0.8;
  const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1, -2, -1), scene);
  dir.position = new BABYLON.Vector3(6, 8, 5);

  const planetRadius = 3.2;
  const planet = BABYLON.MeshBuilder.CreateSphere("planet", { diameter: planetRadius * 2, segments: 64 }, scene);
  const pMat = new BABYLON.StandardMaterial("planetMat", scene);
  pMat.diffuseColor = new BABYLON.Color3(0.19, 0.29, 0.43);
  pMat.specularColor = new BABYLON.Color3(0.08, 0.12, 0.2);
  planet.material = pMat;

  const ring = BABYLON.MeshBuilder.CreateTorus("ring", { diameter: planetRadius * 2.05, thickness: 0.07, tessellation: 96 }, scene);
  ring.rotation.x = Math.PI / 2;
  const rMat = new BABYLON.StandardMaterial("ringMat", scene);
  rMat.emissiveColor = new BABYLON.Color3(0.35, 0.65, 0.95);
  rMat.alpha = 0.45;
  ring.material = rMat;

  const nodeMeshes = [];
  const conveyorMeshes = [];
  const buildingMeshes = [];

  function hexColor(hex) {
    return BABYLON.Color3.FromHexString(hex);
  }

  function sphToVec(lat, lon, r = planetRadius) {
    return new BABYLON.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
  }

  function vecToLatLon(v) {
    const n = v.normalize();
    return { lat: Math.asin(n.y), lon: Math.atan2(n.x, n.z) };
  }

  function setStatus(t) {
    els.status.textContent = t;
  }

  function canAfford(cost) {
    return Object.entries(cost).every(([r, v]) => (state.wallet[r] || 0) >= v);
  }

  function spend(cost) {
    Object.entries(cost).forEach(([r, v]) => (state.wallet[r] -= v));
  }

  function recipeKeys(type) {
    const rt = DEF.buildings[type].recipeType;
    return rt ? Object.keys(DEF.recipes[rt]) : [];
  }

  function createBuilding(type, lat, lon, nodeId = null) {
    return { id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, lat, lon, nodeId, level: 1, mode: recipeKeys(type)[0] || "default", input: {}, output: {}, mesh: null };
  }

  function createNodeSplotch(node) {
    const pos = sphToVec(node.lat, node.lon, planetRadius + 0.02);
    const up = pos.normalize();

    const splotch = BABYLON.MeshBuilder.CreateDisc(`s-${node.id}`, { radius: 0.62, tessellation: 36 }, scene);
    splotch.position = pos;
    splotch.lookAt(pos.add(up));

    const sMat = new BABYLON.StandardMaterial(`sm-${node.id}`, scene);
    sMat.diffuseColor = hexColor(node.color);
    sMat.emissiveColor = hexColor(node.color).scale(0.25);
    sMat.alpha = 0.75;
    sMat.backFaceCulling = false;
    splotch.material = sMat;

    const crystal = BABYLON.MeshBuilder.CreatePolyhedron(`c-${node.id}`, { type: 1, size: 0.2 }, scene);
    crystal.position = pos.add(up.scale(0.2));
    const cMat = new BABYLON.StandardMaterial(`cm-${node.id}`, scene);
    cMat.diffuseColor = hexColor(node.color);
    cMat.emissiveColor = hexColor(node.color).scale(0.6);
    cMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    crystal.material = cMat;

    const beacon = BABYLON.MeshBuilder.CreateSphere(`beacon-${node.id}`, { diameter: 0.08 }, scene);
    beacon.position = pos.add(up.scale(0.42));
    const bMat = new BABYLON.StandardMaterial(`bm-${node.id}`, scene);
    bMat.emissiveColor = hexColor(node.color).scale(1.4);
    bMat.disableLighting = true;
    beacon.material = bMat;

    node.marker = crystal;
    nodeMeshes.push(splotch, crystal, beacon);
  }

  state.nodes.forEach(createNodeSplotch);

  function createBuildingMesh(building) {
    const color = hexColor(DEF.buildings[building.type].color);
    const body = BABYLON.MeshBuilder.CreateCylinder(`b-${building.id}`, { height: 0.4, diameterTop: 0.34, diameterBottom: 0.42, tessellation: 14 }, scene);
    const roof = BABYLON.MeshBuilder.CreateCylinder(`r-${building.id}`, { height: 0.18, diameterTop: 0.05, diameterBottom: 0.24, tessellation: 12 }, scene);
    const root = BABYLON.Mesh.MergeMeshes([body, roof], true, false, undefined, false, true);

    const pos = sphToVec(building.lat, building.lon, planetRadius + 0.25);
    root.position = pos;
    root.lookAt(pos.add(pos.normalize()));

    const mat = new BABYLON.StandardMaterial(`bm-${building.id}`, scene);
    mat.diffuseColor = color;
    mat.specularColor = color.scale(0.2);
    root.material = mat;
    root.isPickable = true;

    building.mesh = root;
    buildingMeshes.push(root);
  }

  function rebuildConveyorMeshes() {
    while (conveyorMeshes.length) {
      const m = conveyorMeshes.pop();
      m.dispose();
    }

    state.conveyors.forEach((c, idx) => {
      const from = state.getBuilding(c.from);
      const to = state.getBuilding(c.to);
      if (!from || !to) return;

      const a = sphToVec(from.lat, from.lon, planetRadius + 0.25);
      const b = sphToVec(to.lat, to.lon, planetRadius + 0.25);
      const mid = a.add(b).scale(0.5).normalize().scale(planetRadius + 0.7);

      const path = BABYLON.Curve3.CreateQuadraticBezier(a, mid, b, 24).getPoints();
      const tube = BABYLON.MeshBuilder.CreateTube(`t-${idx}`, { path, radius: 0.035, tessellation: 10 }, scene);
      const tm = new BABYLON.StandardMaterial(`tm-${idx}`, scene);
      tm.diffuseColor = new BABYLON.Color3(0.53, 0.83, 0.95);
      tm.emissiveColor = new BABYLON.Color3(0.12, 0.25, 0.35);
      tube.material = tm;

      const payload = BABYLON.MeshBuilder.CreateSphere(`p-${idx}`, { diameter: 0.1 }, scene);
      const pm = new BABYLON.StandardMaterial(`pm-${idx}`, scene);
      pm.diffuseColor = idx % 2 ? new BABYLON.Color3(1, 1, 1) : new BABYLON.Color3(0.5, 1, 0.8);
      pm.emissiveColor = pm.diffuseColor.scale(0.5);
      payload.material = pm;

      c.path = path;
      c.payload = payload;
      conveyorMeshes.push(tube, payload);
    });
  }

  function placeBuildingAtPick(pick) {
    if (!state.selectedBuild) return false;
    const type = state.selectedBuild;
    const def = DEF.buildings[type];
    if (!canAfford(def.cost)) return setStatus("Not enough resources."), true;

    const point = pick.pickedPoint;
    const ll = vecToLatLon(point);

    if (def.nodeOnly) {
      const node = state.nodes.find((n) => BABYLON.Vector3.Distance(sphToVec(n.lat, n.lon, planetRadius), point.normalize().scale(planetRadius)) < 0.5);
      if (!node) return setStatus("Miner must be placed on ore node splotch."), true;
      if (node.minerId) return setStatus("Node already occupied."), true;
      const b = createBuilding(type, node.lat, node.lon, node.id);
      node.minerId = b.id;
      createBuildingMesh(b);
      state.buildings.push(b);
      spend(def.cost);
      state.selectedBuildingId = b.id;
      rebuildConveyorMeshes();
      renderSelection();
      return setStatus(`Placed Miner on ${node.type}.`), true;
    }

    const pos = point.normalize().scale(planetRadius + 0.25);
    const tooClose = state.buildings.some((b) => BABYLON.Vector3.Distance(sphToVec(b.lat, b.lon, planetRadius + 0.25), pos) < 0.45);
    if (tooClose) return setStatus("Too close to another building."), true;

    const b = createBuilding(type, ll.lat, ll.lon);
    createBuildingMesh(b);
    state.buildings.push(b);
    spend(def.cost);
    state.selectedBuildingId = b.id;
    rebuildConveyorMeshes();
    renderSelection();
    return setStatus(`Placed ${def.name}.`), true;
  }

  function pickBuildingFromMesh(mesh) {
    return state.buildings.find((b) => b.mesh === mesh || b.mesh?.getChildMeshes().includes(mesh)) || null;
  }

  function addOut(b, r, q) {
    b.output[r] = (b.output[r] || 0) + q;
  }

  function processBuilding(b, ratio) {
    const speed = ratio * (1 + (b.level - 1) * 0.2);

    if (b.type === "miner") {
      const node = state.nodes.find((n) => n.id === b.nodeId);
      if (node) addOut(b, node.type, 0.65 * node.richness * speed);
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
    state.energyProduced = 0;
    state.energyDemand = 0;
    state.buildings.forEach((b) => {
      const p = DEF.buildings[b.type].power;
      if (p >= 0) state.energyDemand += p;
      else if (state.wallet.Biomass > 0.03) {
        state.wallet.Biomass -= 0.03;
        state.energyProduced += Math.abs(p);
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
      c.t = (c.t + 0.015) % 1;
      if (c.path?.length && c.payload) {
        const idx = Math.floor(c.t * (c.path.length - 1));
        c.payload.position.copyFrom(c.path[idx]);
      }
    });

    state.rates = {};
    Object.keys(state.wallet).forEach((r) => {
      state.rates[r] = (state.wallet[r] - before[r]) * 5;
    });

    state.objectives.forEach((o, i) => {
      if (o.done(state)) state.completed.add(i);
    });
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
    const label = rt ? DEF.recipes[rt][b.mode].label : "N/A";
    els.selection.textContent = `${DEF.buildings[b.type].name} | Lv.${b.level} | Recipe: ${label}`;

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
      cycle.textContent = `Cycle Recipe (${label})`;
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

  scene.onPointerObservable.add((info) => {
    if (info.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
    if (info.event.button !== 0) return;

    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick?.hit) return;

    if (state.conveyorMode) {
      const b = pickBuildingFromMesh(pick.pickedMesh);
      if (!b) return setStatus("Conveyors must connect buildings.");
      if (!state.conveyorStartId) {
        state.conveyorStartId = b.id;
        return setStatus("Conveyor source selected.");
      }
      if (state.conveyorStartId === b.id) return setStatus("Cannot connect to itself.");
      if (state.conveyors.some((c) => c.from === state.conveyorStartId && c.to === b.id)) {
        state.conveyorStartId = null;
        return setStatus("Conveyor already exists.");
      }
      state.conveyors.push({ from: state.conveyorStartId, to: b.id, t: Math.random(), path: null, payload: null });
      state.conveyorStartId = null;
      rebuildConveyorMeshes();
      renderSide();
      return setStatus("Conveyor placed.");
    }

    const placed = placeBuildingAtPick(pick);
    if (!placed) {
      const b = pickBuildingFromMesh(pick.pickedMesh);
      state.selectedBuildingId = b?.id || null;
      renderSelection();
      if (b) setStatus(`Selected ${DEF.buildings[b.type].name}.`);
    }
    renderSide();
  });

  engine.runRenderLoop(() => {
    state.tick += 1;
    if (state.tick % 12 === 0) {
      updateSimulation();
      renderSide();
    }
    planet.rotation.y += 0.001;
    scene.render();
    els.planetLabel.textContent = "Babylon.js 3D Planet | Place anywhere (miners on ore nodes)";
    els.cameraLabel.textContent = `Radius ${camera.radius.toFixed(2)} ${state.conveyorMode ? "| Conveyor mode" : ""}`;
  });

  window.addEventListener("resize", () => engine.resize());

  renderBuildMenu();
  renderSelection();
  renderSide();
  setStatus("Babylon.js mode active. Look for bright colored ore splotches on the planet.");
})();
