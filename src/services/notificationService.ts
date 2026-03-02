
import { supabase, isSupabaseConfigured } from '../../supabase';

export type NotificationType = 'message' | 'comment' | 'like' | 'giveaway' | 'system';

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
      console.error('Erro ao criar notificação:', error);
    }
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
}
