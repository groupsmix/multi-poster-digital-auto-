# NEXUS — Complete System Architecture v4.0
### Personal AI Business Engine · Full Specification
> Built for: Personal use · Cloudflare $5/month plan · Zero paid AI to start

---

## PART 1 — INFRASTRUCTURE (FULL CLOUDFLARE $5/MONTH EXPLOITATION)

### Real Plan Limits — What You Actually Get

| Service | Monthly Allowance | Cost if Exceeded | NEXUS Usage |
|---------|------------------|-----------------|-------------|
| **Workers requests** | 10,000,000 | $0.50/extra 1M | ~10K/month for personal use. You have 990x headroom. |
| **KV reads** | 10,000,000 | $0.50/extra 1M | Config lookups + AI response cache. Essentially unlimited. |
| **KV writes/deletes** | 1,000,000 | $5.00/extra 1M | Config changes + cache writes. Will never exceed. |
| **KV storage** | 1 GB | $0.50/GB | Prompts + platform rules + cached AI responses = ~50MB total. |
| **R2 storage** | 10 GB | $0.015/GB | PDFs, images, audio. Hundreds of products before paying. |
| **R2 reads** | 10,000,000 | $0.36/extra 1M | Serving files. Essentially unlimited. |
| **R2 writes** | 1,000,000 | $4.50/extra 1M | Saving generated files. Will never exceed personally. |
| **R2 egress** | UNLIMITED | $0 always | No bandwidth bill. Ever. |
| **D1 storage** | 5 GB | pay/GB after | Products + history. Years before hitting limit. |
| **D1 rows read** | 25,000,000,000 | $0.001/extra 1M | Essentially unlimited for personal use. |
| **D1 rows written** | 50,000,000 | $1.00/extra 1M | Personal use = ~1K writes/month. 50,000x headroom. |
| **Workflows instances** | Unlimited sleeping | -- | Every product = 1 instance. Sleeps free between steps. |
| **Workflows steps/instance** | 10,000 default | up to 25,000 | Max NEXUS workflow = ~15 steps. 666x headroom. |
| **Workflows concurrent** | 10,000 running | -- | You run 1 at a time personally. |
| **Workers AI inference** | 10,000 neurons/day | $0.011/extra 1K | FREE text inference included. Ultimate fallback. |
| **AI Gateway** | Unlimited requests | $0 | Free logging, caching, rate limiting for ALL AI calls. |
| **Pages hosting** | Unlimited | $0 | Frontend. Always free. |
| **Service Bindings** | Free internal calls | $0 | Worker-to-Worker = counted as 1 request, not many. |

**Bottom line: For personal use, your bill will never go above $5/month. Ever.**

---

### The 6 Rules to Exploit Every Limit

**Rule 1 -- KV for all reads, D1 only for writes**

KV gives 10M reads/month free. Every dashboard page load, every AI config check,
every prompt lookup = KV read (fast + free). D1 only used for records that change
(workflow state, product data, review history).

```
KV stores  -> platform rules, prompts, AI model registry, social rules, settings, cached AI responses
D1 stores  -> products, workflow runs, steps, reviews, assets, revision history, analytics
```

**Rule 2 -- CF Workflows instead of raw Durable Objects**

CF Workflows is built on top of Durable Objects but designed exactly for
multi-step AI workflows. Each product run = 1 Workflow instance.
It sleeps for free between steps while waiting for AI API responses.
You only pay (in compute time) for the milliseconds it's actually running.
10,000 steps per instance = your 9-step workflow has 1,111x headroom.

**Rule 3 -- Service Bindings for free internal routing**

Split NEXUS into specialized Workers connected via Service Bindings.
Internal calls between Workers = counted as ONE request (not multiple).
This means your 9-step workflow = 1 inbound request + free internal routing.

```
Worker: nexus-router      <-- receives all dashboard requests (1 request counted)
  |-- Service Binding ->  Worker: nexus-ai       (free internal)
  |-- Service Binding ->  Worker: nexus-workflow  (free internal)
  |-- Service Binding ->  Worker: nexus-storage   (free internal)
  |-- Service Binding ->  Worker: nexus-variation (free internal)
```

**Rule 4 -- R2 for all files, zero egress cost**

R2 has no egress fees. Ever. Every image, PDF, audio file, export -- stored in R2,
served directly to your browser for free. No bandwidth bill regardless of file size.

**Rule 5 -- Workers AI as ultimate free fallback (NEW in V4)**

Workers AI gives you 10,000 neurons/day FREE with your $5 plan.
`@cf/meta/llama-3.1-8b-instruct` runs directly on Cloudflare's edge -- zero latency,
zero external API call, zero rate limits from third parties.
Every text-based failover chain ends with Workers AI as the last resort.
If every external free API is rate-limited or down, Workers AI still works.
You NEVER get "All AIs failed" for text tasks.

```
External free APIs (DeepSeek, Qwen, etc.)
     |
     | all failed / rate limited?
     v
Workers AI (@cf/meta/llama-3.1-8b-instruct) -- ALWAYS available, included in $5
     |
     | This NEVER fails (it's on-platform, no external dependency)
     v
Result returned. Zero cost. Zero external call.
```

**Rule 6 -- AI Gateway for free monitoring + caching (NEW in V4)**

AI Gateway is included free in your $5 plan. Route ALL external AI calls through it.
What you get for free:

```
AI Gateway gives you:
  |-- Request/response logging   -> see every AI call, what was sent, what came back
  |-- Response caching           -> identical prompts return cached result (zero AI cost)
  |-- Rate limiting              -> prevent runaway API usage
  |-- Analytics dashboard        -> tokens used, cost per provider, success rates
  |-- Retry logic                -> auto-retry failed requests before failover
  |-- Fallback routing           -> gateway-level failover (complements our engine)

Setup: One CF AI Gateway instance, all providers routed through it.
Cost: $0. Included in Workers Paid plan.
```

---

### Full Infrastructure Map

```
+------------------------------------------------------------------+
|                   NEXUS -- CLOUDFLARE $5/MONTH                    |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |  CF PAGES -- Dashboard UI (Next.js)          FREE ALWAYS     | |
|  +---------------------------+----------------------------------+ |
|                              | HTTP requests                      |
|  +---------------------------v----------------------------------+ |
|  |  WORKER: nexus-router (Hono.js)                              | |
|  |  Routes: /api/workflow, /api/products, /api/review, etc.     | |
|  |  10M requests/month included -- personal use = ~10K/month    | |
|  +--+----------------+------------------+----------------------+ |
|     |Service Binding  |Service Binding   |Service Binding        |
|     |(free internal)  |(free internal)   |(free internal)        |
|  +--v----------+ +----v-----------+ +---v-----------------------+|
|  | WORKER:     | | WORKER:        | | WORKER:                   ||
|  | nexus-ai    | | nexus-         | | nexus-variation            ||
|  |             | | workflow       | |                            ||
|  | AI Gateway  | | Calls CF       | | Platform variation engine  ||
|  | + Failover  | | Workflows API  | | Social adaptation engine   ||
|  | + Cache     | |                | | Humanizer                  ||
|  +--+----------+ +----+-----------+ +---+------------------------+|
|     |                  |                 |                         |
|     |   +--------------v-----------------v---+                    |
|     |   |  CF WORKFLOWS                      |                    |
|     |   |  One instance per product          |                    |
|     |   |  Sleeps free between steps         |                    |
|     |   |  10,000 steps/instance             |                    |
|     |   |  State survives tab close          |                    |
|     |   +------------------------------------+                    |
|     |                                                             |
|  +--v-----------------------------------------------------------+|
|  |  AI LAYER                                                     ||
|  |                                                               ||
|  |  AI Gateway ---- Routes ALL external AI calls                 ||
|  |                  Caches responses, logs usage, rate limits     ||
|  |                  FREE with $5 plan                            ||
|  |                                                               ||
|  |  Workers AI ---- @cf/meta/llama-3.1-8b-instruct              ||
|  |                  Ultimate fallback. On-platform. FREE.        ||
|  |                  10,000 neurons/day included                  ||
|  +---------------------------------------------------------------+|
|     |                                                             |
|  +--v-----------------------------------------------------------+|
|  |  STORAGE LAYER                                                ||
|  |                                                               ||
|  |  KV -------- Platform rules, prompts, AI registry            ||
|  |              Settings, social channel rules                   ||
|  |              AI response cache (hash prompt -> cached result) ||
|  |              10M reads/month free -- ~5MB config + ~50MB cache||
|  |                                                               ||
|  |  D1 -------- Products, workflow runs, steps, reviews          ||
|  |              Assets metadata, revision history, analytics     ||
|  |              5GB included -- personal use = ~50MB/year        ||
|  |                                                               ||
|  |  R2 -------- PDFs, images, audio, exports, mockups           ||
|  |              10GB included -- ZERO egress fee ever            ||
|  |                                                               ||
|  |  CF Images - Image CDN, resize, transform, optimize          ||
|  |                                                               ||
|  |  Secrets --- All AI API keys, encrypted at rest              ||
|  |              Add key -> AI activates. Remove -> sleeps.       ||
|  +---------------------------------------------------------------+|
+-------------------------------------------------------------------+
```

---

### How a Full Product Workflow Runs

```
Dashboard click: START WORKFLOW
        |
        v (1 HTTP request -- counts as 1 of your 10M/month)
nexus-router Worker receives request
        |
        v (Service Binding -- FREE, not counted)
nexus-workflow Worker creates Workflow instance in CF Workflows
        |
        v
CF Workflow instance starts -- persists in Durable Object storage
        |
   +----+------------------------------------------------------+
   |  STEP 1: Research                                          |
   |  -> nexus-ai (Service Binding, free)                       |
   |  -> AI Gateway checks cache first (identical prompt?)      |
   |     -> Cache HIT: return cached result instantly (free)    |
   |     -> Cache MISS: failover engine picks AI, calls API     |
   |  -> Result saved to D1 + cached in KV                      |
   |  -> Workflow SLEEPS (zero cost while sleeping)             |
   +----+------------------------------------------------------+
        | (wakes when step complete)
   +----+------------------------------------------------------+
   |  STEP 2: Content Generation                                |
   |  -> nexus-ai -> AI Gateway -> cache check -> AI call       |
   |  -> Result to D1 + KV cache                                |
   |  -> Workflow SLEEPS again                                  |
   +----+------------------------------------------------------+
        |
   [... steps 3-8 same pattern ...]
        |
   +----+------------------------------------------------------+
   |  STEP 9: Platform Variation                                |
   |  -> nexus-variation (Service Binding, free)                |
   |  -> Generates variant per platform                         |
   |  -> Files uploaded to R2                                   |
   |  -> Images stored in CF Images                             |
   +----+------------------------------------------------------+
        |
        v
Workflow marks status: PENDING_REVIEW in D1
Dashboard polls D1 -> shows CEO Review screen
        |
   APPROVE -> Published records written to D1
   REJECT  -> Feedback stored in D1 -> Workflow restarts failed steps only
```

**Tab close mid-workflow?** CF Workflows persists. When you reopen, workflow
already finished. Results waiting in review screen.

---

### Smart AI Response Caching (NEW in V4)

```
Every AI call goes through this cache layer:

1. Build prompt from all layers (master + role + domain + category + ...)
2. Hash the final prompt: SHA-256(prompt + model_id + task_type)
3. Check KV: cache:ai:{hash}
   |
   +-- HIT (exists + not expired)
   |   -> Return cached response immediately
   |   -> Zero AI cost, zero latency
   |   -> Log: [CACHE HIT] task_type, model, saved_tokens
   |
   +-- MISS (not found or expired)
       -> Call AI via failover engine
       -> On success: write to KV with TTL
       -> cache:ai:{hash} = { response, model_used, tokens, timestamp }
       -> TTL varies by task type:
          Research:  1 hour  (trends change fast)
          Writing:   24 hours (content is stable)
          SEO:       6 hours  (keywords shift slowly)
          Review:    0 (never cache, always fresh review)
          Images:    0 (never cache, always unique)
          Audio:     0 (never cache, always unique)
```

**Why this matters:** If you create 3 Notion templates for "freelancers",
the research step is nearly identical each time. Cache saves 2 out of 3 AI calls.
For a personal user, this alone can cut AI usage by 30-50%.

---

### Deletion Flow (Dashboard -> All Cloudflare Services Synced)

```
You click DELETE (product, asset, domain, category, anything)
        |
        v (1 request -> nexus-router)
        |
   +----+-----------------------------------------------------+
   |  nexus-storage Worker (Service Binding, free)              |
   |                                                            |
   |  DELETE from D1       -> removes all product rows          |
   |  DELETE from R2       -> removes all files/assets          |
   |  DELETE from KV       -> removes cached config + AI cache  |
   |  DELETE from CF Images -> removes image CDN entry          |
   |  INVALIDATE AI Gateway cache -> removes cached responses   |
   |  All 5 run in PARALLEL (Promise.all) -- fast               |
   +----+-----------------------------------------------------+
        |
        v
Dashboard confirms: deleted
Nothing orphaned. Everything synced. Cache invalidated.
```

---

### Workers Split (5 Specialized Workers via Service Bindings)

| Worker | Job | Why separate |
|--------|-----|-------------|
| `nexus-router` | Hono.js API router, auth check, request validation | Entry point. Thin and fast. |
| `nexus-ai` | AI Gateway integration, failover engine, AI model registry, all external AI calls, Workers AI fallback, response caching | Isolated. If AI call hangs, doesn't block router. |
| `nexus-workflow` | CF Workflows management, step orchestration, status updates | Stateful. Needs its own context. |
| `nexus-variation` | Platform variation engine, social adaptation, humanizer | CPU-heavy rewrites, isolated from main flow. |
| `nexus-storage` | All R2, D1, KV, CF Images operations, cache invalidation | One place for all storage. Easy to maintain. |

All connected via Service Bindings -- zero extra request cost between them.

---

## PART 2 -- DASHBOARD NAVIGATION STRUCTURE

### Screen 1: Home -- Big Domain Cards

First thing you see when you open the dashboard.
Each card is a big domain. Nothing else.

```
+----------------+  +----------------+  +----------------+
|   Digital      |  |     POD        |  |   Content      |
|   Products     |  | Print on Dem   |  |  & Media       |
|      ->        |  |      ->        |  |      ->        |
+----------------+  +----------------+  +----------------+

+----------------+  +----------------+  +----------------+
|  Freelance     |  |  Affiliate     |  |  E-Commerce    |
|   Services     |  |  Marketing     |  |  & Retail      |
|      ->        |  |      ->        |  |      ->        |
+----------------+  +----------------+  +----------------+

+----------------+  +----------------+  +----------------+
|  Knowledge     |  |  Specialized   |  |  Automation    |
|  & Education   |  |  Technology    |  |  & No-Code     |
|      ->        |  |      ->        |  |      ->        |
+----------------+  +----------------+  +----------------+

+----------------+
|  + Add New     |  <-- Add custom domain anytime
|   Domain       |
+----------------+
```

### Screen 2: Domain Opened -> Category Cards

Click any domain -> see its categories as cards.
Example: Digital Products clicked:

```
<- Digital Products

+----------------+  +----------------+  +----------------+
|   Notion       |  |    PDFs &      |  |   Courses &    |
|  Templates     |  |   Guides       |  |  E-Learning    |
+----------------+  +----------------+  +----------------+

+----------------+  +----------------+  +----------------+
|   Planners     |  |  Prompt        |  |  SaaS          |
| & Calendars    |  |  Libraries     |  |  Templates     |
+----------------+  +----------------+  +----------------+

+----------------+  +----------------+  +----------------+
|  Checklists    |  |  Spreadsheet   |  |  + Add New     |
|  & Trackers    |  |  Templates     |  |  Category      |
+----------------+  +----------------+  +----------------+
```

### Screen 3: Category Opened -> Product Setup Form

Click a category -> the product setup form appears.
Every field is OPTIONAL. If you leave it empty, AI fills it.

```
<- Digital Products > Notion Templates

+-----------------------------------------------------+
|  PRODUCT SETUP                                       |
|                                                      |
|  Language          [English v] [+ Add Language]      |
|                                                      |
|  Niche (optional)  [________________________]        |
|                    e.g. "freelancers", "students"     |
|                                                      |
|  Product Name      [________________________]        |
|  (optional)        e.g. "Freelancer CRM System"      |
|                                                      |
|  Description       [________________________]        |
|  (optional)        e.g. "tracks clients + invoices"   |
|                                                      |
|  Keywords          [________________________]        |
|  (optional)        e.g. "notion, freelance, crm"      |
|                                                      |
|  --------------- PLATFORMS ---------------            |
|                                                      |
|  Post to:  [xEtsy] [xGumroad] [Payhip] [Shopify]    |
|            [Amazon KDP] [TikTok Shop] [+Add]          |
|                                                      |
|  --------------- SOCIAL MEDIA ------------            |
|                                                      |
|  Post to social?  [Yes o] [No o]                     |
|                                                      |
|  Select channels: [xInstagram] [xTikTok] [X/Twitter] |
|                   [Pinterest] [LinkedIn] [YouTube]    |
|                   [Facebook] [+Add Channel]           |
|                                                      |
|  Posting mode:    [Auto o] [Manual o]                |
|  (overrides global setting for this product)          |
|                                                      |
|  --------------- AI OPTIONS --------------            |
|                                                      |
|  Price suggestion    [x Let AI decide]               |
|  Target audience     [x Let AI decide]               |
|  Design style        [x Let AI decide]               |
|                                                      |
|  --------------- BATCH MODE (V4) ---------            |
|                                                      |
|  Generate multiple?  [1 product v]                   |
|  (AI creates N unique variations of this concept)     |
|                                                      |
|  [  START WORKFLOW  ]  [  SAVE AS DRAFT  ]           |
+-----------------------------------------------------+
```

**Rule**: Every field is optional.
If filled -> AI uses your input as direction.
If empty -> AI researches and decides everything itself.

**Batch mode (V4)**: Set "Generate multiple" to 3, 5, or 10 -> AI creates
that many unique product variations from one setup form. Each gets its own
workflow run, own CEO review, own platform variants. Queue runs sequentially.

---

### Screen 4: Live Workflow Progress (NEW detail in V4)

After clicking START WORKFLOW, you see real-time progress:

```
<- Digital Products > Notion Templates > Freelancer CRM

+-----------------------------------------------------+
|  WORKFLOW PROGRESS                                   |
|                                                      |
|  Product: Freelancer CRM Notion Template             |
|  Status: RUNNING (Step 3 of 9)                       |
|                                                      |
|  [=====>                  ] Step 3/9                  |
|                                                      |
|  Step 1: Research          [DONE]  2.3s  DeepSeek-V3 |
|  Step 2: Strategy          [DONE]  1.8s  Qwen 3.5    |
|  Step 3: Content Gen       [....]  --    DeepSeek-V3 |
|  Step 4: SEO Optimization  [    ]                    |
|  Step 5: Image Generation  [    ]                    |
|  Step 6: Platform Variants [    ]                    |
|  Step 7: Social Content    [    ]                    |
|  Step 8: Humanizer Pass    [    ]                    |
|  Step 9: Quality Review    [    ]                    |
|                                                      |
|  AI Cost So Far: $0.00 (all free-tier models)        |
|  Tokens Used: 4,231                                  |
|  Cache Hits: 1 (research reused from similar product)|
|                                                      |
|  [  CANCEL WORKFLOW  ]                               |
+-----------------------------------------------------+
```

Shows which AI model was used per step, time taken, cost (usually $0),
and whether any cache hits saved AI calls.

---

## PART 3 -- ALL DOMAINS AND THEIR CATEGORIES

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

## PART 4 -- THE WORKFLOW ENGINE

### How Every Workflow Runs

```
You click START WORKFLOW
         |
         v
nexus-router receives request (1 counted request)
         |
         v (Service Binding -- free)
nexus-workflow creates CF Workflow instance
         |
         v
CF Workflow instance starts -- persists in Durable Object storage
         |
    STEP 1 --> STEP 2 --> STEP 3 --> ... --> STEP N
         |
         v
Every step:
  1. nexus-ai called via Service Binding (free)
  2. AI Gateway checks cache first
  3. Cache miss -> failover engine picks AI
  4. Failover chain: external free -> external paid -> Workers AI (never fails)
  5. Result saved to D1 + cached in KV
  6. Workflow SLEEPS (zero cost) until next step
         |
         v
Dashboard shows live progress via polling (SSE in future)
         |
         v
Final output assembled -> status: PENDING_REVIEW
         |
         v
CEO Review Screen appears
         |
    APPROVE --> Platform Variation Engine --> Social Engine --> DONE
         |
    REJECT  --> Feedback form --> back to AI --> regenerate --> Review again
```

### Workflow Status System

Every workflow and every step has a status stored in D1:

| Status | Meaning |
|--------|---------|
| `queued` | Waiting to start |
| `running` | Currently executing |
| `waiting_cache` | Checking AI response cache (V4) |
| `waiting_fallback` | Primary AI failed, switching to next |
| `workers_ai_fallback` | All external AIs failed, using Workers AI (V4) |
| `completed` | Step done successfully |
| `failed` | All AIs in chain failed (should never happen for text with Workers AI) |
| `pending_review` | Waiting for CEO approval |
| `approved` | CEO approved |
| `rejected` | CEO rejected, needs revision |
| `in_revision` | AI re-working based on feedback |
| `published` | Posted to platform(s) |
| `cancelled` | User cancelled mid-workflow (V4) |

---

### Batch Workflow Support (NEW in V4)

```
User sets "Generate multiple: 5" in product setup form
         |
         v
nexus-workflow creates 5 separate CF Workflow instances
Each instance = independent product with its own:
  - Unique niche angle (AI generates variation)
  - Own workflow steps
  - Own CEO review
  - Own platform variants
         |
         v
Queue runs them sequentially (1 at a time to respect free API limits)
Dashboard shows batch progress:

  Batch: 5 Notion Templates for "productivity"
  [=====] Product 1/5: Freelancer CRM     [DONE - Pending Review]
  [==   ] Product 2/5: Student Planner    [Running - Step 4/9]
  [     ] Product 3/5: --                 [Queued]
  [     ] Product 4/5: --                 [Queued]
  [     ] Product 5/5: --                 [Queued]
```

---

## PART 5 -- THE AI FAILOVER ENGINE (ENHANCED in V4)

### The Core Rules

1. Every task has a ranked list of AIs.
2. The engine tries #1. If it fails -> sleeps it -> tries #2 -> and so on.
3. If an AI has no API key -> automatically skipped, no error.
4. When a limit resets -> that AI wakes back up automatically.
5. **V4: AI Gateway cache checked BEFORE any AI call.**
6. **V4: Workers AI is the LAST entry in every text-based chain. It never fails.**
7. **V4: Health scores track each model's reliability over time.**

### Enhanced Failover Logic (TypeScript)

```typescript
// src/ai-engine/failover.ts

interface AIModel {
  id: string
  name: string
  apiKeyEnvName: string        // name of the secret in CF Secrets Store
  status: 'active' | 'sleeping' | 'rate_limited' | 'no_key'
  rateLimitResetAt?: number    // unix timestamp
  dailyLimitResetAt?: number   // unix timestamp (usually midnight)
  healthScore: number          // V4: 0-100, tracks reliability
  totalCalls: number           // V4: lifetime calls
  totalFailures: number        // V4: lifetime failures
  avgLatencyMs: number         // V4: average response time
  isWorkersAI: boolean         // V4: true = on-platform, never needs API key
}

// V4: Cache layer before failover
async function checkCache(
  prompt: string,
  taskType: string,
  env: Env
): Promise<string | null> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(prompt + taskType)
  )
  const key = `cache:ai:${Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')}`
  const cached = await env.KV.get(key, 'json')
  if (cached) {
    console.log(`[CACHE HIT] ${taskType} -- saved tokens`)
    return cached.response
  }
  return null
}

// V4: Write to cache after successful AI call
async function writeCache(
  prompt: string,
  taskType: string,
  response: string,
  env: Env
): Promise<void> {
  const TTL_MAP: Record<string, number> = {
    research: 3600,        // 1 hour
    writing: 86400,        // 24 hours
    seo: 21600,            // 6 hours
    code: 86400,           // 24 hours
    variation: 86400,      // 24 hours
    social: 86400,         // 24 hours
    review: 0,             // never cache
    image: 0,              // never cache
    audio: 0,              // never cache
  }
  const ttl = TTL_MAP[taskType] || 0
  if (ttl === 0) return  // don't cache this type

  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(prompt + taskType)
  )
  const key = `cache:ai:${Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')}`
  await env.KV.put(key, JSON.stringify({ response, timestamp: Date.now() }), {
    expirationTtl: ttl
  })
}

export async function runWithFailover(
  taskType: string,
  prompt: string,
  env: Env
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {

  // V4: Check cache first
  const cached = await checkCache(prompt, taskType, env)
  if (cached) {
    return { result: cached, model: 'cache', cached: true }
  }

  const models = TASK_MODEL_REGISTRY[taskType]

  for (const model of models) {

    // Workers AI doesn't need an API key -- it's on-platform
    if (!model.isWorkersAI) {
      const apiKey = env[model.apiKeyEnvName]
      if (!apiKey) {
        console.log(`[SKIP] ${model.name} -- no API key`)
        continue
      }
    }

    // Rate limited -> check if reset time passed
    if (model.status === 'rate_limited') {
      const now = Date.now()
      if (model.rateLimitResetAt && now < model.rateLimitResetAt) {
        console.log(`[SLEEP] ${model.name} -- rate limited`)
        continue
      }
      model.status = 'active'
    }

    // Daily limit hit -> check if midnight passed
    if (model.status === 'sleeping') {
      const now = Date.now()
      if (model.dailyLimitResetAt && now < model.dailyLimitResetAt) {
        console.log(`[SLEEP] ${model.name} -- daily limit`)
        continue
      }
      model.status = 'active'
    }

    try {
      const start = Date.now()
      let result: string
      let tokens: number | undefined

      if (model.isWorkersAI) {
        // V4: Workers AI -- direct on-platform call, no external dependency
        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: prompt }]
        })
        result = response.response
        console.log(`[WORKERS-AI] Fallback succeeded`)
      } else {
        // Route through AI Gateway for logging + caching
        const aiResult = await callAIviaGateway(model, env[model.apiKeyEnvName], prompt, env)
        result = aiResult.text
        tokens = aiResult.tokens
      }

      // V4: Update health score
      const latency = Date.now() - start
      model.totalCalls++
      model.avgLatencyMs = (model.avgLatencyMs * (model.totalCalls - 1) + latency) / model.totalCalls
      model.healthScore = Math.round(
        ((model.totalCalls - model.totalFailures) / model.totalCalls) * 100
      )

      console.log(`[OK] ${model.name} succeeded (${latency}ms, health: ${model.healthScore}%)`)

      // V4: Cache the response
      await writeCache(prompt, taskType, result, env)

      return { result, model: model.name, cached: false, tokens }

    } catch (err: any) {
      model.totalCalls++
      model.totalFailures++
      model.healthScore = Math.round(
        ((model.totalCalls - model.totalFailures) / model.totalCalls) * 100
      )

      if (err.status === 429) {
        model.status = 'rate_limited'
        model.rateLimitResetAt = Date.now() + 3600_000
        console.log(`[LIMIT] ${model.name} -> sleep 1hr (health: ${model.healthScore}%)`)
      } else if (err.status === 402 || err.code === 'QUOTA_EXCEEDED') {
        const midnight = new Date()
        midnight.setHours(24, 0, 0, 0)
        model.status = 'sleeping'
        model.dailyLimitResetAt = midnight.getTime()
        console.log(`[QUOTA] ${model.name} -> sleep until midnight`)
      } else {
        console.log(`[ERR] ${model.name}: ${err.message} (health: ${model.healthScore}%)`)
      }
      continue
    }
  }

  // V4: This should never happen for text tasks because Workers AI is always last
  throw new Error(`All AIs failed for task: ${taskType}`)
}
```

### V4: AI Health Scoring System

Every AI model has a health score (0-100) that tracks reliability over time:

```
Health Score = (successful_calls / total_calls) * 100

Tracking per model:
  - totalCalls: lifetime number of attempts
  - totalFailures: lifetime failures (rate limits, errors, timeouts)
  - avgLatencyMs: average response time
  - healthScore: calculated reliability percentage

Dashboard shows health in AI Manager:
  DeepSeek-V3      health: 97%  avg: 1.2s  [======= ]
  Qwen 3.5 Max     health: 94%  avg: 0.8s  [====== ]
  Workers AI       health: 100% avg: 0.3s  [========] (never fails)

Health data stored in D1 analytics table.
Auto-promotes: If model #2 has higher health than #1 for 7 days,
suggest reordering in AI Manager (manual confirmation required).
```

---

## PART 6 -- AI ASSIGNMENTS PER TASK TYPE

**Status**: Active (free/cheap) | Sleeping (add key to activate)

Every AI is chosen because it is objectively the strongest for that specific job.
Not random. Not marketing. The actual best tool per task.

**V4 Enhancement**: Every text-based chain ends with Workers AI as ultimate fallback.

---

### RESEARCH TASKS (used by ALL domains)

**Web Trend Research** -- Find what's selling, what's trending, competitor analysis

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Tavily Search | tavily.com | Purpose-built for AI agents. Returns clean structured web data. | Active |
| 2 | Exa Neural Search | exa.ai | Finds by meaning not keywords. Discovers emerging niches. | Active |
| 3 | SerpAPI | serpapi.com | Raw Google results. Reliable backup for trend data. | Active |
| 4 | DeepSeek-V3 | deepseek.com | Reasoning fallback when search APIs hit limits. | Active |
| 5 | Workers AI (Llama 3.1) | Cloudflare | Ultimate fallback. On-platform, always available. | Active (V4) |

**Keyword & SEO Research** -- Volume, competition, buyer intent

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DataForSEO | dataforseo.com | Most accurate keyword volume + difficulty data. | Active |
| 2 | SerpAPI | serpapi.com | See exactly what pages rank and why. | Active |
| 3 | Qwen 3.5 Flash | SiliconFlow | Cheapest reasoning fallback for keyword clustering. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Ultimate fallback for keyword analysis. | Active (V4) |

**Document/PDF Parsing** -- Reading uploaded client briefs, PDFs, docs

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Mistral OCR | mistral.ai | Free tier. Best open OCR for documents. | Active |
| 2 | Tesseract OCR | local/HF | Open source. Free. No limits. Handles most formats. | Active |
| 3 | Google Vision OCR | google.com | Free tier 1000 units/month. Very accurate. | Active |
| 4 | Unstructured.io | unstructured.io | Converts any doc format to clean AI-ready text. | Active |

---

### WRITING & CONTENT TASKS

**Long-form Writing** -- Articles, guides, ebooks, course content (2000-5000 words)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-V3 | deepseek.com | Best free long-form quality. Avoids robotic patterns. | Active |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong long-form. Especially good for technical topics. | Active |
| 3 | Doubao 1.5 Pro | SiliconFlow | ByteDance model. Most human-like narrative flow. | Active |
| 4 | Kimi k1.5 | moonshot.cn | 10M token context. Never loses track on long docs. | Active |
| 5 | Workers AI (Llama 3.1) | Cloudflare | Emergency fallback. Shorter output but always works. | Active (V4) |
| 6 | Claude Sonnet 4.5 | anthropic.com | Best quality writing on the market. | Sleeping |
| 7 | GPT-5.4 | openai.com | Top-tier long-form. | Sleeping |

**Short Copywriting** -- Product titles, descriptions, sales copy, hooks

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-V3 | deepseek.com | Best free persuasive copywriting. Understands conversion. | Active |
| 2 | Doubao 1.5 Pro | SiliconFlow | TikTok AI. Naturally writes viral hooks. | Active |
| 3 | Qwen 3.5 Max | SiliconFlow | Strong at adapting tone per audience. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Short copy fallback. Good enough for titles/hooks. | Active (V4) |
| 5 | Claude Sonnet 4.5 | anthropic.com | Best copywriter in AI world. | Sleeping |

**SEO Formatting** -- Titles, meta descriptions, tags (constrained, precise output)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Qwen 3.5 Flash | SiliconFlow | Fastest + best at constrained output. $0.05/1M tokens. | Active |
| 2 | DeepSeek-V3 | deepseek.com | Reliable rule-following for SEO constraints. | Active |
| 3 | Mistral 7B | Groq | Ultra-fast free inference. Good SEO fallback. | Active |
| 4 | Llama 4 Scout | Fireworks AI | Free tier. Strong structured output. | Active |
| 5 | Workers AI (Llama 3.1) | Cloudflare | Structured output fallback. | Active (V4) |

**Reasoning & Analysis** -- Strategy, architecture, review, complex logic

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-R1 | deepseek.com | Best free reasoning model. Matches paid models at 5% cost. | Active |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong analytical reasoning. Great fallback. | Active |
| 3 | Phi-4 | HuggingFace | Microsoft small model. Punches above weight on logic. Free. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Basic reasoning fallback. | Active (V4) |
| 5 | Gemini 3.1 Pro | google.com | #1 ARC-AGI-2 benchmark. Best paid reasoning. | Sleeping |
| 6 | Claude Opus 4.6 | anthropic.com | Deep nuanced thinking. Best for strategy. | Sleeping |

**Code Generation** -- Web apps, APIs, SaaS, database architecture

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-Coder-V3 | deepseek.com | Purpose-built for software architecture. Best free coder. | Active |
| 2 | Qwen 3.5 (Coder) | SiliconFlow | Strong full-stack. Next.js/Supabase/CF fluent. | Active |
| 3 | DeepSeek-R1 | deepseek.com | Complex algorithmic problems needing reasoning first. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Simple code generation fallback. | Active (V4) |
| 5 | GPT-5.3 Codex | openai.com | Specialized purely for repository-scale coding. | Sleeping |
| 6 | Claude Sonnet 4.5 | anthropic.com | Best at understanding requirements -> clean code. | Sleeping |

---

### IMAGE & VISUAL TASKS

**Text-on-Image Generation** -- POD designs where text must render on fabric/products

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | FLUX.1 Pro | fal.ai | #1 in world for text rendering in images. POD essential. | Active (free credits) |
| 2 | Ideogram 3.0 | ideogram.ai | Specialized in typography + graphic design layouts. | Active (free tier) |
| 3 | SDXL | HuggingFace | Free, open. Good for illustration-style designs. | Active (free) |
| 4 | Segmind | segmind.com | Serverless SD endpoints. Fast fallback. | Active |
| 5 | Workers AI (SDXL) | Cloudflare | On-platform image gen. Basic but free. | Active (V4) |
| 6 | Midjourney | PiAPI | Highest artistic quality. Worth it for premium. | Sleeping |
| 7 | DALL-E 3 | openai.com | Reliable, clean text rendering. | Sleeping |

**Artistic Image Generation** -- Concepts, covers, illustrations, game assets

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | SDXL | HuggingFace | Best free artistic output. | Active |
| 2 | CogView-3 | Zhipu AI | Strong artistic quality. Chinese model, cheap. | Active |
| 3 | Wan 2.6 | Alibaba | Multi-image fusion. Image editing built in. | Active |
| 4 | Workers AI (SDXL) | Cloudflare | On-platform fallback. | Active (V4) |
| 5 | Midjourney | PiAPI | Best artistic quality on the market. | Sleeping |

**Image Editing/Enhancement** -- Mockups, background removal, resizing

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Cloudflare Images | CF built-in | Already in your plan. Transform, resize, optimize. | Active |
| 2 | Clipdrop | clipdrop.co | Background removal, upscaling. Free tier. | Active |
| 3 | fal.ai | fal.ai | Fast inference for any open image model. | Active |

**Mockup Generation** -- Place designs on real product photos

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Printful Mockup API | printful.com | Free. Real product catalog mockups. | Active |
| 2 | Printify Mockup API | printify.com | Free. Different product catalog. | Active |
| 3 | Placeit | placeit.net | Lifestyle mockups. Person wearing shirt. | Sleeping |

---

### AUDIO & MUSIC TASKS

**Music Generation** -- Loops, intros, stingers, background tracks

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Suno | suno.com | Best overall audio quality. All genres. 50 songs/day free. | Active |
| 2 | Udio | udio.com | Different sonic character. Strong for specific genres. | Active |
| 3 | MusicGen | HuggingFace | Open source. Free. No limits. Good instrumentals. | Active |
| 4 | Stable Audio | stability.ai | Strong for sound design, stingers, ambience. | Active |
| 5 | Udio Pro | udio.com | Higher quality, longer generation. | Sleeping |

**Voice / TTS** -- Narration, podcast intros, voiceovers

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Kokoro TTS | HuggingFace | Open source. Free. Surprisingly good quality. | Active |
| 2 | Coqui TTS | local/HF | Open source. Multiple voices. No API cost. | Active |
| 3 | Google TTS | google.com | Free tier. Very clean output. | Active |
| 4 | Workers AI (Whisper) | Cloudflare | On-platform TTS/STT. Free with plan. | Active (V4) |
| 5 | Cartesia Sonic | cartesia.ai | Sub-100ms latency. Best for real-time voice. | Sleeping |
| 6 | ElevenLabs | elevenlabs.io | Best voice quality + emotion on market. | Sleeping |

---

### PLATFORM VARIATION TASKS

**Platform Variation AI** -- Rewrites content per platform rules

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Qwen 3.5 Flash | SiliconFlow | Fastest at rule-based rewriting tasks. | Active |
| 2 | DeepSeek-V3 | deepseek.com | Better at maintaining quality while adapting tone. | Active |
| 3 | Doubao 1.5 Lite | SiliconFlow | Micro-model. Perfect for fast variation generation. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Variation fallback. | Active (V4) |

**Social Media Adaptation** -- Rewrites per platform (TikTok vs LinkedIn vs Pinterest)

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Doubao 1.5 Pro | SiliconFlow | ByteDance. Naturally understands social platform patterns. | Active |
| 2 | DeepSeek-V3 | deepseek.com | Best at tone adaptation across platforms. | Active |
| 3 | Qwen 3.5 Max | SiliconFlow | Strong creative writing for social. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Social fallback. | Active (V4) |

**Humanizer AI** -- Makes AI output sound human, not robotic

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | Doubao 1.5 Pro | SiliconFlow | Most human-like conversational output. | Active |
| 2 | DeepSeek-V3 | deepseek.com | Naturally avoids AI writing patterns. | Active |
| 3 | MiniMax M2.5 | minimax.io | Best "human-like flow" in industry. | Active |
| 4 | Workers AI (Llama 3.1) | Cloudflare | Basic humanizer fallback. | Active (V4) |
| 5 | Claude Sonnet 4.5 | anthropic.com | Lowest AI-detection score of any model. | Sleeping |

**Final Quality Review** -- Multi-criteria review of entire output package

| # | Model | Provider | Why | Status |
|---|-------|----------|-----|--------|
| 1 | DeepSeek-R1 | deepseek.com | Reasoning model. Evaluates from multiple angles. | Active |
| 2 | Qwen 3.5 Max | SiliconFlow | Strong checklist-following and gap detection. | Active |
| 3 | Workers AI (Llama 3.1) | Cloudflare | Basic review fallback. | Active (V4) |
| 4 | Claude Opus 4.6 | anthropic.com | Most nuanced reviewer on the market. | Sleeping |
| 5 | GPT-5.4 High | openai.com | PhD-level logic for final review. | Sleeping |

---

## PART 7 -- PLATFORM VARIATION ENGINE

### The Problem It Solves

Same product should NOT have the same listing everywhere.
Each platform has different buyers, different SEO, different tone.

### Platform Rules (Stored in KV for fast reads, D1 for edits)

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
      "seo_style": "Problem -> solution keywords",
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

## PART 8 -- SOCIAL MEDIA ENGINE

### Auto vs Manual (Global Setting + Per-Product Override)

```
Settings -> Publishing -> Social Media Mode
  [o Auto-post when CEO approves]
  [o Manual -- I post myself]

Per product override available on product setup form.
```

### Social Platform Rules (Stored in KV for fast reads, D1 for edits)

```json
{
  "social_channels": {
    "instagram": {
      "caption_max_chars": 2200,
      "hashtag_count": 30,
      "tone": "Visual, aspirational, lifestyle-focused",
      "format": "Hook line -> value -> CTA -> hashtags",
      "content_types": ["single image", "carousel", "reel script"]
    },
    "tiktok": {
      "hook_max_chars": 150,
      "tone": "Fast, punchy, entertaining, trend-aware",
      "format": "Strong hook (1-3 seconds) -> problem -> solution -> CTA",
      "content_types": ["video script", "hook + 3 points + CTA"]
    },
    "pinterest": {
      "title_max_chars": 100,
      "description_max_chars": 500,
      "tone": "Inspirational, search-optimized, idea-focused",
      "format": "Keyword-rich title -> what it is -> who it's for -> link",
      "content_types": ["pin title + description"]
    },
    "linkedin": {
      "post_max_chars": 3000,
      "tone": "Professional, insight-driven, authority-building",
      "format": "Bold opening statement -> 3-5 insights -> professional CTA",
      "content_types": ["article post", "insight post"]
    },
    "x_twitter": {
      "tweet_max_chars": 280,
      "thread_max_tweets": 10,
      "tone": "Direct, witty, value-dense, conversation-starting",
      "format": "Hook tweet -> 5-7 value tweets -> CTA tweet",
      "content_types": ["single tweet", "thread"]
    }
  }
}
```

---

## PART 9 -- PROMPT ENGINEERING SYSTEM

### The Layered Prompt Architecture

Every AI call in NEXUS uses a layered prompt. Not a single prompt.
Layers stack on top of each other.

```
Layer A: MASTER SYSTEM PROMPT
         (applies to ALL tasks, ALL domains)
              |
Layer B: ROLE PROMPT
         (specific role for this task: researcher, writer, designer)
              |
Layer C: DOMAIN PROMPT
         (domain-specific knowledge: POD rules, digital product norms)
              |
Layer D: CATEGORY PROMPT
         (category-specific rules: Notion templates vs PDF guides)
              |
Layer E: PLATFORM PROMPT
         (platform-specific SEO + tone rules)
              |
Layer F: TASK PROMPT
         (the actual specific instruction for this step)
              |
Layer G: USER INPUT INJECTION
         (what the user filled in -- optional fields)
              |
Layer H: OUTPUT SCHEMA
         (exact JSON structure expected back)
              |
Layer I: CONTEXT INJECTION (NEW in V4)
         (previous step results, cached research, product history)
```

### Layer A: Master System Prompt (Apply to All)

```
You are NEXUS -- a world-class AI business engine.

You operate with the mindset of:
- A senior marketing strategist with 15 years of e-commerce experience
- A professional copywriter who understands consumer psychology deeply
- An SEO specialist who knows how platforms rank and reward listings
- A creative director who understands what converts browsers to buyers

Core rules you ALWAYS follow:
1. Never produce generic AI-sounding output. Write like a real expert human.
2. Always think about the END BUYER -- their emotions, desires, fears, language.
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
Avoid cliches, avoid fluff, avoid anything that sounds like it was AI-generated.
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
- Price competition is real -- differentiation must come from niche specificity and design quality
- Etsy and Redbubble are the primary discovery channels -- optimize for both
```

**Digital Products Domain:**
```
Domain context: Digital Products (instant download)
Key facts:
- Buyers want transformation, not information -- sell the outcome not the content
- No physical shipping -- speed and instant access are key selling points
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

### Layer I: Context Injection (NEW in V4)

```
Previous context from this workflow:
- Research findings: {step_1_research_output}
- Strategy decisions: {step_2_strategy_output}
- Similar products from cache: {cached_similar_products}
- Revision feedback (if revision): {ceo_feedback}

Use this context to:
1. Build on research findings, don't contradict them
2. Follow strategy decisions made earlier
3. Learn from similar products that performed well
4. Address ALL revision feedback points specifically
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

## PART 10 -- CEO APPROVAL LOOP

### Review Screen (Every Workflow Ends Here)

```
+-----------------------------------------------------+
|  CEO REVIEW -- Notion Templates > Freelancer CRM     |
|                                                      |
|  AI Score: 8.4/10 -- Ready for review                |
|  AI Model Used: DeepSeek-R1 (health: 97%)            |
|  Cache Hits: 2 (research + SEO reused)               |
|  Total Cost: $0.00                                   |
|                                                      |
|  +---------------+  +---------------+                |
|  |   TITLE       |  |  ETSY SCORE   |                |
|  | Freelancer    |  | SEO: 9/10     |                |
|  | CRM Notion    |  | Title: 8/10   |                |
|  | Template      |  | Tags: 9/10    |                |
|  +---------------+  +---------------+                |
|                                                      |
|  DESCRIPTION PREVIEW:                                |
|  [Preview text here...]                              |
|                                                      |
|  PLATFORM VARIANTS:                                  |
|  [Etsy] [Gumroad] [Payhip] -- click to preview each |
|                                                      |
|  SOCIAL CONTENT:                                     |
|  [Instagram] [TikTok] [Pinterest] -- click to preview|
|                                                      |
|  -------------------------------------------------  |
|                                                      |
|  [ APPROVE -- SEND TO PUBLISH ] [ REJECT ]           |
|                                                      |
|  If rejecting, tell AI what to fix:                  |
|  [_____________________________________________]     |
|                                                      |
|  Examples:                                           |
|  - "Title too generic, make it more niche-specific"  |
|  - "Description sounds robotic in paragraph 2"       |
|  - "Price too low, raise to $27"                     |
|  - "TikTok hook is weak, punch it up"                |
|                                                      |
|  [ SEND BACK TO AI WITH FEEDBACK ]                   |
+-----------------------------------------------------+
```

### Rejection -> Revision Loop

```
CEO rejects with feedback
         |
         v
Worker receives: { feedback: "...", original_output: {...} }
         |
         v
Only the FAILED sections are regenerated (not the whole workflow)
Context injection (Layer I) includes: original output + CEO feedback
         |
         v
New output returned -> CEO review screen again
         |
         v
Repeat until CEO approves
         |
         v
Status: APPROVED -> Platform Variation Engine runs
```

### Revision History (Stored in D1)

Every revision is saved:
```sql
CREATE TABLE revision_history (
  id          TEXT PRIMARY KEY,
  product_id  TEXT REFERENCES products(id) ON DELETE CASCADE,
  version     INTEGER,
  output      JSON,
  feedback    TEXT,
  ai_score    REAL,
  ai_model    TEXT,    -- V4: which model generated this version
  reviewed_at TEXT,
  decision    TEXT  -- 'approved' | 'rejected'
);
```

---

## PART 11 -- FULL DATABASE SCHEMA (Cloudflare D1)

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
  batch_id      TEXT,   -- V4: links products created in same batch
  status        TEXT DEFAULT 'draft',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT
);

-- Individual workflow runs per product
CREATE TABLE workflow_runs (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  batch_id      TEXT,   -- V4: batch tracking
  status        TEXT DEFAULT 'queued',
  started_at    TEXT,
  completed_at  TEXT,
  current_step  TEXT,
  total_steps   INTEGER,
  total_tokens  INTEGER DEFAULT 0,  -- V4: token tracking
  total_cost    REAL DEFAULT 0,     -- V4: cost tracking
  cache_hits    INTEGER DEFAULT 0,  -- V4: cache hit count
  error         TEXT
);

-- Individual steps within a workflow
CREATE TABLE workflow_steps (
  id            TEXT PRIMARY KEY,
  run_id        TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,
  step_order    INTEGER,
  status        TEXT DEFAULT 'waiting',
  ai_used       TEXT,  -- which model actually ran
  ai_tried      JSON,  -- all models tried before success
  input         JSON,
  output        JSON,
  tokens_used   INTEGER,
  cost          REAL DEFAULT 0,      -- V4: cost per step
  cached        BOOLEAN DEFAULT false, -- V4: was this a cache hit?
  latency_ms    INTEGER,             -- V4: response time
  started_at    TEXT,
  completed_at  TEXT
);

-- Generated assets (files stored in R2)
CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
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
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
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
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  channel_id    TEXT REFERENCES social_channels(id),
  content       JSON,  -- { caption, hashtags, hook, thread, etc }
  status        TEXT DEFAULT 'draft',
  scheduled_at  TEXT,
  published_at  TEXT
);

-- CEO review history
CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  run_id        TEXT REFERENCES workflow_runs(id),
  version       INTEGER DEFAULT 1,
  ai_score      REAL,
  ai_model      TEXT,    -- V4: which model did the review
  decision      TEXT,    -- 'approved' | 'rejected'
  feedback      TEXT,
  reviewed_at   TEXT DEFAULT (datetime('now'))
);

-- Revision history (full audit trail)
CREATE TABLE revision_history (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  version       INTEGER,
  output        JSON,
  feedback      TEXT,
  ai_score      REAL,
  ai_model      TEXT,
  reviewed_at   TEXT,
  decision      TEXT  -- 'approved' | 'rejected'
);

-- Prompt templates (editable from dashboard Prompt Manager)
CREATE TABLE prompt_templates (
  id            TEXT PRIMARY KEY,
  layer         TEXT,   -- 'master' | 'role' | 'domain' | 'category' | 'platform' | 'social' | 'review' | 'context'
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
  task_type           TEXT,      -- 'writing' | 'research' | 'image' | 'audio' | 'seo' | 'review' | 'code' | 'variation' | 'social' | 'humanizer'
  rank                INTEGER,   -- failover priority (1 = try first)
  api_key_secret_name TEXT,      -- name of CF Secret holding the key (null for Workers AI)
  is_workers_ai       BOOLEAN DEFAULT false,  -- V4: true = on-platform, no key needed
  status              TEXT DEFAULT 'active',  -- 'active' | 'sleeping' | 'rate_limited'
  rate_limit_reset_at TEXT,
  daily_limit_reset_at TEXT,
  is_free_tier        BOOLEAN DEFAULT true,
  health_score        INTEGER DEFAULT 100,     -- V4: reliability score 0-100
  total_calls         INTEGER DEFAULT 0,       -- V4: lifetime calls
  total_failures      INTEGER DEFAULT 0,       -- V4: lifetime failures
  avg_latency_ms      INTEGER DEFAULT 0,       -- V4: average response time
  notes               TEXT
);

-- V4: Analytics tracking
CREATE TABLE analytics (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,  -- 'workflow_complete' | 'ai_call' | 'cache_hit' | 'failover' | 'error'
  product_id    TEXT,
  run_id        TEXT,
  ai_model      TEXT,
  tokens_used   INTEGER,
  cost          REAL DEFAULT 0,
  latency_ms    INTEGER,
  cached        BOOLEAN DEFAULT false,
  metadata      JSON,
  created_at    TEXT DEFAULT (datetime('now'))
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
-- batch_max_products: 10
-- cache_enabled: true
-- ai_gateway_enabled: true
```

---

## PART 12 -- DASHBOARD SECTIONS (Complete UI Map)

```
NEXUS Dashboard
|-- Home (Domain Cards)
|   +-- Click Domain -> Category Cards
|       +-- Click Category -> Product Setup Form
|           +-- Fill optional fields -> Start Workflow
|               +-- Live Progress Screen (with AI model + cost tracking)
|                   +-- CEO Review Screen
|                       +-- Approve -> Publish Center
|                       +-- Reject -> Feedback -> AI Revision
|
|-- Products
|   |-- All products list with status
|   |-- Filter by: domain, category, status, platform, batch
|   |-- Batch view: group products by batch ID (V4)
|   +-- Click product -> full detail + platform variants
|
|-- Review Center
|   |-- Pending Review (badge count)
|   |-- In Revision
|   +-- Review history
|
|-- Publishing Center
|   |-- Approved & ready to publish
|   |-- Select platforms + channels
|   |-- Manual publish (copy/export per platform)
|   +-- Auto-publish queue (if auto mode)
|
|-- Content Manager
|   |-- All generated assets (images, PDFs, audio)
|   |-- Delete -> removes from R2 + CF Images + D1 + KV cache
|   +-- Download / preview
|
|-- Prompt Manager
|   |-- Master prompt (edit)
|   |-- Role prompts (edit per role type)
|   |-- Domain prompts (edit per domain)
|   |-- Category prompts (edit per category)
|   |-- Platform prompts (edit per platform)
|   |-- Social prompts (edit per channel)
|   |-- Context injection template (edit) (V4)
|   +-- Review/CEO prompt (edit)
|
|-- AI Manager
|   |-- View all AI models + current status + health scores (V4)
|   |-- Active / Sleeping / Rate Limited badges
|   |-- Health score bars per model (V4)
|   |-- Add API key -> model activates instantly
|   |-- Remove API key -> model sleeps instantly
|   |-- Failover chain order (drag to reorder)
|   |-- Workers AI status (always active, no key needed) (V4)
|   +-- AI Gateway dashboard link (V4)
|
|-- Platform Manager
|   |-- All platforms list
|   |-- Edit platform rules (title limit, tone, SEO style)
|   |-- Add new platform
|   +-- Delete platform
|
|-- Social Channel Manager
|   |-- All channels list
|   |-- Edit channel rules
|   |-- Global posting mode: Auto / Manual
|   |-- Add new channel
|   +-- Connect channel (for auto-posting)
|
|-- Domain & Category Manager
|   |-- All domains (edit, reorder, delete)
|   |-- All categories per domain (edit, reorder, delete)
|   |-- Add new domain
|   +-- Add new category to any domain
|
|-- Analytics (NEW in V4)
|   |-- Total products created (all time / this month)
|   |-- AI usage: tokens per provider, cost breakdown
|   |-- Cache hit rate (% of AI calls saved by cache)
|   |-- Most used AI models (ranked by calls)
|   |-- AI health leaderboard (ranked by reliability)
|   |-- Average workflow time
|   |-- Products by domain/category breakdown
|   +-- Cost savings from free-tier vs what paid would cost
|
|-- History
|   |-- All past workflow runs
|   |-- Tokens used per run
|   |-- AI models used per step
|   |-- Cache hits per run (V4)
|   |-- Cost per run (V4)
|   +-- Revision history
|
+-- Settings
    |-- Social posting mode (Auto / Manual)
    |-- Default language
    |-- CEO review: required / optional
    |-- Auto-publish after approval: on/off
    |-- Batch max products (1-10) (V4)
    |-- AI response caching: on/off (V4)
    |-- AI Gateway: enabled/disabled (V4)
    |-- API key management (add/remove -> CF Secrets)
    +-- Account preferences
```

---

## PART 13 -- FILE STRUCTURE

```
nexus/
|-- apps/
|   |-- web/                          # Next.js frontend (CF Pages)
|   |   |-- app/
|   |   |   |-- page.tsx              # Domain cards (home)
|   |   |   |-- [domain]/
|   |   |   |   |-- page.tsx          # Category cards
|   |   |   |   +-- [category]/
|   |   |   |       +-- page.tsx      # Product setup form
|   |   |   |-- workflow/[id]/
|   |   |   |   +-- page.tsx          # Live progress (with AI + cost tracking)
|   |   |   |-- review/[id]/
|   |   |   |   +-- page.tsx          # CEO review screen
|   |   |   |-- products/page.tsx
|   |   |   |-- publish/page.tsx
|   |   |   |-- prompts/page.tsx
|   |   |   |-- ai-manager/page.tsx
|   |   |   |-- platforms/page.tsx
|   |   |   |-- social/page.tsx
|   |   |   |-- analytics/page.tsx    # V4: Analytics dashboard
|   |   |   |-- history/page.tsx
|   |   |   +-- settings/page.tsx
|   |   +-- components/
|   |       |-- DomainCard.tsx
|   |       |-- CategoryCard.tsx
|   |       |-- ProductSetupForm.tsx
|   |       |-- BatchProgress.tsx     # V4: Batch workflow view
|   |       |-- WorkflowProgress.tsx
|   |       |-- ReviewScreen.tsx
|   |       |-- PlatformVariantPreview.tsx
|   |       |-- SocialVariantPreview.tsx
|   |       |-- AIStatusBadge.tsx
|   |       |-- AIHealthBar.tsx       # V4: Health score visualization
|   |       |-- AnalyticsCharts.tsx   # V4: Usage charts
|   |       +-- CacheIndicator.tsx    # V4: Cache hit/miss indicator
|   |
|   +-- workers/                      # Cloudflare Workers (5 specialized)
|       |
|       |-- nexus-router/             # Entry point worker
|       |   |-- src/
|       |   |   +-- index.ts          # Hono.js router, auth, validation
|       |   +-- wrangler.toml         # Service bindings to other workers
|       |
|       |-- nexus-ai/                 # AI engine worker
|       |   |-- src/
|       |   |   |-- index.ts          # AI worker entry
|       |   |   |-- failover.ts       # Enhanced failover engine (V4)
|       |   |   |-- cache.ts          # V4: AI response caching layer
|       |   |   |-- gateway.ts        # V4: AI Gateway integration
|       |   |   |-- health.ts         # V4: Health scoring system
|       |   |   |-- registry.ts       # All AI model configs
|       |   |   |-- workers-ai.ts     # V4: Workers AI fallback caller
|       |   |   +-- callers/          # One file per AI provider
|       |   |       |-- deepseek.ts
|       |   |       |-- qwen.ts
|       |   |       |-- suno.ts
|       |   |       |-- flux.ts
|       |   |       +-- ...
|       |   +-- wrangler.toml
|       |
|       |-- nexus-workflow/           # Workflow engine worker
|       |   |-- src/
|       |   |   |-- index.ts          # Workflow worker entry
|       |   |   |-- engine.ts         # CF Workflows manager
|       |   |   |-- steps.ts          # Step definitions per domain/category
|       |   |   +-- batch.ts          # V4: Batch workflow orchestrator
|       |   +-- wrangler.toml
|       |
|       |-- nexus-variation/          # Variation engine worker
|       |   |-- src/
|       |   |   |-- index.ts          # Variation worker entry
|       |   |   |-- platform.ts       # Platform variation engine
|       |   |   |-- social.ts         # Social adaptation engine
|       |   |   +-- humanizer.ts      # Humanizer pass
|       |   +-- wrangler.toml
|       |
|       +-- nexus-storage/            # Storage operations worker
|           |-- src/
|           |   |-- index.ts          # Storage worker entry
|           |   |-- r2.ts             # R2 operations (upload/delete)
|           |   |-- d1.ts             # D1 query helpers
|           |   |-- kv.ts             # KV cache helpers (config + AI cache)
|           |   |-- images.ts         # CF Images operations
|           |   +-- cleanup.ts        # Synced deletion across all services
|           +-- wrangler.toml
|
|-- migrations/                       # D1 SQL migrations
|   |-- 001_initial_schema.sql
|   +-- 002_v4_analytics.sql          # V4: Analytics + health tracking
|
|-- packages/                         # Shared code between workers
|   +-- shared/
|       |-- types.ts                  # Shared TypeScript types
|       |-- constants.ts              # Shared constants
|       +-- utils.ts                  # Shared utilities
|
+-- prompts/                          # Prompt templates (seeded to KV)
    |-- master.txt
    |-- roles/
    |   |-- researcher.txt
    |   |-- copywriter.txt
    |   |-- seo.txt
    |   +-- reviewer.txt
    |-- domains/
    |   |-- digital-products.txt
    |   |-- pod.txt
    |   +-- ...
    +-- categories/
        |-- notion-templates.txt
        |-- t-shirts.txt
        +-- ...
```

---

## PART 14 -- SECRETS & API KEYS (All in CF Secrets Store)

```
# === ACTIVE NOW (free/cheap) ===
TAVILY_API_KEY          # tavily.com
EXA_API_KEY             # exa.ai
SERPAPI_KEY              # serpapi.com
DEEPSEEK_API_KEY         # deepseek.com (near-zero cost)
DASHSCOPE_API_KEY        # SiliconFlow (Qwen + Doubao + MiniMax)
SILICONFLOW_API_KEY      # siliconflow.cn (aggregator)
FIREWORKS_API_KEY        # fireworks.ai (free Llama/Mixtral)
GROQ_API_KEY             # groq.com (ultra-fast free)
HF_TOKEN                 # huggingface.co (open models)
FAL_API_KEY              # fal.ai (FLUX free credits)
OPENROUTER_API_KEY       # openrouter.ai (free model access)
MOONSHOT_API_KEY          # moonshot.cn (Kimi free tier)
DATAFORSEO_KEY           # dataforseo.com (free tier)
PRINTFUL_API_KEY         # printful.com (free mockups)
PRINTIFY_API_KEY         # printify.com (free mockups)
SUNO_API_KEY             # suno.com (50 songs/day free)

# === NO KEY NEEDED (included in $5 plan) === (V4)
# Workers AI          -- @cf/meta/llama-3.1-8b-instruct (text)
# Workers AI          -- @cf/stabilityai/stable-diffusion-xl-base-1.0 (images)
# Workers AI          -- @cf/openai/whisper (speech)
# AI Gateway          -- logging, caching, rate limiting
# CF Images           -- image CDN + transform

# === ADD WHEN READY (sleeping until key added) ===
ANTHROPIC_API_KEY        # Claude Sonnet + Opus
OPENAI_API_KEY           # GPT-5
GOOGLE_API_KEY           # Gemini 3.1 Pro
MIDJOURNEY_API_KEY       # Via PiAPI partner
IDEOGRAM_API_KEY         # ideogram.ai
ELEVENLABS_API_KEY       # ElevenLabs voice
CARTESIA_API_KEY         # Cartesia sub-100ms TTS
PERPLEXITY_API_KEY       # Perplexity research
PLACEIT_API_KEY          # Lifestyle mockups
```

**Adding a key activates that AI instantly -- no code change needed.**
**Removing a key puts it back to sleep instantly.**
**Workers AI + AI Gateway need NO key -- they're on-platform, always active.**

---

## PART 15 -- V4 SMART FEATURES SUMMARY (What's New)

| Feature | V2/V3 | V4 |
|---------|-------|----|
| **Workers AI fallback** | Not used | Every text chain ends with Workers AI. Text tasks NEVER fail. |
| **AI Gateway** | Not used | All external AI calls routed through gateway. Free logging, caching, analytics. |
| **AI response caching** | None | SHA-256 prompt hash -> KV cache with task-type TTLs. Saves 30-50% AI calls. |
| **AI health scoring** | None | Track reliability, latency, failure rates per model. Auto-suggest reordering. |
| **Batch workflows** | None | Generate 1-10 unique product variations from one setup form. Sequential queue. |
| **Cost tracking** | None | Tokens used, cost per step, cost per run, cost per product. All in analytics. |
| **Analytics dashboard** | None | Full section: usage charts, cache hit rates, AI leaderboard, cost breakdown. |
| **Workflow cancellation** | None | Cancel running workflow from progress screen. |
| **Context injection** | None | Layer I: previous step results + cached research fed to later steps. |
| **Cache-aware deletion** | Basic | Delete invalidates AI cache + AI Gateway cache in addition to D1/R2/KV/Images. |
| **5-worker architecture** | V3 only | Inherited from V3 + nexus-ai now includes cache + gateway + health layers. |
| **CF Workflows** | V3 only | Inherited from V3. Sleeps free between steps. |
| **Service Bindings** | V3 only | Inherited from V3. Free internal routing between workers. |
| **$5/month exploitation** | V3 only | Inherited from V3 + added Workers AI + AI Gateway to the plan usage. |

---

## SUMMARY

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend | Next.js on CF Pages | $0 |
| Backend | 5x CF Workers (Hono.js) via Service Bindings | Included in $5/mo |
| Database | CF D1 | Included |
| Files | CF R2 | Included (10GB) |
| Images | CF Images | Included |
| Workflow State | CF Workflows (Durable Objects) | Included |
| Config Cache | CF KV | Included |
| AI Response Cache | CF KV | Included |
| AI Monitoring | CF AI Gateway | Included ($0) |
| AI Fallback | CF Workers AI (Llama 3.1 + SDXL) | Included (10K neurons/day) |
| API Keys | CF Secrets Store | Included |
| **Total Infrastructure** | **100% Cloudflare** | **$5/month** |

**All 10 domains run right now with zero paid AIs.**
**Workers AI ensures text tasks NEVER fail -- even if every external API is down.**
**AI Gateway caches responses -- same prompt = instant result, zero cost.**
**Add any paid AI key later -> activates instantly, no setup.**
**Delete anything from dashboard -> deleted from ALL Cloudflare storage + caches automatically.**
**Analytics show exactly what you spent, what you saved, and which AIs perform best.**
