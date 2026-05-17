-- 1. 为 inspirations 表添加评论计数列
alter table inspirations add column if not exists comments_count integer not null default 0;

-- 2. 创建评论表
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  inspiration_id uuid not null references inspirations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 索引
comment on table comments is '灵感评论';
create index if not exists idx_comments_inspiration_id on comments(inspiration_id);
create index if not exists idx_comments_created_at on comments(created_at);

-- 4. 启用 RLS
alter table comments enable row level security;

-- 5. RLS 策略
-- 所有人可读
create policy "comments_select_all"
  on comments for select
  using (true);

-- 登录用户只能插入自己的评论
create policy "comments_insert_auth"
  on comments for insert
  with check (auth.uid() = user_id);

-- 只能更新自己的评论（10 分钟限制由前端控制，也可在应用层校验）
create policy "comments_update_own"
  on comments for update
  using (auth.uid() = user_id);

-- 只能删除自己的评论
create policy "comments_delete_own"
  on comments for delete
  using (auth.uid() = user_id);

-- 6. 触发器：自动维护 inspirations.comments_count
create or replace function update_inspiration_comments_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update inspirations set comments_count = comments_count + 1 where id = new.inspiration_id;
    return new;
  elsif tg_op = 'DELETE' then
    update inspirations set comments_count = comments_count - 1 where id = old.inspiration_id;
    return old;
  elsif tg_op = 'UPDATE' and old.inspiration_id is distinct from new.inspiration_id then
    update inspirations set comments_count = comments_count - 1 where id = old.inspiration_id;
    update inspirations set comments_count = comments_count + 1 where id = new.inspiration_id;
    return new;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_comments_count on comments;
create trigger trg_comments_count
  after insert or delete or update on comments
  for each row
  execute function update_inspiration_comments_count();
