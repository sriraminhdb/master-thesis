const { db } = require("./firebaseAdmin");
const { reportDeviceState } = require("./homegraph");
const metricsCollector = require("./metricsCollector");

const DEVICES_COL = "devices";

function defaultWasherState() {
  return {
    online: true,
    on: false,
    isRunning: false,
    modes: {
      washMode: "cotton",
      temperature: "40c",
      spinSpeed: "medium",
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
  const startTime = Date.now();
  
  try {
    const { ref, state } = await ensureDevice(agentUserId, deviceId);
    const nextOn = Boolean(on);

    const next = {
      ...state,
      on: nextOn,
      isRunning: nextOn ? state.isRunning : false,
      lastUpdated: Date.now(),
    };
    
    await ref.set(next);
    
    const endTime = Date.now();

    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'OnOff',
      startTime,
      endTime,
      success: true
    });

    const reportStartTime = Date.now();
    reportDeviceState(agentUserId, deviceId, next)
      .then(() => {
        const reportEndTime = Date.now();
        console.log('[DeviceManager] State reported to Google for OnOff');
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: true
        });
      })
      .catch(err => {
        const reportEndTime = Date.now();
        console.error('[DeviceManager] Failed to report state:', err.message);
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: false,
          error: err.message
        });
      });
    
    return next;
  } catch (error) {
    const endTime = Date.now();
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'OnOff',
      startTime,
      endTime,
      success: false,
      error: error.message
    });
    throw error;
  }
}

async function setModes(agentUserId, deviceId, modeUpdates) {
  const startTime = Date.now();
  
  try {
    const { ref, state } = await ensureDevice(agentUserId, deviceId);
    const next = {
      ...state,
      modes: { ...state.modes, ...modeUpdates },
      lastUpdated: Date.now(),
    };
    
    await ref.set(next);
    
    const endTime = Date.now();
    
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'SetModes',
      startTime,
      endTime,
      success: true
    });
    
    const reportStartTime = Date.now();
    reportDeviceState(agentUserId, deviceId, next)
      .then(() => {
        const reportEndTime = Date.now();
        console.log('[DeviceManager] State reported to Google for Modes');
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: true
        });
      })
      .catch(err => {
        const reportEndTime = Date.now();
        console.error('[DeviceManager] Failed to report state:', err.message);
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: false,
          error: err.message
        });
      });
    
    return next;
  } catch (error) {
    const endTime = Date.now();
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'SetModes',
      startTime,
      endTime,
      success: false,
      error: error.message
    });
    throw error;
  }
}

async function setToggles(agentUserId, deviceId, toggleUpdates) {
  const startTime = Date.now();
  
  try {
    const { ref, state } = await ensureDevice(agentUserId, deviceId);
    const next = {
      ...state,
      toggles: { ...state.toggles, ...toggleUpdates },
      lastUpdated: Date.now(),
    };
    
    await ref.set(next);
    
    const endTime = Date.now();
    
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'SetToggles',
      startTime,
      endTime,
      success: true
    });
    
    const reportStartTime = Date.now();
    reportDeviceState(agentUserId, deviceId, next)
      .then(() => {
        const reportEndTime = Date.now();
        console.log('[DeviceManager] State reported to Google for Toggles');
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: true
        });
      })
      .catch(err => {
        const reportEndTime = Date.now();
        console.error('[DeviceManager] Failed to report state:', err.message);
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: false,
          error: err.message
        });
      });
    
    return next;
  } catch (error) {
    const endTime = Date.now();
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'SetToggles',
      startTime,
      endTime,
      success: false,
      error: error.message
    });
    throw error;
  }
}

async function startStop(agentUserId, deviceId, start) {
  const startTime = Date.now();
  
  try {
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
    
    const endTime = Date.now();
    
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'StartStop',
      startTime,
      endTime,
      success: true
    });
    
    const reportStartTime = Date.now();
    reportDeviceState(agentUserId, deviceId, next)
      .then(() => {
        const reportEndTime = Date.now();
        console.log('[DeviceManager] State reported to Google for StartStop');
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: true
        });
      })
      .catch(err => {
        const reportEndTime = Date.now();
        console.error('[DeviceManager] Failed to report state:', err.message);
        metricsCollector.logReportState({
          deviceId,
          startTime: reportStartTime,
          endTime: reportEndTime,
          success: false,
          error: err.message
        });
      });
    
    return next;
  } catch (error) {
    const endTime = Date.now();
    metricsCollector.logCommandExecution({
      deviceId,
      deviceType: 'washer',
      command: 'StartStop',
      startTime,
      endTime,
      success: false,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  getDeviceState,
  setOnOff,
  setModes,
  setToggles,
  startStop,
};