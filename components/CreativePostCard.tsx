
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageSquare, Share2, Trash2, Quote, User as UserIcon, Send, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Post, Profile, Comment } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { createNotification } from '../src/services/notificationService';
import { awardPoints } from '../src/services/pointsService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Link } from 'react-router-dom';

interface CreativePostCardProps {
  post: Post;
  currentProfile: Profile | null;
  onDelete?: (postId: string) => void;
  isAdmin: boolean;
}

const CreativePostCard: React.FC<CreativePostCardProps> = ({ post, currentProfile, onDelete, isAdmin }) => {
  const [liked, setLiked] = useState(post.user_has_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);

  const isOwner = currentProfile?.id === post.user_id;

  useEffect(() => {
    if (showComments) {
      const key = `comments_${post.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setComments(JSON.parse(saved));
      } else if (isSupabaseConfigured) {
        supabase.from('comments').select('*, author:profiles(*)').eq('post_id', post.id).then(({ data }) => {
          if (data) setComments(data);
        });
      }
    }
  }, [showComments, post.id]);

  useEffect(() => {
    setLiked(post.user_has_liked || false);
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
  }, [post.id]); // Only re-initialize when post ID changes

  useEffect(() => {
    if (isSupabaseConfigured && post.id) {
      const likesChannel = supabase
        .channel(`creative_likes:${post.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'likes',
          filter: `post_id=eq.${post.id}`
        }, async () => {
          const { count, error } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          
          if (!error && count !== null) {
            setLikesCount(count);
          }
        })
        .subscribe();

      const commentsChannel = supabase
        .channel(`creative_comments:${post.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'comments',
          filter: `post_id=eq.${post.id}`
        }, async () => {
          const { count, error } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          
          if (!error && count !== null) {
            setCommentsCount(count);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(likesChannel);
        supabase.removeChannel(commentsChannel);
      };
    }
  }, [post.id]);

  const handleLike = async () => {
    if (!currentProfile || isLiking) return;
    
    setIsLiking(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    
    if (isSupabaseConfigured) {
      try {
        if (wasLiked) {
          await supabase.from('likes').delete().eq('user_id', currentProfile.id).eq('post_id', post.id);
          
          // Deduct points when unliking to prevent accumulation
          await awardPoints(currentProfile.id, 'like', currentProfile, -1);
        } else {
          // Check if already liked to prevent duplicates
          const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', currentProfile.id)
            .eq('post_id', post.id)
            .maybeSingle();

          if (!existingLike) {
            const { error: insertError } = await supabase.from('likes').insert({ user_id: currentProfile.id, post_id: post.id });
            if (insertError) throw insertError;
            
            // Ganho de pontos por curtir
            await awardPoints(currentProfile.id, 'like', currentProfile);

            // Notificar o autor do post
            if (post.user_id !== currentProfile.id) {
              await createNotification(
                post.user_id,
                'like',
                'Nova curtida!',
                `@${currentProfile.username} curtiu seu texto: "${post.title || 'Sem título'}".`,
                `/#/creative?id=${post.id}`
              );
            }
          } else {
            // If already liked, revert UI state to liked
            setLiked(true);
          }
        }
      } catch (err) { 
        console.error(err);
        // Revert on error
        setLiked(wasLiked);
        setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
      } finally {
        setIsLiking(false);
      }
    } else {
      setIsLiking(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentProfile) return;

    const commentObj: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      post_id: post.id,
      user_id: currentProfile.id,
      content: newComment,
      created_at: new Date().toISOString(),
      author: currentProfile
    };

    const key = `comments_${post.id}`;
    const previousComments = [...comments];
    const updated = [...comments, commentObj];
    setComments(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    setCommentsCount(prev => prev + 1);

    if (isSupabaseConfigured) {
      try {
        const { error: insertError } = await supabase.from('comments').insert({
          post_id: post.id,
          user_id: currentProfile.id,
          content: newComment
        });

        if (insertError) throw insertError;

        // Ganho de pontos por comentar
        await awardPoints(currentProfile.id, 'comment', currentProfile);

        // Notificar o autor do post
        if (post.user_id !== currentProfile.id) {
          await createNotification(
            post.user_id,
            'comment',
            'Novo comentário!',
            `@${currentProfile.username} comentou no seu texto: "${newComment.substring(0, 30)}${newComment.length > 30 ? '...' : ''}"`,
            `/#/creative?id=${post.id}`
          );
        }
      } catch (err) {
        console.error('Erro ao inserir comentário:', err);
        // Revert local state on error
        setComments(previousComments);
        setCommentsCount(prev => Math.max(0, prev - 1));
        localStorage.setItem(key, JSON.stringify(previousComments));
        alert('Erro ao enviar comentário. Tente novamente.');
        return;
      }
    }
    setNewComment('');
  };

  const handleShare = async () => {
    const shareData = {
      title: `Nobel Conecta - ${post.title || 'Texto Literário'}`,
      text: `✍️ Confira este texto autoral de @${post.author?.username} no Nobel Conecta: \n\n"${post.content.substring(0, 100)}..."`,
      url: window.location.origin + `/#/creative?id=${post.id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Erro ao compartilhar:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Texto e link copiados para a área de transferência! Agora você pode colar no Instagram ou WhatsApp.');
      } catch (err) {
        alert('Não foi possível copiar o link.');
      }
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
        <Quote size={180} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <Link to={`/profile/${post.user_id}`} className="flex items-center gap-4 group/user">
          <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center font-black text-yellow-700 text-sm border border-yellow-100 group-hover/user:border-yellow-400 transition-colors overflow-hidden">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url.startsWith('http') ? `https://images.weserv.nl/?url=${encodeURIComponent(post.author.avatar_url)}&default=${encodeURIComponent(post.author.avatar_url)}` : post.author.avatar_url} alt={post.author.username} crossOrigin="anonymous" className="w-full h-full object-cover" />
            ) : (
              <span>{post.author?.full_name?.[0] || post.author?.username?.[0]}</span>
            )}
          </div>
          <div>
            <p className="font-black text-gray-900 text-sm md:text-base group-hover:text-yellow-600 transition-colors">@{post.author?.username}</p>
            <p className="text-[11px] md:text-[12px] text-gray-400 uppercase font-bold tracking-[0.2em]">
              {post.title || 'Escrito Livre'} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </Link>
        {(isAdmin || isOwner) && (
          <button 
            onClick={() => onDelete && onDelete(post.id)} 
            className="p-3 bg-red-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
            title="Excluir Texto"
          >
            <Trash2 size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="mb-10">
        <div className="text-xl md:text-2xl font-serif italic text-gray-800 leading-relaxed whitespace-pre-wrap tracking-tight border-l-4 border-yellow-100 pl-6">
          {post.content}
        </div>
      </div>

      <div className="pt-8 border-t border-gray-50">
        <div className="flex items-center gap-8">
          <button onClick={handleLike} className={`flex items-center gap-2 transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
            <Heart size={22} fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 2} />
            <span className="text-xs font-black">{likesCount}</span>
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-2 transition-colors ${showComments ? 'text-black' : 'text-gray-400 hover:text-black'}`}
          >
            <MessageSquare size={22} />
            <span className="text-xs font-black">{commentsCount}</span>
            {showComments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={handleShare} className="flex items-center gap-2 text-gray-400 hover:text-black transition-colors" title="Compartilhar Link">
              <Share2 size={22} />
              <span className="text-xs font-black hidden md:inline">Link</span>
            </button>
          </div>
        </div>

        {showComments && (
          <div className="mt-6 pt-6 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
            <div className="max-h-40 overflow-y-auto space-y-3 mb-4 scrollbar-hide">
              {comments.length > 0 ? comments.map(c => (
                <div key={c.id} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.author?.avatar_url ? (
                      <img src={c.author.avatar_url.startsWith('http') ? `https://images.weserv.nl/?url=${encodeURIComponent(c.author.avatar_url)}&default=${encodeURIComponent(c.author.avatar_url)}` : c.author.avatar_url} crossOrigin="anonymous" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={12} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] md:text-[12px] font-black text-black">@{c.author?.username}</span>
                    <p className="text-[12px] md:text-xs text-gray-700 leading-tight mt-0.5">{c.content}</p>
                  </div>
                </div>
              )) : (
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest text-center py-4">Sem comentários ainda</p>
              )}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                className="flex-1 bg-gray-50 border border-gray-200 text-sm text-black px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 transition-all placeholder:text-gray-400" 
                placeholder="Escreva seu comentário..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <button type="submit" className="p-2 bg-black text-yellow-400 rounded-xl hover:scale-105 transition-transform shadow-md"><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreativePostCard;
