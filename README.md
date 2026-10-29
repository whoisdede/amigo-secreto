# 🎁 Amigo Secreto Online

Site completo para organizar **Amigo Secreto** com convite por link, acesso com e-mail e senha, listas de desejos, sorteio secreto no servidor e chat anônimo.

Construído com **React + Vite + TypeScript** no frontend e **Supabase (PostgreSQL + Auth + RLS)** no backend, pronto para ser hospedado gratuitamente no **GitHub Pages** ou **Firebase Hosting**.

---

## ✨ Funcionalidades

- **Sessões completas de amigo secreto**:
  - Nome, descrição/mensagem aos convidados
  - Data e hora da troca + exportação para **Google Agenda** e arquivo **`.ics`**
  - Local e link do mapa (Google Maps / Waze)
  - Valor mínimo e máximo dos presentes e sugestões gerais
  - Prazo para confirmação de presença (RSVP) e limite de participantes
  - Tema, código de vestimenta (traje) e regras/observações
  - Opção para o organizador também participar do sorteio
- **Convite por link**:
  - Pré-visualização do evento mesmo antes do login
  - Botão de copiar link, envio direto formatado para **WhatsApp** e compartilhamento nativo do celular
  - Opção para o organizador invalidar o link atual e gerar um novo
- **Sorteio 100% secreto no banco de dados**:
  - Realizado por função PostgreSQL (`draw_group`) formando um ciclo único (ninguém tira a si mesmo e não há pares isolados)
  - Tabela `assignments` bloqueada por RLS: **nem o organizador consegue ver quem tirou quem**, cada participante vê apenas o próprio amigo secreto (`get_my_assignment`)
  - Botão com proteção contra curiosos ("Revelar quem eu tirei" / "Esconder") e opção de refazer sorteio caso necessário
- **Lista de desejos**:
  - Cada participante adiciona, edita ou remove ideias de presentes com links de produtos e detalhes (tamanho, cor, etc.)
- **Chat anônimo em duas vias**:
  - **Com quem eu tirei**: envie perguntas sem revelar sua identidade
  - **Com quem me tirou**: dê dicas de presente para o seu amigo secreto

---

## 🚀 Passo a Passo de Configuração

### 1. Criar o banco de dados no Supabase (gratuito)

1. Acesse [supabase.com](https://supabase.com/) e clique em **New project**.
2. No menu lateral do projeto, abra **SQL Editor** → **New query**.
3. Copie todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql), cole no editor e clique em **Run**.
4. Vá em **Project Settings** (ícone de engrenagem) → **API** e anote:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Project API keys → `anon` `public`**

### 2. Configurar o Login por E-mail no Supabase (1 clique)

O login por **E-mail e Senha** já vem ativado por padrão no Supabase!

1. No painel do Supabase, vá em **Authentication** → **Providers** → **Email**.
2. Desmarque a opção **Confirm email** e clique em **Save**.
   *(Assim todos os seus convidados criam conta e entram na hora pelo link do WhatsApp, sem depender de caixa de spam nem do limite de envio de e-mails do plano gratuito.)*

### 3. Rodar localmente

```bash
cd amigo-secreto
cp .env.example .env.local
```

Edite o arquivo `.env.local` com as chaves do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

---

## 🌐 Hospedar Online no GitHub Pages (Gratuito)

O projeto já inclui o workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) e suporte a rotas SPA (`404.html` + convites com HTTP 200).

1. Crie um repositório **Public** no GitHub (ex.: `amigo-secreto`, sem marcar README).
2. No repositório do GitHub, vá em **Settings** → **Pages** e em **Build and deployment → Source** selecione **GitHub Actions**.
3. Vá em **Settings** → **Secrets and variables** → **Actions** → **New repository secret** e crie dois segredos:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Envie o código:
   ```bash
   git init
   git add .
   git commit -m "Site Amigo Secreto"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/amigo-secreto.git
   git push -u origin main
   ```
5. Acompanhe a aba **Actions**: em ~1 minuto seu site estará disponível em `https://SEU-USUARIO.github.io/amigo-secreto/`.
