const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../lib/firebaseAdmin");
const router = express.Router();

const CODES_COL = "oauthCodes";
const DEMO_AGENT_USER_ID = "user-1";

router.get("/authorize", async (req, res) => {
  const { redirect_uri, state, client_id } = req.query;
  const code = uuidv4();

  await db.collection(CODES_COL).doc(code).set({
    code,
    clientId: client_id,
    redirectUri: redirect_uri,
    agentUserId: DEMO_AGENT_USER_ID,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  return res.redirect(url.toString());
});

module.exports = router;