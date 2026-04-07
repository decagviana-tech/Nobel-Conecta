# Manual de Operações: Nobel Conecta

## 1. Visão Geral do Projeto
O **Nobel Conecta** é uma plataforma comunitária para leitores da Livraria Nobel, integrando redes sociais, gamificação e recursos de PWA para uma experiência mobile de alta fidelidade.

### Tech Stack
- **Frontend**: React 19, Vite, TypeScript.
- **Estilização**: Tailwind CSS 4, Framer Motion (animações).
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage).
- **PWA**: Service Worker para funcionamento offline e instalação.

---

## 2. Arquitetura do Sistema

### Navegação e Roteamento
O projeto utiliza um `HashRouter` para lidar com roteamento no lado do cliente, o que é útil para deploys em static hostings que não suportam History API (como alguns subdomínios ou GitHub Pages legado).

### Gerenciamento de Estado
O estado é gerenciado de forma descentralizada:
1.  **Sessão e Perfil**: Mantidos no `App.tsx` e passados via props para as views.
2.  **Sincronização**: Utiliza eventos customizados (`nobel_profile_updated`) para notificar outros componentes quando os pontos ou o perfil do usuário mudam sem a necessidade de uma store global.
3.  **Modo Demo**: O sistema detecta se o Supabase está configurado. Caso contrário, entra em um modo mock que utiliza `localStorage`.

---

## 3. Fluxos Principais

### Autenticação e Registro
- O registro cria um usuário no `auth.users` do Supabase e, em seguida, dispara um listener ou fallback no `App.tsx` para criar a entrada correspondente na tabela `public.profiles`.
- Perfis têm papéis (`role`): `user` ou `admin`.

### Gamificação (Sistema de Pontos)
As ações no app premiam o usuário com pontos, definidos no `pointsService.ts`:
- **Resenha**: 10 pontos
- **Texto Criativo**: 10 pontos
- **Comentário**: 2 pontos
- **Curtida**: 1 ponto
- **Participação em Sorteio**: 5 pontos

---

## 4. Estrutura do Banco de Dados (Principal)

| Tabela | Descrição |
| :--- | :--- |
| `profiles` | Dados do usuário (bio, avatar, pontos, papel). |
| `posts` | Resenhas de livros. |
| `creative_posts` | Poesias e textos autorais no "Espaço Criativo". |
| `book_clubs` | Clubes de leitura e seus membros. |
| `notifications` | Feed de notificações (suporta Realtime). |
| `rewards` | Catálogo de recompensas disponíveis. |
| `redemptions` | Registro de resgates de prêmios. |

---

## 5. Manutenção e Administração

### Adicionando Administradores
Atualmente, o papel de admin é atribuído de duas formas:
1. **Banco de Dados**: Definindo `role = 'admin'` na tabela `profiles`.
2. **Código**: E-mails e usernames específicos estão hardcoded em `useAdmin.ts` e no `App.tsx`.

### Gerenciamento de Conteúdo
Administradores têm acesso ao `/admin` para:
- Gerenciar sorteios.
- Aprovar/Validar resgates.
- Moderar posts.

---

## 6. Recursos Avançados
- **Service Worker**: Localizado em `sw.js`, gerencia o cache dos assets para carregamento instantâneo.
- **Compressão de Imagens**: Utiliza `browser-image-compression` antes do upload para economizar storage e largura de banda.
