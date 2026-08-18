# Mentoria HOF — Agenda online

Guia pra colocar a agenda no ar com **link próprio**, **login por e-mail e senha** e a **agenda compartilhada** entre você e quem você autorizar. Não precisa saber programar — é seguir os passos. Leva ~20–30 min.

Você vai usar dois serviços gratuitos:
- **Supabase** → cuida do login e guarda os dados no servidor.
- **Vercel** → hospeda o app e te dá o link.

---

## Parte 1 — Supabase (login + banco de dados)

1. Acesse **https://supabase.com** e crie uma conta (pode entrar com o Google).
2. Clique em **New project**. Dê um nome (ex: `mentoria-hof`), crie uma **senha do banco** (guarde) e escolha a região **South America (São Paulo)**. Clique em **Create new project** e espere ~2 min.
3. No menu lateral, abra **SQL Editor** → **New query**. Abra o arquivo **`supabase-schema.sql`** (que veio nesta pasta), copie **todo** o conteúdo, cole ali e clique em **Run**. Deve aparecer "Success".
4. Agora pegue as chaves: menu **Settings** (engrenagem) → **API**. Anote dois valores:
   - **Project URL**
   - **anon public** (uma chave longa)

### Criar os acessos (quem pode entrar)

5. Menu **Authentication** → **Providers** → **Email**: deixe **ligado**, mas **desligue** a opção *"Allow new users to sign up"* (assim ninguém se cadastra sozinho — só quem você criar).
6. Menu **Authentication** → **Users** → **Add user** → **Create new user**. Preencha:
   - E-mail: `juliazanella@mentoria.com`
   - Senha: `Mentoriahof`
   - Marque **Auto Confirm User** (importante, senão o login não funciona).
   - Clique em **Create user**.
7. Pra liberar outra pessoa depois, é só repetir o passo 6 com o e-mail e senha dela.

---

## Parte 2 — Publicar no Vercel (o link)

1. Crie uma conta no **GitHub** (https://github.com) se não tiver, e uma no **Vercel** (https://vercel.com) — entre no Vercel **com o GitHub**.
2. Suba esta pasta pro GitHub:
   - Jeito fácil: no GitHub, clique em **New repository**, dê um nome, crie, e na tela do repositório use **"uploading an existing file"** pra arrastar **todos os arquivos desta pasta** (inclusive a pasta `src`). Confirme (**Commit changes**).
3. No **Vercel**, clique em **Add New… → Project**, escolha o repositório que você acabou de criar e clique em **Import**.
4. Antes de dar deploy, abra **Environment Variables** e adicione as duas chaves do Supabase (Parte 1, passo 4):
   - Nome: `VITE_SUPABASE_URL` → Valor: a Project URL
   - Nome: `VITE_SUPABASE_ANON_KEY` → Valor: a anon public
5. Clique em **Deploy** e espere ~1 min. No fim aparece o **link** (algo como `mentoria-hof-agenda.vercel.app`). Pronto! 🎉

---

## Como usar

- Abra o link, entre com o e-mail e a senha. A agenda é a **mesma** pra todos que você autorizou, de qualquer celular ou computador.
- Pra dar acesso a mais alguém: crie o usuário no Supabase (Parte 1, passo 6) e passe o link + o login.
- Pra trocar uma senha: Supabase → Authentication → Users → clique no usuário → **Reset password** (ou edite).

## Rodar no seu computador (opcional, pra testar antes)

1. Instale o **Node.js** (https://nodejs.org).
2. Nesta pasta, crie um arquivo `.env` (copie o `.env.example`) e cole suas duas chaves.
3. No terminal: `npm install` e depois `npm run dev`. Abra o endereço que aparecer.

---

### Observações
- Os dados ficam no **seu** projeto Supabase — são seus. O plano grátis é bem folgado pra uma agenda de consultório.
- Se um dia quiser separar os valores por profissional, histórico de auditoria, etc., dá pra evoluir o banco. É só pedir.
