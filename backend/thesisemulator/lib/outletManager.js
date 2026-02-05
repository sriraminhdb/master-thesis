const { db } = require("./firebaseAdmin");
const { reportState } = require("./homegraph");

const DEVICES_COL = "devices";

function defaultOutletState() {
  return {
    online: true,
    on: false,
    lastUpdated: Date.now(),
  };
}

async function ensureOutlet(agentUserId, deviceId) {
  const ref = db.collection(DEVICES_COL).doc(`${agentUserId}_${deviceId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const state = defaultOutletState();
    await ref.set(state);
    return { ref, state };
  }
  return { ref, state: snap.data() };
}

async function getOutletState(agentUserId, deviceId) {
  const { state } = await ensureOutlet(agentUserId, deviceId);
  return state;
}

async function setOutletOnOff(agentUserId, deviceId, on) {
  const { ref, state } = await ensureOutlet(agentUserId, deviceId);
  const nextOn = Boolean(on);

  const next = {
    ...state,
    on: nextOn,
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  reportOutletState(agentUserId, deviceId, next)
    .then(() => console.log('[OutletManager] State reported to Google for OnOff'))
    .catch(err => console.error('[OutletManager] Failed to report state:', err.message));
  
  return next;
}

function formatOutletState(state) {
  return {
    online: state.online !== false,
    on: state.on || false
  };
}

async function reportOutletState(agentUserId, deviceId, state) {
  const formattedState = formatOutletState(state);
  
  return reportState(agentUserId, {
    [deviceId]: formattedState
  });
}

module.exports = {
  getOutletState,
  setOutletOnOff,
  formatOutletState,
};