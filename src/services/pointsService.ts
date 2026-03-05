
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

// In-memory lock to prevent rapid duplicate calls
const activeRequests = new Set<string>();

export const awardPoints = async (userId: string, action: PointsAction, currentProfile: Profile | null, amountOverride?: number) => {
  if (!userId) return;

  const requestId = `${userId}:${action}:${amountOverride || 'default'}`;
  if (activeRequests.has(requestId)) {
    console.log(`Request already in progress for ${requestId}`);
    return false;
  }

  activeRequests.add(requestId);

  try {
    if (isSupabaseConfigured) {
      // Use PostgreSQL increment to ensure atomicity and avoid race conditions
      // This is much safer than fetching and then updating
      const pointsToAdd = amountOverride !== undefined ? amountOverride : POINTS_MAP[action];

      const { data: updatedProfile, error: updateError } = await supabase.rpc('increment_points', {
        user_id: userId,
        amount: pointsToAdd
      });

      // Fallback if RPC is not available (though RPC is recommended)
      if (updateError) {
        console.warn('RPC increment_points failed, falling back to manual update:', updateError);
        const { data: profileData, error: fetchError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;

        const currentPoints = profileData?.points || 0;
        const newPoints = Math.max(0, currentPoints + pointsToAdd);

        const { error: manualUpdateError } = await supabase
          .from('profiles')
          .update({ points: newPoints })
          .eq('id', userId);

        if (manualUpdateError) throw manualUpdateError;

        // Use manual points for notification
        if (pointsToAdd > 0) {
          await createNotification(
            userId,
            'system',
            '✨ Pontos Nobel!',
            `Você ganhou +${pointsToAdd} pontos ${ACTION_LABELS[action]}. Seu novo saldo é ${newPoints} pts.`,
            '/rewards'
          );
        }
        window.dispatchEvent(new CustomEvent('nobel_profile_updated', { detail: { points: newPoints } }));
      } else {
        // RPC successful
        const newPoints = updatedProfile?.[0]?.points;
        if (pointsToAdd > 0) {
          await createNotification(
            userId,
            'system',
            '✨ Pontos Nobel!',
            `Você ganhou +${pointsToAdd} pontos ${ACTION_LABELS[action]}.`,
            '/rewards'
          );
        }
        if (newPoints !== undefined) {
          window.dispatchEvent(new CustomEvent('nobel_profile_updated', { detail: { points: newPoints } }));
        }
      }

      return true;
    } else {
      // Demo mode: update localStorage
      if (!currentProfile) return;
      const pointsToAdd = amountOverride !== undefined ? amountOverride : POINTS_MAP[action];
      const newPoints = Math.max(0, (currentProfile.points || 0) + pointsToAdd);

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
  } catch (err) {
    console.error('Error awarding points:', err);
    return false;
  } finally {
    // Release the lock after 1 second to prevent immediate spam but allow future actions
    setTimeout(() => {
      activeRequests.delete(requestId);
    }, 1000);
  }
  return false;
};
