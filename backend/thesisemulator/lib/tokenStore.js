const { db } = require("./firebaseAdmin");
const TOKENS_COL = "oauthTokens";

async function saveTokens({ agentUserId, accessToken, refreshToken, expiresAt }) {
  await db.collection(TOKENS_COL).doc(accessToken).set({
    agentUserId,
    accessToken,
    refreshToken,
    expiresAt,
    createdAt: Date.now(),
  });
}

async function verifyAccessToken(bearerToken) {
  if (!bearerToken) return null;
  const snap = await db.collection(TOKENS_COL).doc(bearerToken).get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (data.expiresAt && Date.now() > data.expiresAt) return null;

  return data;
}

module.exports = { saveTokens, verifyAccessToken };
