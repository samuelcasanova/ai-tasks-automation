# Debian rather than Alpine: Claude Code's native binary is built for glibc.
FROM node:26.13.0-slim

ARG CLAUDE_CODE_VERSION=2.1.317
# The container runs read-only, so Claude Code can never update itself; versions move with this file.
ENV DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
 && npm cache clean --force \
 && claude --version

WORKDIR /app
COPY package.json ./
COPY src ./src

USER node
CMD ["node", "src/main.js"]
