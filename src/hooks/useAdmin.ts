
import { Profile } from '../../types';

/**
 * Centraliza a lógica para verificar se um perfil tem privilégios de administrador.
 * @param profile O perfil do usuário logado.
 * @returns boolean indicando se o usuário é administrador.
 */
export const useAdmin = (profile: Profile | null): boolean => {
    if (!profile) return false;

    const adminUsernames = ['nobel_oficial', 'nobelpetro'];
    const adminEmails = ['nobel.petropolis@gmail.com', 'decagviana@gmail.com'];

    return (
        profile.role === 'admin' ||
        adminUsernames.includes(profile.username) ||
        (profile.email && adminEmails.includes(profile.email))
    );
};
