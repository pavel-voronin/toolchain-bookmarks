# check=skip=FromPlatformFlagConstDisallowed
FROM --platform=linux/amd64 node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    curl \
    gnupg \
    wget \
  && rm -rf /var/lib/apt/lists/*

RUN wget -q -O /tmp/google-chrome.pub https://dl.google.com/linux/linux_signing_key.pub \
  && gpg --batch --yes --dearmor -o /usr/share/keyrings/google-chrome.gpg /tmp/google-chrome.pub \
  && rm -f /tmp/google-chrome.pub \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY package-lock.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY vite.config.ts ./
COPY SKILL.md ./
COPY src ./src
RUN npm install --include=dev && npm run build && npm prune --omit=dev

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
