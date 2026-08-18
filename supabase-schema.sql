-- ============================================================
-- Mentoria HOF — estrutura do banco (rode no SQL Editor do Supabase)
-- ============================================================

-- Uma tabela guarda o estado da agenda (consultas, pacientes, afazeres, estoque).
create table if not exists app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Segurança: liga o controle de acesso por linha.
alter table app_state enable row level security;

-- Só usuários LOGADOS podem ler e escrever. Todos os autorizados
-- compartilham a mesma agenda.
create policy "ler autenticado"      on app_state for select to authenticated using (true);
create policy "inserir autenticado"  on app_state for insert to authenticated with check (true);
create policy "atualizar autenticado" on app_state for update to authenticated using (true) with check (true);
