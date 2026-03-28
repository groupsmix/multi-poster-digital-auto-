-- NEXUS — Seed data
-- Minimal starter dataset for development and testing.
-- Covers Phase 1 domains from Section 29 of the architecture doc.

-- ── Domains (Phase 1) ───────────────────────────────────
INSERT INTO domains (id, name, slug, icon, description, sort_order) VALUES
  ('dom_digital_products', 'Digital Products', 'digital-products', 'package', 'Create and sell digital products like templates, printables, and downloads.', 1),
  ('dom_pod',              'Print-on-Demand',  'pod',              'printer', 'Design and sell print-on-demand products across multiple platforms.',          2),
  ('dom_search_research',  'Search / Research', 'search-research',  'search',  'AI-powered research, trend analysis, and competitive intelligence.',          3),
  ('dom_ads_marketing',    'Ads / Marketing',   'ads-marketing',    'megaphone','Generate ad copy, marketing campaigns, and promotional content.',            4),
  ('dom_sell_digital',     'Sell Digital Products', 'sell-digital',  'shopping-cart', 'Marketplace listings and sales optimization for digital goods.',       5);

-- ── Categories ──────────────────────────────────────────
INSERT INTO categories (id, domain_id, name, slug, sort_order) VALUES
  -- Digital Products
  ('cat_planners',    'dom_digital_products', 'Planners',           'planners',    1),
  ('cat_templates',   'dom_digital_products', 'Templates',          'templates',   2),
  ('cat_printables',  'dom_digital_products', 'Printables',         'printables',  3),
  ('cat_ebooks',      'dom_digital_products', 'E-Books',            'ebooks',      4),
  ('cat_courses',     'dom_digital_products', 'Courses',            'courses',     5),
  -- POD
  ('cat_tshirts',     'dom_pod', 'T-Shirts',            't-shirts',     1),
  ('cat_mugs',        'dom_pod', 'Mugs',                'mugs',         2),
  ('cat_posters',     'dom_pod', 'Posters',             'posters',      3),
  ('cat_stickers',    'dom_pod', 'Stickers',            'stickers',     4),
  -- Ads / Marketing
  ('cat_social_ads',  'dom_ads_marketing', 'Social Media Ads',    'social-ads',   1),
  ('cat_email_copy',  'dom_ads_marketing', 'Email Copy',          'email-copy',   2),
  ('cat_landing',     'dom_ads_marketing', 'Landing Page Copy',   'landing-page', 3),
  -- Search / Research
  ('cat_trends',      'dom_search_research', 'Trend Analysis',    'trends',       1),
  ('cat_competitors', 'dom_search_research', 'Competitor Research','competitors',  2),
  ('cat_keywords',    'dom_search_research', 'Keyword Research',  'keywords',     3),
  -- Sell Digital
  ('cat_listing_opt', 'dom_sell_digital', 'Listing Optimization', 'listing-opt',  1),
  ('cat_pricing',     'dom_sell_digital', 'Pricing Strategy',     'pricing',      2);

-- ── Platforms ───────────────────────────────────────────
INSERT INTO platforms (id, name, type, title_limit, tone_profile, cta_style, sort_order) VALUES
  ('plat_etsy',       'Etsy',       'marketplace', 140, 'warm, handmade, personal',       'Shop Now / Add to Cart',       1),
  ('plat_gumroad',    'Gumroad',    'marketplace', 200, 'direct, creator-first',          'I want this!',                 2),
  ('plat_shopify',    'Shopify',    'storefront',  255, 'brand-aware, professional',      'Buy Now / Add to Cart',        3),
  ('plat_redbubble',  'Redbubble',  'marketplace', 150, 'creative, artistic, fun',        'Buy / Get this design',        4),
  ('plat_amazon',     'Amazon',     'marketplace', 200, 'benefit-driven, keyword-rich',   'Buy Now / Add to Cart',        5),
  ('plat_creative_market', 'Creative Market', 'marketplace', 200, 'professional, design-savvy', 'Add to Cart',            6);

-- ── Social Channels ─────────────────────────────────────
INSERT INTO social_channels (id, name, tone_profile, hashtag_rules, length_rules, audience_style, sort_order) VALUES
  ('sc_instagram',  'Instagram',      'visual, aspirational, lifestyle',    'Up to 30 hashtags, mix popular and niche', 'Caption: 125-2200 chars',  'visual-first consumers',      1),
  ('sc_tiktok',     'TikTok',         'casual, trend-aware, hook-first',    'Up to 5 hashtags, trending preferred',     'Hook: 3 sec, script: 60s', 'gen-z and millennials',        2),
  ('sc_x',          'X (Twitter)',    'concise, punchy, thread-friendly',   '2-3 hashtags max',                         '280 chars per post',        'tech-savvy, news-driven',     3),
  ('sc_linkedin',   'LinkedIn',       'professional, thought-leader',       '3-5 industry hashtags',                    '700-1300 chars optimal',    'professionals and B2B',       4),
  ('sc_pinterest',  'Pinterest',      'inspirational, search-optimized',    'Use keywords as natural hashtags',          'Pin title: 100 chars, desc: 500 chars', 'planners, DIY, shoppers', 5),
  ('sc_facebook',   'Facebook',       'conversational, community-driven',   '1-3 hashtags',                             '40-80 chars optimal hook',  'broad, 25-54 age range',      6),
  ('sc_youtube',    'YouTube Shorts', 'educational, entertaining, quick',   '3-5 hashtags + #shorts',                   'Title: 100 chars, desc: 5000', 'how-to seekers, browsers', 7);

-- ── AI Roles ────────────────────────────────────────────
INSERT INTO ai_roles (id, name, slug, description, sort_order) VALUES
  ('role_researcher', 'Researcher',        'researcher', 'Analyzes trends, competitors, pricing, keywords, market gaps, and audience behavior.',  1),
  ('role_planner',    'Planner / Architect','planner',    'Creates product structure, deliverable outlines, strategy, and workflow planning.',      2),
  ('role_creator',    'Creator',           'creator',    'Generates the main output: titles, copy, image prompts, code, articles, etc.',           3),
  ('role_adapter',    'Platform Adapter',  'adapter',    'Adapts a single output for each selected marketplace or storefront platform.',           4),
  ('role_marketing',  'Marketing',         'marketing',  'Generates pricing suggestions, persuasive copy, hooks, CTAs, SEO titles, and tags.',    5),
  ('role_social',     'Social',            'social',     'Creates channel-specific promotional content for each selected social platform.',        6),
  ('role_reviewer',   'Reviewer',          'reviewer',   'Checks quality, completeness, platform fit, SEO strength, tone, and policy compliance.',7);

-- ── Workflow Templates ──────────────────────────────────
INSERT INTO workflow_templates (id, name, description, steps_json) VALUES
  ('wft_standard', 'Standard Product Workflow',
   'Full workflow: research → plan → create → adapt → market → social → review → boss approval.',
   '[
     {"step": "research",  "role": "researcher", "required": true},
     {"step": "plan",      "role": "planner",    "required": true},
     {"step": "create",    "role": "creator",    "required": true},
     {"step": "adapt",     "role": "adapter",    "required": false},
     {"step": "market",    "role": "marketing",  "required": true},
     {"step": "social",    "role": "social",     "required": false},
     {"step": "review",    "role": "reviewer",   "required": true},
     {"step": "approve",   "role": "boss",       "required": true}
   ]'),
  ('wft_quick', 'Quick Create Workflow',
   'Shortened workflow: create → market → review → boss approval. Skips research and planning.',
   '[
     {"step": "create",    "role": "creator",    "required": true},
     {"step": "market",    "role": "marketing",  "required": true},
     {"step": "review",    "role": "reviewer",   "required": true},
     {"step": "approve",   "role": "boss",       "required": true}
   ]');

-- ── Provider Configs (free-first, paid sleeping) ────────
INSERT INTO provider_configs (id, name, provider, model, task_lane, tier, priority, state, has_api_key) VALUES
  -- Search lane
  ('prov_search_free_1',  'DuckDuckGo Search',  'duckduckgo', NULL,              'search',            0, 1, 'active',   0),
  ('prov_search_free_2',  'Brave Search',        'brave',      NULL,              'search',            0, 2, 'active',   0),
  ('prov_search_paid_1',  'Google Search API',   'google',     NULL,              'search',            2, 1, 'sleeping', 0),
  -- Planning lane
  ('prov_plan_free_1',    'Workers AI (Llama)',  'workers-ai', '@cf/meta/llama-3.1-8b-instruct', 'planning', 0, 1, 'active', 0),
  ('prov_plan_paid_1',    'OpenAI GPT-4o',       'openai',     'gpt-4o',          'planning',          2, 1, 'sleeping', 0),
  -- Build lane
  ('prov_build_free_1',   'Workers AI (Llama)',  'workers-ai', '@cf/meta/llama-3.1-8b-instruct', 'build', 0, 1, 'active', 0),
  ('prov_build_paid_1',   'OpenAI GPT-4o',       'openai',     'gpt-4o',          'build',             2, 1, 'sleeping', 0),
  ('prov_build_paid_2',   'Anthropic Claude',    'anthropic',  'claude-sonnet-4-20250514',   'build',             2, 2, 'sleeping', 0),
  -- Structured output lane
  ('prov_struct_free_1',  'Workers AI (Llama)',  'workers-ai', '@cf/meta/llama-3.1-8b-instruct', 'structured_output', 0, 1, 'active', 0),
  ('prov_struct_paid_1',  'OpenAI GPT-4o-mini',  'openai',     'gpt-4o-mini',     'structured_output', 2, 1, 'sleeping', 0),
  -- Review lane
  ('prov_review_free_1',  'Workers AI (Llama)',  'workers-ai', '@cf/meta/llama-3.1-8b-instruct', 'review', 0, 1, 'active', 0),
  ('prov_review_paid_1',  'Anthropic Claude',    'anthropic',  'claude-sonnet-4-20250514',   'review',            2, 1, 'sleeping', 0);
