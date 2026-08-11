# Contexto do projeto — Agenda Mentoria HOF

Documento de handoff. Resume **o que é**, **como está** e **as regras de negócio** desta agenda,
para continuar o desenvolvimento (ex: no Claude Code) sem perder o histórico das decisões.

## O que é
Agenda/gestão para o consultório de estética **Mentoria HOF (Harmonização Orofacial)**.
Usada pela dentista (Julia) para marcar consultas, controlar pagamentos, pacientes,
retornos, faturamento e estoque. Interface em português, uso em celular e computador.

## Stack
- **React 18** + **Vite**
- **Tailwind** (via CDN no `index.html`)
- **recharts** (gráfico do faturamento) e **lucide-react** (ícones)
- **Firebase**: Authentication (email/senha) + Firestore (banco)
- Deploy no **Netlify** ou **Firebase Hosting**

## Estrutura
```
index.html            # HTML + Tailwind CDN
vite.config.js
package.json
supabase-schema.sql   # cria a tabela app_state + RLS
.env.example          # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
src/
  main.jsx
  App.jsx             # o app inteiro (todas as telas e regras)
  supabaseClient.js   # cria o client do Supabase
  lib/store.js        # get/set de "coleções" em app_state
README.md             # guia passo a passo de publicação
```

## Persistência (importante)
Os dados são guardados por "coleção" como blobs JSON numa única tabela `app_state`
(colunas `key`, `value jsonb`, `updated_at`), via `src/lib/store.js`. Chaves usadas:
- `agenda:consultas:v2` — todas as consultas
- `agenda:pacientes:v1` — pacientes cadastrados manualmente
- `agenda:afazeres:v1` — checklist de afazeres
- `agenda:estoque:v1` — itens de estoque

RLS: qualquer usuário **autenticado** lê/escreve tudo → agenda **compartilhada** entre
os autorizados. O controle de quem entra é feito criando usuários no painel do Supabase.

> Nota: modelo "last-write-wins" (salva o array inteiro da coleção). Suficiente para poucos
> usuários. Se crescer, vale migrar cada coleção para tabelas relacionais (uma linha por
> consulta/paciente/etc.) com RLS por linha.

## Autenticação
- Supabase Auth (email/senha). `login()` usa `signInWithPassword`; sessão persiste.
- Usuário atual: `juliazanella@mentoria.com` (senha definida no painel do Supabase — **não** fica no código).
- Tela de `LoginScreen` mostra a logo tipográfica (MENTORIA / Harmonização Facial / FULL FACE / IMERSÃO).
- Botão "Sair" no cabeçalho.

## Telas / abas
- **Agenda** — alterna **Dia** e **Semana**.
  - Dia: calendário mensal + lista do dia, com sub-toggle **Lista / Horários**.
    Na grade de Horários, atendimentos **simultâneos** aparecem lado a lado; o 1º com fundo
    **azul claro** e o 2º **rosa claro** (barra lateral = cor do status).
  - Semana: 7 colunas com as consultas de cada dia.
  - Abaixo: seção **Afazeres** (checklist persistida).
- **Pacientes** — lista automática (derivada das consultas) + **Cadastrar** manual.
  Clicar no nome abre o **histórico completo** do paciente (consultas, valores, como pagou, status).
- **Retornos** — quem fez **botox** ou **combos de harmonização**, para retoque. Filtros
  Todos/Botox/Harmonização; marca "retorno recomendado" (botox ~4m, harmonização ~6m).
- **Chamar** — recontato por tempo: **botox 5 meses**, **bioestimulador 6 meses**,
  **harmonização 4 meses**. Mostra nome + telefone, botão WhatsApp e Agendar; destaca atrasados.
- **Pagamentos** — a receber / quitados; totais e filtros. Clicar abre a consulta.
- **Faturamento** — mês navegável: faturado, recebido, a receber, atendimentos; gráfico de
  6 meses; **Recebido por conta** (Mari/Loan quebrado por Pix/Crédito/Débito); top procedimentos.
- **Estoque** — cada produto tem **qtd inicial**, **sobrou** e **usados** (calculado).
  Para dar baixa: digita quanto usou e confirma (não usa +/-). Botão editar; alerta de baixo.

## Regras de negócio (consulta / pagamento)
- **Procedimentos** têm preço embutido (à vista e "com taxa"/parcelado). Tabela em `PROCS` no `App.jsx`.
- Uma consulta pode ter **vários procedimentos** (principal + "Adicionar procedimento"); o valor
  total **soma todos** automaticamente.
- **Forma de pagamento** define o preço:
  - **Pix** → valor **à vista** (sem taxa).
  - **Crédito** e **Débito** → valor **com taxa** (preço parcelado), mesmo em 1x.
  - **Parcelas (1–4)** só aparecem no Crédito e são **informativas** (não mudam o total).
  - Hoje **débito usa o mesmo preço com taxa do crédito** — se a taxa do débito for diferente,
    criar um preço próprio.
- **Conta (recebedor)**: **Loan** ou **Mari**. Ao selecionar, a consulta vira **Concluído**.
- **Sinal**: registra entrada paga; o app mostra "Falta pagar R$ X" em destaque.
- **Status**: Pendente → Confirmado → (ao registrar pagamento) Concluído; ou Cancelado.

## Visual
- Cabeçalho grafite com a logo tipográfica compacta no canto.
- Paleta neutra quente + acento mauve/rosé. Status: âmbar=pendente, verde=confirmado,
  azul=concluído, cinza=cancelado. Fontes: Cormorant Garamond (serif da logo), Bricolage
  Grotesque (títulos), Inter (texto).

## Como rodar / publicar
Ver **README.md**. Resumo: criar projeto no Supabase, rodar `supabase-schema.sql`, criar os
usuários, pegar URL + anon key, subir no GitHub, importar no Vercel e colar as env vars.
Local: `.env` com as chaves, `npm install`, `npm run dev`.

## Próximos passos / ideias em aberto
- Fazer o **deploy** (Vercel + Supabase) — ainda pendente.
- Descontar **estoque automaticamente** ao concluir um procedimento (ex: botox → -1 toxina).
- **Débito com preço próprio** (taxa menor que o crédito).
- Faturamento: separar totais gerais por **via** (Pix vs cartão).
- Eventual migração para tabelas relacionais com RLS por linha (multiusuário mais robusto).

---
*Este projeto foi prototipado numa conversa no Claude.ai; o preview standalone também existe como
um único `.html` (dados no navegador, via localStorage) e como artefato React. Esta versão (Vite +
Supabase) é a que dá link compartilhado e dados sincronizados.*
