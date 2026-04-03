create extension if not exists pgcrypto;

do $$ begin
  create type job_status as enum ('running', 'success', 'failed_retryable', 'failed_fatal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type image_status as enum ('generated', 'approved', 'hidden', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status job_status not null default 'running',
  idempotency_key text unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  message text,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists raw_products (
  id bigserial primary key,
  source_site text not null,
  source_product_id text,
  product_url text not null,
  product_name text,
  category_raw text,
  price_raw text,
  sale_price_raw text,
  description_raw text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  crawl_run_id uuid references job_runs(id),
  raw_html_hash text,
  dedupe_key text,
  unique(source_site, product_url)
);

create table if not exists raw_product_images (
  id bigserial primary key,
  raw_product_id bigint not null references raw_products(id) on delete cascade,
  image_url text not null,
  image_hash text,
  is_primary boolean not null default false,
  unique(raw_product_id, image_url)
);

create table if not exists taxonomy_terms (
  id bigserial primary key,
  domain text not null,
  canonical_label text not null,
  unique(domain, canonical_label)
);

create table if not exists products (
  id bigserial primary key,
  source_site text not null,
  source_product_id text,
  canonical_name text not null,
  product_url text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique(source_site, product_url)
);

create table if not exists product_attributes (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  domain text not null,
  term_id bigint not null references taxonomy_terms(id),
  confidence numeric(5,4) not null default 0.7000,
  source text not null,
  unique(product_id, domain, term_id, source)
);

create table if not exists trend_windows (
  id bigserial primary key,
  label text not null,
  start_date date not null,
  end_date date not null,
  unique(label, start_date, end_date)
);

create table if not exists trend_scores (
  id bigserial primary key,
  window_current_id bigint not null references trend_windows(id),
  window_prev_id bigint not null references trend_windows(id),
  domain text not null,
  term_id bigint not null references taxonomy_terms(id),
  freq_current int not null,
  freq_prev int not null,
  growth_rate numeric(10,4) not null,
  smoothed_growth numeric(10,4) not null,
  confidence numeric(5,4) not null,
  score numeric(12,4) not null,
  rank int,
  is_emerging boolean not null default false,
  computed_at timestamptz not null default now(),
  unique(window_current_id, window_prev_id, domain, term_id)
);

create table if not exists vision_feature_extractions (
  id bigserial primary key,
  product_id bigint references products(id) on delete set null,
  source_image_url text not null,
  model text not null,
  model_params jsonb not null default '{}'::jsonb,
  extracted_json jsonb not null,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create table if not exists prompt_candidates (
  id bigserial primary key,
  trend_score_id bigint not null references trend_scores(id) on delete cascade,
  prompt_text text not null,
  negative_prompt text,
  prompt_version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists generated_images (
  id bigserial primary key,
  trend_score_id bigint not null references trend_scores(id) on delete cascade,
  prompt_id bigint not null references prompt_candidates(id) on delete cascade,
  provider text not null,
  model text not null,
  seed text,
  size text,
  style text,
  image_url text not null,
  status image_status not null default 'generated',
  generation_cost_yen int not null default 0,
  created_at timestamptz not null default now()
);

alter table job_runs enable row level security;
alter table trend_windows enable row level security;
alter table trend_scores enable row level security;
alter table taxonomy_terms enable row level security;
alter table generated_images enable row level security;

create policy "public select trend_windows" on trend_windows for select using (true);
create policy "public select trend_scores" on trend_scores for select using (true);
create policy "public select taxonomy_terms" on taxonomy_terms for select using (true);
create policy "public select generated_images approved" on generated_images for select using (status = 'approved');
