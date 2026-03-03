
import { supabase, isSupabaseConfigured } from '../../supabase';
import { Profile } from '../../types';
import { createNotification } from './notificationService';

export type PointsAction = 'review' | 'creative' | 'club_thought' | 'comment' | 'like' | 'giveaway' | 'join_club';

const POINTS_MAP: Record<PointsAction, number> = {
  review: 10,
  creative: 10,
  club_thought: 10,
  comment: 2,
  like: 1,
  giveaway: 5,
  join_club: 5
};

const ACTION_LABELS: Record<PointsAction, string> = {
  review: 'por sua resenha',
  creative: 'por seu texto autoral',
  club_thought: 'por sua análise de clube',
  comment: 'por comentar',
  like: 'por curtir',
  giveaway: 'por participar do sorteio',
  join_club: 'por entrar no clube'
};

export const awardPoints = async (userId: string, action: PointsAction, currentProfile: Profile | null, amountOverride?: number) => {
  if (!userId || !currentProfile) return;

  const pointsToAdd = amountOverride !== undefined ? amountOverride : POINTS_MAP[action];
  const newPoints = Math.max(0, (currentProfile.points || 0) + pointsToAdd);

  if (isSupabaseConfigured) {
    try {
      // Update points in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', userId);

      if (error) throw error;

      // Create notification for points earned (only if positive)
      if (pointsToAdd > 0) {
        await createNotification(
          userId,
          'system',
          '✨ Pontos Nobel!',
          `Você ganhou +${pointsToAdd} pontos ${ACTION_LABELS[action]}. Seu novo saldo é ${newPoints} pts.`,
          '/rewards'
        );
      }

      // Dispatch custom event to refresh profile in App.tsx
      window.dispatchEvent(new CustomEvent('nobel_profile_updated', { detail: { points: newPoints } }));
      
      return true;
    } catch (err) {
      console.error('Error awarding points:', err);
      return false;
    }
  } else {
    // Demo mode: update localStorage
    const savedDemoUser = localStorage.getItem('nobel_demo_session');
    if (savedDemoUser) {
      const user = JSON.parse(savedDemoUser);
      if (user.id === userId) {
        user.points = newPoints;
        localStorage.setItem('nobel_demo_session', JSON.stringify(user));
        
        // Update local state via event
        window.dispatchEvent(new CustomEvent('nobel_profile_updated', { detail: { points: newPoints } }));
        return true;
      }
    }
  }
  return false;
};
