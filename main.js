// =========================
// Viewer
// =========================
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: Cesium.createWorldTerrain(),
  timeline: false,
  animation: false,
  selectionIndicator: false,
  infoBox: false,
});
viewer.scene.primitives.add(Cesium.createOsmBuildings());

// Foco no canvas p/ capturar setas
viewer.canvas.setAttribute("tabindex", "0");
viewer.canvas.addEventListener("click", () => viewer.canvas.focus());
viewer.canvas.focus();

// HUD
const hud = document.createElement("div");
hud.style = "position:absolute;top:10px;right:10px;z-index:20;background:rgba(0,0,0,.55);color:#fff;padding:8px 12px;border-radius:8px;font:14px/1.3 system-ui";
hud.innerHTML = "vel: 0 m/s<br>offset: 0°<br>eixo: +X<br>status: ativo";
document.body.appendChild(hud);

// =========================
// Posição inicial
// =========================
const lon0 = -122.39053, lat0 = 37.61779, h0 = 50.0;

// =========================
// Modelo do avião
// =========================
const ION_AIRPLANE_ASSET_ID = null; // se tiver, preencha
const MODEL_URL_FALLBACK = "cessna_a-37b.glb"; // ajuste o caminho

async function loadAirplaneModel() {
  let modelUri;
  if (ION_AIRPLANE_ASSET_ID) {
    modelUri = await Cesium.IonResource.fromAssetId(ION_AIRPLANE_ASSET_ID);
  } else if (MODEL_URL_FALLBACK) {
    modelUri = MODEL_URL_FALLBACK;
  } else {
    console.warn("Sem assetId/URL de modelo. Usando box temporário.");
    return viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon0, lat0, h0),
      box: { dimensions: new Cesium.Cartesian3(5,2,1.5), material: Cesium.Color.RED },
    });
  }

  return viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon0, lat0, h0),
    model: { uri: modelUri, minimumPixelSize: 64, maximumScale: 2000, scale: 1, runAnimations: false },
  });
}

// =========================
// Estado / controles
// =========================
const deg2rad = d => d * Math.PI / 180;

const state = {
  speed: 0, minSpeed: 0, maxSpeed: 250,
  heading: deg2rad(90),  // rumo inicial
  pitch: 0, roll: 0,
  noseOffset: 0,         // ⬅ offset do "nariz" (rad). Ajuste com N/M.
  paused: false,
};

const controls = {
  dHeading: deg2rad(30), dPitch: deg2rad(20), dRoll: deg2rad(50),
  dSpeed: 30, maxPitch: deg2rad(45), maxRoll: deg2rad(75), minAGL: 5,
};

// Eixos possíveis para o "frente" do corpo
// Eixos possíveis para o "frente" do corpo
const FORWARD_AXES = (() => {
  const neg = (v) => Cesium.Cartesian3.negate(v, new Cesium.Cartesian3());
  return [
    { v: Cesium.Cartesian3.UNIT_X,  label: "+X" },
    { v: neg(Cesium.Cartesian3.UNIT_X), label: "-X" },
    { v: Cesium.Cartesian3.UNIT_Y,  label: "+Y" },
    { v: neg(Cesium.Cartesian3.UNIT_Y), label: "-Y" },
    { v: Cesium.Cartesian3.UNIT_Z,  label: "+Z" },
    { v: neg(Cesium.Cartesian3.UNIT_Z), label: "-Z" },
  ];
})();

let forwardIndex = 3; // começa com +X

const keys = new Set();
function onKeyDown(e){
  if (e.code.startsWith("Arrow")) e.preventDefault();
  keys.add(e.code);
  if (e.code === "Space") state.paused = !state.paused;

  // Calibração rápida:
  if (e.code === "KeyN") { state.noseOffset -= deg2rad(15); } // gira -15°
  if (e.code === "KeyM") { state.noseOffset += deg2rad(15); } // gira +15°
  if (e.code === "KeyT") { forwardIndex = (forwardIndex + 1) % FORWARD_AXES.length; } // troca eixo

  hud.innerHTML = `vel: ${state.speed.toFixed(1)} m/s<br>offset: ${(state.noseOffset*180/Math.PI).toFixed(0)}°<br>eixo: ${FORWARD_AXES[forwardIndex].label}<br>status: ${state.paused ? "pausado" : "ativo"}`;
}
function onKeyUp(e){
  if (e.code.startsWith("Arrow")) e.preventDefault();
  keys.delete(e.code);
}
viewer.canvas.addEventListener("keydown", onKeyDown);
viewer.canvas.addEventListener("keyup", onKeyUp);
document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);

function applyControls(dt){
  if (keys.has("KeyA")) state.heading -= controls.dHeading * dt;
  if (keys.has("KeyD")) state.heading += controls.dHeading * dt;

  if (keys.has("KeyW")) state.pitch += controls.dPitch * dt;
  if (keys.has("KeyS")) state.pitch -= controls.dPitch * dt;
  state.pitch = Cesium.Math.clamp(state.pitch, -controls.maxPitch, controls.maxPitch);

  if (keys.has("KeyQ")) state.roll -= controls.dRoll * dt;
  if (keys.has("KeyE")) state.roll += controls.dRoll * dt;
  state.roll = Cesium.Math.clamp(state.roll, -controls.maxRoll, controls.maxRoll);

  if (keys.has("ArrowUp") || keys.has("KeyR"))
    state.speed = Math.min(state.maxSpeed, state.speed + controls.dSpeed * dt);
  if (keys.has("ArrowDown") || keys.has("KeyF"))
    state.speed = Math.max(state.minSpeed, state.speed - controls.dSpeed * dt);
}

// =========================
// Física simples
// =========================
function integratePosition(entity, dt){
  const pos = entity.position.getValue(viewer.clock.currentTime);
  if (!Cesium.defined(pos)) return pos;

  // Aplica o offset do nariz ao heading
  const hpr = new Cesium.HeadingPitchRoll(state.heading + state.noseOffset, state.pitch, state.roll);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

  // Converte o vetor "frente" (escolhido) do corpo para mundo
  const rotMat = Cesium.Matrix3.fromQuaternion(orientation);
  const forward = Cesium.Matrix3.multiplyByVector(
    rotMat,
    FORWARD_AXES[forwardIndex].v,
    new Cesium.Cartesian3()
  );

  // Move
  let newPos = pos;
  if (state.speed > 0){
    const delta = Cesium.Cartesian3.multiplyByScalar(forward, state.speed * dt, new Cesium.Cartesian3());
    newPos = Cesium.Cartesian3.add(pos, delta, new Cesium.Cartesian3());
  }

  // Mantém acima do terreno (AGL mínima)
  const carto = Cesium.Cartographic.fromCartesian(newPos);
  const hTerrain = viewer.scene.globe.getHeight(carto) ?? 0;
  const minHeight = hTerrain + controls.minAGL;
  if (carto.height < minHeight){
    carto.height = minHeight;
    newPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
  }

  entity.position = new Cesium.ConstantPositionProperty(newPos);
  entity.orientation = new Cesium.ConstantProperty(orientation);

  hud.innerHTML = `vel: ${state.speed.toFixed(1)} m/s<br>offset: ${(state.noseOffset*180/Math.PI).toFixed(0)}°<br>eixo: ${FORWARD_AXES[forwardIndex].label}<br>status: ${state.paused ? "pausado" : "ativo"}`;
  return newPos;
}

// =========================
// Loop
// =========================
(async () => {
  const airplane = await loadAirplaneModel();
  viewer.trackedEntity = airplane; // seguir

  let lastTime = Cesium.JulianDate.now();
  viewer.clock.onTick.addEventListener(() => {
    if (state.paused){ lastTime = Cesium.JulianDate.now(); return; }
    const now = Cesium.JulianDate.now();
    const dt = Cesium.JulianDate.secondsDifference(now, lastTime);
    lastTime = now;
    if (dt <= 0 || dt > 1) return;

    applyControls(dt);
    integratePosition(airplane, dt);
  });
})();
