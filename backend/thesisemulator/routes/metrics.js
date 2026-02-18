const express = require("express");
const metricsCollector = require("../lib/metricsCollector");
const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || getDateDaysAgo(7);

    const summary = await metricsCollector.getMetricsSummary(startDate, endDate);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/commands", async (req, res) => {
  try {
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || getDateDaysAgo(7);
    const format = req.query.format || 'json';

    const commands = await metricsCollector.getCommandMetrics(startDate, endDate);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="commands_${startDate}_${endDate}.csv"`);
      res.send(metricsCollector.metricsToCSV(commands));
    } else {
      res.json({
        success: true,
        count: commands.length,
        data: commands
      });
    }
  } catch (error) {
    console.error('Error getting commands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/energy", async (req, res) => {
  try {
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || getDateDaysAgo(7);

    const energyMetrics = await metricsCollector.getEnergyMetrics(startDate, endDate);

    res.json({
      success: true,
      data: energyMetrics
    });
  } catch (error) {
    console.error('Error getting energy metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || getDateDaysAgo(30); // Last 30 days

    const stats = await metricsCollector.getDeviceStatistics(deviceId, startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting device stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate7 = getDateDaysAgo(7);
    const startDate30 = getDateDaysAgo(30);

    const [
      summary7Days,
      summary30Days,
      energyMetrics,
      lightStats,
      washerStats,
      energyManagerStats
    ] = await Promise.all([
      metricsCollector.getMetricsSummary(startDate7, endDate),
      metricsCollector.getMetricsSummary(startDate30, endDate),
      metricsCollector.getEnergyMetrics(startDate7, endDate),
      metricsCollector.getDeviceStatistics('light-1', startDate30, endDate),
      metricsCollector.getDeviceStatistics('washer-1', startDate30, endDate),
      metricsCollector.getDeviceStatistics('energy-manager-1', startDate30, endDate)
    ]);

    res.json({
      success: true,
      data: {
        last7Days: summary7Days,
        last30Days: summary30Days,
        energyManager: energyMetrics,
        devices: {
          light: lightStats,
          washer: washerStats,
          energyManager: energyManagerStats
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/export", async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || getDateDaysAgo(90);

    const [
      summary,
      commands,
      energyMetrics,
      devices
    ] = await Promise.all([
      metricsCollector.getMetricsSummary(startDate, endDate),
      metricsCollector.getCommandMetrics(startDate, endDate),
      metricsCollector.getEnergyMetrics(startDate, endDate),
      Promise.all([
        metricsCollector.getDeviceStatistics('light-1', startDate, endDate),
        metricsCollector.getDeviceStatistics('washer-1', startDate, endDate),
        metricsCollector.getDeviceStatistics('outlet-1', startDate, endDate),
        metricsCollector.getDeviceStatistics('switch-1', startDate, endDate),
        metricsCollector.getDeviceStatistics('energy-manager-1', startDate, endDate)
      ])
    ]);

    res.json({
      success: true,
      exportDate: new Date().toISOString(),
      period: {
        start: startDate,
        end: endDate
      },
      summary,
      totalCommands: commands.length,
      commands,
      energyManager: energyMetrics,
      devices: {
        'light-1': devices[0],
        'washer-1': devices[1],
        'outlet-1': devices[2],
        'switch-1': devices[3],
        'energy-manager-1': devices[4]
      }
    });
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

module.exports = router;