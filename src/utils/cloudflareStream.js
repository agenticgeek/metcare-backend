const axios = require('axios');

/**
 * Request a short-lived signed playback token from Cloudflare Stream.
 * @param {string} videoId
 * @returns {Promise<string>}
 */
async function createSignedStreamToken(videoId) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Stream env vars are not configured');
  }

  const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`;

  const { data } = await axios.post(
    url,
    { exp },
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
      validateStatus: () => true,
    }
  );

  if (!data?.success || !data.result?.token) {
    const err = new Error('Cloudflare Stream token request failed');
    err.status = 502;
    err.details = data;
    throw err;
  }

  return data.result.token;
}

module.exports = { createSignedStreamToken };
