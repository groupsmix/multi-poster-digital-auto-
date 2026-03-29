# NEXUS — Complete System Architecture v2.0
### Personal AI Business Engine · Full Specification
> Built for: Personal use · Cloudflare $5/month plan · Zero paid AI to start

---

## PART 1 — INFRASTRUCTURE (FULL CLOUDFLARE $5/MONTH EXPLOITATION)

### Real Plan Limits — What You Actually Get

| Service | Monthly Allowance | Cost if Exceeded | NEXUS Usage |
|---------|------------------|-----------------|-------------|
| **Workers requests** | 10,000,000 | $0.50/extra 1M | ~10K/month for personal use. You have 990x headroom. |
| **KV reads** | 10,000,000 | $0.50/extra 1M | Config lookups. Essentially unlimited for personal use. |
| **KV writes/deletes** | 1,000,000 | $5.00/extra 1M | Only on config changes. Will never exceed. |
| **KV storage** | 1 GB | $0.50/GB | Prompts + platform rules = ~5MB total. |
| **R2 storage** | 10 GB | $0.015/GB | PDFs, images, audio. Hundreds of products before paying. |
| **R2 reads** | 10,000,000 | $0.36/extra 1M | Serving files. Essentially unlimited. |
| **R2 writes** | 1,000,000 | $4.50/extra 1M | Saving generated files. Will never exceed personally. |
| **R2 egress** | ∞ UNLIMITED | $0 always | No bandwidth bill. Ever. |
| **D1 storage** | 5 GB | pay/GB after | Products + history. Years before hitting limit. |
| **Workflows instances** | Unlimited sleeping | — | Every product = 1 instance. Sleeps free between steps. |
| **Workflows steps/instance** | 10,000 default | up to 25,000 | Max NEXUS workflow = ~15 steps. 666x headroom. |
| **Workflows concurrent** | 10,000 running | — | You run 1 at a time personally. |
| **Pages hosting** | Unlimited | $0 | Frontend. Always free. |
| **Service Bindings** | Free internal calls | $0 | Worker-to-Worker = counted as 1 request, not many. |

**Bottom line: For personal use, your bill will never go above $5/month. Ever.**

---

### The 4 Rules to Exploit Every Limit

**Rule 1 — KV for all reads, D1 only for writes**

KV gives 10M reads/month free. Every dashboard page load, every AI config check,
every prompt lookup = KV read (fast + free). D1 only used for records that change
(workflow state, product data, review history).

```
KV stores  → platform rules, prompts, AI model registry, social rules, settings
D1 stores  → products, workflow runs, steps, reviews, assets, revision history
```

**Rule 2 — CF Workflows instead of Durable Objects**

CF Workflows is built on top of Durable Objects but designed exactly for
multi-step AI workflows. Each product run = 1 Workflow instance.
It sleeps for free between steps while waiting for AI API responses.
You only pay (in compute time) for the milliseconds it's actually running.
10,000 steps per instance = your 9-step workflow has 1,111x headroom.

**Rule 3 — Service Bindings for free internal routing**

Split NEXUS into specialized Workers connected via Service Bindings.
Internal calls between Workers = counted as ONE request (not multiple).
This means your 9-step workflow = 1 inbound request + free internal routing.

```
Worker: nexus-router      ← receives all dashboard requests (1 request counted)
  └─ Service Binding →  Worker: nexus-ai       (free internal)
  └─ Service Binding →  Worker: nexus-workflow  (free internal)
  └─ Service Binding →  Worker: nexus-storage   (free internal)
  └─ Service Binding →  Worker: nexus-variation (free internal)
```

**Rule 4 — R2 for all files, zero egress cost**

R2 has no egress fees. Ever. Every image, PDF, audio file, export — stored in R2,
served directly to your browser for free. No bandwidth bill regardless of file size.

---

### Full Infrastructure Map (Exploiting Every Feature)

```
┌──────────────────────────────────────────────────────────────────┐
│                   NEXUS — CLOUDFLARE $5/MONTH                     │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  CF PAGES — Dashboard UI (Next.js)          FREE ALWAYS     │  │
│  └───────────────────────┬─────────────────────────────────────┘  │
│                          │ HTTP requests                           │
│  ┌───────────────────────▼─────────────────────────────────────┐  │
│  │  WORKER: nexus-router (Hono.js)                             │  │
│  │  Routes: /api/workflow, /api/products, /api/review, etc.    │  │
│  │  10M requests/month included — personal use = ~10K/month    │  │
│  └──┬────────────────┬──────────────────┬──────────────────────┘  │
│     │Service Binding │Service Binding   │Service Binding           │
│     │(free internal) │(free internal)   │(free internal)           │
│  ┌──▼────────┐  ┌────▼──────────┐  ┌───▼───────────────────────┐  │
│  │ WORKER:   │  │ WORKER:       │  │ WORKER:                   │  │
│  │ nexus-ai  │  │ nexus-        │  │ nexus-variation           │  │
│  │           │  │ workflow      │  │                           │  │
│  │ Failover  │  │ Calls CF      │  │ Platform variation engine │  │
│  │ engine    │  │ Workflows API │  │ Social adaptation engine  │  │
│  │ AI router │  │               │  │                           │  │
│  └──┬────────┘  └────┬──────────┘  └───┬───────────────────────┘  │
│     │               │                  │                           │
│     │        ┌──────▼──────────────────▼──┐                       │
│     │        │  CF WORKFLOWS               │                       │
│     │        │  One instance per product   │                       │
│     │        │  Sleeps free between steps  │                       │
│     │        │  10,000 steps/instance      │                       │
│     │        │  State survives tab close   │                       │
│     │        └─────────────────────────────┘                       │
│     │                                                              │
│  ┌──▼──────────────────────────────────────────────────────────┐  │
│  │  STORAGE LAYER                                               │  │
│  │                                                              │  │
│  │  KV ──────── Platform rules, prompts, AI registry           │  │
│  │              Settings, social channel rules                  │  │
│  │              10M reads/month free · ~5MB total used          │  │
│  │                                                              │  │
│  │  D1 ──────── Products, workflow runs, steps, reviews         │  │
│  │              Assets metadata, revision history               │  │
│  │              5GB included · personal use = ~50MB/year        │  │
│  │                                                              │  │
│  │  R2 ──────── PDFs, images, audio, exports, mockups          │  │
│  │              10GB included · ZERO egress fee ever            │  │
│  │                                                              │  │
│  │  CF Images ─ Image CDN, resize, transform, optimize         │  │
│  │                                                              │  │
│  │  Secrets ─── All AI API keys, encrypted at rest             │  │
│  │              Add key → AI activates. Remove → sleeps.        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

### How a Full Product Workflow Runs (Exploiting CF Workflows)

```
Dashboard click: START WORKFLOW
        │
        ▼ (1 HTTP request — counts as 1 of your 10M/month)
nexus-router Worker receives request
        │
        ▼ (Service Binding — FREE, not counted)
nexus-workflow Worker creates Workflow instance in CF Workflows
        │
        ▼
CF Workflow instance starts — persists in Durable Object storage
        │
   ┌────┴──────────────────────────────────────────────┐
   │  STEP 1: Research                                  │
   │  → nexus-ai (Service Binding, free)                │
   │  → Failover engine picks AI, calls external API   │
   │  → Result saved to D1                             │
   │  → Workflow SLEEPS (zero cost while sleeping)      │
   └────┬──────────────────────────────────────────────┘
        │ (wakes when step complete)
   ┌────┴──────────────────────────────────────────────┐
   │  STEP 2: Content Generation                        │
   │  → nexus-ai → AI call → result to D1              │
   │  → Workflow SLEEPS again                           │
   └────┬──────────────────────────────────────────────┘
        │
   [... steps 3-8 same pattern ...]
        │
   ┌────┴──────────────────────────────────────────────┐
   │  STEP 9: Platform Variation                        │
   │  → nexus-variation (Service Binding, free)         │
   │  → Generates variant per platform                 │
   │  → Files uploaded to R2                           │
   │  → Images stored in CF Images                     │
   └────┬──────────────────────────────────────────────┘
        │
        ▼
Workflow marks status: PENDING_REVIEW in D1
Dashboard polls D1 → shows CEO Review screen
        │
   APPROVE → Published records written to D1 ✓
   REJECT  → Feedback stored in D1 → Workflow restarts failed steps only
```

**Tab close mid-workflow?** CF Workflows persists. When you reopen → workflow
already finished. Results waiting in review screen.

---

### Deletion Flow (Dashboard → All Cloudflare Services Synced)

```
You click DELETE (product, asset, domain, category, anything)
        │
        ▼ (1 request → nexus-router)
        │
   ┌────┴────────────────────────────────────────────────┐
   │  nexus-storage Worker (Service Binding, free)        │
   │                                                      │
   │  DELETE from D1     → removes all product rows       │
   │  DELETE from R2     → removes all files/assets       │
   │  DELETE from KV     → removes cached config          │
   │  DELETE from CF Images → removes image CDN entry     │
   │  All 4 run in PARALLEL (Promise.all) — fast          │
   └────┬────────────────────────────────────────────────┘
        │
        ▼
Dashboard confirms: deleted ✓
Nothing orphaned. Everything synced.
```

---

### Workers Split (4 Specialized Workers via Service Bindings)

| Worker | Job | Why separate |
|--------|-----|-------------|
| `nexus-router` | Hono.js API router, auth check, request validation | Entry point. Thin and fast. |
| `nexus-ai` | Failover engine, AI model registry, all external AI calls | Isolated. If AI call hangs, doesn't block router. |
| `nexus-workflow` | CF Workflows management, step orchestration, status updates | Stateful. Needs its own context. |
| `nexus-variation` | Platform variation engine, social adaptation, humanizer | CPU-heavy rewrites, isolated from main flow. |
| `nexus-storage` | All R2, D1, KV, CF Images operations | One place for all storage. Easy to maintain. |

All connected via Service Bindings — zero extra request cost between them.

---

## PART 2 — DASHBOARD NAVIGATION STRUCTURE

### Screen 1: Home — Big Domain Cards

First thing you see when you open the dashboard.
Each card is a big domain. Nothing else.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Digital    │  │     POD      │  │   Content    │
│   Products   │  │ Print on Dem │  │  & Media     │
│      →       │  │      →       │  │      →       │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Freelance   │  │  Affiliate   │  │  E-Commerce  │
│   Services   │  │  Marketing   │  │  & Retail    │
│      →       │  │      →       │  │      →       │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Knowledge   │  │  Specialized │  │  Automation  │
│  & Education │  │  Technology  │  │  & No-Code   │
│      →       │  │      →       │  │      →       │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐
│  + Add New   │  ← Add custom domain anytime
│   Domain     │
└──────────────┘
```

### Screen 2: Domain Opened → Category Cards

Click any domain → see its categories as cards.
Example: Digital Products clicked:

```
← Digital Products

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Notion     │  │    PDFs &    │  │   Courses &  │
│  Templates   │  │   Guides     │  │  E-Learning  │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Planners   │  │  Prompt      │  │  SaaS        │
│ & Calendars  │  │  Libraries   │  │  Templates   │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Checklists  │  │  Spreadsheet │  │  + Add New   │
│  & Trackers  │  │  Templates   │  │  Category    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Screen 3: Category Opened → Product Setup Form

Click a category → the product setup form appears.
Every field is OPTIONAL. If you leave it empty, AI fills it.

```
← Digital Products › Notion Templates

┌─────────────────────────────────────────────────────┐
│  PRODUCT SETUP                                       │
│                                                      │
│  Language          [English ▼] [+ Add Language]      │
│                                                      │
│  Niche (optional)  [________________________]        │
│                    e.g. "freelancers", "students"    │
│                                                      │
│  Product Name      [________________________]        │
│  (optional)        e.g. "Freelancer CRM System"     │
│                                                      │
│  Description       [________________________]        │
│  (optional)        e.g. "tracks clients + invoices" │
│                                                      │
│  Keywords          [________________________]        │
│  (optional)        e.g. "notion, freelance, crm"    │
│                                                      │
│  ─────────────── PLATFORMS ───────────────           │
│                                                      │
│  Post to:  [✓Etsy] [✓Gumroad] [Payhip] [Shopify]   │
│            [Amazon KDP] [TikTok Shop] [+Add]        │
│                                                      │
│  ─────────────── SOCIAL MEDIA ────────────           │
│                                                      │
│  Post to social?  [Yes ●] [No ○]                    │
│                                                      │
│  Select channels: [✓Instagram] [✓TikTok] [X/Twitter]│
│                   [Pinterest] [LinkedIn] [YouTube]   │
│                   [Facebook] [+Add Channel]          │
│                                                      │
│  Posting mode:    [Auto ○] [Manual ●]               │
│  (overrides global setting for this product)        │
│                                                      │
│  ─────────────── AI OPTIONS ──────────────           │
│                                                      │
│  Price suggestion    [✓ Let AI decide]              │
│  Target audience     [✓ Let AI decide]              │
│  Design style        [✓ Let AI decide]              │
│                                                      │
│  [  START WORKFLOW  ]  [  SAVE AS DRAFT  ]          │
└─────────────────────────────────────────────────────┘
```

**Rule**: Every field is optional.
If filled → AI uses your input as direction.
If empty → AI researches and decides everything itself.

---

## PART 3 — ALL DOMAINS AND THEIR CATEGORIES

Everything configurable from dashboard. Add/edit/delete any domain, category, or sub-item.

### Domain 1: Digital Products
- Notion Templates
- PDF Guides & Ebooks
- Planners & Calendars
- Courses & E-Learning Modules
- Prompt Libraries
- SaaS Templates
- Checklists & Trackers
- Spreadsheet Templates
- AI Tool Kits
- Storybooks & Kids Books

### Domain 2: Print on Demand (POD)
- T-Shirts & Apparel
- Mugs & Drinkware
- Posters & Wall Art
- Phone Cases
- Tote Bags
- Stickers & Decals
- Hoodies & Sweatshirts
- Home Decor
- Notebooks & Journals
- Hats & Accessories

### Domain 3: Content & Media
- Video Making (Scripts, Shorts, YouTube)
- Music Making (Loops, Intros, Sonic Logos)
- Podcast Content (Episodes, Show Notes)
- Animation Scripts
- Stock Photography Concepts
- 3D Asset Descriptions
- B-roll Organization
- Visual Asset Packs

### Domain 4: Freelance Services
- Software Development (Web, SaaS, API)
- Technical Writing (Docs, White Papers)
- SEO & Digital Marketing Audits
- Legal & Compliance (Contracts, Policies)
- Business Operations (SOPs, Workflows)
- UI/UX Design Briefs
- Database Architecture
- Mobile App Development

### Domain 5: Affiliate Marketing
- Software Comparison Articles
- Product Review Posts
- Top 10 Roundups
- Buying Guides
- Deal & Discount Newsletters
- Niche Blog Posts
- YouTube Script Reviews
- Email Sequences

### Domain 6: E-Commerce & Retail
- Dropshipping Product Research
- Amazon FBA Listings
- Shopify Store Setup
- Inventory Management SOPs
- Marketplace Optimization
- Product Bundle Creation
- Supplier Research

### Domain 7: Knowledge & Education
- Online Course Creation
- Workshop Materials
- Paid Newsletter Content
- Skill Certification Modules
- Coaching Plans (Fitness, Finance)
- Study Guides
- Training Manuals

### Domain 8: Specialized Technology
- AI Implementation Plans
- Cybersecurity Audit Reports
- Real Estate Listing Automation
- HealthTech Wellness Content
- No-Code Tool Builds
- PropTech Lead Systems

### Domain 9: Automation & No-Code
- Zapier/Make Workflow Designs
- n8n Automation Blueprints
- Airtable/Notion System Builds
- API Integration Docs
- Chatbot Flow Design
- CRM Automation Plans

### Domain 10: Space & Innovation
- Space Tourism Content
- Satellite Data Reports
- Space Merchandise Concepts
- Aerospace Research Briefs

---

## PART 4 — THE WORKFLOW ENGINE

### How Every Workflow Runs

```
You click START WORKFLOW
         │
         ▼
Cloudflare Worker creates workflow record in D1
         │
         ▼
Durable Object spins up → manages the entire workflow state
         │
         ▼
Queues sends each step to a Worker asynchronously
         │
    STEP 1 ──→ STEP 2 ──→ STEP 3 ──→ ... ──→ STEP N
         │
         ▼
Every step result saved to D1 in real time
         │
         ▼
Dashboard shows live progress via polling
         │
         ▼
Final output assembled → status: PENDING_REVIEW
         │
         ▼
CEO Review Screen appears
         │
    APPROVE ──→ Platform Variation Engine ──→ Social Engine ──→ DONE
         │
    REJECT  ──→ Feedback form ──→ back to AI ──→ regenerate ──→ Review again
```

### Workflow Status System

Every workflow and every step has a status stored in D1:

| Status | Meaning |
|--------|---------|
| `queued` | Waiting to start |
| `running` | Currently executing |
| `waiting_fallback` | Primary AI failed, switching to next |
| `completed` | Step done successfully |
| `failed` | All AIs in chain failed |
| `pending_review` | Waiting for CEO approval |
| `approved` | CEO approved |
| `rejected` | CEO rejected, needs revision |
| `in_revision` | AI re-working based on feedback |
| `published` | Posted to platform(s) |

---

## PART 5 — THE AI FAILOVER ENGINE

### The Core Rule

Every task has a ranked list of AIs.
The engine tries #1. If it fails for any reason → sleeps it → tries #2 → and so on.
If an AI has no API key → automatically skipped, no error.
When a limit resets → that AI wakes back up automatically.

### Failover Logic (TypeScript)

```typescript
// src/ai-engine/failover.ts

interface AIModel {
  id: string
  name: string
  apiKeyEnvName: string        // name of the secret in CF Secrets Store
  status: 'active' | 'sleeping' | 'rate_limited' | 'no_key'
  rateLimitResetAt?: number   // unix timestamp
  dailyLimitResetAt?: number  // unix timestamp (usually midnight)
}

export async function runWithFailover(
  taskType: string,
  prompt: string,
  env: Env
): Promise<string> {

  const models = TASK_MODEL_REGISTRY[taskType]

  for (const model of models) {

    // No API key configured → skip silently
    const apiKey = env[model.apiKeyEnvName]
    if (!apiKey) {
      console.log(`[SKIP] ${model.name} — no API key`)
      continue
    }

    // Rate limited → check if reset time passed
    if (model.status === 'rate_limited') {
      const now = Date.now()
      if (model.rateLimitResetAt && now < model.rateLimitResetAt) {
        console.log(`[SLEEP] ${model.name} — rate limited`)
        continue
      }
      model.status = 'active' // limit reset, wake up
    }

    // Daily limit hit → check if midnight passed
    if (model.status === 'sleeping') {
      const now = Date.now()
      if (model.dailyLimitResetAt && now < model.dailyLimitResetAt) {
        console.log(`[SLEEP] ${model.name} — daily limit`)
        continue
      }
      model.status = 'active' // new day, wake up
    }

    try {
      const result = await callAI(model, apiKey, prompt)
      console.log(`[OK] ${model.name} succeeded`)
      return result

    } catch (err: any) {
      if (err.status === 429) {
        // Rate limit → sleep for 1 hour
        model.status = 'rate_limited'
        model.rateLimitResetAt = Date.now() + 3600_000
        console.log(`[LIMIT] ${model.name} → sleep 1hr`)
      } else if (err.status === 402 || err.code === 'QUOTA_EXCEEDED') {
        // Daily quota → sleep until midnight
        const midnight = new Date()
        midnight.setHours(24, 0, 0, 0)
        model.status = 'sleeping'
        model.dailyLimitResetAt = midnight.getTime()
        console.log(`[QUOTA] ${model.name} → sleep until midnight`)
      } else {
        console.log(`[ERR] ${model.name}: ${err.message}`)
      }
      continue // try next model
    }
  }

  throw new Error(`All AIs failed for task: ${taskType}`)
}
```

---

## PART 6 — AI ASSIGNMENTS PER TASK TYPE

**Status**: 🟢 Active (free/cheap) | 🔴 Sleeping (add key to activate)

Every AI is chosen because it is objectively the strongest for that specific job.
Not random. Not marketing. The actual best tool per task.

---

### RESEARCH TASKS (used by ALL domains)

**Web Trend Research** — Find what's selling, what's trending, competitor analysis

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Tavily Search | tavily.com | Purpose-built for AI agents. Returns clean structured web data. | 🟢 |
| 2 | Exa Neural Search | exa.ai | Finds by meaning not keywords. Discovers emerging niches. | 🟢 |
| 3 | SerpAPI | serpapi.com | Raw Google results. Reliable backup for trend data. | 🟢 |
| 4 | DeepSeek-V3 | deepseek.com | Reasoning fallback when search APIs hit limits. | 🟢 |

**Keyword & SEO Research** — Volume, competition, buyer intent

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DataForSEO | dataforseo.com | Most accurate keyword volume + difficulty data. | 🟢 |
| 2 | SerpAPI | serpapi.com | See exactly what pages rank and why. | 🟢 |
| 3 | Qwen 3.5 Flash | SiliconFlow | Cheapest reasoning fallback for keyword clustering. | 🟢 |

**Document/PDF Parsing** — Reading uploaded client briefs, PDFs, docs

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Mistral OCR | mistral.ai | Free tier. Best open OCR for documents. | 🟢 |
| 2 | Tesseract OCR | local/HF | Open source. Free. No limits. Handles most formats. | 🟢 |
| 3 | Google Vision OCR | google.com | Free tier 1000 units/month. Very accurate. | 🟢 |
| 4 | Unstructured.io | unstructured.io | Converts any doc format to clean AI-ready text. | 🟢 |

---

### WRITING & CONTENT TASKS

**Long-form Writing** — Articles, guides, ebooks, course content (2000-5000 words)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-V3 | deepseek.com | Best free long-form quality. Avoids robotic patterns. | 🟢 |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong long-form. Especially good for technical topics. | 🟢 |
| 3 | Doubao 1.5 Pro | SiliconFlow | ByteDance model. Most human-like narrative flow. | 🟢 |
| 4 | Kimi k1.5 | moonshot.cn | 10M token context. Never loses track on long docs. | 🟢 |
| 5 | Claude Sonnet 4.5 | anthropic.com | Best quality writing on the market. | 🔴 |
| 6 | GPT-5.4 | openai.com | Top-tier long-form. | 🔴 |

**Short Copywriting** — Product titles, descriptions, sales copy, hooks

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-V3 | deepseek.com | Best free persuasive copywriting. Understands conversion. | 🟢 |
| 2 | Doubao 1.5 Pro | SiliconFlow | TikTok AI. Naturally writes viral hooks. | 🟢 |
| 3 | Qwen 3.5 Max | SiliconFlow | Strong at adapting tone per audience. | 🟢 |
| 4 | Claude Sonnet 4.5 | anthropic.com | Best copywriter in AI world. | 🔴 |

**SEO Formatting** — Titles, meta descriptions, tags (constrained, precise output)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Qwen 3.5 Flash | SiliconFlow | Fastest + best at constrained output. $0.05/1M tokens. | 🟢 |
| 2 | DeepSeek-V3 | deepseek.com | Reliable rule-following for SEO constraints. | 🟢 |
| 3 | Mistral 7B | Groq | Ultra-fast free inference. Good SEO fallback. | 🟢 |
| 4 | Llama 4 Scout | Fireworks AI | Free tier. Strong structured output. | 🟢 |

**Reasoning & Analysis** — Strategy, architecture, review, complex logic

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-R1 | deepseek.com | Best free reasoning model. Matches paid models at 5% cost. | 🟢 |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong analytical reasoning. Great fallback. | 🟢 |
| 3 | Phi-4 | HuggingFace | Microsoft small model. Punches above weight on logic. Free. | 🟢 |
| 4 | Gemini 3.1 Pro | google.com | #1 ARC-AGI-2 benchmark. Best paid reasoning. | 🔴 |
| 5 | Claude Opus 4.6 | anthropic.com | Deep nuanced thinking. Best for strategy. | 🔴 |

**Code Generation** — Web apps, APIs, SaaS, database architecture

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-Coder-V3 | deepseek.com | Purpose-built for software architecture. Best free coder. | 🟢 |
| 2 | Qwen 3.5 (Coder) | SiliconFlow | Strong full-stack. Next.js/Supabase/CF fluent. | 🟢 |
| 3 | DeepSeek-R1 | deepseek.com | Complex algorithmic problems needing reasoning first. | 🟢 |
| 4 | GPT-5.3 Codex | openai.com | Specialized purely for repository-scale coding. | 🔴 |
| 5 | Claude Sonnet 4.5 | anthropic.com | Best at understanding requirements → clean code. | 🔴 |

---

### IMAGE & VISUAL TASKS

**Text-on-Image Generation** — POD designs where text must render on fabric/products

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | FLUX.1 Pro | fal.ai | #1 in world for text rendering in images. POD essential. | 🟢 (free credits) |
| 2 | Ideogram 3.0 | ideogram.ai | Specialized in typography + graphic design layouts. | 🟢 (free tier) |
| 3 | SDXL | HuggingFace | Free, open. Good for illustration-style designs. | 🟢 (free) |
| 4 | Segmind | segmind.com | Serverless SD endpoints. Fast fallback. | 🟢 |
| 5 | Midjourney | PiAPI | Highest artistic quality. Worth it for premium. | 🔴 |
| 6 | DALL-E 3 | openai.com | Reliable, clean text rendering. | 🔴 |

**Artistic Image Generation** — Concepts, covers, illustrations, game assets

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | SDXL | HuggingFace | Best free artistic output. | 🟢 |
| 2 | CogView-3 | Zhipu AI | Strong artistic quality. Chinese model, cheap. | 🟢 |
| 3 | Wan 2.6 | Alibaba | Multi-image fusion. Image editing built in. | 🟢 |
| 4 | Midjourney | PiAPI | Best artistic quality on the market. | 🔴 |

**Image Editing/Enhancement** — Mockups, background removal, resizing

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Cloudflare Images | CF built-in | Already in your plan. Transform, resize, optimize. | 🟢 |
| 2 | Clipdrop | clipdrop.co | Background removal, upscaling. Free tier. | 🟢 |
| 3 | fal.ai | fal.ai | Fast inference for any open image model. | 🟢 |

**Mockup Generation** — Place designs on real product photos

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Printful Mockup API | printful.com | Free. Real product catalog mockups. | 🟢 |
| 2 | Printify Mockup API | printify.com | Free. Different product catalog. | 🟢 |
| 3 | Placeit | placeit.net | Lifestyle mockups. Person wearing shirt. | 🔴 |

---

### AUDIO & MUSIC TASKS

**Music Generation** — Loops, intros, stingers, background tracks

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Suno | suno.com | Best overall audio quality. All genres. 50 songs/day free. | 🟢 |
| 2 | Udio | udio.com | Different sonic character. Strong for specific genres. | 🟢 |
| 3 | MusicGen | HuggingFace | Open source. Free. No limits. Good instrumentals. | 🟢 |
| 4 | Stable Audio | stability.ai | Strong for sound design, stingers, ambience. | 🟢 |
| 5 | Udio Pro | udio.com | Higher quality, longer generation. | 🔴 |

**Voice / TTS** — Narration, podcast intros, voiceovers

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Kokoro TTS | HuggingFace | Open source. Free. Surprisingly good quality. | 🟢 |
| 2 | Coqui TTS | local/HF | Open source. Multiple voices. No API cost. | 🟢 |
| 3 | Google TTS | google.com | Free tier. Very clean output. | 🟢 |
| 4 | Cartesia Sonic | cartesia.ai | Sub-100ms latency. Best for real-time voice. | 🔴 |
| 5 | ElevenLabs | elevenlabs.io | Best voice quality + emotion on market. | 🔴 |

---

### PLATFORM VARIATION TASKS

**Platform Variation AI** — Rewrites content per platform rules

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Qwen 3.5 Flash | SiliconFlow | Fastest at rule-based rewriting tasks. | 🟢 |
| 2 | DeepSeek-V3 | deepseek.com | Better at maintaining quality while adapting tone. | 🟢 |
| 3 | Doubao 1.5 Lite | SiliconFlow | Micro-model. Perfect for fast variation generation. | 🟢 |

**Social Media Adaptation** — Rewrites per platform (TikTok vs LinkedIn vs Pinterest)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Doubao 1.5 Pro | SiliconFlow | ByteDance. Naturally understands social platform patterns. | 🟢 |
| 2 | DeepSeek-V3 | deepseek.com | Best at tone adaptation across platforms. | 🟢 |
| 3 | Qwen 3.5 Max | SiliconFlow | Strong creative writing for social. | 🟢 |

**Humanizer AI** — Makes AI output sound human, not robotic

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Doubao 1.5 Pro | SiliconFlow | Most human-like conversational output. | 🟢 |
| 2 | DeepSeek-V3 | deepseek.com | Naturally avoids AI writing patterns. | 🟢 |
| 3 | MiniMax M2.5 | minimax.io | Best "human-like flow" in industry. | 🟢 |
| 4 | Claude Sonnet 4.5 | anthropic.com | Lowest AI-detection score of any model. | 🔴 |

**Final Quality Review** — Multi-criteria review of entire output package

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-R1 | deepseek.com | Reasoning model. Evaluates from multiple angles. | 🟢 |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong checklist-following and gap detection. | 🟢 |
| 3 | Claude Opus 4.6 | anthropic.com | Most nuanced reviewer on the market. | 🔴 |
| 4 | GPT-5.4 High | openai.com | PhD-level logic for final review. | 🔴 |

---

## PART 7 — PLATFORM VARIATION ENGINE

### The Problem It Solves

Same product should NOT have the same listing everywhere.
Each platform has different buyers, different SEO, different tone.

### Platform Rules (Stored in D1, Editable from Dashboard)

```json
{
  "platforms": {
    "etsy": {
      "title_max_chars": 140,
      "tag_count": 13,
      "tag_max_chars": 20,
      "audience": "Handmade lovers, gift shoppers, small business owners",
      "tone": "Warm, personal, gift-focused, emotional",
      "seo_style": "Long-tail, buyer-intent keywords",
      "description_style": "Story-driven, include: who it's for, what they get, how it helps",
      "cta_style": "Save for later, Perfect gift for...",
      "forbidden": ["best", "cheapest", "guaranteed"]
    },
    "gumroad": {
      "title_max_chars": 100,
      "tag_count": 10,
      "audience": "Creators, solopreneurs, freelancers",
      "tone": "Value-driven, outcome-focused, creator-to-creator",
      "seo_style": "Problem → solution keywords",
      "description_style": "What you get + what problem it solves + who it's for",
      "cta_style": "Download instantly, Start using today"
    },
    "shopify": {
      "title_max_chars": 70,
      "audience": "Brand-conscious buyers, direct traffic",
      "tone": "Clean, brand-driven, professional",
      "seo_style": "Short-tail + brand keywords",
      "description_style": "Benefits-first, scannable bullets, trust signals"
    },
    "redbubble": {
      "title_max_chars": 60,
      "tag_count": 15,
      "audience": "Design lovers, pop culture fans, gift buyers",
      "tone": "Fun, creative, trend-driven",
      "description_style": "Design-first, playful, trendy language"
    },
    "amazon_kdp": {
      "title_max_chars": 200,
      "audience": "Readers, learners, professional development seekers",
      "tone": "Authority-driven, educational, trustworthy",
      "description_style": "Book-style blurb, author authority, what reader will learn"
    }
  }
}
```

### Platform Variation Prompt (Injected Per Platform)

```
You are a platform-specialized copywriter.

Platform: {platform_name}
Audience: {platform.audience}
Tone: {platform.tone}
Title limit: {platform.title_max_chars} characters
Tag rules: {platform.tag_rules}
SEO style: {platform.seo_style}
Description style: {platform.description_style}
CTA style: {platform.cta_style}

Take this base product and rewrite it for this platform.
Do NOT copy the base listing. Fully adapt it.

Base product:
{base_product_json}

Output: JSON matching this exact schema:
{output_schema}
```

---

## PART 8 — SOCIAL MEDIA ENGINE

### Auto vs Manual (Global Setting + Per-Product Override)

```
Settings → Publishing → Social Media Mode
  [○ Auto-post when CEO approves]
  [● Manual — I post myself]

Per product override available on product setup form.
```

### Social Platform Rules (Stored in D1, Editable from Dashboard)

```json
{
  "social_channels": {
    "instagram": {
      "caption_max_chars": 2200,
      "hashtag_count": 30,
      "tone": "Visual, aspirational, lifestyle-focused",
      "format": "Hook line → value → CTA → hashtags",
      "content_types": ["single image", "carousel", "reel script"]
    },
    "tiktok": {
      "hook_max_chars": 150,
      "tone": "Fast, punchy, entertaining, trend-aware",
      "format": "Strong hook (1-3 seconds) → problem → solution → CTA",
      "content_types": ["video script", "hook + 3 points + CTA"]
    },
    "pinterest": {
      "title_max_chars": 100,
      "description_max_chars": 500,
      "tone": "Inspirational, search-optimized, idea-focused",
      "format": "Keyword-rich title → what it is → who it's for → link",
      "content_types": ["pin title + description"]
    },
    "linkedin": {
      "post_max_chars": 3000,
      "tone": "Professional, insight-driven, authority-building",
      "format": "Bold opening statement → 3-5 insights → professional CTA",
      "content_types": ["article post", "insight post"]
    },
    "x_twitter": {
      "tweet_max_chars": 280,
      "thread_max_tweets": 10,
      "tone": "Direct, witty, value-dense, conversation-starting",
      "format": "Hook tweet → 5-7 value tweets → CTA tweet",
      "content_types": ["single tweet", "thread"]
    }
  }
}
```

---

## PART 9 — PROMPT ENGINEERING SYSTEM

### The Layered Prompt Architecture

Every AI call in NEXUS uses a layered prompt. Not a single prompt.
Layers stack on top of each other.

```
Layer A: MASTER SYSTEM PROMPT
         (applies to ALL tasks, ALL domains)
              │
Layer B: ROLE PROMPT
         (specific role for this task: researcher, writer, designer)
              │
Layer C: DOMAIN PROMPT
         (domain-specific knowledge: POD rules, digital product norms)
              │
Layer D: CATEGORY PROMPT
         (category-specific rules: Notion templates vs PDF guides)
              │
Layer E: PLATFORM PROMPT
         (platform-specific SEO + tone rules)
              │
Layer F: TASK PROMPT
         (the actual specific instruction for this step)
              │
Layer G: USER INPUT INJECTION
         (what the user filled in — optional fields)
              │
Layer H: OUTPUT SCHEMA
         (exact JSON structure expected back)
```

### Layer A: Master System Prompt (Apply to All)

```
You are NEXUS — a world-class AI business engine.

You operate with the mindset of:
- A senior marketing strategist with 15 years of e-commerce experience
- A professional copywriter who understands consumer psychology deeply  
- An SEO specialist who knows how platforms rank and reward listings
- A creative director who understands what converts browsers to buyers

Core rules you ALWAYS follow:
1. Never produce generic AI-sounding output. Write like a real expert human.
2. Always think about the END BUYER — their emotions, desires, fears, language.
3. Always optimize for the specific platform's algorithm and buyer behavior.
4. Always produce output in the exact JSON schema specified.
5. If something is missing from your instructions, make the smartest decision.
6. Quality over speed. Every word should earn its place.
```

### Layer B: Role Prompts (Examples)

**Researcher Role:**
```
Your role: Senior Market Research Analyst
Your job: Find real market data, real trends, real competitor insights.
Do not guess. Use the search results provided.
Extract: what's selling, why it sells, who buys it, what price they pay.
Think like someone who has studied this market for years.
```

**Copywriter Role:**
```
Your role: Elite Direct Response Copywriter
Your job: Write copy that makes people pull out their wallet.
Use psychological triggers: social proof, scarcity, identity, transformation.
Avoid clichés, avoid fluff, avoid anything that sounds like it was AI-generated.
Every sentence must either build desire or eliminate doubt.
```

**SEO Strategist Role:**
```
Your role: Platform SEO Specialist
Your job: Maximize organic discoverability within platform constraints.
You understand: keyword intent, search behavior, platform algorithm signals.
Never sacrifice readability for keywords. Best SEO reads like natural language.
```

**Reviewer/CEO Role:**
```
Your role: Chief Quality Officer
Your job: Be the harshest, most demanding reviewer of this output.
Evaluate from 3 angles: (1) Would this sell? (2) Is the SEO strong? (3) Does it sound human?
Identify every weakness. Be specific about what needs to change.
Output a structured review with pass/fail per criterion and specific revision instructions.
```

### Layer C: Domain Prompts (Examples)

**POD Domain:**
```
Domain context: Print-on-Demand (POD)
Key facts:
- Buyers purchase for identity expression, gifting, and community belonging
- Design must work at small scale (thumbnail on mobile) and large scale (actual print)
- Most successful POD niches are hyper-specific identity groups, not generic audiences
- Price competition is real — differentiation must come from niche specificity and design quality
- Etsy and Redbubble are the primary discovery channels — optimize for both
```

**Digital Products Domain:**
```
Domain context: Digital Products (instant download)
Key facts:
- Buyers want transformation, not information — sell the outcome not the content
- No physical shipping — speed and instant access are key selling points
- Screenshots and previews convert. Describe the product visually in text.
- Most successful digital products solve ONE specific problem for ONE specific person
- Gumroad and Etsy are primary channels. SEO must target "template" + "niche" keywords.
```

### Layer D: Category Prompts (Examples)

**Notion Templates Category:**
```
Category: Notion Templates
Specific rules:
- Buyers are productivity-obsessed. Language: "system", "workflow", "organized", "automated"
- Always mention: mobile-friendly, free Notion account required, instant duplicate
- Best performers: CRM, project manager, content calendar, habit tracker, finance tracker
- Price range that converts: $7-$27 for single templates, $37-$97 for systems/bundles
- Keywords that drive traffic: "notion template", "notion dashboard", "notion system", "[niche] notion"
```

**T-Shirts POD Category:**
```
Category: POD T-Shirts & Apparel
Specific rules:
- Design must work in both light and dark shirt colors unless you specify one
- Text-based designs outperform complex illustrations on Etsy
- Hyper-niche identity phrases outperform generic funny quotes
- Size guide mention in description increases conversions
- Unisex positioning expands audience. Specify: "Unisex, true to size, soft cotton blend"
- Winning formula: [Identity group] + [Relatable situation or pride statement]
```

### CEO Review Prompt (Used on Every Output)

```
You are the CEO reviewing a product package before it goes to market.

Be extremely critical. Your standard: would YOU personally buy this? Would you be embarrassed by this?

Review the following output and score each criterion 1-10:

PRODUCT PACKAGE TO REVIEW:
{product_output_json}

Evaluate:
1. TITLE STRENGTH (1-10): Is it attention-grabbing? SEO-optimized? Platform-appropriate?
2. DESCRIPTION QUALITY (1-10): Does it sell? Is it human? Does it answer buyer questions?
3. SEO QUALITY (1-10): Right keywords? Right density? Platform-appropriate?
4. PRICE LOGIC (1-10): Competitive? Justified? Psychologically optimized?
5. PLATFORM FIT (1-10): Does it match the platform's buyer psychology?
6. HUMAN QUALITY (1-10): Does any part sound AI-generated or robotic?
7. OVERALL READINESS (1-10): Is this ready to publish?

For any score below 8:
- State exactly what is wrong
- State exactly what should be changed
- Provide the corrected version

Output format:
{
  "overall_score": number,
  "approved": boolean,  // true only if ALL scores >= 8
  "scores": { ... },
  "issues": [ { "criterion": "...", "problem": "...", "fix": "..." } ],
  "revised_sections": { ... }  // only sections that need revision
}
```

---

## PART 10 — CEO APPROVAL LOOP

### Review Screen (Every Workflow Ends Here)

```
┌─────────────────────────────────────────────────────┐
│  CEO REVIEW — Notion Templates › Freelancer CRM     │
│                                                      │
│  AI Score: 8.4/10 · Ready for review                │
│                                                      │
│  ┌───────────────┐  ┌───────────────┐               │
│  │   TITLE       │  │  ETSY SCORE   │               │
│  │ Freelancer    │  │ SEO: 9/10     │               │
│  │ CRM Notion    │  │ Title: 8/10   │               │
│  │ Template      │  │ Tags: 9/10    │               │
│  └───────────────┘  └───────────────┘               │
│                                                      │
│  DESCRIPTION PREVIEW:                               │
│  [Preview text here...]                             │
│                                                      │
│  PLATFORM VARIANTS:                                  │
│  [Etsy] [Gumroad] [Payhip] — click to preview each │
│                                                      │
│  SOCIAL CONTENT:                                     │
│  [Instagram] [TikTok] [Pinterest] — click to preview│
│                                                      │
│  ─────────────────────────────────────────────      │
│                                                      │
│  [ ✓ APPROVE — SEND TO PUBLISH ] [ ✗ REJECT ]       │
│                                                      │
│  If rejecting, tell AI what to fix:                  │
│  [_____________________________________________]     │
│                                                      │
│  Examples:                                           │
│  • "Title too generic, make it more niche-specific" │
│  • "Description sounds robotic in paragraph 2"      │
│  • "Price too low, raise to $27"                    │
│  • "TikTok hook is weak, punch it up"              │
│                                                      │
│  [ SEND BACK TO AI WITH FEEDBACK ]                  │
└─────────────────────────────────────────────────────┘
```

### Rejection → Revision Loop

```
CEO rejects with feedback
         │
         ▼
Worker receives: { feedback: "...", original_output: {...} }
         │
         ▼
Only the FAILED sections are regenerated (not the whole workflow)
         │
         ▼
New output returned → CEO review screen again
         │
         ▼
Repeat until CEO approves
         │
         ▼
Status: APPROVED → Platform Variation Engine runs
```

### Revision History (Stored in D1)

Every revision is saved:
```sql
CREATE TABLE revision_history (
  id          TEXT PRIMARY KEY,
  product_id  TEXT,
  version     INTEGER,
  output      JSON,
  feedback    TEXT,
  ai_score    REAL,
  reviewed_at TEXT,
  decision    TEXT  -- 'approved' | 'rejected'
);
```

---

## PART 11 — FULL DATABASE SCHEMA (Cloudflare D1)

```sql
-- Core domain/category structure (all manageable from dashboard)
CREATE TABLE domains (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  domain_id   TEXT REFERENCES domains(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

-- Platform and social channel configs (editable from dashboard)
CREATE TABLE platforms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  title_max_chars INTEGER,
  tag_count       INTEGER,
  tag_max_chars   INTEGER,
  audience        TEXT,
  tone            TEXT,
  seo_style       TEXT,
  description_style TEXT,
  cta_style       TEXT,
  rules_json      JSON,  -- additional platform-specific rules
  is_active       BOOLEAN DEFAULT true
);

CREATE TABLE social_channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  caption_max_chars INTEGER,
  hashtag_count   INTEGER,
  tone            TEXT,
  format          TEXT,
  content_types   JSON,
  is_active       BOOLEAN DEFAULT true
);

-- Products and their workflow runs
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  domain_id     TEXT REFERENCES domains(id),
  category_id   TEXT REFERENCES categories(id),
  name          TEXT,
  niche         TEXT,
  language      TEXT DEFAULT 'en',
  user_input    JSON,   -- what user filled in (optional fields)
  status        TEXT DEFAULT 'draft',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT
);

-- Individual workflow runs per product
CREATE TABLE workflow_runs (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  status        TEXT DEFAULT 'queued',
  started_at    TEXT,
  completed_at  TEXT,
  current_step  TEXT,
  total_steps   INTEGER,
  error         TEXT
);

-- Individual steps within a workflow
CREATE TABLE workflow_steps (
  id            TEXT PRIMARY KEY,
  run_id        TEXT REFERENCES workflow_runs(id),
  step_name     TEXT NOT NULL,
  step_order    INTEGER,
  status        TEXT DEFAULT 'waiting',
  ai_used       TEXT,  -- which model actually ran
  ai_tried      JSON,  -- all models tried before success
  input         JSON,
  output        JSON,
  tokens_used   INTEGER,
  started_at    TEXT,
  completed_at  TEXT
);

-- Generated assets (files stored in R2)
CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  asset_type    TEXT,  -- 'image' | 'pdf' | 'audio' | 'mockup'
  r2_key        TEXT,  -- R2 storage key for deletion
  cf_image_id   TEXT,  -- Cloudflare Images ID (if image)
  url           TEXT,
  metadata      JSON,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Platform-specific listings per product
CREATE TABLE platform_variants (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  platform_id   TEXT REFERENCES platforms(id),
  title         TEXT,
  description   TEXT,
  tags          JSON,
  price         REAL,
  metadata      JSON,
  status        TEXT DEFAULT 'draft',
  published_at  TEXT
);

-- Social media content per product per channel
CREATE TABLE social_variants (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  channel_id    TEXT REFERENCES social_channels(id),
  content       JSON,  -- { caption, hashtags, hook, thread, etc }
  status        TEXT DEFAULT 'draft',
  scheduled_at  TEXT,
  published_at  TEXT
);

-- CEO review history
CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  run_id        TEXT REFERENCES workflow_runs(id),
  version       INTEGER DEFAULT 1,
  ai_score      REAL,
  decision      TEXT,  -- 'approved' | 'rejected'
  feedback      TEXT,
  reviewed_at   TEXT DEFAULT (datetime('now'))
);

-- Prompt templates (editable from dashboard Prompt Manager)
CREATE TABLE prompt_templates (
  id            TEXT PRIMARY KEY,
  layer         TEXT,   -- 'master' | 'role' | 'domain' | 'category' | 'platform' | 'social' | 'review'
  target_id     TEXT,   -- domain_id, category_id, platform_id, or null for global
  name          TEXT,
  prompt        TEXT,
  version       INTEGER DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- AI model registry and failover state
CREATE TABLE ai_models (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  provider            TEXT,
  task_type           TEXT,      -- 'writing' | 'research' | 'image' | 'audio' | 'seo' | 'review' | 'code'
  rank                INTEGER,   -- failover priority (1 = try first)
  api_key_secret_name TEXT,      -- name of CF Secret holding the key
  status              TEXT DEFAULT 'active',  -- 'active' | 'sleeping' | 'rate_limited'
  rate_limit_reset_at TEXT,
  daily_limit_reset_at TEXT,
  is_free_tier        BOOLEAN DEFAULT true,
  notes               TEXT
);

-- Settings
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);
-- Default settings:
-- social_posting_mode: 'manual' | 'auto'
-- default_language: 'en'
-- ceo_review_required: true
-- auto_publish_after_approval: false
```

---

## PART 12 — DASHBOARD SECTIONS (Complete UI Map)

```
NEXUS Dashboard
├── Home (Domain Cards)
│   └── Click Domain → Category Cards
│       └── Click Category → Product Setup Form
│           └── Fill optional fields → Start Workflow
│               └── Live Progress Screen
│                   └── CEO Review Screen
│                       └── Approve → Publish Center
│                       └── Reject → Feedback → AI Revision
│
├── Products
│   ├── All products list with status
│   ├── Filter by: domain, category, status, platform
│   └── Click product → full detail + platform variants
│
├── Review Center
│   ├── Pending Review (badge count)
│   ├── In Revision
│   └── Review history
│
├── Publishing Center
│   ├── Approved & ready to publish
│   ├── Select platforms + channels
│   ├── Manual publish (copy/export per platform)
│   └── Auto-publish queue (if auto mode)
│
├── Content Manager
│   ├── All generated assets (images, PDFs, audio)
│   ├── Delete → removes from R2 + CF Images + D1
│   └── Download / preview
│
├── Prompt Manager
│   ├── Master prompt (edit)
│   ├── Role prompts (edit per role type)
│   ├── Domain prompts (edit per domain)
│   ├── Category prompts (edit per category)
│   ├── Platform prompts (edit per platform)
│   ├── Social prompts (edit per channel)
│   └── Review/CEO prompt (edit)
│
├── AI Manager
│   ├── View all AI models + current status
│   ├── Active / Sleeping / Rate Limited badges
│   ├── Add API key → model activates instantly
│   ├── Remove API key → model sleeps instantly
│   └── Failover chain order (drag to reorder)
│
├── Platform Manager
│   ├── All platforms list
│   ├── Edit platform rules (title limit, tone, SEO style)
│   ├── Add new platform
│   └── Delete platform
│
├── Social Channel Manager
│   ├── All channels list
│   ├── Edit channel rules
│   ├── Global posting mode: Auto / Manual
│   ├── Add new channel
│   └── Connect channel (for auto-posting)
│
├── Domain & Category Manager
│   ├── All domains (edit, reorder, delete)
│   ├── All categories per domain (edit, reorder, delete)
│   ├── Add new domain
│   └── Add new category to any domain
│
├── History
│   ├── All past workflow runs
│   ├── Tokens used per run
│   ├── AI models used per step
│   └── Revision history
│
└── Settings
    ├── Social posting mode (Auto / Manual)
    ├── Default language
    ├── CEO review: required / optional
    ├── Auto-publish after approval: on/off
    ├── API key management (add/remove → CF Secrets)
    └── Account preferences
```

---

## PART 13 — FILE STRUCTURE

```
nexus/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── page.tsx              # Domain cards (home)
│   │   │   ├── [domain]/
│   │   │   │   ├── page.tsx          # Category cards
│   │   │   │   └── [category]/
│   │   │   │       └── page.tsx      # Product setup form
│   │   │   ├── workflow/[id]/
│   │   │   │   └── page.tsx          # Live progress
│   │   │   ├── review/[id]/
│   │   │   │   └── page.tsx          # CEO review screen
│   │   │   ├── products/page.tsx
│   │   │   ├── publish/page.tsx
│   │   │   ├── prompts/page.tsx
│   │   │   ├── ai-manager/page.tsx
│   │   │   ├── platforms/page.tsx
│   │   │   ├── social/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── components/
│   │       ├── DomainCard.tsx
│   │       ├── CategoryCard.tsx
│   │       ├── ProductSetupForm.tsx
│   │       ├── WorkflowProgress.tsx
│   │       ├── ReviewScreen.tsx
│   │       ├── PlatformVariantPreview.tsx
│   │       ├── SocialVariantPreview.tsx
│   │       └── AIStatusBadge.tsx
│   │
│   └── worker/                       # Cloudflare Workers
│       ├── src/
│       │   ├── index.ts              # Hono.js router
│       │   ├── workflow/
│       │   │   ├── engine.ts         # Durable Object workflow manager
│       │   │   ├── steps.ts          # Step definitions per domain/category
│       │   │   └── queue-handler.ts  # Queue consumer
│       │   ├── ai/
│       │   │   ├── failover.ts       # Failover engine
│       │   │   ├── registry.ts       # All AI model configs
│       │   │   ├── callers/          # One file per AI provider
│       │   │   │   ├── deepseek.ts
│       │   │   │   ├── qwen.ts
│       │   │   │   ├── suno.ts
│       │   │   │   ├── flux.ts
│       │   │   │   └── ...
│       │   ├── prompts/
│       │   │   ├── builder.ts        # Assembles layered prompts
│       │   │   ├── master.ts         # Master system prompt
│       │   │   └── layers/           # Domain/category/platform/social prompts
│       │   ├── platforms/
│       │   │   ├── variation.ts      # Platform variation engine
│       │   │   └── social.ts         # Social adaptation engine
│       │   ├── storage/
│       │   │   ├── r2.ts             # R2 operations (upload/delete)
│       │   │   ├── d1.ts             # D1 query helpers
│       │   │   └── kv.ts             # KV cache helpers
│       │   └── review/
│       │       └── ceo-loop.ts       # CEO approval loop logic
│       └── wrangler.toml
│
└── migrations/                       # D1 SQL migrations
    └── 001_initial_schema.sql
```

---

## PART 14 — SECRETS & API KEYS (All in CF Secrets Store)

```
# ═══ ACTIVE NOW (free/cheap) ═══
TAVILY_API_KEY          # tavily.com
EXA_API_KEY             # exa.ai
SERPAPI_KEY             # serpapi.com
DEEPSEEK_API_KEY        # deepseek.com (near-zero cost)
DASHSCOPE_API_KEY       # SiliconFlow (Qwen + Doubao + MiniMax)
SILICONFLOW_API_KEY     # siliconflow.cn (aggregator)
FIREWORKS_API_KEY       # fireworks.ai (free Llama/Mixtral)
GROQ_API_KEY            # groq.com (ultra-fast free)
HF_TOKEN                # huggingface.co (open models)
FAL_API_KEY             # fal.ai (FLUX free credits)
OPENROUTER_API_KEY      # openrouter.ai (free model access)
MOONSHOT_API_KEY        # moonshot.cn (Kimi free tier)
DATAFORSEO_KEY          # dataforseo.com (free tier)
PRINTFUL_API_KEY        # printful.com (free mockups)
PRINTIFY_API_KEY        # printify.com (free mockups)
SUNO_API_KEY            # suno.com (50 songs/day free)

# ═══ ADD WHEN READY (sleeping until key added) ═══
ANTHROPIC_API_KEY       # Claude Sonnet + Opus
OPENAI_API_KEY          # GPT-5
GOOGLE_API_KEY          # Gemini 3.1 Pro
MIDJOURNEY_API_KEY      # Via PiAPI partner
IDEOGRAM_API_KEY        # ideogram.ai
ELEVENLABS_API_KEY      # ElevenLabs voice
CARTESIA_API_KEY        # Cartesia sub-100ms TTS
PERPLEXITY_API_KEY      # Perplexity research
PLACEIT_API_KEY         # Lifestyle mockups
```

**Adding a key activates that AI instantly — no code change needed.**
**Removing a key puts it back to sleep instantly.**

---

## SUMMARY

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend | Next.js on CF Pages | $0 |
| Backend | CF Workers (Hono.js) | Included in $5/mo |
| Database | CF D1 | Included |
| Files | CF R2 | Included (10GB) |
| Images | CF Images | Included |
| Workflow State | CF Durable Objects | Included |
| Task Queue | CF Queues | Included |
| Config Cache | CF KV | Included |
| API Keys | CF Secrets Store | Included |
| **Total Infrastructure** | **100% Cloudflare** | **$5/month** |

**All 5+ domains run right now with zero paid AIs.**
**Add any paid AI key later → activates instantly, no setup.**
**Delete anything from dashboard → deleted from all Cloudflare storage automatically.**
