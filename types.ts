
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  favorite_genres: string[];
  reading_now?: string;
  role: 'user' | 'admin';
  email?: string;
  following_ids?: string[];
  points?: number;
}

export interface BookClub {
  id: string;
  name: string;
  description: string;
  current_book: string;
  current_book_author: string;
  image_url: string;
  admin_id: string;
  member_ids: string[];
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  book_title?: string;
  book_author?: string;
  content: string;
  rating?: number;
  images: string[];
  created_at: string;
  author?: Profile;
  likes_count: number;
  comments_count: number;
  user_has_liked?: boolean;
  type: 'review' | 'creative' | 'club_thought';
  title?: string;
  club_id?: string; // Vinculação opcional a um clube
}

export interface Book {
  id: string;
  title: string;
  author: string;
  price: string;
  cover_url: string;
  description: string;
  created_at?: string;
}

export interface LibraryEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  image_url: string;
  type: 'upcoming' | 'past';
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  sender?: Profile;
  receiver?: Profile;
}

export interface Giveaway {
  id: string;
  title: string;
  description: string;
  book_image_url: string;
  end_date: string;
  winner_id?: string;
  participants_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'message' | 'comment' | 'like' | 'giveaway' | 'system';
  title: string;
  content: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points_required: number;
  type: 'discount' | 'gift';
  image_url?: string;
  stock?: number;
  is_active: boolean;
  created_at: string;
}

export interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  status: 'pending' | 'completed' | 'cancelled';
  redemption_code?: string;
  created_at: string;
  reward?: Reward;
  user?: Profile;
}
