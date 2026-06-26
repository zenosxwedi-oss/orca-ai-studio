# Orca AI Studio

A multi-page AI creative workspace powered by OrcaRouter — featuring streaming AI chat, image generation, animated video creation, file management, and GitHub export.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ai-studio run dev` — run the frontend (port 22936)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `OPENAI_API_KEY` — OrcaRouter API key (starts with `sk-orca-...`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui + wouter routing
- API: Express 5 + multer (file uploads) + archiver + unzipper
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-studio/src/pages/` — page components (dashboard, chat, images, videos, files, github)
- `artifacts/ai-studio/src/components/` — shared components (layout, code-preview, markdown-renderer)
- `artifacts/api-server/src/routes/` — API routes (chat, images, videos, files, github, dashboard)
- `artifacts/api-server/uploads/` — file storage (files/, images/, videos/, zips/)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/` — auto-generated hooks and Zod schemas

## Architecture decisions

- OrcaRouter is accessed at `https://api.orcarouter.ai/v1/` using `OPENAI_API_KEY` env var
- Chat uses SSE streaming via raw `fetch` on the frontend (not generated hooks)
- Videos are HTML5 canvas animations generated as raw HTML code by the AI; previewed in sandboxed iframes
- `archiver` is CJS-only — imported via `createRequire` to avoid ESM default-import issues in esbuild
- Images and files are stored to disk under `artifacts/api-server/uploads/`; served as static files

## Product

- **AI Chat** — streaming chat with model selector (DeepSeek, GPT-4o, Claude, Gemini). Code blocks with syntax highlighting, live HTML preview iframe.
- **Image Studio** — generate DALL-E 3 images with size and style controls. Gallery with download/delete.
- **Video Studio** — generate 30s/60s HTML5 canvas animations. Preview in iframe, download as `.html`.
- **File Manager** — drag-and-drop upload, ZIP/TAR extraction, multi-select download as ZIP, delete.
- **GitHub Export** — push selected files to any GitHub repo with a personal access token.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always use `createRequire` for CJS-only packages like `archiver` in ESM esbuild targets.
- File upload field name must be `"file"` (multer config in `files.ts`).
- Chat streaming: POST to `/api/chat/stream`, reads SSE `data: {...}` lines, extracts `choices[0].delta.content`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
