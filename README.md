# Mentoria HOF — Agenda online (Firebase)

Guia pra publicar a agenda com **link próprio**, **login por e-mail e senha** e a **agenda compartilhada/sincronizada** entre você e quem você autorizar. Não precisa saber programar. Leva ~30 min.

Você vai usar o **Firebase** (login + banco de dados) e, pra hospedar, **Netlify** (mais fácil) ou o **Firebase Hosting**.

---

## Fase 1 — Firebase (login + dados)

1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Adicionar projeto**. Dê um nome (ex: `mentoria-hof`), pode **desativar o Google Analytics**, e crie. Espere montar.
3. **Ativar o login por senha:** menu **Authentication → Vamos começar → Sign-in method → Email/senha → Ativar → Salvar**.
4. **Criar o banco:** menu **Firestore Database → Criar banco de dados**. Escolha o modo **produção**, região **southamerica-east1 (São Paulo)** (ou us-central), e confirme.
5. **Regras de segurança:** dentro do Firestore, aba **Regras (Rules)**, apague o que estiver lá, cole o conteúdo do arquivo **`firestore.rules`** (desta pasta) e clique em **Publicar**.
6. **Criar o acesso da Julia:** volte em **Authentication → Users → Adicionar usuário**. E-mail `juliazanella@mentoria.com`, senha `Mentoriahof`, salvar. (Pra liberar outra pessoa depois, repita aqui.)
7. **Pegar as chaves do app:** **engrenagem → Configurações do projeto → aba Geral**. Role até **Seus apps** e clique no ícone **Web </>**. Dê um apelido (ex: `agenda`) e registre. Aparece um bloco `firebaseConfig` com **apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId**. Copie esses valores — você usa na Fase 3.

---

## Fase 2 — GitHub (guardar o código)

1. Crie uma conta em **https://github.com** (se não tiver).
2. **New repository** -> nome -> **Create repository**.
3. Na tela do repositório vazio, clique em **"uploading an existing file"** e **arraste todos os arquivos desta pasta** (inclusive a pasta `src`). Confirme em **Commit changes**.

---

## Fase 3 — Publicar (o link)

### Opção A — Netlify (mais fácil, recomendada)

1. Acesse **https://netlify.com** e entre **com o GitHub**.
2. **Add new site → Import an existing project → GitHub** e escolha o repositório.
3. O `netlify.toml` já configura o build — só confirmar.
4. Abra **Environment variables** e adicione as **6 chaves** do Firebase (Fase 1, passo 7):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_SENDER_ID`  (é o *messagingSenderId*)
   - `VITE_FIREBASE_APP_ID`
5. **Deploy** -> sai o link (algo como `seu-site.netlify.app`).

### Opção B — Firebase Hosting

Requer **Node.js** (https://nodejs.org) e o terminal:
1. Crie um `.env` (copie o `.env.example`) e preencha as 6 chaves.
2. `npm install`
3. `npm install -g firebase-tools`
4. `firebase login`
5. `firebase use --add` e escolha o projeto
6. `npm run build`
7. `firebase deploy` -> mostra o link (`seu-projeto.web.app`).

---

## Como usar

- Abra o link **no notebook** e entre com `juliazanella@mentoria.com` / `Mentoriahof`.
- Abra o **mesmo link no celular** com o mesmo login. A agenda é a mesma, sincronizada.
- No celular, use **"Adicionar à tela de início"** — fica com cara de app.
- Pra liberar mais alguém: crie o usuário no Firebase (Fase 1, passo 6) e passe o link + login.

## Rodar no computador (opcional)

1. Instale o **Node.js**. Crie um `.env` (copie o `.env.example`) e preencha as chaves.
2. `npm install` e `npm run dev`.

---

### Observações
- Os dados ficam no **seu** projeto Firebase. O plano grátis (Spark) é bem folgado pra uma agenda de consultório.
- As regras do Firestore garantem que **só quem está logado** acessa a agenda.
