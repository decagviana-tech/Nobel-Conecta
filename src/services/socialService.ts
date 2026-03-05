
import { supabase, isSupabaseConfigured } from '../../supabase';

export const followUser = async (followerId: string, followingId: string) => {
    if (!isSupabaseConfigured) {
        const saved = localStorage.getItem('nobel_conecta_following');
        const following: string[] = saved ? JSON.parse(saved) : [];
        if (!following.includes(followingId)) {
            following.push(followingId);
            localStorage.setItem('nobel_conecta_following', JSON.stringify(following));
        }
        return true;
    }

    const { error } = await supabase
        .from('follows')
        .insert({ follower_id: followerId, following_id: followingId });

    return !error;
};

export const unfollowUser = async (followerId: string, followingId: string) => {
    if (!isSupabaseConfigured) {
        const saved = localStorage.getItem('nobel_conecta_following');
        const following: string[] = saved ? JSON.parse(saved) : [];
        const updated = following.filter(id => id !== followingId);
        localStorage.setItem('nobel_conecta_following', JSON.stringify(updated));
        return true;
    }

    const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

    return !error;
};

export const getFollowingIds = async (followerId: string): Promise<string[]> => {
    if (!isSupabaseConfigured) {
        const saved = localStorage.getItem('nobel_conecta_following');
        return saved ? JSON.parse(saved) : [];
    }

    const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', followerId);

    if (error) return [];
    return data.map(f => f.following_id);
};

export const isFollowingUser = async (followerId: string, followingId: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
        const saved = localStorage.getItem('nobel_conecta_following');
        const following: string[] = saved ? JSON.parse(saved) : [];
        return following.includes(followingId);
    }

    const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

    return !!data && !error;
};
