
import { supabase, isSupabaseConfigured } from '../../supabase';
import { Post } from '../../types';

/**
 * Centralized post operations. Avoids duplicating Supabase
 * queries and points-revocation logic across multiple views.
 */

/**
 * Archives a post and lets the database adjust points consistently.
 * Used by Home, ProfileView, and AdminDashboard.
 */
export const deletePost = async (
  postId: string,
  _authorUserId?: string,
  _pointsAction: 'review' | 'creative' = 'review',
  _pointsToRevoke: number = -10
): Promise<boolean> => {
  if (!isSupabaseConfigured) return true; // Demo mode: caller handles local state

  try {
    const { error } = await supabase.rpc('archive_post', {
      p_post_id: postId,
      p_reason: 'user_removed'
    });
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error('Error archiving post:', err);
    throw err;
  }
};

/**
 * Fetches a paginated list of posts with author, likes, and comments.
 * Common query used by Home, ProfileView, ClubDetail.
 */
export const fetchPostsQuery = (options?: {
  userId?: string;
  clubId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 10;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('posts')
    .select('*, author:profiles(*), likes:likes(user_id), comments:comments(count)')
    .is('archived_at', null)
    .is('comments.archived_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options?.clubId) {
    query = query.eq('club_id', options.clubId);
  }

  return query;
};

/**
 * Transforms raw Supabase post data to include computed fields.
 */
export const transformPosts = (rawPosts: any[], currentUserId?: string): Post[] => {
  return rawPosts.map((p: any) => ({
    ...p,
    likes_count: p.likes?.length || 0,
    comments_count: p.comments?.[0]?.count || 0,
    user_has_liked: currentUserId
      ? p.likes?.some((l: any) => l.user_id === currentUserId)
      : false,
  }));
};
