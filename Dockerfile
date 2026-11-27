# Glama builds this image and talks to the process over stdio.
# initialize and tools/list succeed with no CLEARRUN_API_KEY.
# clearrun_score, clearrun_evaluate, and clearrun_chat return an error until a key is set.
# clearrun_verify does not read the key. No key is baked into the image.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core-types/package.json packages/core-types/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/mcp/package.json packages/mcp/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/security/package.json packages/security/package.json
COPY packages/vendors/package.json packages/vendors/package.json

RUN npm ci

COPY tsconfig.json ./
COPY scripts/build_package.js scripts/build_package.js
COPY packages/core-types/tsconfig.json packages/core-types/tsconfig.json
COPY packages/core-types/src packages/core-types/src
COPY packages/sdk/tsconfig.json packages/sdk/tsconfig.json
COPY packages/sdk/src packages/sdk/src
COPY packages/mcp/tsconfig.json packages/mcp/tsconfig.json
COPY packages/mcp/src packages/mcp/src

RUN npm run build -w @clearrun/mcp \
 && npm cache clean --force

ENV HOME=/home/node
USER node

ENTRYPOINT ["node", "packages/mcp/dist/index.js"]
