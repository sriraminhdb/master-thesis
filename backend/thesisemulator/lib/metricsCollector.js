const admin = require('firebase-admin');

async function logCommandExecution(data) {
  const {
    deviceId,
    deviceType,
    command,
    responseTimeMs,
    success,
    errorCode = null,
    timestamp = Date.now(),
    agentUserId
  } = data;

  try {
    await admin.firestore()
      .collection('metrics_commands')
      .add({
        deviceId,
        deviceType,
        command,
        responseTimeMs,
        success,
        errorCode,
        timestamp,
        agentUserId,
        date: new Date(timestamp).toISOString().split('T')[0],
        hour: new Date(timestamp).getHours()
      });

    const dateKey = new Date(timestamp).toISOString().split('T')[0];
    const summaryRef = admin.firestore()
      .collection('metrics_daily_summary')
      .doc(dateKey);

    const summaryDoc = await summaryRef.get();
    const currentData = summaryDoc.exists ? summaryDoc.data() : {
      date: dateKey,
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      totalResponseTime: 0,
      lastUpdated: 0
    };

    await summaryRef.set({
      date: dateKey,
      totalCommands: currentData.totalCommands + 1,
      successfulCommands: success ? currentData.successfulCommands + 1 : currentData.successfulCommands,
      failedCommands: success ? currentData.failedCommands : currentData.failedCommands + 1,
      totalResponseTime: currentData.totalResponseTime + responseTimeMs,
      lastUpdated: timestamp
    });

    console.log(`[Metrics] Logged: ${command} for ${deviceId} - ${responseTimeMs}ms - ${success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('[Metrics] Error logging command:', error);
  }
}

async function logEnergyManagerState(agentUserId, deviceId, state) {
  try {
    await admin.firestore()
      .collection('metrics_energy_manager')
      .add({
        deviceId,
        agentUserId,
        powerSource: state.powerSource,
        batteryLevel: state.batteryLevel,
        solarGeneration: state.solarGeneration,
        monthlySavings: state.monthlySavings,
        mode: state.mode,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        hour: new Date().getHours()
      });

    console.log(`[Metrics] Energy Manager: ${state.powerSource} - Battery: ${state.batteryLevel}%`);
  } catch (error) {
    console.error('[Metrics] Error logging energy state:', error);
  }
}

async function logHardwareCommand(deviceId, command, responseTimeMs) {
  try {
    await admin.firestore()
      .collection('metrics_hardware_commands')
      .add({
        deviceId,
        command: command.command || 'unknown',
        color: command.color || null,
        brightness: command.brightness || null,
        on: command.on,
        responseTimeMs,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
      });

    console.log(`[Metrics] Hardware: ${deviceId} - ${responseTimeMs}ms`);
  } catch (error) {
    console.error('[Metrics] Error logging hardware command:', error);
  }
}

async function getMetricsSummary(startDate, endDate) {
  try {
    const snapshot = await admin.firestore()
      .collection('metrics_daily_summary')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    let totalCommands = 0;
    let successfulCommands = 0;
    let failedCommands = 0;
    let totalResponseTime = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalCommands += data.totalCommands || 0;
      successfulCommands += data.successfulCommands || 0;
      failedCommands += data.failedCommands || 0;
      totalResponseTime += data.totalResponseTime || 0;
    });

    const avgResponseTime = totalCommands > 0 ? totalResponseTime / totalCommands : 0;
    const successRate = totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0;

    return {
      period: `${startDate} to ${endDate}`,
      totalCommands,
      successfulCommands,
      failedCommands,
      successRate: parseFloat(successRate.toFixed(2)),
      avgResponseTimeMs: parseFloat(avgResponseTime.toFixed(2)),
      avgResponseTimeSec: parseFloat((avgResponseTime / 1000).toFixed(2))
    };
  } catch (error) {
    console.error('[Metrics] Error getting summary:', error);
    return null;
  }
}

async function getCommandMetrics(startDate, endDate) {
  try {
    const snapshot = await admin.firestore()
      .collection('metrics_commands')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .orderBy('timestamp', 'asc')
      .limit(1000)
      .get();

    const commands = [];
    snapshot.forEach(doc => {
      commands.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return commands;
  } catch (error) {
    console.error('[Metrics] Error getting command metrics:', error);
    return [];
  }
}

async function getEnergyMetrics(startDate, endDate) {
  try {
    const snapshot = await admin.firestore()
      .collection('metrics_energy_manager')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .orderBy('timestamp', 'asc')
      .limit(1000)
      .get();

    const metrics = [];
    let solarCount = 0;
    let batteryCount = 0;
    let gridCount = 0;
    let hybridCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      metrics.push({
        id: doc.id,
        ...data
      });

      if (data.powerSource === 'solar') solarCount++;
      else if (data.powerSource === 'battery') batteryCount++;
      else if (data.powerSource === 'grid') gridCount++;
      else if (data.powerSource === 'hybrid') hybridCount++;
    });

    const total = metrics.length;
    const distribution = {
      solar: total > 0 ? parseFloat(((solarCount / total) * 100).toFixed(1)) : 0,
      battery: total > 0 ? parseFloat(((batteryCount / total) * 100).toFixed(1)) : 0,
      grid: total > 0 ? parseFloat(((gridCount / total) * 100).toFixed(1)) : 0,
      hybrid: total > 0 ? parseFloat(((hybridCount / total) * 100).toFixed(1)) : 0
    };

    const latestSavings = metrics.length > 0 ? metrics[metrics.length - 1].monthlySavings : 0;

    return {
      metrics,
      distribution,
      totalDataPoints: total,
      estimatedMonthlySavings: latestSavings
    };
  } catch (error) {
    console.error('[Metrics] Error getting energy metrics:', error);
    return null;
  }
}

async function getDeviceStatistics(deviceId, startDate, endDate) {
  try {
    const snapshot = await admin.firestore()
      .collection('metrics_commands')
      .where('deviceId', '==', deviceId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    const responseTimes = [];
    let successCount = 0;
    const commandTypes = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      responseTimes.push(data.responseTimeMs);
      
      if (data.success) successCount++;

      commandTypes[data.command] = (commandTypes[data.command] || 0) + 1;
    });

    const total = responseTimes.length;
    if (total === 0) {
      return {
        deviceId,
        noData: true
      };
    }

    responseTimes.sort((a, b) => a - b);
    const avg = responseTimes.reduce((a, b) => a + b, 0) / total;
    const min = responseTimes[0];
    const max = responseTimes[total - 1];
    const p95Index = Math.floor(total * 0.95);
    const p95 = responseTimes[p95Index];

    return {
      deviceId,
      totalCommands: total,
      successRate: parseFloat(((successCount / total) * 100).toFixed(2)),
      avgResponseMs: parseFloat(avg.toFixed(2)),
      minResponseMs: min,
      maxResponseMs: max,
      p95ResponseMs: p95,
      commandBreakdown: commandTypes
    };
  } catch (error) {
    console.error('[Metrics] Error getting device stats:', error);
    return null;
  }
}

function metricsToCSV(metrics) {
  if (!metrics || metrics.length === 0) {
    return 'No data';
  }

  const escapeCSV = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);

    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  };

  const headers = Object.keys(metrics[0]);
  const headerRow = headers.map(h => escapeCSV(h)).join(',');

  const dataRows = metrics.map(row => {
    return headers.map(header => escapeCSV(row[header])).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

module.exports = {
  logCommandExecution,
  logEnergyManagerState,
  logHardwareCommand,
  getMetricsSummary,
  getCommandMetrics,
  getEnergyMetrics,
  getDeviceStatistics,
  metricsToCSV
};