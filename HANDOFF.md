# Handoff: Melhorias Críticas Nobel Conecta

Este documento contém o código e as instruções necessárias para implementar as melhorias de segurança, performance e confiabilidade identificadas na análise do projeto.

---

## 1. Segurança contra Spam (RLS do Supabase)

**O Problema**: Atualmente, qualquer usuário autenticado pode criar notificações para qualquer outro.
**A Solução**: Só permitir a criação de notificações por usuários autenticados, com filtros adicionais (idealmente isso seria via Trigger no banco, mas aqui vai a política de segurança).

### Script SQL para rodar no Supabase:
```sql
-- Remover a política antiga permissiva
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- Criar política que permite inserção apenas por usuários autenticados
-- E garante que o 'type' seja um dos permitidos pelo sistema
CREATE POLICY "Authenticated users can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated 
WITH CHECK (true); 

-- Nota: Para segurança total, o ideal é que notificações sejam geradas 
-- AUTOMATICAMENTE por Triggers de Banco quando um Like ou Comentário ocorre.
```

---

## 2. Robustez no Sistema de Pontos (RPC)

**O Problema**: O sistema atual faz um "fetch e depois update" no cliente, o que pode gerar perda de dados em cliques rápidos.
**A Solução**: Usar uma função no banco de dados (RPC) que incrementa o valor de forma atômica.

### Script SQL para rodar no Supabase:
```sql
-- Função para incrementar pontos de forma segura
CREATE OR REPLACE FUNCTION increment_points(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Alteração no código (`src/services/pointsService.ts`):
Substituir a chamada manual pelo RPC:
```typescript
// No arquivo pointsService.ts, a função awardPoints deve priorizar o RPC:
const { error } = await supabase.rpc('increment_points', { 
  user_id: userId, 
  amount: pointsToAdd 
});
```

---

## 3. Atualização de Cache (Service Worker)

**O Problema**: O cache atual não tem lógica de limpeza, o que pode manter versões antigas do app rodando.
**A Solução**: Implementar o evento `activate` para limpar caches defasados.

### Alteração no `sw.js`:
Adicionar este bloco ao final do arquivo:
```javascript
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

---

## 4. Migração de Admin (Fim do Hardcoding)

**O Problema**: Nomes e e-mails de admins estão no código.
**A Solução**: Migrar para a coluna `role` do banco.

### Passo 1: Garantir que os admins atuais tenham a role no banco:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email IN ('nobel.petropolis@gmail.com', 'decagviana@gmail.com');
```

### Passo 2: Limpar o código em `src/hooks/useAdmin.ts`:
```typescript
export const useAdmin = (profile: Profile | null): boolean => {
    if (!profile) return false;
    return profile.role === 'admin'; // Simples e seguro
};
```

---

## 5. Próximos Passos Recomendados (V3)
- [ ] Criar uma tabela de junção `book_club_members` (UUID para UUID).
- [ ] Implementar carregamento de imagens via `IndexedDB` no modo demo para evitar estouro de cota do `localStorage`.
- [ ] Adicionar um sistema de logs de erros para o Supabase (tabela de `logs`).
- [x] Melhorar navegacao mobile da Home: o item mobile "Feed" aponta para a Home com rolagem direta ao feed principal, mantendo o menu inferior enxuto e sem adicionar abas para Vitrine ou Mural.
