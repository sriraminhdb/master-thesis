const express = require("express");
const oauthRoutes = require("./routes/oauth");
const tokenRoutes = require("./routes/token");
const smarthomeRoutes = require("./routes/smarthome");
const testRoutes = require("./routes/test");
const metricsRoutes = require("./routes/metrics");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.use("/oauth", oauthRoutes);
app.use("/token", tokenRoutes);
app.use("/smarthome", smarthomeRoutes);
app.use("/test", testRoutes);
app.use("/metrics", metricsRoutes);

module.exports = app;