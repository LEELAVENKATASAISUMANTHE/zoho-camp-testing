FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production
EXPOSE 3000

CMD ["server.js"]