const express = require("express");
const metricsCollector = require("../lib/metricsCollector");

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    const startDate = req.query.startDate || defaultStartDate;
    const endDate = req.query.endDate || today;
    
    console.log(`[Metrics API] Getting summary for ${startDate} to ${endDate}`);
    
    const summary = await metricsCollector.getMetricsSummary(startDate, endDate);
    
    return res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[Metrics API] Summary error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`[Metrics API] Getting ${limit} recent events`);
    
    const events = await metricsCollector.getRecentEvents(limit);
    
    return res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('[Metrics API] Events error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/uptime", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    console.log(`[Metrics API] Calculating uptime for last ${days} days`);
    
    const uptime = await metricsCollector.calculateUptime(days);
    
    return res.json({
      success: true,
      data: uptime
    });
  } catch (error) {
    console.error('[Metrics API] Uptime error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    console.log('[Metrics API] Generating dashboard data');
    
    const [summary, uptime, recentEvents] = await Promise.all([
      metricsCollector.getMetricsSummary(startDate, today),
      metricsCollector.calculateUptime(30),
      metricsCollector.getRecentEvents(50)
    ]);
    
    return res.json({
      success: true,
      data: {
        summary,
        uptime,
        recentEvents,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Metrics API] Dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/performance", async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    
    const summary = await metricsCollector.getMetricsSummary(startDate, today);

    const performance = {
      period: `${startDate} to ${today}`,
      deviceCommands: summary.categories.device_commands || {},
      reportState: summary.categories.report_state || {},
      apiRequests: summary.categories.api_requests || {},
    };

    const checks = {
      responseTime: {
        requirement: "95% of requests < 2000ms",
        status: "needs_calculation",
      },
      uptime: {
        requirement: "99.5% uptime",
        actual: (await metricsCollector.calculateUptime(30))?.uptimePercentage,
        status: "checking"
      },
      successRate: {
        requirement: "> 95% success rate",
        actual: summary.categories.device_commands?.successRate,
        status: "checking"
      }
    };
    
    return res.json({
      success: true,
      data: {
        performance,
        thesisRequirements: checks
      }
    });
  } catch (error) {
    console.error('[Metrics API] Performance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;