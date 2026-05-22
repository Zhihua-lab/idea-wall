alter table comments add column if not exists is_ai_generated boolean not null default false;
alter table comments add column if not exists ai_display_name text;
alter table comments add column if not exists requested_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_comments_requested_by_user_id on comments(requested_by_user_id);
