# NEXUS — Final Complete Architecture

## 1. Purpose

NEXUS is a **dashboard-driven, AI-powered product operating system** for creating, adapting, reviewing, approving, and publishing outputs across multiple domains.

It is designed for:
- personal use first
- Cloudflare-first infrastructure
- free-first AI routing
- paid AI providers sleeping until API keys are added
- human approval before final output is accepted
- dashboard configuration instead of hardcoded workflows

The system is not just an AI generator. It is a **configurable workflow platform** with:
- domain cards
- dynamic categories
- platform-aware variations
- social-aware variations
- prompt-engineered AI roles
- failover routing
- version history
- approval loops
- publishing and export flows

---

## 2. Core Principles

1. **Config-driven, not hardcoded**
   - Domains, categories, platforms, social channels, prompt templates, and workflow steps must be manageable from the dashboard.

2. **Free-first routing**
   - Active chains should prioritize free or free-tier providers.
   - Paid providers stay sleeping by default until API keys are configured.

3. **Task-based AI specialization**
   - Each AI role handles the task it is best at.
   - One AI should not do everything.

4. **Human approval is mandatory**
   - Every output must pass through a Boss/CEO approval step.
   - Rejected outputs go back into revision until approved.

5. **Platform-specific output**
   - The same product should be adapted to each selected platform.
   - Do not reuse the same exact copy everywhere.

6. **Social-specific output**
   - Each selected social channel should get its own adapted content.

7. **Version everything**
   - Outputs, prompts, reviews, and revisions must all be versioned.

8. **Regenerate only what is needed**
   - Users must be able to regenerate a title, price, platform variation, or social post without rerunning the whole workflow.

---

## 3. Product Model

NEXUS should be treated as a **product OS** with reusable engines.

### Main workflow skeleton

```text
Input
→ Research
→ Planning
→ Creation
→ Platform adaptation
→ Social adaptation
→ Marketing optimization
→ Review
→ Boss approval
→ Publish / Export
```

### One-product execution flow

```text
Choose Card
→ Choose Category
→ Enter Idea / Goal / Niche
→ Choose Platform(s)
→ Choose Social Media Yes/No
→ If Yes, choose Channels
→ Run Researcher AI
→ Run Planner AI
→ Run Creator AI
→ Run Platform Adapter AI
→ Run Marketing AI
→ Run Social AI
→ Run Reviewer AI
→ Boss Approval
→ Approve = Ready to Publish
→ Reject = Send Revision Notes
→ Regenerate only failed/selected parts
→ Approve
→ Publish / Export
```

---

## 4. Domain Cards

The dashboard home should show cards such as:

- Website Building
- Code / App Building
- Music Making
- Video Making
- Picture / Image Making
- Story Maker with Images
- Ads / Marketing Making
- Search / Research
- Game Making
- Sell Games / Digital Products
- Payment Gateways
- Animation Making
- All-in-One AI
- Watermark Removal
- Voice / Custom AI Voice
- Prompt / Component Libraries
- Print-on-Demand (POD)
- Digital Products
- Music & Audio
- Freelance Arbitrage
- Affiliate Marketing
- E-Commerce & Retail
- Dropshipping Automation
- Inventory & Logistics
- Marketplace Optimization
- Digital Assets & Media
- Music & Audio Branding
- Visual Assets
- Digital Printables
- Video Content Production
- Professional Services
- Software Development
- Technical Writing
- SEO & Digital Marketing
- Legal & Compliance
- Business Operations
- E-Learning & Courses
- Paid Newsletters
- Skill Certification
- Coaching & Consultative Tools
- AI Implementation Agency
- Cybersecurity Consulting
- PropTech
- HealthTech (non-medical)
- Automation & No-Code Tools
- Space-related / Experimental domains

### Card behavior
When the user clicks a card:
- open the card detail page
- show categories inside that card
- show product or service subtype options
- allow selecting one or many platforms
- allow selecting whether social content should be generated
- allow selecting one or many social channels
- show workflow progress and outputs

---

## 5. Dynamic Configuration Requirements

The platform must allow adding and editing from the dashboard:

- domains/cards
- categories
- platforms
- social channels
- prompt presets
- AI roles
- workflow templates
- publishing targets

### Required actions
For each config item, support:
- add
- edit
- disable
- archive
- reorder / set priority

This ensures the system can grow without code changes.

---

## 6. Dashboard Information Architecture

### 6.1 Home
- domain cards
- quick stats
- recent workflow runs
- approval queue summary
- provider status summary

### 6.2 Domains
- list all domain cards
- add new card
- edit card settings
- manage categories within the card

### 6.3 Categories
- create category under a domain
- set category rules
- attach prompt presets
- attach workflow template

### 6.4 Products / Outputs
- list all generated products or deliverables
- filter by domain, category, status, version, platform
- open detail view

### 6.5 Workflow Runs
- show job history
- show provider path taken
- show retries and failovers
- show errors and warnings

### 6.6 Platforms
- add/edit supported platforms
- define SEO and audience rules
- define title/description/CTA constraints

### 6.7 Social Channels
- add/edit channels
- define channel-specific tone, length, hooks, hashtags, CTA style

### 6.8 Prompt Studio
- manage prompt templates
- manage prompt versions
- test prompts
- compare outputs by prompt version

### 6.9 AI Router
- provider list
- active / sleeping / cooldown states
- fallback order by task type
- usage and limit status

### 6.10 Review Center
- outputs waiting for approval
- approve / reject / request revision
- review notes history

### 6.11 Assets Library
- generated images
- PDFs
- audio
- video
- mockups
- ZIP exports
- prompt output files

### 6.12 Publish Center
- export bundles
- publish-ready outputs
- platform-specific packages
- later direct publishing jobs

### 6.13 Settings
- project settings
- cleanup policies
- provider connection status
- secret/config status
- backup/export settings

---

## 7. Card Detail Page Design

Each card detail page should include:

### Input area
- product/service idea
- niche / target audience
- optional notes
- optional files/assets

### Structure area
- category selector
- workflow template selector
- prompt preset selector

### Platform area
- multi-select platforms
- add platform button
- platform-specific variation toggle

### Social area
- social yes/no toggle
- if yes, show multi-select list of channels
- add social channel button

### Workflow area
- step-by-step status
- Researcher result
- Planner result
- Creator result
- Platform variants
- Social variants
- Reviewer notes
- Boss approval section

### Revision area
- revision notes
- regenerate selected components only

---

## 8. AI Role Architecture

### 8.1 Researcher AI
Purpose:
- trends
- competitors
- pricing
- keywords
- market gaps
- audience behavior
- platform patterns

Output:
- structured research summary
- competitor comparison
- pricing range
- SEO opportunity map

### 8.2 Planner / Architect AI
Purpose:
- product structure
- deliverable structure
- strategy
- workflow planning
- information architecture

Output:
- outline
- product/service structure
- stage plan
- offer architecture

### 8.3 Creator AI
Purpose:
- generate the main output

Possible outputs:
- product title
- listing copy
- image prompts
- audio prompts
- code
- app spec
- article draft
- documentation draft
- course content
- game concept

### 8.4 Platform Adapter AI
Purpose:
- adapt one output for each selected platform

Examples:
- Etsy version
- Gumroad version
- Shopify version
- Redbubble version
- Steam-style version

### 8.5 Marketing AI
Purpose:
- pricing suggestion
- persuasive descriptions
- high-converting hooks
- CTAs
- SEO titles
- tags / keywords
- positioning
- marketing psychology
- more humanized tone

### 8.6 Social AI
Purpose:
- create channel-specific promotional content

Examples:
- Instagram caption
- TikTok hook/script
- X thread
- LinkedIn post
- Pinterest title/description
- Facebook post
- YouTube Shorts text

### 8.7 Reviewer AI
Purpose:
- check quality
- check completeness
- check platform fit
- check SEO strength
- check natural tone
- check price logic
- check consistency
- flag policy or risk issues

Output:
- pass/fail
- issues found
- revision notes

### 8.8 Boss / CEO Approval
Purpose:
- final human approval

Actions:
- approve
- reject
- approve with notes
- request revision
- approve only some variants

Rule:
- no output is final until approved

---

## 9. Prompt Architecture

Prompts must be written and stored like they were built by a professional prompt engineer.

### 9.1 Prompt layers

#### Layer 1 — Master System Prompt
Defines:
- identity of the AI
- quality bar
- truthfulness rules
- formatting discipline
- banned behavior

#### Layer 2 — Role Prompt
Defines the role:
- Researcher
- Planner
- Creator
- Adapter
- Marketing
- Social
- Reviewer

#### Layer 3 — Domain Prompt
Defines domain-specific rules:
- POD
- digital products
- game making
- music
- services
- coding
- research
- etc.

#### Layer 4 — Category Prompt
Defines subtype behavior:
- planner
- template
- poster
- t-shirt
- newsletter issue
- landing page
- app MVP
- etc.

#### Layer 5 — Platform Prompt
Defines platform-specific adaptation:
- SEO rules
- title length
- buyer tone
- CTA style
- description style
- tags behavior

#### Layer 6 — Social Prompt
Defines channel-specific adaptation:
- hook style
- length
- tone
- hashtags
- CTA style
- emoji behavior

#### Layer 7 — Output Schema
Forces structured output.

#### Layer 8 — Quality Rules
Examples:
- avoid generic content
- avoid robotic tone
- make output commercially useful
- be specific
- optimize for conversion without sounding fake

#### Layer 9 — Revision Prompt
Used when the Boss rejects output and provides notes.

### 9.2 Prompt storage
Store prompts in:
- Markdown files for editable source
- database records for active versions and configuration

Suggested prompt folder structure:

```text
prompts/
  master/
    system.md
    quality-rules.md
  roles/
    researcher.md
    planner.md
    creator.md
    adapter.md
    marketing.md
    social.md
    reviewer.md
  domains/
    digital-products.md
    pod.md
    music.md
    services.md
    coding.md
  platforms/
    etsy.md
    gumroad.md
    shopify.md
    redbubble.md
  social/
    instagram.md
    tiktok.md
    x.md
    linkedin.md
    pinterest.md
```

### 9.3 Prompt versioning
Every prompt must have:
- name
- version
- role type
- scope
- active/inactive state
- notes/changelog

---

## 10. Free-First AI Routing Architecture

### 10.1 Routing rule
Each task type must have a ranked chain:
- active free provider #1
- active free provider #2
- active free provider #3
- sleeping premium provider #1
- sleeping premium provider #2

### 10.2 Provider states
Each provider/model can be in one of these states:
- active
- sleeping
- cooldown
- rate_limited
- error
- disabled

### 10.3 Sleeping logic
A provider is skipped automatically if:
- API key is missing
- balance/quota is unavailable
- it is manually disabled
- its cooldown period has not ended

### 10.4 Wake logic
A sleeping provider wakes when:
- a valid API key is added
- quota/balance is restored
- cooldown period ends
- it is re-enabled manually

### 10.5 Task lanes

#### Search lane
- free search provider #1
- free search provider #2
- free reasoning summarizer fallback
- paid premium sleeping fallback

#### Planning lane
- free reasoning provider #1
- free reasoning provider #2
- free platform-native fallback
- premium sleeping fallback(s)

#### Build lane
- free capable build/coding/content provider #1
- free fallback #2
- free fallback #3
- premium sleeping fallback(s)

#### Structured-output lane
- free fast model #1
- free platform-native fallback
- free fallback #3
- premium sleeping fallback(s)

#### Review lane
- free reviewer #1
- free reviewer #2
- free reviewer #3
- premium sleeping fallback(s)

### 10.6 Critical rule
**Reviewer should be different from the generator whenever possible.**

---

## 11. Cloudflare-First Infrastructure

This platform should use Cloudflare as the base.

### 11.1 Workers
Use for:
- backend API
- orchestration
- routing
- workflow execution
- publishing/export actions

### 11.2 Durable Objects
Use for:
- provider cooldown state
- locks
- queue coordination
- approval sessions
- single-flight workflow coordination
- preventing duplicate job execution

### 11.3 D1
Use for:
- products
- variants
- runs
- reviews
- prompts
- statuses
- analytics summaries
- configuration metadata

### 11.4 KV
Use for:
- cache
- feature flags
- read-heavy config
- temporary lookups
- low-risk fast retrievals

### 11.5 R2
Use for:
- files
- PDFs
- generated media
- ZIP exports
- mockups
- audio/video output
- final asset bundles

### 11.6 Images (optional)
Use if image delivery/transformation is needed.

### 11.7 Secrets
Use for:
- provider API keys
- sensitive service tokens

Rule:
- never expose secrets in browser
- dashboard calls Worker
- Worker handles provider communication securely

---

## 12. Data Model

### 12.1 Core entities
- domains
- categories
- platforms
- social_channels
- workflow_templates
- prompt_templates
- ai_roles
- provider_configs
- products
- product_variants
- social_variants
- assets
- workflow_runs
- workflow_steps
- reviews
- revisions
- publishing_jobs
- analytics_daily
- cost_events

### 12.2 Table blueprint

#### domains
- id
- name
- slug
- icon
- description
- is_active
- created_at

#### categories
- id
- domain_id
- name
- slug
- config_json
- is_active

#### platforms
- id
- name
- type
- title_limit
- description_rules
- tag_rules
- seo_rules
- audience_profile
- tone_profile
- cta_style
- is_active

#### social_channels
- id
- name
- caption_rules
- hashtag_rules
- length_rules
- audience_style
- tone_profile
- is_active

#### products
- id
- domain_id
- category_id
- idea
- notes
- status
- current_version
- approved_version
- created_at
- updated_at

#### product_variants
- id
- product_id
- version
- platform_id nullable
- social_channel_id nullable
- title
- description
- price_suggestion
- seo_json
- content_json
- asset_refs_json
- status

#### workflow_runs
- id
- product_id
- template_id
- status
- started_at
- finished_at
- provider_summary_json
- cost_summary_json

#### workflow_steps
- id
- run_id
- step_name
- role_type
- status
- provider_used
- model_used
- retries
- error_log
- output_ref

#### reviews
- id
- product_id
- version
- reviewer_type
- approval_status
- issues_found
- feedback
- created_at

#### revisions
- id
- product_id
- version_from
- version_to
- revision_reason
- boss_notes
- changed_steps_json
- created_at

#### prompt_templates
- id
- name
- role_type
- version
- scope_type
- scope_ref
- system_prompt
- domain_prompt
- platform_prompt
- quality_rules
- output_schema
- is_active

#### assets
- id
- product_id
- type
- storage_key
- provider
- metadata_json
- created_at

#### publishing_jobs
- id
- product_id
- target_type
- target_ref
- status
- payload_ref
- result_ref
- created_at

---

## 13. Status System

Every item and run needs a clear lifecycle state.

### Product / variant statuses
- draft
- queued
- running
- waiting_for_review
- rejected
- revision_requested
- approved
- ready_to_publish
- publishing
- published
- archived
- failed_partial
- failed

### Step statuses
- pending
- running
- retrying
- cooldown_wait
- completed
- failed
- skipped

---

## 14. Versioning Requirements

Version these items:
- product output
- platform variants
- social variants
- prices
- titles
- descriptions
- prompt templates
- reviews
- generated assets

Keep:
- who generated it
- which provider/model generated it
- which prompt version generated it
- what changed between versions

### Example
- product v1
- product v2
- product v3 approved

---

## 15. Review and Approval Loop

### Required review flow
1. AI generates output
2. Reviewer AI checks output
3. Boss/CEO sees the result
4. Boss approves or rejects
5. If rejected, revision notes are stored
6. Only the selected parts are regenerated
7. New version is reviewed again
8. Repeat until approved

### Boss actions
- approve all
- reject all
- approve selected platform variants only
- request specific revisions
- archive

### Mandatory storage
Store:
- rejection reason
- detailed notes
- revision action taken
- final approved version

---

## 16. Regenerate-Only-This-Part Design

The UI must support selective regeneration.

### Required regenerate actions
- regenerate title only
- regenerate price only
- regenerate description only
- regenerate tags only
- regenerate Etsy version only
- regenerate Gumroad version only
- regenerate Instagram caption only
- regenerate only SEO
- regenerate only creative prompt
- regenerate using Boss feedback

This avoids wasting credits and time.

---

## 17. Platform Variation Engine

The platform adapter must create a true variation for each selected platform.

### Store per platform
- title max length
- description rules
- metadata/tag rules
- SEO style
- audience profile
- tone profile
- CTA style
- banned phrases
- required sections

### Result
The same base product becomes:
- Etsy version
- Gumroad version
- Shopify version
- Redbubble version
- etc.

Each should feel native to the platform.

---

## 18. Social Variation Engine

The same rule applies to social channels.

### Store per social channel
- tone profile
- max length
- hook style
- CTA style
- hashtag rules
- emoji preference
- audience style
- visual prompt suggestions

### Result
From one product, generate:
- Instagram caption
- TikTok promo angle
- X thread
- LinkedIn post
- Pinterest pin copy
- Facebook post
- Shorts description

---

## 19. Pricing and Marketing Layer

Marketing AI must generate:
- pricing suggestions
- high-converting descriptions
- SEO-aware titles
- humanized copy
- strong but natural hooks
- buyer psychology-driven copy
- CTA options
- platform-specific persuasion angles

### Optional outputs
- short description
- long description
- bullet benefits
- objection handling
- platform-specific version
- ad copy pack
- launch copy pack

---

## 20. Asset Library Architecture

A unified asset library is required.

### Store
- images
- mockups
- PDFs
- audio files
- video files
- prompts used
- export bundles
- previews
- social creatives

### Storage design
- metadata in D1
- file blobs in R2
- optional image variants via Images

### Required actions
- view
- search
- download
- delete
- archive
- attach to product

---

## 21. Publishing Architecture

### Mode A — Generate only
- create outputs for manual posting

### Mode B — Export package
- ZIP bundle
- JSON bundle
- text files
- media bundle

### Mode C — Direct publish (future)
- publish to platforms via integration
- sync published IDs
- track publishing status

### Recommended MVP
Start with:
- Generate only
- Export package

Add direct publishing later.

---

## 22. Queue and Job System

A job system is required for slow and multi-step workflows.

### Job types
- research jobs
- text generation jobs
- image generation jobs
- audio generation jobs
- video jobs
- adaptation jobs
- review jobs
- publishing/export jobs

### Job states
- pending
- running
- retrying
- cooldown_wait
- completed
- partial_success
- failed

### Requirements
- concurrency control
- provider cooldown awareness
- step retries
- partial success support
- separate run logs per step

---

## 23. Error Handling Architecture

Handle errors at step level, not just whole-workflow level.

### Must handle
- invalid JSON
- timeout
- provider unavailable
- rate limit hit
- quota exceeded
- one variant failed while others succeeded
- one social channel failed while the product succeeded
- broken file upload
- asset generation failed

### Required behavior
- store error
- mark step as failed or partial_success
- allow retry on failed step only
- keep successful steps intact

---

## 24. Analytics and Cost Tracking

Track analytics from day one.

### Per workflow run
- domain
- category
- platform(s)
- social channel(s)
- provider used
- model used
- retries
- failovers
- estimated cost / credits / tokens used
- time taken
- approval result

### Dashboard analytics
- most used card
- most used category
- best performing platform
- most approved prompt version
- most reliable provider
- average revisions before approval
- cost per approved output

### Cost events
Store:
- provider
- model
- request type
- usage amount
- timestamp
- run_id

---

## 25. API / Provider Management

The dashboard should have an API/provider management area.

### It should show
- provider name
- role(s) used for
- active/sleeping/cooldown state
- key configured or not
- last test result
- priority position
- notes about limits

### Security rule
- do not expose raw secrets to browser
- use secure backend management only

### Paid provider behavior
If no key exists:
- provider remains sleeping
- router skips it automatically

---

## 26. Delete / Cleanup Architecture

The dashboard must be able to delete actual stored data.

### Deletable items
- products
- variants
- cached results
- assets
- R2 files
- image records
- old runs
- archived items

### Delete flow
1. user clicks delete
2. Worker checks permission and scope
3. delete file/object if needed
4. delete metadata record or mark archived
5. return success/failure to UI

### Recommended safety
Support:
- soft delete first
- permanent cleanup later

---

## 27. Backup / Export Requirements

Support export of:
- prompts
- products
- variants
- reviews
- platform configs
- social configs
- workflow templates
- analytics summaries

### Suggested formats
- Markdown
- JSON
- ZIP bundles
- CSV for summaries

---

## 28. Risk / Policy Layer

Add checks for:
- trademark risk
- copyright risk
- platform policy violations
- misleading claims
- unsafe legal/medical content if such domains are enabled
- suspicious asset usage

### Important note
Watermark removal and certain compliance-heavy domains should be guarded by policy rules and scope checks.

---

## 29. MVP Scope

Do not launch every domain at once.

### Phase 1
- Digital Products
- POD
- Search / Research
- Ads / Marketing
- Sell Digital Products

### Phase 2
- Website Building
- Code / App Building
- Prompt / Component Libraries
- Voice / Custom Voice
- Music

### Phase 3
- Video
- Animation
- Story with Images
- Game Making

---

## 30. Final Implementation Rules

1. Build for configuration, not hardcoding.
2. Use Markdown for prompt source files.
3. Store active prompt versions in the database.
4. Keep free providers active first.
5. Keep premium providers sleeping until keys are added.
6. Always use a review step.
7. Always keep Boss approval mandatory.
8. Version every major output.
9. Regenerate only selected parts.
10. Start with generate/export before direct publishing.
11. Track costs, failovers, and approvals from day one.
12. Use Cloudflare as the base infrastructure for V1.

---

## 31. Final Short Summary

NEXUS should be built as a **Cloudflare-first, dashboard-configurable, free-first AI product OS** with:
- dynamic domain cards
- dynamic categories
- platform-aware and social-aware output generation
- prompt-engineered AI role lanes
- automatic failover routing
- paid providers sleeping until activated
- version history
- selective regeneration
- human Boss/CEO approval loop
- asset library
- publish/export pipeline
- analytics and cost tracking

That is the final architecture.
