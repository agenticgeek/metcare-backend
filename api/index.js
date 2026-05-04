/**
 * Vercel serverless entry: routes all traffic to Express (see vercel.json rewrites).
 * Local dev still uses `npm run dev` → src/server.js.
 */
const app = require('../src/app');

module.exports = app;
