FROM node:20-alpine

WORKDIR /app

# Install from the committed lockfile (reproducible, fails on drift). Dev
# dependencies (esbuild, sharp) are needed for the in-image build below, so the
# install runs before NODE_ENV=production is set.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# The server itself has zero runtime dependencies.
CMD ["npm", "start"]
