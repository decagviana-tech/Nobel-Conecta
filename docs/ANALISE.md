# Análise de Arquitetura e Pontos de Risco: Nobel Conecta

## 1. Riscos de Escalabilidade

### Armazenamento no Modo Demo (Base64)
- **Localização**: `supabase.ts` (uploadFile).
- **Risco**: No modo demo, o sistema faz o fallback para salvar imagens em Base64 no `localStorage`.
- **Impacto**: O `localStorage` tem um limite rígido (comumente 5MB). Salvar algumas imagens de alta qualidade vai rapidamente quebrar o funcionamento do app para o usuário, impedindo o salvamento de qualquer outro dado.
- **Recomendação**: Adicionar um aviso persistente ou desabilitar o salvamento de imagens se o Supabase não estiver configurado.

### Membros de Clubes como Array de UUID (UUID[])
- **Localização**: `supabase.sql` (book_clubs.member_ids).
- **Risco**: Gerenciar membros como um array de strings dentro de uma coluna é ineficiente quando o número de membros cresce (lentidão em filtros e joins).
- **Impacto**: Difícil escalabilidade para clubes com milhares de membros.
- **Recomendação**: Criar uma tabela de junção `book_club_members` para normalizar a relação N-para-N.

---

## 2. Riscos de Robustaça e Segurança

### Políticas de RLS Permissivas
- **Localização**: `supabase.sql` (line 166).
- **Risco**: `CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);`
- **Impacto**: Qualquer usuário autenticado pode inundar a caixa de entrada de qualquer outro usuário com notificações falsas/spam, já que não há verificação se a notificação faz sentido (ex: "você curtiu o post X").
- **Recomendação**: Refinar o `CHECK` para garantir que o remetente seja o usuário atual e que apenas certos tipos de notificações sejam disparados pelo frontend (ou idealmente, usar Database Triggers para criar notificações automáticas no servidor).

### Lógica de Admin Hardcoded
- **Localização**: `App.tsx` (line 117) e `src/hooks/useAdmin.ts` (lines 12-13).
- **Risco**: Senhas/Emails estão embutidos no código.
- **Impacto**: Se esses emails mudarem ou se novos admins forem necessários, é obrigatório um novo deploy de código. Além disso, expõe os emails/usernames dos administradores publicamente no bundle de JavaScript.
- **Recomendação**: Depender puramente da coluna `role = 'admin'` no banco de dados e gerenciar isso através de um painel administrativo fechado.

---

## 3. Confiabilidade de Dados (Atomicidade)

### Sistema de Pontos (Corrida de Dados)
- **Localização**: `pointsService.ts` (awardPoints).
- **Risco**: O fallback para atualização manual (fetch + add + update) não é atômico.
- **Impacto**: Se o usuário realizar duas ações simultâneas (ex: clicar rápido emcurtir em dois posts) e o RPC falhar, um dos incrementos pode ser sobrescrito pelo outro.
- **Recomendação**: O RPC `increment_points` (usando `amount = amount + new_val`) no banco de dados é a solução definitiva. É preciso garantir que essa função SQL exista sempre no Supabase de produção.

---

## 4. Manutenção Futura

### Dependência de React 19 (Beta/Recent)
- **Risco**: O projeto usa a versão mais recente do React.
- **Impacto**: Algumas bibliotecas de terceiros podem não estar totalmente compatíveis ainda, gerando warnings no console ou comportamentos inesperados em novos deploys.
- **Recomendação**: Manter o `package-lock.json` atualizado e testar extensivamente após qualquer atualização de dependência (`npm update`).

---

## 5. Melhorias de PWA e Performance

### Service Worker (sw.js)
- **Risco**: O cache atual é muito básico (`v1`). Não há lógica para apagar caches antigos no evento `activate`.
- **Impacto**: Ocupação excessiva de memória no navegador do usuário e risco de 'Stale content' se os arquivos estiverem em cache mas desatualizados.
- **Recomendação**: Implementar o evento `activate` para deletar caches que não sejam o `CACHE_NAME` atual. Além disso, considerar estratégias mais robustas como "Stale-While-Revalidate" para ativos que mudam mas devem carregar instantaneamente.
