# Lampros Personal Website

Static personal website ready to deploy on Railway.

## Local run

```bash
docker build -t lampros-site .
docker run --rm -p 8080:80 lampros-site
```

Open: http://localhost:8080

## Railway deploy

1. Push this repository to GitHub.
2. In Railway, create a new project from GitHub repo.
3. Railway will detect `Dockerfile` and build automatically.
4. Expose port `80` (already configured by image) and deploy.
