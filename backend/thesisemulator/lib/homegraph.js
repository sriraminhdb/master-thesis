const { google } = require('googleapis');
const functions = require('firebase-functions');

let auth;
try {
  const serviceAccountKey = functions.config().homegraph?.key;
  
  if (serviceAccountKey) {
    const credentials = JSON.parse(serviceAccountKey);
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/homegraph']
    });
    console.log('[HomeGraph] Using credentials from Firebase config');
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: './service-account-key.json',
      scopes: ['https://www.googleapis.com/auth/homegraph']
    });
    console.log('[HomeGraph] Using credentials from service account file');
  }
} catch (error) {
  console.error('[HomeGraph] Failed to initialize auth:', error.message);
  auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/homegraph']
  });
}

const homegraph = google.homegraph({
  version: 'v1',
  auth: auth
});

async function requestSync(agentUserId) {
  try {
    console.log(`[HomeGraph] Requesting sync for user: ${agentUserId}`);
    
    const res = await homegraph.devices.requestSync({
      requestBody: {
        agentUserId: agentUserId,
      },
    });
    
    console.log('[HomeGraph] Request sync successful:', res.data);
    return res.data;
  } catch (error) {
    console.error('[HomeGraph] Request sync failed:', error.message);
    if (error.response) {
      console.error('[HomeGraph] Error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function reportState(agentUserId, devices) {
  try {
    console.log(`[HomeGraph] Reporting state for user: ${agentUserId}`);
    console.log('[HomeGraph] Device states:', JSON.stringify(devices, null, 2));
    
    const requestBody = {
      requestId: `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentUserId: agentUserId,
      payload: {
        devices: {
          states: devices
        }
      }
    };
    
    const res = await homegraph.devices.reportStateAndNotification({
      requestBody: requestBody
    });
    
    console.log('[HomeGraph] Report state successful:', res.data);
    return res.data;
  } catch (error) {
    console.error('[HomeGraph] Report state failed:', error.message);
    if (error.response) {
      console.error('[HomeGraph] Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

function formatDeviceState(state) {
  let loadSize = "medium";
  if (state.modes?.washMode === "eco" || state.modes?.washMode === "quick") {
    loadSize = "small";
  } else if (state.modes?.washMode === "cotton") {
    loadSize = "medium";
  } else if (state.modes?.washMode === "delicates") {
    loadSize = "large";
  }
  
  return {
    online: state.online !== false,
    on: state.on || false,
    isRunning: state.isRunning || false,
    isPaused: false,
    currentModeSettings: {
      load: loadSize
    },
    currentToggleSettings: state.toggles || {
      childLock: false,
      extraRinse: false
    }
  };
}

async function reportDeviceState(agentUserId, deviceId, state) {
  const formattedState = formatDeviceState(state);
  
  return reportState(agentUserId, {
    [deviceId]: formattedState
  });
}

module.exports = {
  requestSync,
  reportState,
  reportDeviceState,
  formatDeviceState
};