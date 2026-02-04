const express = require("express");
const { requestSync, reportDeviceState } = require("../lib/homegraph");
const deviceManager = require("../lib/deviceManager");
const lightManager = require("../lib/lightManager");

const router = express.Router();

router.get("/request-sync", async (req, res) => {
  try {
    const agentUserId = req.query.userId || "user-1";
    
    console.log(`[Test] Requesting sync for user: ${agentUserId}`);
    const result = await requestSync(agentUserId);
    
    return res.json({
      success: true,
      message: "Sync request sent successfully",
      agentUserId,
      result
    });
  } catch (error) {
    console.error('[Test] Request sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/report-state", async (req, res) => {
  try {
    const { deviceId = "washer-1", userId = "user-1" } = req.body;
    
    console.log(`[Test] Reporting state for device: ${deviceId}, user: ${userId}`);
    
    const state = await deviceManager.getDeviceState(userId, deviceId);
    const result = await reportDeviceState(userId, deviceId, state);
    
    return res.json({
      success: true,
      message: "State reported successfully",
      deviceId,
      userId,
      state,
      result
    });
  } catch (error) {
    console.error('[Test] Report state error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/device-state", async (req, res) => {
  try {
    const { deviceId = "washer-1", userId = "user-1" } = req.query;
    
    const state = await deviceManager.getDeviceState(userId, deviceId);
    
    return res.json({
      success: true,
      deviceId,
      userId,
      state
    });
  } catch (error) {
    console.error('[Test] Get device state error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/simulate-change", async (req, res) => {
  try {
    const { deviceId = "washer-1", userId = "user-1", action = "turnOn" } = req.body;
    
    console.log(`[Test] Simulating ${action} for device: ${deviceId}`);
    
    let newState;
    
    switch (action) {
      case "turnOn":
        newState = await deviceManager.setOnOff(userId, deviceId, true);
        break;
      case "turnOff":
        newState = await deviceManager.setOnOff(userId, deviceId, false);
        break;
      case "start":
        newState = await deviceManager.startStop(userId, deviceId, true);
        break;
      case "stop":
        newState = await deviceManager.startStop(userId, deviceId, false);
        break;
      case "toggleChildLock": {
        const currentState = await deviceManager.getDeviceState(userId, deviceId);
        newState = await deviceManager.setToggles(userId, deviceId, {
          childLock: !currentState.toggles.childLock
        });
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return res.json({
      success: true,
      message: `${action} completed and state reported to Google`,
      deviceId,
      userId,
      action,
      newState
    });
  } catch (error) {
    console.error('[Test] Simulate change error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/light-state", async (req, res) => {
  try {
    const { deviceId = "light-1", userId = "user-1" } = req.query;
    
    const state = await lightManager.getLightState(userId, deviceId);
    
    return res.json({
      success: true,
      deviceId,
      userId,
      state
    });
  } catch (error) {
    console.error('[Test] Get light state error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/light-control", async (req, res) => {
  try {
    const { 
      deviceId = "light-1", 
      userId = "user-1", 
      action = "turnOn",
      brightness = 100,
      color = 16777215
    } = req.body;
    
    console.log(`[Test] Light control - ${action} for device: ${deviceId}`);
    
    let newState;
    
    switch (action) {
      case "turnOn":
        newState = await lightManager.setLightOnOff(userId, deviceId, true);
        break;
      case "turnOff":
        newState = await lightManager.setLightOnOff(userId, deviceId, false);
        break;
      case "setBrightness":
        newState = await lightManager.setLightBrightness(userId, deviceId, brightness);
        break;
      case "setColor":
        newState = await lightManager.setLightColor(userId, deviceId, color);
        break;
      case "setRed":
        newState = await lightManager.setLightColor(userId, deviceId, 0xFF0000);
        break;
      case "setGreen":
        newState = await lightManager.setLightColor(userId, deviceId, 0x00FF00);
        break;
      case "setBlue":
        newState = await lightManager.setLightColor(userId, deviceId, 0x0000FF);
        break;
      case "setWhite":
        newState = await lightManager.setLightColor(userId, deviceId, 0xFFFFFF);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return res.json({
      success: true,
      message: `${action} completed and state reported to Google`,
      deviceId,
      userId,
      action,
      newState
    });
  } catch (error) {
    console.error('[Test] Light control error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/light-demo", async (req, res) => {
  try {
    const { deviceId = "light-1", userId = "user-1" } = req.body;
    
    console.log(`[Test] Running light demo sequence for: ${deviceId}`);
    
    const sequence = [];

    sequence.push(await lightManager.setLightOnOff(userId, deviceId, true));
    await new Promise(resolve => setTimeout(resolve, 500));

    sequence.push(await lightManager.setLightColor(userId, deviceId, 0xFF0000));
    await new Promise(resolve => setTimeout(resolve, 1000));

    sequence.push(await lightManager.setLightColor(userId, deviceId, 0x00FF00));
    await new Promise(resolve => setTimeout(resolve, 1000));

    sequence.push(await lightManager.setLightColor(userId, deviceId, 0x0000FF));
    await new Promise(resolve => setTimeout(resolve, 1000));

    sequence.push(await lightManager.setLightBrightness(userId, deviceId, 50));
    await new Promise(resolve => setTimeout(resolve, 1000));

    sequence.push(await lightManager.setLightBrightness(userId, deviceId, 100));
    await new Promise(resolve => setTimeout(resolve, 1000));

    sequence.push(await lightManager.setLightColor(userId, deviceId, 0xFFFFFF));
    
    return res.json({
      success: true,
      message: "Light demo sequence completed",
      deviceId,
      userId,
      steps: sequence.length,
      finalState: sequence[sequence.length - 1]
    });
  } catch (error) {
    console.error('[Test] Light demo error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;