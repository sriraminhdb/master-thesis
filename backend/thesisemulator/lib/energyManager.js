const admin = require('firebase-admin');

const SOLAR_PEAK_GENERATION = 5.0;
const BATTERY_CAPACITY = 13.5;
const TYPICAL_HOME_CONSUMPTION = 1.2;
const GRID_COST_PER_KWH = 0.30;
const SOLAR_COST_PER_KWH = 0.05;

const SEASON_MULTIPLIERS = {
  winter: 0.3,
  spring: 0.7,
  summer: 1.0,
  autumn: 0.6
};

function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

function calculateSolarGeneration() {
  const hour = new Date().getHours();
  const season = getCurrentSeason();
  const seasonMultiplier = SEASON_MULTIPLIERS[season];
  
  let timeMultiplier = 0;
  if (hour >= 6 && hour <= 18) {
    const hoursSinceSunrise = hour - 6;
    timeMultiplier = Math.sin((hoursSinceSunrise / 12) * Math.PI);
  }
  
  const generation = SOLAR_PEAK_GENERATION * seasonMultiplier * timeMultiplier;
  return Math.max(0, generation);
}

function determineOptimalPowerSource(state) {
  const solarGeneration = calculateSolarGeneration();
  const consumption = state.currentConsumption || TYPICAL_HOME_CONSUMPTION;
  const batteryLevel = state.batteryLevel || 50;
  const mode = state.mode || 'auto';

  if (mode !== 'auto') {
    return mode;
  }
  
  if (solarGeneration >= consumption) {
    return 'solar';
  }

  if (solarGeneration > 0 && batteryLevel > 20) {
    return 'hybrid';
  }

  const hour = new Date().getHours();
  const isPeakHour = (hour >= 17 && hour <= 21);
  
  if (batteryLevel > 30 && isPeakHour) {
    return 'battery';
  }

  if (batteryLevel > 50) {
    return 'battery';
  }

  return 'grid';
}

function updateBatteryLevel(state) {
  const solarGeneration = calculateSolarGeneration();
  const consumption = state.currentConsumption || TYPICAL_HOME_CONSUMPTION;
  const powerSource = state.powerSource || 'grid';
  const currentBattery = state.batteryLevel || 50;
  
  let batteryChange = 0;

  const MINUTES_SINCE_LAST_UPDATE = 1;
  
  if (powerSource === 'solar') {
    const excess = solarGeneration - consumption;
    if (excess > 0) {
      batteryChange = (excess / BATTERY_CAPACITY) * 100 * (MINUTES_SINCE_LAST_UPDATE / 60);
    }
  } else if (powerSource === 'battery') {
    batteryChange = -(consumption / BATTERY_CAPACITY) * 100 * (MINUTES_SINCE_LAST_UPDATE / 60);
  } else if (powerSource === 'hybrid') {
    const deficit = consumption - solarGeneration;
    batteryChange = -(deficit / BATTERY_CAPACITY) * 100 * (MINUTES_SINCE_LAST_UPDATE / 60);
  }
  else if (powerSource === 'grid' && solarGeneration > 0 && currentBattery < 80) {
    batteryChange = (solarGeneration / BATTERY_CAPACITY) * 100 * (MINUTES_SINCE_LAST_UPDATE / 60);
  }
  
  const newBattery = Math.max(0, Math.min(100, currentBattery + batteryChange));
  return newBattery;
}

function calculateSavings(state) {
  const powerSource = state.powerSource || 'grid';
  const consumption = state.currentConsumption || TYPICAL_HOME_CONSUMPTION;
  const hoursThisMonth = state.monthlyHours || 0;
  
  let savings = 0;
  
  if (powerSource === 'solar') {
    savings = (GRID_COST_PER_KWH - SOLAR_COST_PER_KWH) * consumption;
  } else if (powerSource === 'battery') {
    savings = GRID_COST_PER_KWH * consumption;
  } else if (powerSource === 'hybrid') {
    const solarGeneration = calculateSolarGeneration();
    savings = GRID_COST_PER_KWH * solarGeneration;
  }

  const savingsPerHour = savings;
  const totalMonthlySavings = (state.monthlySavings || 0) + savingsPerHour;
  
  return {
    currentSavingsPerHour: savingsPerHour,
    totalMonthlySavings: totalMonthlySavings
  };
}

async function ensureEnergyManager(agentUserId, deviceId) {
  const ref = admin.firestore()
    .collection('users')
    .doc(agentUserId)
    .collection('energyManagers')
    .doc(deviceId);

  const snap = await ref.get();
  
  if (snap.exists) {
    return { ref, state: snap.data() };
  }

  const defaultState = {
    on: true,
    mode: 'auto',
    powerSource: 'grid',
    batteryLevel: 50,
    solarGeneration: 0,
    currentConsumption: TYPICAL_HOME_CONSUMPTION,
    monthlySavings: 0,
    monthlyHours: 0,
    lastUpdated: Date.now(),
    online: true
  };

  await ref.set(defaultState);
  return { ref, state: defaultState };
}

async function updateEnergyManager(agentUserId, deviceId) {
  const { ref, state } = await ensureEnergyManager(agentUserId, deviceId);
  
  if (!state.on) {
    return state;
  }

  const solarGeneration = calculateSolarGeneration();
  const optimalSource = determineOptimalPowerSource(state);
  const newBatteryLevel = updateBatteryLevel({ ...state, powerSource: optimalSource });
  const savings = calculateSavings({ ...state, powerSource: optimalSource });
  
  const nextState = {
    ...state,
    powerSource: optimalSource,
    solarGeneration: parseFloat(solarGeneration.toFixed(2)),
    batteryLevel: parseFloat(newBatteryLevel.toFixed(1)),
    monthlySavings: parseFloat(savings.totalMonthlySavings.toFixed(2)),
    monthlyHours: state.monthlyHours + (1/60),
    lastUpdated: Date.now()
  };
  
  await ref.set(nextState);
  
  console.log(`[EnergyManager] Updated ${deviceId}:`, {
    source: optimalSource,
    solar: solarGeneration.toFixed(2) + 'kW',
    battery: newBatteryLevel.toFixed(1) + '%',
    savings: '€' + savings.totalMonthlySavings.toFixed(2)
  });
  
  return nextState;
}

async function setEnergyMode(agentUserId, deviceId, mode) {
  const { ref, state } = await ensureEnergyManager(agentUserId, deviceId);
  
  const validModes = ['auto', 'grid', 'solar', 'battery'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  
  const nextState = {
    ...state,
    mode: mode,
    powerSource: mode === 'auto' ? determineOptimalPowerSource(state) : mode,
    lastUpdated: Date.now()
  };
  
  await ref.set(nextState);
  
  console.log(`[EnergyManager] Mode changed to ${mode} for ${deviceId}`);
  
  return nextState;
}

async function setEnergyOnOff(agentUserId, deviceId, on) {
  const { ref, state } = await ensureEnergyManager(agentUserId, deviceId);
  
  const nextState = {
    ...state,
    on: Boolean(on),
    powerSource: on ? determineOptimalPowerSource(state) : 'grid',
    lastUpdated: Date.now()
  };
  
  await ref.set(nextState);
  
  console.log(`[EnergyManager] ${on ? 'Enabled' : 'Disabled'} ${deviceId}`);
  
  return nextState;
}

async function getEnergyState(agentUserId, deviceId) {
  const { state } = await ensureEnergyManager(agentUserId, deviceId);
  return await updateEnergyManager(agentUserId, deviceId);
}

function getStatusDescription(state) {
  const season = getCurrentSeason();
  const powerSourceNames = {
    grid: 'grid power',
    solar: 'solar panels',
    battery: 'battery storage',
    hybrid: 'solar and battery'
  };
  
  return {
    powerSource: powerSourceNames[state.powerSource] || 'unknown',
    batteryLevel: `${state.batteryLevel.toFixed(0)}%`,
    solarGeneration: `${state.solarGeneration.toFixed(1)} kW`,
    monthlySavings: `€${state.monthlySavings.toFixed(2)}`,
    season: season,
    mode: state.mode
  };
}

module.exports = {
  ensureEnergyManager,
  updateEnergyManager,
  setEnergyMode,
  setEnergyOnOff,
  getEnergyState,
  getStatusDescription,
  calculateSolarGeneration,
  getCurrentSeason
};