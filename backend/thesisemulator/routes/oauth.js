const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../lib/firebaseAdmin");
const { saveTokens } = require("../lib/tokenStore");
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

async function consumeAuthCode({ code, clientId, redirectUri }) {
  const ref = db.collection(CODES_COL).doc(code);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (Date.now() > data.expiresAt) return null;
  if (data.clientId !== clientId) return null;
  if (data.redirectUri !== redirectUri) return null;

  await ref.delete();
  return data;
}

router.post("/token", async (req, res) => {
  try {
    const {
      grant_type,
      code,
      refresh_token,
      client_id,
      client_secret,
      redirect_uri,
    } = req.body;

    if (client_id !== "washer-client" || client_secret !== "super-secret") {
      return res.status(401).json({ error: "invalid_client" });
    }

    if (grant_type === "authorization_code") {
      const consumed = await consumeAuthCode({
        code,
        clientId: client_id,
        redirectUri: redirect_uri,
      });

      if (!consumed) {
        return res.status(400).json({ error: "invalid_grant" });
      }

      const accessToken = uuidv4();
      const refreshToken = uuidv4();
      const expiresIn = 3600;

      await saveTokens({
        agentUserId: consumed.agentUserId,
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return res.json({
        token_type: "bearer",
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      });
    }

    if (grant_type === "refresh_token") {
      if (!refresh_token) {
        return res.status(400).json({ error: "invalid_request" });
      }
      const accessToken = uuidv4();
      const expiresIn = 3600;

      await saveTokens({
        agentUserId: DEMO_AGENT_USER_ID,
        accessToken,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return res.json({
        token_type: "bearer",
        access_token: accessToken,
        expires_in: expiresIn,
      });
    }

    return res.status(400).json({ error: "unsupported_grant_type" });
  } catch (e) {
    console.error('[OAuth] Token error:', e);
    return res.status(500).json({ error: "server_error" });
  }
});

module.exports = router;