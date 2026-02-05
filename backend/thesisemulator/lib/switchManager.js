const { db } = require("./firebaseAdmin");
const { reportState } = require("./homegraph");

const DEVICES_COL = "devices";

function defaultSwitchState() {
  return {
    online: true,
    on: false,
    lastUpdated: Date.now(),
  };
}

async function ensureSwitch(agentUserId, deviceId) {
  const ref = db.collection(DEVICES_COL).doc(`${agentUserId}_${deviceId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const state = defaultSwitchState();
    await ref.set(state);
    return { ref, state };
  }
  return { ref, state: snap.data() };
}

async function getSwitchState(agentUserId, deviceId) {
  const { state } = await ensureSwitch(agentUserId, deviceId);
  return state;
}

async function setSwitchOnOff(agentUserId, deviceId, on) {
  const { ref, state } = await ensureSwitch(agentUserId, deviceId);
  const nextOn = Boolean(on);

  const next = {
    ...state,
    on: nextOn,
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  reportSwitchState(agentUserId, deviceId, next)
    .then(() => console.log('[SwitchManager] State reported to Google for OnOff'))
    .catch(err => console.error('[SwitchManager] Failed to report state:', err.message));
  
  return next;
}

function formatSwitchState(state) {
  return {
    online: state.online !== false,
    on: state.on || false
  };
}

async function reportSwitchState(agentUserId, deviceId, state) {
  const formattedState = formatSwitchState(state);
  
  return reportState(agentUserId, {
    [deviceId]: formattedState
  });
}

module.exports = {
  getSwitchState,
  setSwitchOnOff,
  formatSwitchState,
};