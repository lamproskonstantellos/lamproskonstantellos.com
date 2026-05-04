# Lampros Personal Website

Static personal website deployed on Railway using Docker + Nginx.

## Local run

```bash
docker build -t lampros-site .
docker run --rm -p 8080:80 lampros-site
```

Open: http://localhost:8080

## Railway deploy (recommended for this repo)

1. Push this repository to GitHub.
2. In Railway, create a new project from this repo.
3. Railway will detect `Dockerfile` and build automatically.
4. Keep **Root Directory** empty (`/`).
5. Do **not** set any Railway Variables for this static site (leave empty, including no `PORT`).
6. Redeploy latest commit.

## Railway troubleshooting checklist

If you see **"Application failed to respond"**, verify these in order:

1. **Service source** points to this repository and correct branch.
2. **Root Directory** is empty (`/`).
3. Deployment logs contain successful Nginx startup.
4. No custom Start Command is set (Dockerfile flow should be used).
5. Cloudflare DNS points to Railway endpoint (if using custom domain).

## Prompt template for fast Railway log debugging

Use this prompt in ChatGPT/Codex when sharing logs:

```text
Act as a Railway deployment debugger for a static website.
I will paste:
1) Build logs
2) Deploy/runtime logs
3) Railway service settings (Root Directory, Build/Start command, Variables)
4) Domain/DNS setup from Cloudflare

Your tasks:
- Identify the single most likely root cause.
- List exact fixes in priority order.
- Give copy-paste Railway settings values.
- Explain how to verify the fix in logs after redeploy.
- If multiple issues exist, separate "blocking" vs "non-blocking".

Project context:
- Static site repo with index.html + /news pages.
- Deployed on Railway.
- Cloudflare used only for DNS/custom domain.
```
