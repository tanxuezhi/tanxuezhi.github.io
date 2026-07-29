# Dynamic Scholar API

This Cloudflare Worker provides the dynamic data layer for the academic website while GitHub Pages continues to serve the public profile at `https://tanxuezhi.github.io`.

## What it does

- keeps the latest successful Scholar snapshot in Cloudflare KV;
- refreshes the snapshot daily using a Cron Trigger;
- serves `GET /api/v1/stats`, `GET /api/v1/publications`, and `GET /api/v1/health`;
- falls back to the GitHub Pages snapshot if Google Scholar temporarily rejects an automated request.

## One-time Cloudflare setup

1. Sign in to Cloudflare and install Wrangler: `npm install -g wrangler`.
2. In this directory, run `wrangler kv namespace create SCHOLAR_CACHE`.
3. Copy the returned namespace ID into `wrangler.toml` in place of `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
4. Run `wrangler deploy` and copy the resulting `https://…workers.dev` URL.
5. Put that URL in `data/runtime-config.json` as `scholar_api_base`, then publish the website repository.

The public site continues to work if the Worker is unavailable: it falls back to the last verified repository snapshot.
