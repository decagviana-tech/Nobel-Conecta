import { supabase, isSupabaseConfigured } from '../../supabase';
import { Profile } from '../../types';

export type PointsAction = 'review' | 'creative' | 'club_thought' | 'comment' | 'like' | 'giveaway' | 'join_club';

const POINTS_MAP: Record<PointsAction, number> = {
  review: 10,
  creative: 10,
  club_thought: 10,
  comment: 2,
  like: 0,
  giveaway: 5,
  join_club: 5
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
      // In production, points are awarded by database triggers tied to the real action.
      // This client helper only refreshes the visible profile points after the mutation.
      const previousPoints = currentProfile?.points;
      const expectedDelta = amountOverride !== undefined ? amountOverride : POINTS_MAP[action];
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Profile points refresh failed:', profileError);
        return false;
      }

      const newPoints = updatedProfile?.points;
      if (newPoints !== undefined) {
        window.dispatchEvent(new CustomEvent('nobel_profile_updated', { detail: { points: newPoints } }));
      }

      if (previousPoints === undefined) return true;
      return expectedDelta > 0 ? newPoints > previousPoints : newPoints < previousPoints;
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
