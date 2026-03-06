const express = require("express");
const { verifyAccessToken } = require("../lib/tokenStore");
const deviceManager = require("../lib/deviceManager");
const lightManager = require("../lib/lightManager");
const outletManager = require("../lib/outletManager");
const switchManager = require("../lib/switchManager");
const energyManager = require("../lib/energyManager");
const metricsCollector = require("../lib/metricsCollector");
const router = express.Router();

function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m ? m[1] : null;
}

function temperatureToRgb(kelvin) {
  if (kelvin <= 2000) return 0xFF9329;
  if (kelvin <= 3000) return 0xFFD4A3;
  if (kelvin <= 4000) return 0xFFF4E5;
  if (kelvin <= 5000) return 0xFFFFFF;
  if (kelvin <= 6500) return 0xE8F4FF;
  return 0xC9E2FF;
}

router.post("/", async (req, res) => {
  console.log('=== SMARTHOME REQUEST ===');
  console.log('Time:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const token = getBearer(req);
    console.log('Token present:', !!token);
    
    const auth = await verifyAccessToken(token);
    console.log('Auth verified:', !!auth);

    if (!auth) {
      console.log('Auth failed - returning error');
      return res.json({
        requestId: req.body.requestId,
        payload: { errorCode: "authFailure" },
      });
    }

    const agentUserId = auth.agentUserId;
    const { requestId, inputs } = req.body;
    console.log('Processing for user:', agentUserId);

    const results = [];
    for (const input of inputs) {
      const intent = input.intent;
      console.log('Processing intent:', intent);

      if (intent === "action.devices.SYNC") {
        results.push(handleSync(agentUserId));
      } else if (intent === "action.devices.QUERY") {
        const queryResult = await handleQuery(agentUserId, input.payload);
        console.log('Query result:', JSON.stringify(queryResult, null, 2));
        results.push(queryResult);
      } else if (intent === "action.devices.EXECUTE") {
        const execResult = await handleExecute(agentUserId, input.payload);
        console.log('Execute result:', JSON.stringify(execResult, null, 2));
        results.push(execResult);
      } else {
        console.log('Unsupported intent:', intent);
        results.push({ payload: { errorCode: "notSupported" } });
      }
    }

    const merged = results.reduce(
      (acc, r) => ({ ...acc, ...r }),
      { requestId }
    );

    console.log('Final response:', JSON.stringify(merged, null, 2));
    console.log('=== END REQUEST ===\n');

    return res.json(merged);
  } catch (e) {
    console.error('=== ERROR ===');
    console.error('Error:', e);
    console.error('Stack:', e.stack);
    console.error('=== END ERROR ===\n');
    
    return res.status(200).json({
      requestId: req.body?.requestId || 'unknown',
      payload: { errorCode: "hardError" },
    });
  }
});

function handleSync(agentUserId) {
  console.log('handleSync called for:', agentUserId);
  return {
    payload: {
      agentUserId,
      devices: [
        {
          id: "washer-1",
          type: "action.devices.types.WASHER",
          traits: [
            "action.devices.traits.OnOff",
            "action.devices.traits.StartStop",
            "action.devices.traits.Modes",
            "action.devices.traits.Toggles",
          ],
          name: {
            name: "Laundry",
            defaultNames: ["Ram's Washer"],
            nicknames: ["laundry", "washer", "washing machine"],
          },
          willReportState: false,
          attributes: {
            availableModes: [
              {
                name: "load",
                name_values: [
                  {
                    name_synonym: ["load", "size", "load size"],
                    lang: "en"
                  }
                ],
                settings: [
                  {
                    setting_name: "small",
                    setting_values: [
                      {
                        setting_synonym: ["small", "half", "eco", "quick"],
                        lang: "en"
                      }
                    ]
                  },
                  {
                    setting_name: "medium",
                    setting_values: [
                      {
                        setting_synonym: ["medium", "normal", "cotton", "regular"],
                        lang: "en"
                      }
                    ]
                  },
                  {
                    setting_name: "large",
                    setting_values: [
                      {
                        setting_synonym: ["large", "full", "heavy", "delicates"],
                        lang: "en"
                      }
                    ]
                  }
                ],
                ordered: true
              }
            ],
            availableToggles: [
              {
                name: "childLock",
                name_values: [
                  {
                    name_synonym: ["child lock", "safety lock"],
                    lang: "en"
                  }
                ]
              },
              {
                name: "extraRinse",
                name_values: [
                  {
                    name_synonym: ["extra rinse", "rinse plus", "additional rinse"],
                    lang: "en"
                  }
                ]
              }
            ],
            pausable: true
          },
          deviceInfo: {
            manufacturer: "ThesisEmulator",
            model: "Washer v1",
            hwVersion: "1.0",
            swVersion: "1.0",
          },
        },
        {
          id: "light-1",
          type: "action.devices.types.LIGHT",
          traits: [
            "action.devices.traits.OnOff",
            "action.devices.traits.Brightness",
            "action.devices.traits.ColorSetting",
          ],
          name: {
            name: "Living Room Light",
            defaultNames: ["Smart Light"],
            nicknames: ["living room light", "main light", "light"],
          },
          willReportState: false,
          attributes: {
            colorModel: "rgb",
            colorTemperatureRange: {
              temperatureMinK: 2000,
              temperatureMaxK: 9000
            },
            commandOnlyColorSetting: false
          },
          deviceInfo: {
            manufacturer: "ThesisEmulator",
            model: "Smart Light v1",
            hwVersion: "1.0",
            swVersion: "1.0",
          },
        },
        {
          id: "outlet-1",
          type: "action.devices.types.OUTLET",
          traits: [
            "action.devices.traits.OnOff",
          ],
          name: {
            name: "Smart Outlet",
            defaultNames: ["Power Outlet"],
            nicknames: ["outlet", "plug", "socket"],
          },
          willReportState: false,
          attributes: {},
          deviceInfo: {
            manufacturer: "ThesisEmulator",
            model: "Smart Outlet v1",
            hwVersion: "1.0",
            swVersion: "1.0",
          },
        },
        {
          id: "switch-1",
          type: "action.devices.types.SWITCH",
          traits: [
            "action.devices.traits.OnOff",
          ],
          name: {
            name: "Smart Switch",
            defaultNames: ["Light Switch"],
            nicknames: ["switch", "wall switch"],
          },
          willReportState: false,
          attributes: {},
          deviceInfo: {
            manufacturer: "ThesisEmulator",
            model: "Smart Switch v1",
            hwVersion: "1.0",
            swVersion: "1.0",
          },
        },
        {
          id: "energy-manager-1",
          type: "action.devices.types.SENSOR",
          traits: [
            "action.devices.traits.OnOff",
            "action.devices.traits.Modes",
            "action.devices.traits.SensorState",
            "action.devices.traits.EnergyStorage"
          ],
          name: {
            name: "Energy Manager",
            defaultNames: ["Smart Energy Controller"],
            nicknames: ["energy manager", "power manager", "solar system"],
          },
          willReportState: false,
          attributes: {
            availableModes: [
              {
                name: "power_mode",
                name_values: [{ name_synonym: ["power mode", "energy mode"], lang: "en" }],
                settings: [
                  { setting_name: "auto", setting_values: [{ setting_synonym: ["auto", "automatic"], lang: "en" }] },
                  { setting_name: "grid", setting_values: [{ setting_synonym: ["grid", "grid power"], lang: "en" }] },
                  { setting_name: "solar", setting_values: [{ setting_synonym: ["solar", "solar power"], lang: "en" }] },
                  { setting_name: "battery", setting_values: [{ setting_synonym: ["battery", "battery power"], lang: "en" }] }
                ],
                ordered: false
              }
            ],
            sensorStatesSupported: [
              { name: "PowerSource", numericCapabilities: { rawValueUnit: "NO_UNITS" } },
              { name: "SolarGeneration", numericCapabilities: { rawValueUnit: "KILOWATTS" } },
              { name: "MonthlySavings", numericCapabilities: { rawValueUnit: "NO_UNITS" } }
            ],
            queryOnlyEnergyStorage: true,
            energyStorageDistanceUnitForUX: "PERCENTAGE",
            isRechargeable: true
          },
          deviceInfo: {
            manufacturer: "ThesisEmulator",
            model: "Smart Energy Manager v1",
            hwVersion: "1.0",
            swVersion: "1.0",
          },
        },
      ],
    },
  };
}

async function handleQuery(agentUserId, payload) {
  console.log('handleQuery called');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  const devices = payload.devices || [];
  const out = {};

  for (const d of devices) {
    console.log('Querying device:', d.id);
    try {
      if (d.id === "washer-1") {
        const state = await deviceManager.getDeviceState(agentUserId, d.id);
        let loadSize = "medium";
        if (state.modes?.washMode === "eco" || state.modes?.washMode === "quick") {
          loadSize = "small";
        } else if (state.modes?.washMode === "cotton") {
          loadSize = "medium";
        } else if (state.modes?.washMode === "delicates") {
          loadSize = "large";
        }
        
        out[d.id] = {
          online: state.online,
          on: state.on,
          isRunning: state.isRunning,
          isPaused: false,
          currentModeSettings: { load: loadSize },
          currentToggleSettings: state.toggles || { childLock: false, extraRinse: false }
        };
      } else if (d.id === "light-1") {
        const state = await lightManager.getLightState(agentUserId, d.id);
        out[d.id] = {
          online: state.online,
          on: state.on,
          brightness: state.brightness,
          color: state.color
        };
      } else if (d.id === "outlet-1") {
        const state = await outletManager.getOutletState(agentUserId, d.id);
        out[d.id] = {
          online: state.online,
          on: state.on
        };
      } else if (d.id === "switch-1") {
        const state = await switchManager.getSwitchState(agentUserId, d.id);
        out[d.id] = {
          online: state.online,
          on: state.on
        };
      } else if (d.id === "energy-manager-1") {
        const state = await energyManager.getEnergyState(agentUserId, d.id);
        
        out[d.id] = {
          online: state.online,
          on: state.on,
          currentModeSettings: { power_mode: state.mode },
          currentSensorStateData: [
            { name: "PowerSource", rawValue: state.powerSource === 'grid' ? 0 : state.powerSource === 'solar' ? 1 : state.powerSource === 'battery' ? 2 : 3 },
            { name: "SolarGeneration", rawValue: state.solarGeneration },
            { name: "MonthlySavings", rawValue: state.monthlySavings }
          ],
          descriptiveCapacityRemaining: state.batteryLevel > 70 ? "HIGH" : state.batteryLevel > 30 ? "MEDIUM" : "LOW",
          capacityRemaining: [{ rawValue: state.batteryLevel, unit: "PERCENTAGE" }],
          capacityUntilFull: [{ rawValue: 100 - state.batteryLevel, unit: "PERCENTAGE" }],
          isCharging: state.solarGeneration > 0 && state.batteryLevel < 100
        };
      } else {
        out[d.id] = {
          online: false,
          status: "ERROR",
          errorCode: "deviceNotFound"
        };
      }
    } catch (error) {
      console.error('Error querying device:', d.id, error);
      out[d.id] = {
        online: false,
        status: "ERROR",
        errorCode: "deviceNotFound"
      };
    }
  }

  return { payload: { devices: out } };
}

async function handleExecute(agentUserId, payload) {
  console.log('handleExecute called');
  const commands = payload.commands || [];
  const results = [];

  for (const cmd of commands) {
    const devices = cmd.devices || [];
    const executions = cmd.execution || [];

    for (const dev of devices) {
      try {
        let state;

        if (dev.id === "washer-1") {
          state = await deviceManager.getDeviceState(agentUserId, dev.id);

          for (const ex of executions) {
            const cmdStartTime = Date.now();
            console.log('Executing washer command:', ex.command);
            
            let cmdSuccess = true;
            let cmdError = null;
            
            try {
              if (ex.command === "action.devices.commands.OnOff") {
                state = await deviceManager.setOnOff(agentUserId, dev.id, ex.params.on);
              }
              if (ex.command === "action.devices.commands.SetModes") {
                const modeSettings = ex.params.updateModeSettings || {};
                if (modeSettings.load) {
                  const loadMap = { "small": "eco", "medium": "cotton", "large": "delicates" };
                  const washMode = loadMap[modeSettings.load] || "cotton";
                  state = await deviceManager.setModes(agentUserId, dev.id, { washMode });
                } else {
                  state = await deviceManager.setModes(agentUserId, dev.id, modeSettings);
                }
              }
              if (ex.command === "action.devices.commands.SetToggles") {
                state = await deviceManager.setToggles(agentUserId, dev.id, ex.params.updateToggleSettings || {});
              }
              if (ex.command === "action.devices.commands.StartStop") {
                state = await deviceManager.startStop(agentUserId, dev.id, ex.params.start);
              }
            } catch (error) {
              cmdSuccess = false;
              cmdError = error.message;
              console.error('Washer command error:', error);
            }

            const responseTime = Date.now() - cmdStartTime;
            await metricsCollector.logCommandExecution({
              deviceId: dev.id,
              deviceType: 'washer',
              command: ex.command,
              responseTimeMs: responseTime,
              success: cmdSuccess,
              errorCode: cmdError,
              agentUserId: agentUserId
            });
          }

          let loadSize = "medium";
          if (state.modes?.washMode === "eco" || state.modes?.washMode === "quick") {
            loadSize = "small";
          } else if (state.modes?.washMode === "cotton") {
            loadSize = "medium";
          } else if (state.modes?.washMode === "delicates") {
            loadSize = "large";
          }

          results.push({
            ids: [dev.id],
            status: "SUCCESS",
            states: {
              online: state.online,
              on: state.on,
              isRunning: state.isRunning,
              isPaused: false,
              currentModeSettings: { load: loadSize },
              currentToggleSettings: state.toggles || { childLock: false, extraRinse: false }
            },
          });
        } else if (dev.id === "light-1") {
          state = await lightManager.getLightState(agentUserId, dev.id);

          for (const ex of executions) {
            const cmdStartTime = Date.now();
            console.log('Executing light command:', ex.command);
            console.log('Light params:', JSON.stringify(ex.params));
            
            let cmdSuccess = true;
            let cmdError = null;
            
            try {
              if (ex.command === "action.devices.commands.OnOff") {
                state = await lightManager.setLightOnOff(agentUserId, dev.id, ex.params.on);
              }
              if (ex.command === "action.devices.commands.BrightnessAbsolute") {
                state = await lightManager.setLightBrightness(agentUserId, dev.id, ex.params.brightness);
              }
              if (ex.command === "action.devices.commands.ColorAbsolute") {
                console.log('ColorAbsolute received!');
                console.log('Color data:', JSON.stringify(ex.params.color));
                
                if (!ex.params.color) {
                  throw new Error('Missing color parameter in ColorAbsolute');
                }
                
                let colorValue;

                colorValue = ex.params.color.spectrumRgb || ex.params.color.spectrumRGB;

                if (colorValue === undefined && ex.params.color.temperature) {
                  console.log('Converting temperature to RGB:', ex.params.color.temperature);
                  colorValue = temperatureToRgb(ex.params.color.temperature);
                  console.log('Converted to RGB:', colorValue);
                }
                
                if (colorValue === undefined || colorValue === null) {
                  throw new Error('Missing spectrumRgb value in color parameter');
                }
                
                console.log('Setting color to:', colorValue);
                state = await lightManager.setLightColor(agentUserId, dev.id, { 
                  spectrumRgb: colorValue 
                });
                console.log('Color set successfully');
              }
            } catch (error) {
              cmdSuccess = false;
              cmdError = error.message;
              console.error('Light command error:', error);
            }

            const responseTime = Date.now() - cmdStartTime;
            await metricsCollector.logCommandExecution({
              deviceId: dev.id,
              deviceType: 'light',
              command: ex.command,
              responseTimeMs: responseTime,
              success: cmdSuccess,
              errorCode: cmdError,
              agentUserId: agentUserId
            });
          }

          results.push({
            ids: [dev.id],
            status: "SUCCESS",
            states: {
              online: state.online,
              on: state.on,
              brightness: state.brightness,
              color: state.color
            },
          });
        } else if (dev.id === "outlet-1") {
          state = await outletManager.getOutletState(agentUserId, dev.id);

          for (const ex of executions) {
            const cmdStartTime = Date.now();
            console.log('Executing outlet command:', ex.command);
            
            let cmdSuccess = true;
            let cmdError = null;
            
            try {
              if (ex.command === "action.devices.commands.OnOff") {
                state = await outletManager.setOutletOnOff(agentUserId, dev.id, ex.params.on);
              }
            } catch (error) {
              cmdSuccess = false;
              cmdError = error.message;
              console.error('Outlet command error:', error);
            }

            const responseTime = Date.now() - cmdStartTime;
            await metricsCollector.logCommandExecution({
              deviceId: dev.id,
              deviceType: 'outlet',
              command: ex.command,
              responseTimeMs: responseTime,
              success: cmdSuccess,
              errorCode: cmdError,
              agentUserId: agentUserId
            });
          }

          results.push({
            ids: [dev.id],
            status: "SUCCESS",
            states: {
              online: state.online,
              on: state.on
            },
          });
        } else if (dev.id === "switch-1") {
          state = await switchManager.getSwitchState(agentUserId, dev.id);

          for (const ex of executions) {
            const cmdStartTime = Date.now();
            console.log('Executing switch command:', ex.command);
            
            let cmdSuccess = true;
            let cmdError = null;
            
            try {
              if (ex.command === "action.devices.commands.OnOff") {
                state = await switchManager.setSwitchOnOff(agentUserId, dev.id, ex.params.on);
              }
            } catch (error) {
              cmdSuccess = false;
              cmdError = error.message;
              console.error('Switch command error:', error);
            }

            const responseTime = Date.now() - cmdStartTime;
            await metricsCollector.logCommandExecution({
              deviceId: dev.id,
              deviceType: 'switch',
              command: ex.command,
              responseTimeMs: responseTime,
              success: cmdSuccess,
              errorCode: cmdError,
              agentUserId: agentUserId
            });
          }

          results.push({
            ids: [dev.id],
            status: "SUCCESS",
            states: {
              online: state.online,
              on: state.on
            },
          });
        } else if (dev.id === "energy-manager-1") {
          state = await energyManager.getEnergyState(agentUserId, dev.id);

          for (const ex of executions) {
            const cmdStartTime = Date.now();
            console.log('Executing energy manager command:', ex.command);
            console.log('Energy params:', JSON.stringify(ex.params));
            
            let cmdSuccess = true;
            let cmdError = null;
            
            try {
              if (ex.command === "action.devices.commands.OnOff") {
                state = await energyManager.setEnergyOnOff(agentUserId, dev.id, ex.params.on);
              }
              if (ex.command === "action.devices.commands.SetModes") {
                const modeSettings = ex.params.updateModeSettings || {};
                if (modeSettings.power_mode) {
                  state = await energyManager.setEnergyMode(agentUserId, dev.id, modeSettings.power_mode);
                }
              }
            } catch (error) {
              cmdSuccess = false;
              cmdError = error.message;
              console.error('Energy manager command error:', error);
            }

            const responseTime = Date.now() - cmdStartTime;
            await metricsCollector.logCommandExecution({
              deviceId: dev.id,
              deviceType: 'energy_manager',
              command: ex.command,
              responseTimeMs: responseTime,
              success: cmdSuccess,
              errorCode: cmdError,
              agentUserId: agentUserId
            });
          }

          results.push({
            ids: [dev.id],
            status: "SUCCESS",
            states: {
              online: state.online,
              on: state.on,
              currentModeSettings: { power_mode: state.mode },
              currentSensorStateData: [
                { name: "PowerSource", rawValue: state.powerSource === 'grid' ? 0 : state.powerSource === 'solar' ? 1 : state.powerSource === 'battery' ? 2 : 3 },
                { name: "SolarGeneration", rawValue: state.solarGeneration },
                { name: "MonthlySavings", rawValue: state.monthlySavings }
              ],
              descriptiveCapacityRemaining: state.batteryLevel > 70 ? "HIGH" : state.batteryLevel > 30 ? "MEDIUM" : "LOW",
              capacityRemaining: [{ rawValue: state.batteryLevel, unit: "PERCENTAGE" }],
              capacityUntilFull: [{ rawValue: 100 - state.batteryLevel, unit: "PERCENTAGE" }],
              isCharging: state.solarGeneration > 0 && state.batteryLevel < 100
            },
          });
        } else {
          results.push({
            ids: [dev.id],
            status: "ERROR",
            errorCode: "deviceNotFound",
          });
        }
      } catch (e) {
        console.error('Execute error:', e);
        results.push({
          ids: [dev.id],
          status: "ERROR",
          errorCode: "hardError",
        });
      }
    }
  }

  return { payload: { commands: results } };
}

module.exports = router;