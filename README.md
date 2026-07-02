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

## Access & security

The local `raph studio` server binds to loopback and only answers requests whose
`Host` is `localhost`/`127.0.0.1` (this blocks DNS-rebinding). It exposes its API
to the browser only for:

- any **loopback** origin (this dashboard on `localhost`, including a local dev
  build on any port), and
- the hosted dashboard at `https://raph-studio.pages.dev`.

Requests from any other website are refused, so a page you happen to be visiting
can't read or wipe your graph. If you self-host the dashboard at a different
origin, allow it explicitly when starting the server:

```bash
RAPH_STUDIO_ALLOWED_ORIGINS="https://studio.example.com" raph studio
```

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
