// Vercel serverless function: hands out short-lived Cloudflare TURN relay logins for online co-op (js/net.js), so the
// secret key never reaches the browser. The relay is only used on networks that block direct links between players
// (school or work Wi-Fi, phone hotspots). Needs two environment variables on the Vercel project:
//   CF_TURN_KEY_ID      the TURN key's id        CF_TURN_API_TOKEN   the key's API token
// Without them it answers 503 and the game uses plain STUN instead (fine on most home networks).
// CommonJS on purpose: package.json has no "type": "module", and the game itself uses no modules.

module.exports = async function handler(req, res){
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  res.setHeader('Cache-Control', 'no-store');
  if (!id || !token){ res.status(503).json({ error: 'TURN is not configured' }); return; }
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 3 * 3600 }),   // a session lasts an hour or two
    });
    if (!r.ok){ res.status(502).json({ error: 'TURN provider refused' }); return; }
    const { iceServers } = await r.json();
    // port 53 is blocked by browsers and makes the connection wait for a timeout
    const clean = [].concat(iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) }));
    res.status(200).json({ iceServers: clean });
  } catch(e){ res.status(502).json({ error: 'TURN request failed' }); }
};
