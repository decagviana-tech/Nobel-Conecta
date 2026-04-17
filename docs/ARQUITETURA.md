# 💻 Documentação Técnica: Nobel Conecta
**Visão Geral da Arquitetura e Stack para Desenvolvedores**

Bem-vindo ao repositório do Nobel Conecta. Este documento visa dar tração e contexto imediato para novos desenvolvedores que venham a ingressar no projeto, delineando nossas decisões arquiteturais.

## 🛠️ Stack Tecnológica Core
O projeto foi construído utilizando métricas modernas de Frontend, com acoplamento reativo a um serviço BaaS.

* **Frontend Engine:** React estruturado com **TypeScript** para maior rigor e segurança das tipagens (veja `src/types.ts`). Empacotador **Vite** gerando builds rápidos.
* **Estilização:** Tailwind CSS (utility-first, gerando um pacote final leve e permitindo refatorações ultra ágeis).
* **Roteamento:** React Router DOM (Mapeamento de rotas em SPA).
* **Backend, Auth & Database:** **Supabase**. Gerencia a autenticação JWT, armazenamento de mídias (`Storage` Buckets) e banco de dados avançado derivado de PostgreSQL puro.
* **Infraestrutura PWA:** Instalável via `manifest.json`. Presença de um `sw.js` (Service Worker) que intercepta eventos de `fetch` e está engatilhado para os eventos de Push Notifications local.

---

## 🗄️ Arquitetura de Banco de Dados e Segurança

A aplicação foi rigidamente desenhada sobre o modelo PostgreSQL, utilizando de forma intensiva a engine de segurança no backend (evitando "mágica" no lado do cliente).

### 1. Modelagem Relacional Escalonável
A arquitetura transicionou de Arrays desorganizados para tabelas de junção sólidas, suportando integridade referencial:
* Exemplo Prático: Tabelas como a `book_clubs` se apoiam na `club_members` (`club_id`, `user_id` com chaves estrangeiras de Exclusão em Cascata).
* Existe suporte natural a Perfis Globais baseados na chave mestra do User Auth.
* Banco equipado com telemetria autônoma (`app_logs`).

### 2. Políticas de Segurança de Nível de Linha (RLS - Row Level Security)
Não dependemos da inibição de UI para brecar injeções ou spam.
* **RLS Policies** controlam agressivamente as tabelas de `notifications` e `app_logs`.
* Um usuário (mesmo autenticado) não consegue falsear *inserts*. Comandos paralelos do cliente falham a menos que a sua respectiva chave JWT coincida exatamente com a regra restrita em PL/pgSQL gravada dentro do banco de dados (ex: Inserir logs mas jamais selecioná-los; apenas `role = 'admin'` pode ler).

### 3. Operações Atômicas (RPCs)
Sistemas sensíveis, como a Gamificação/E-Wallet PWA (adição e consumo de pontos), não confiam na memória do Front-End. Omitimos a prática frágil do _"fetch, somar e salvar"_. As requisições disparam um **RPC** genérico pro Postgres (ex: função atômica de `increment_points`), impedindo Race Conditions em cliques exagerados vindos dos usuários.

---

## ⚙️ Convenções e Paradigmas do Front-End

* **Componentização via Hooks Customizados:** Acesso focado e repetitivo à permissões foram envelopadas visando manter os componentes funcionais limpos. (Avalie o `src/hooks/useAdmin.ts` para capturar papéis de gerência/superadmin).
* **Isolamento de Estado de Banco ("Graceful Fallback"):** A camada abstrata (`isSupabaseConfigured`) nas Services e Páginas entrega uma defesa excelente. O projeto possui fallback local nativo permitindo que qualquer desenvolvedor clone o repósitorio e consiga testar 70% das lógicas offline via `localStorage` antes mesmo de colocar suas credenciais `.env` de configuração do Supabase real.

## 🚀 Horizonte do Produto (Para Backlog Futuro)
Missões sugeridas aos próximos *Maintainers*:
1. Criar as `Supabase Edge Functions` de backend dedicadas e interligar os WebPush Subscriptions.
2. Migrar injeções massivas de `notifications` feitas pela view do Browser para se transformarem em Database Triggers 100% autônomos.
