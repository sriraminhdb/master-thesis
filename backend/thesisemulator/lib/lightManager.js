const { db } = require("./firebaseAdmin");
const { reportDeviceState } = require("./homegraph");

const DEVICES_COL = "devices";

function defaultLightState() {
  return {
    online: true,
    on: false,
    brightness: 100,
    color: {
      spectrumRgb: 16777215,
    },
    lastUpdated: Date.now(),
  };
}

async function ensureLight(agentUserId, deviceId) {
  const ref = db.collection(DEVICES_COL).doc(`${agentUserId}_${deviceId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const state = defaultLightState();
    await ref.set(state);
    return { ref, state };
  }
  return { ref, state: snap.data() };
}

async function getLightState(agentUserId, deviceId) {
  const { state } = await ensureLight(agentUserId, deviceId);
  return state;
}

async function setLightOnOff(agentUserId, deviceId, on) {
  const { ref, state } = await ensureLight(agentUserId, deviceId);
  const nextOn = Boolean(on);

  const next = {
    ...state,
    on: nextOn,
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported to Google for OnOff'))
    .catch(err => console.error('[LightManager] Failed to report state:', err.message));
  
  return next;
}

async function setLightBrightness(agentUserId, deviceId, brightness) {
  const { ref, state } = await ensureLight(agentUserId, deviceId);

  const nextBrightness = Math.max(0, Math.min(100, brightness));

  const next = {
    ...state,
    brightness: nextBrightness,
    on: nextBrightness > 0 ? true : state.on,
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported to Google for Brightness'))
    .catch(err => console.error('[LightManager] Failed to report state:', err.message));
  
  return next;
}

async function setLightColor(agentUserId, deviceId, spectrumRgb) {
  const { ref, state } = await ensureLight(agentUserId, deviceId);

  const next = {
    ...state,
    color: {
      spectrumRgb: spectrumRgb,
    },
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);
  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported to Google for Color'))
    .catch(err => console.error('[LightManager] Failed to report state:', err.message));
  
  return next;
}

function formatLightState(state) {
  return {
    online: state.online !== false,
    on: state.on || false,
    brightness: state.brightness || 0,
    color: state.color || { spectrumRgb: 16777215 }
  };
}

async function reportLightState(agentUserId, deviceId, state) {
  const formattedState = formatLightState(state);
  
  const { reportState } = require("./homegraph");
  return reportState(agentUserId, {
    [deviceId]: formattedState
  });
}

module.exports = {
  getLightState,
  setLightOnOff,
  setLightBrightness,
  setLightColor,
  formatLightState,
};