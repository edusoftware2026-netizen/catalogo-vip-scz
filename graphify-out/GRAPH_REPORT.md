# Graph Report - catalogo-vip-scz  (2026-10-16)

## Corpus Check
- 21 files · ~217,466 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 1, .lock 1)

## Summary
- 212 nodes · 466 edges · 9 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e14d98ab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- telegram.ts
- App.tsx
- package.json
- db.ts
- compilerOptions
- dependencies
- devDependencies
- 🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io
- Filosofía Pragmática y Flexible (Ponytail Adaptativo)

## God Nodes (most connected - your core abstractions)
1. `processTelegramUpdate()` - 26 edges
2. `getDb()` - 25 edges
3. `sendMessage()` - 19 edges
4. `getProfileById()` - 16 edges
5. `compilerOptions` - 15 edges
6. `syncProfileToChannel()` - 14 edges
7. `saveProfile()` - 13 edges
8. `getBotConfig()` - 13 edges
9. `saveDb()` - 12 edges
10. `callTelegramApi()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `getDb()`  [EXTRACTED]
  server.ts → src/server/db.ts
- `startServer()` --calls--> `registerBotWebhook()`  [EXTRACTED]
  server.ts → src/server/telegram.ts
- `startServer()` --calls--> `updateBotMenuButton()`  [EXTRACTED]
  server.ts → src/server/telegram.ts
- `ProfileCardProps` --references--> `Profile`  [EXTRACTED]
  src/components/ProfileCard.tsx → src/types.ts
- `ProfileDetailModalProps` --references--> `Profile`  [EXTRACTED]
  src/components/ProfileDetailModal.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.16
Nodes (34): dotenv, startServer(), addAuditLog(), getConversationState(), getProfileById(), saveProfile(), setConversationState(), callTelegramApi() (+26 more)

### Community 1 - "App.tsx"
Cohesion: 0.11
Nodes (28): lucide-react, react, App(), AdminPanel(), AdminPanelProps, AdminTab, AgeModal(), AgeModalProps (+20 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (34): name, private, scripts, build, clean, dev, lint, start (+26 more)

### Community 3 - "db.ts"
Cohesion: 0.13
Nodes (33): addCommissionLog(), addSyncError(), clearConversationState(), CommissionLog, createCustomerRequest(), DATA_DIR, DB_FILE, deleteProfile() (+25 more)

### Community 4 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+7 more)

### Community 5 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, cors, dotenv, express, @google/genai, jsonwebtoken, lucide-react, motion (+7 more)

### Community 6 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/cors, @types/express, @types/jsonwebtoken (+6 more)

### Community 7 - "🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io"
Cohesion: 0.25
Nodes (7): ⚡ Alternativa 1 (Para Pruebas Rápida desde tu PC): Cloudflare Tunnel, 🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io, Comandos útiles para la gestión diaria en Fly.io:, 🛠️ Estructura técnica de Persistencia en Docker, 🚀 Guía de Publicación y Despliegue, 💎 Iam Dani — Catálogo Digital e IA con Telegram Bot (Santa Cruz), Pasos para publicar con la Alternativa 2:

### Community 8 - "Filosofía Pragmática y Flexible (Ponytail Adaptativo)"
Cohesion: 0.29
Nodes (6): 1. Reutilización Inteligente, 2. Claridad y Legibilidad sobre Brevedad Forzada, 3. Alcance Preciso (Anti-Sobreingeniería), 4. Flexibilidad Arquitectónica, 5. Cero Recortes en lo Crítico, Filosofía Pragmática y Flexible (Ponytail Adaptativo)

## Knowledge Gaps
- **15 isolated node(s):** `@google/genai`, `motion`, `@types/cors`, `@types/express`, `@types/jsonwebtoken` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **What connects `@google/genai`, `motion`, `@types/cors` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11470985155195682 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05873015873015873 - nodes in this community are weakly interconnected._
- **Why does `Profile` connect `App.tsx` to `telegram.ts`, `db.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1253968253968254 - nodes in this community are weakly interconnected._