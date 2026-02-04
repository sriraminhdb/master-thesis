const express = require("express");
const { verifyAccessToken } = require("../lib/tokenStore");
const deviceManager = require("../lib/deviceManager");
const lightManager = require("../lib/lightManager");

const router = express.Router();

function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m ? m[1] : null;
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
        console.log('Washer state:', JSON.stringify(state, null, 2));
        
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
          currentModeSettings: {
            load: loadSize
          },
          currentToggleSettings: state.toggles || {
            childLock: false,
            extraRinse: false
          }
        };
      } else if (d.id === "light-1") {
        const state = await lightManager.getLightState(agentUserId, d.id);
        console.log('Light state:', JSON.stringify(state, null, 2));
        
        out[d.id] = {
          online: state.online,
          on: state.on,
          brightness: state.brightness,
          color: state.color
        };
      } else {
        console.log('Unknown device:', d.id);
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
            console.log('Executing washer command:', ex.command);
            console.log('Params:', JSON.stringify(ex.params, null, 2));
            
            if (ex.command === "action.devices.commands.OnOff") {
              state = await deviceManager.setOnOff(agentUserId, dev.id, ex.params.on);
            }

            if (ex.command === "action.devices.commands.SetModes") {
              const modeSettings = ex.params.updateModeSettings || {};
              
              if (modeSettings.load) {
                const loadMap = {
                  "small": "eco",
                  "medium": "cotton",
                  "large": "delicates"
                };
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
            console.log('Executing light command:', ex.command);
            console.log('Params:', JSON.stringify(ex.params, null, 2));
            
            if (ex.command === "action.devices.commands.OnOff") {
              state = await lightManager.setLightOnOff(agentUserId, dev.id, ex.params.on);
            }

            if (ex.command === "action.devices.commands.BrightnessAbsolute") {
              state = await lightManager.setLightBrightness(agentUserId, dev.id, ex.params.brightness);
            }

            if (ex.command === "action.devices.commands.ColorAbsolute") {
              if (ex.params.color && ex.params.color.spectrumRGB !== undefined) {
                state = await lightManager.setLightColor(agentUserId, dev.id, ex.params.color.spectrumRGB);
              }
            }
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