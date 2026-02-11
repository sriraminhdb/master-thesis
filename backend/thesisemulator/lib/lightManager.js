const admin = require('firebase-admin');

async function sendToHardware(deviceId, command) {
  try {
    const hardwarePath = `/hardware/${deviceId}`;
    
    const commandWithTimestamp = {
      ...command,
      timestamp: Date.now()
    };
    
    await admin.database().ref(hardwarePath).set(commandWithTimestamp);
    
    console.log(`[HardwareManager] Command sent to ${deviceId}:`, commandWithTimestamp);
    return true;
  } catch (error) {
    console.error(`[HardwareManager] Failed to send to ${deviceId}:`, error.message);
    return false;
  }
}

async function ensureLight(agentUserId, deviceId) {
  const ref = admin.firestore()
    .collection('users')
    .doc(agentUserId)
    .collection('lights')
    .doc(deviceId);

  const snap = await ref.get();
  
  if (snap.exists) {
    return { ref, state: snap.data() };
  }

  const defaultLight = {
    on: false,
    brightness: 100,
    color: { spectrumRgb: 16777215 },
    lastUpdated: Date.now(),
  };

  await ref.set(defaultLight);
  return { ref, state: defaultLight };
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

  await sendToHardware(deviceId, {
    command: 'setOnOff',
    on: nextOn,
    brightness: state.brightness,
    color: state.color
  });

  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported'))
    .catch(err => console.error('[LightManager] Report failed:', err.message));
  
  return next;
}

async function setLightBrightness(agentUserId, deviceId, brightness) {
  const { ref, state } = await ensureLight(agentUserId, deviceId);
  const nextBrightness = Math.min(100, Math.max(0, brightness));

  const next = {
    ...state,
    on: true,
    brightness: nextBrightness,
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  const rgb = state.color?.spectrumRgb || 16777255;
  await sendToHardware(deviceId, {
    command: 'setBrightness',
    on: true,
    brightness: nextBrightness,
    color: {
      rgb: rgb,
      r: (rgb >> 16) & 0xFF,
      g: (rgb >> 8) & 0xFF,
      b: rgb & 0xFF
    }
  });
  
  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported'))
    .catch(err => console.error('[LightManager] Report failed:', err.message));
  
  return next;
}

async function setLightColor(agentUserId, deviceId, color) {
  const { ref, state } = await ensureLight(agentUserId, deviceId);

  const next = {
    ...state,
    on: true,
    color: {
      spectrumRgb: color.spectrumRgb || 16777215,
    },
    lastUpdated: Date.now(),
  };
  
  await ref.set(next);

  const rgb = color.spectrumRgb || 16777215;
  const red = (rgb >> 16) & 0xFF;
  const green = (rgb >> 8) & 0xFF;
  const blue = rgb & 0xFF;
  
  await sendToHardware(deviceId, {
    command: 'setColor',
    on: true,
    brightness: state.brightness,
    color: {
      rgb: rgb,
      r: red,
      g: green,
      b: blue
    }
  });
  
  reportLightState(agentUserId, deviceId, next)
    .then(() => console.log('[LightManager] State reported'))
    .catch(err => console.error('[LightManager] Report failed:', err.message));
  
  return next;
}

async function getLightState(agentUserId, deviceId) {
  const { state } = await ensureLight(agentUserId, deviceId);
  return state;
}

async function reportLightState(agentUserId, deviceId, state) {
  const payload = {
    requestId: `light-${Date.now()}`,
    agentUserId,
    payload: {
      devices: {
        states: {
          [deviceId]: {
            on: state.on,
            brightness: state.brightness,
            color: state.color,
            online: true,
          },
        },
      },
    },
  };

  return reportStateToHomeGraph(payload);
}

async function reportStateToHomeGraph(payload) {
  try {
    const { google } = require('googleapis');
    const homegraph = google.homegraph('v1');
    
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/homegraph']
    });
    
    const authClient = await auth.getClient();
    
    const response = await homegraph.devices.reportStateAndNotification({
      auth: authClient,
      requestBody: payload
    });
    
    console.log('[HomeGraph] State reported successfully');
    return response;
  } catch (error) {
    console.error('[HomeGraph] Failed to report state:', error.message);
    throw error;
  }
}

module.exports = {
  setLightOnOff,
  setLightBrightness,
  setLightColor,
  getLightState,
  reportLightState,
  sendToHardware,
};