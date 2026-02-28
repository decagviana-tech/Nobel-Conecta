# Nobel Conecta 📚✨

**Nobel Conecta** é a plataforma oficial da Livraria Nobel de Petrópolis para conectar leitores, promover eventos e fortalecer a comunidade literária local.

## 🚀 Funcionalidades

- **Feed da Comunidade:** Compartilhamento de fotos, resenhas e indicações de livros.
- **Estante Virtual:** Organize suas leituras e veja o que outros estão lendo.
- **Eventos:** Fique por dentro de lançamentos, clubes do livro e noites de autógrafos.
- **Sistema de Mensagens:** Converse com outros leitores da cidade.
- **Painel Administrativo:** Gerenciamento de eventos e moderação de conteúdo.

## 🛠️ Tecnologias

- **Frontend:** React + Vite + Tailwind CSS
- **Backend/Banco de Dados:** Supabase (PostgreSQL, Auth, Storage)
- **Animações:** Motion (Framer Motion)
- **Ícones:** Lucide React

## 📦 Como rodar localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU-USUARIO/nobel-conecta.git
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente no arquivo `.env`:
   ```env
   VITE_SUPABASE_URL=seu_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🌐 Deploy no Netlify

Este projeto está configurado para o Netlify. O arquivo `public/_redirects` garante que as rotas do React Router funcionem corretamente.

**Configurações recomendadas:**
- **Build command:** `npm run build`
- **Publish directory:** `dist`

---
Desenvolvido com ❤️ para a Livraria Nobel Petrópolis.
