# Graph Report - catalogo-vip-scz  (2026-10-17)

## Corpus Check
- 25 files · ~224,040 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 1, .lock 1)

## Summary
- 228 nodes · 495 edges · 10 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1784a29d`
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
- scripts

## God Nodes (most connected - your core abstractions)
1. `processTelegramUpdate()` - 29 edges
2. `getDb()` - 26 edges
3. `sendMessage()` - 19 edges
4. `getProfileById()` - 18 edges
5. `syncProfileToChannel()` - 15 edges
6. `compilerOptions` - 15 edges
7. `getBotConfig()` - 14 edges
8. `saveProfile()` - 12 edges
9. `callTelegramApi()` - 12 edges
10. `react` - 11 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `getDb()`  [EXTRACTED]
  server.ts → src/server/db.ts
- `startServer()` --calls--> `registerBotCommands()`  [EXTRACTED]
  server.ts → src/server/telegram.ts
- `startServer()` --calls--> `registerBotWebhook()`  [EXTRACTED]
  server.ts → src/server/telegram.ts
- `startServer()` --calls--> `updateBotMenuButton()`  [EXTRACTED]
  server.ts → src/server/telegram.ts
- `ProfileCardProps` --references--> `Profile`  [EXTRACTED]
  src/components/ProfileCard.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.16
Nodes (39): startServer(), addAuditLog(), addSyncError(), clearConversationState(), getConversationState(), getProfileById(), getSystemSetting(), saveProfile() (+31 more)

### Community 1 - "App.tsx"
Cohesion: 0.10
Nodes (28): lucide-react, react, react-dom, App(), AdminPanel(), AdminPanelProps, AdminTab, AgeModal() (+20 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (35): name, private, type, version, autoprefixer, cors, dotenv, esbuild (+27 more)

### Community 3 - "db.ts"
Cohesion: 0.13
Nodes (31): addCommissionLog(), CommissionLog, createCustomerRequest(), DATA_DIR, DB_FILE, deleteProfile(), getAllProfiles(), getAuditLogs() (+23 more)

### Community 4 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+7 more)

### Community 5 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, cors, dotenv, express, @google/genai, jsonwebtoken, @libsql/client, lucide-react (+8 more)

### Community 6 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/cors, @types/express, @types/jsonwebtoken (+6 more)

### Community 7 - "🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io"
Cohesion: 0.25
Nodes (7): ⚡ Alternativa 1 (Para Pruebas Rápida desde tu PC): Cloudflare Tunnel, 🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io, Comandos útiles para la gestión diaria en Fly.io:, 🛠️ Estructura técnica de Persistencia en Docker, 🚀 Guía de Publicación y Despliegue, 💎 Iam Dani — Catálogo Digital e IA con Telegram Bot (Santa Cruz), Pasos para publicar con la Alternativa 2:

### Community 8 - "Filosofía Pragmática y Flexible (Ponytail Adaptativo)"
Cohesion: 0.29
Nodes (6): 1. Reutilización Inteligente, 2. Claridad y Legibilidad sobre Brevedad Forzada, 3. Alcance Preciso (Anti-Sobreingeniería), 4. Flexibilidad Arquitectónica, 5. Cero Recortes en lo Crítico, Filosofía Pragmática y Flexible (Ponytail Adaptativo)

### Community 9 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, clean, dev, lint, start

## Knowledge Gaps
- **15 isolated node(s):** `motion`, `sql.js`, `@types/cors`, `@types/express`, `@types/jsonwebtoken` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **What connects `motion`, `sql.js`, `@types/cors` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10121951219512196 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05647840531561462 - nodes in this community are weakly interconnected._
- **Why does `@libsql/client` connect `package.json` to `db.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1265597147950089 - nodes in this community are weakly interconnected._