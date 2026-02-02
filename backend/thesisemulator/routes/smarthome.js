// routes/smarthome.js - UI Compatible Version with Voice Support
const express = require("express");
const { verifyAccessToken } = require("../lib/tokenStore");
const deviceManager = require("../lib/deviceManager");

const router = express.Router();

function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m ? m[1] : null;
}

// POST /smarthome
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
            // Using Google's standard 'load' mode for UI compatibility
            // But voice commands for custom modes will still work
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
      const state = await deviceManager.getDeviceState(agentUserId, d.id);
      console.log('Device state:', JSON.stringify(state, null, 2));
      
      // Map internal state to UI-compatible format
      let loadSize = "medium"; // default
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
      let state = await deviceManager.getDeviceState(agentUserId, dev.id);

      try {
        for (const ex of executions) {
          console.log('Executing command:', ex.command);
          console.log('Params:', JSON.stringify(ex.params, null, 2));
          
          if (ex.command === "action.devices.commands.OnOff") {
            state = await deviceManager.setOnOff(agentUserId, dev.id, ex.params.on);
          }

          if (ex.command === "action.devices.commands.SetModes") {
            // Map UI 'load' setting to internal modes
            const modeSettings = ex.params.updateModeSettings || {};
            console.log('SetModes - input:', JSON.stringify(modeSettings));
            
            if (modeSettings.load) {
              const loadMap = {
                "small": "eco",
                "medium": "cotton",
                "large": "delicates"
              };
              const washMode = loadMap[modeSettings.load] || "cotton";
              
              state = await deviceManager.setModes(agentUserId, dev.id, {
                washMode: washMode
              });
              console.log('Mapped load to washMode:', washMode);
            } else {
              // Direct mode settings (for voice commands)
              state = await deviceManager.setModes(agentUserId, dev.id, modeSettings);
            }
          }

          if (ex.command === "action.devices.commands.SetToggles") {
            const toggleSettings = ex.params.updateToggleSettings || {};
            console.log('SetToggles - input:', JSON.stringify(toggleSettings));
            state = await deviceManager.setToggles(agentUserId, dev.id, toggleSettings);
          }

          if (ex.command === "action.devices.commands.StartStop") {
            console.log('StartStop - start:', ex.params.start);
            state = await deviceManager.startStop(agentUserId, dev.id, ex.params.start);
          }

          if (ex.command === "action.devices.commands.PauseUnpause") {
            console.log('PauseUnpause - pause:', ex.params.pause);
            // You can implement pause logic here if needed
          }
        }

        // Map internal state back to UI format for response
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
            currentModeSettings: {
              load: loadSize
            },
            currentToggleSettings: state.toggles || {
              childLock: false,
              extraRinse: false
            }
          },
        });
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