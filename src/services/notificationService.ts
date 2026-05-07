import { supabase, isSupabaseConfigured } from '../../supabase';

export type NotificationType = 'message' | 'comment' | 'like' | 'follow' | 'giveaway' | 'system';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  content: string,
  link?: string
) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      content,
      link,
      read: false
    });

    if (error) {
      console.error('Erro ao criar notificacao:', error);
    }
  } catch (err) {
    console.error('Erro ao criar notificacao:', err);
  }
}

async function callNotificationRpc(functionName: string, params: Record<string, string>) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.rpc(functionName, params);
    if (error) {
      console.error(`Erro ao executar ${functionName}:`, error);
    }
  } catch (err) {
    console.error(`Erro ao executar ${functionName}:`, err);
  }
}

export const notifyPostLike = (postId: string) =>
  callNotificationRpc('notify_post_like', { p_post_id: postId });

export const notifyPostComment = (commentId: string) =>
  callNotificationRpc('notify_post_comment', { p_comment_id: commentId });

export const notifyCreativeLike = (postId: string) =>
  callNotificationRpc('notify_creative_like', { p_post_id: postId });

export const notifyCreativeComment = (commentId: string) =>
  callNotificationRpc('notify_creative_comment', { p_comment_id: commentId });

export const notifyFollow = (followingId: string) =>
  callNotificationRpc('notify_follow', { p_following_id: followingId });

export const notifyMessage = (messageId: string) =>
  callNotificationRpc('notify_message', { p_message_id: messageId });
