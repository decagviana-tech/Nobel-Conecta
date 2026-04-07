
import { Profile } from '../../types';

/**
 * Centraliza a lógica para verificar se um perfil tem privilégios de administrador.
 * @param profile O perfil do usuário logado.
 * @returns boolean indicando se o usuário é administrador.
 */
export const useAdmin = (profile: Profile | null): boolean => {
    if (!profile) return false;
    return profile.role === 'admin' || profile.role === 'superadmin';
};
