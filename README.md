# raph-studio

A live, hosted dashboard for your local [raph](https://github.com/tesh254/raph)
knowledge graph — a graph explorer, search, stats, and a near-realtime feed of
what agents and the sync worker are doing. Built with Next.js (static export)
and deployed to Cloudflare Pages.

The app is fully client-side: it talks to your **local** `raph studio` server
(default `http://localhost:4545`) from the browser, so your code and graph never
leave your machine.

## Use it

```bash
# in your project, with raph installed:
raph studio            # starts the local API at http://localhost:4545
```

Then open the hosted dashboard (or run it locally) and point it at your local
server. The API URL is editable in the top bar and persisted locally.

## Develop

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static export in out/
```

Set `NEXT_PUBLIC_RAPH_API` to change the default API URL at build time.

## Deploy

Pushes to `main` deploy to Cloudflare Pages via GitHub Actions. Set repository
secrets `CLOUDFLARE_API_TOKEN` (Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`. The
Pages project is `raph-studio` (see `wrangler.toml`). Manual deploy:

```bash
npm run build && npx wrangler pages deploy out --project-name=raph-studio
```
