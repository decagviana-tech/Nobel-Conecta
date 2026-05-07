
import { Profile } from '../../types';

/**
 * Centralized admin check. Use this everywhere instead of
 * duplicating role/username checks across components.
 *
 * Works both as a React hook (inside components) and as a
 * plain function (it has no React hooks internally).
 */
export const useAdmin = (profile: Profile | null): boolean => {
    if (!profile) return false;
    return (
        profile.role === 'admin' ||
        profile.role === 'superadmin'
    );
};
