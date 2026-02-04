const { db } = require("./firebaseAdmin");
const { reportDeviceState } = require("./homegraph");

const DEVICES_COL = "devices";

function defaultWasherState() {
  return {
    online: true,
    on: false,
    isRunning: false,
    modes: {
      washMode: "cotton",        // eco | quick | cotton | delicates
      temperature: "40c",        // cold | 30c | 40c | 60c
      spinSpeed: "medium",       // low | medium | high
    },
    toggles: {
      childLock: false,
      extraRinse: false,
    },
    currentCycleRemainingSec: 0,
    lastUpdated: Date.now(),
  };
}

async function ensureDevice(agentUserId, deviceId) {
  const ref = db.collection(DEVICES_COL).doc(`${agentUserId}_${deviceId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const state = defaultWasherState();
    await ref.set(state);
    return { ref, state };
  }
  return { ref, state: snap.data() };
}

async function getDeviceState(agentUserId, deviceId) {
  const { state } = await ensureDevice(agentUserId, deviceId);
  return state;
}

async function setOnOff(agentUserId, deviceId, on) {
  const { ref, state } = await ensureDevice(agentUserId, deviceId);
  const nextOn = Boolean(on);

  const next = {
    ...state,
    on: nextOn,
    isRunning: nextOn ? state.isRunning : false,
    lastUpdated: Date.now(),
  };
  await ref.set(next);
  
  reportDeviceState(agentUserId, deviceId, next)
    .then(() => console.log('[DeviceManager] State reported to Google for OnOff'))
    .catch(err => console.error('[DeviceManager] Failed to report state:', err.message));
  
  return next;
}

async function setModes(agentUserId, deviceId, modeUpdates) {
  const { ref, state } = await ensureDevice(agentUserId, deviceId);
  const next = {
    ...state,
    modes: { ...state.modes, ...modeUpdates },
    lastUpdated: Date.now(),
  };

  await ref.set(next);

  reportDeviceState(agentUserId, deviceId, next)
    .then(() => console.log('[DeviceManager] State reported to Google for Modes'))
    .catch(err => console.error('[DeviceManager] Failed to report state:', err.message));
  
  return next;
}

async function setToggles(agentUserId, deviceId, toggleUpdates) {
  const { ref, state } = await ensureDevice(agentUserId, deviceId);
  const next = {
    ...state,
    toggles: { ...state.toggles, ...toggleUpdates },
    lastUpdated: Date.now(),
  };

  await ref.set(next);
  reportDeviceState(agentUserId, deviceId, next)
    .then(() => console.log('[DeviceManager] State reported to Google for Toggles'))
    .catch(err => console.error('[DeviceManager] Failed to report state:', err.message));
  
  return next;
}

async function startStop(agentUserId, deviceId, start) {
  const { ref, state } = await ensureDevice(agentUserId, deviceId);
  const isOn = start ? true : state.on;
  const next = {
    ...state,
    on: isOn,
    isRunning: !!start,
    currentCycleRemainingSec: start ? 45 * 60 : 0,
    lastUpdated: Date.now(),
  };

  await ref.set(next);

  reportDeviceState(agentUserId, deviceId, next)
    .then(() => console.log('[DeviceManager] State reported to Google for StartStop'))
    .catch(err => console.error('[DeviceManager] Failed to report state:', err.message));
  
  return next;
}

module.exports = {
  getDeviceState,
  setOnOff,
  setModes,
  setToggles,
  startStop,
};