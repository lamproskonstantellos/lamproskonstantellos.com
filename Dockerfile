FROM nginx:alpine

# Serve the full static website (home + /news pages + assets)
COPY . /usr/share/nginx/html

EXPOSE 80
