const { db } = require("./firebaseAdmin");

const METRICS_COL = "metrics";
const EVENTS_COL = "events";

async function logDeviceCommand(data) {
  try {
    const duration = data.endTime - data.startTime;
    
    const event = {
      timestamp: data.startTime,
      eventType: 'device_command',
      deviceId: data.deviceId,
      deviceType: data.deviceType,
      command: data.command,
      duration_ms: duration,
      success: data.success,
      error: data.error || null,
      date: new Date(data.startTime).toISOString(),
    };

    await db.collection(EVENTS_COL).add(event);

    await updateAggregatedMetrics('device_commands', {
      deviceId: data.deviceId,
      deviceType: data.deviceType,
      duration: duration,
      success: data.success
    });
    
    console.log('[Metrics] Device command logged:', data.deviceId, data.command, `${duration}ms`);
  } catch (error) {
    console.error('[Metrics] Failed to log device command:', error.message);
  }
}

async function logReportState(data) {
  try {
    const duration = data.endTime - data.startTime;
    
    const event = {
      timestamp: data.startTime,
      eventType: 'report_state',
      deviceId: data.deviceId,
      duration_ms: duration,
      success: data.success,
      error: data.error || null,
      date: new Date(data.startTime).toISOString(),
    };
    
    await db.collection(EVENTS_COL).add(event);
    
    await updateAggregatedMetrics('report_state', {
      deviceId: data.deviceId,
      duration: duration,
      success: data.success
    });
    
    console.log('[Metrics] Report state logged:', data.deviceId, `${duration}ms`, data.success ? 'success' : 'failed');
  } catch (error) {
    console.error('[Metrics] Failed to log report state:', error.message);
  }
}

async function logApiRequest(data) {
  try {
    const duration = data.endTime - data.startTime;
    
    const event = {
      timestamp: data.startTime,
      eventType: 'api_request',
      intent: data.intent,
      duration_ms: duration,
      success: data.success,
      deviceCount: data.deviceCount || 0,
      date: new Date(data.startTime).toISOString(),
    };
    
    await db.collection(EVENTS_COL).add(event);
    
    await updateAggregatedMetrics('api_requests', {
      intent: data.intent,
      duration: duration,
      success: data.success
    });
    
  } catch (error) {
    console.error('[Metrics] Failed to log API request:', error.message);
  }
}

async function updateAggregatedMetrics(category, data) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const metricsRef = db.collection(METRICS_COL).doc(`${category}_${today}`);
    
    const doc = await metricsRef.get();
    
    if (!doc.exists) {
      await metricsRef.set({
        category: category,
        date: today,
        totalCount: 1,
        successCount: data.success ? 1 : 0,
        failureCount: data.success ? 0 : 1,
        totalDuration_ms: data.duration || 0,
        avgDuration_ms: data.duration || 0,
        minDuration_ms: data.duration || 0,
        maxDuration_ms: data.duration || 0,
        lastUpdated: Date.now(),
        details: {}
      });
    } else {
      const current = doc.data();
      const newTotal = current.totalCount + 1;
      const newTotalDuration = current.totalDuration_ms + (data.duration || 0);
      
      await metricsRef.update({
        totalCount: newTotal,
        successCount: current.successCount + (data.success ? 1 : 0),
        failureCount: current.failureCount + (data.success ? 0 : 1),
        totalDuration_ms: newTotalDuration,
        avgDuration_ms: newTotalDuration / newTotal,
        minDuration_ms: Math.min(current.minDuration_ms, data.duration || Infinity),
        maxDuration_ms: Math.max(current.maxDuration_ms, data.duration || 0),
        lastUpdated: Date.now(),
      });
    }
  } catch (error) {
    console.error('[Metrics] Failed to update aggregated metrics:', error.message);
  }
}

async function getMetricsSummary(startDate, endDate) {
  try {
    const snapshot = await db.collection(METRICS_COL)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    const summary = {
      startDate,
      endDate,
      categories: {}
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category;
      
      if (!summary.categories[category]) {
        summary.categories[category] = {
          totalCount: 0,
          successCount: 0,
          failureCount: 0,
          avgDuration_ms: 0,
          minDuration_ms: Infinity,
          maxDuration_ms: 0
        };
      }
      
      summary.categories[category].totalCount += data.totalCount;
      summary.categories[category].successCount += data.successCount;
      summary.categories[category].failureCount += data.failureCount;
      summary.categories[category].avgDuration_ms = 
        (summary.categories[category].avgDuration_ms + data.avgDuration_ms) / 2;
      summary.categories[category].minDuration_ms = 
        Math.min(summary.categories[category].minDuration_ms, data.minDuration_ms);
      summary.categories[category].maxDuration_ms = 
        Math.max(summary.categories[category].maxDuration_ms, data.maxDuration_ms);
    });

    Object.keys(summary.categories).forEach(category => {
      const cat = summary.categories[category];
      cat.successRate = cat.totalCount > 0 
        ? (cat.successCount / cat.totalCount * 100).toFixed(2) + '%'
        : '0%';
    });
    
    return summary;
  } catch (error) {
    console.error('[Metrics] Failed to get metrics summary:', error.message);
    return null;
  }
}

async function getRecentEvents(limit = 100) {
  try {
    const snapshot = await db.collection(EVENTS_COL)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    return events;
  } catch (error) {
    console.error('[Metrics] Failed to get recent events:', error.message);
    return [];
  }
}

async function calculateUptime(days = 30) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const snapshot = await db.collection(EVENTS_COL)
      .where('timestamp', '>=', startDate.getTime())
      .where('timestamp', '<=', endDate.getTime())
      .get();
    
    let totalRequests = 0;
    let successfulRequests = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalRequests++;
      if (data.success) {
        successfulRequests++;
      }
    });
    
    const uptime = totalRequests > 0 
      ? (successfulRequests / totalRequests * 100).toFixed(2)
      : 100;
    
    return {
      days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      uptimePercentage: parseFloat(uptime),
      meetsThreshold: parseFloat(uptime) >= 99.5
    };
  } catch (error) {
    console.error('[Metrics] Failed to calculate uptime:', error.message);
    return null;
  }
}

module.exports = {
  logDeviceCommand,
  logReportState,
  logApiRequest,
  getMetricsSummary,
  getRecentEvents,
  calculateUptime,
};