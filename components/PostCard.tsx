
import React, { useState, useEffect, useRef } from 'react';
import { Star, MessageCircle, Heart, Trash2, User as UserIcon, Send, ChevronDown, ChevronUp, BookOpen, Share2 } from 'lucide-react';
import { Post, Profile, Comment } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { createNotification } from '../src/services/notificationService';
import { awardPoints } from '../src/services/pointsService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Link } from 'react-router-dom';

interface PostCardProps {
  post: Post;
  currentProfile: Profile | null;
  onDelete?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentProfile, onDelete }) => {
  const [liked, setLiked] = useState(post.user_has_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const isAdmin = currentProfile?.role === 'admin' || 
                  currentProfile?.username === 'nobel_oficial' || 
                  currentProfile?.username === 'nobelpetro';
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

  const handleShare = async () => {
    const shareData = {
      title: `Nobel Conecta - ${post.book_title}`,
      text: `📚 Confira esta resenha de "${post.book_title}" no Nobel Conecta! \n\n"${post.content.substring(0, 100)}..."`,
      url: window.location.origin + `/?search=${encodeURIComponent(post.book_title)}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Erro ao compartilhar:', err);
      }
    } else {
      // Fallback: Copiar link
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link da resenha copiado para a área de transferência! Agora você pode colar no Instagram ou WhatsApp.');
      } catch (err) {
        alert('Não foi possível copiar o link.');
      }
    }
  };

  const handleLike = async () => {
    if (!currentProfile) return;
    setLiked(!liked);
    setLikesCount(prev => liked ? prev - 1 : prev + 1);
    
    if (isSupabaseConfigured) {
      try {
        if (liked) {
          await supabase.from('likes').delete().eq('user_id', currentProfile.id).eq('post_id', post.id);
        } else {
          await supabase.from('likes').insert({ user_id: currentProfile.id, post_id: post.id });
          
          // Ganho de pontos por curtir
          await awardPoints(currentProfile.id, 'like', currentProfile);

          // Notificar o autor do post
          if (post.user_id !== currentProfile.id) {
            await createNotification(
              post.user_id,
              'like',
              'Nova curtida!',
              `@${currentProfile.username} curtiu sua resenha de "${post.book_title}".`,
              `/?search=${encodeURIComponent(post.book_title || '')}`
            );
          }
        }
      } catch (err) { console.error(err); }
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
    const updated = [...comments, commentObj];
    setComments(updated);
    localStorage.setItem(key, JSON.stringify(updated));

    if (isSupabaseConfigured) {
      await supabase.from('comments').insert({
        post_id: post.id,
        user_id: currentProfile.id,
        content: newComment
      });

      // Ganho de pontos por comentar
      await awardPoints(currentProfile.id, 'comment', currentProfile);

      // Notificar o autor do post
      if (post.user_id !== currentProfile.id) {
        await createNotification(
          post.user_id,
          'comment',
          'Novo comentário!',
          `@${currentProfile.username} comentou na sua resenha: "${newComment.substring(0, 30)}${newComment.length > 30 ? '...' : ''}"`,
          `/?search=${encodeURIComponent(post.book_title || '')}`
        );
      }
    }
    setNewComment('');
  };

  const isCreative = post.type === 'creative';
  const isClubThought = post.type === 'club_thought';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-3 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:h-[320px] w-full relative">
      
      {post.images && post.images.length > 0 ? (
        <div className="w-full md:w-[40%] aspect-[4/5] md:aspect-square md:h-full overflow-hidden bg-gray-50 shrink-0 border-r border-gray-50 relative group/img">
          <img 
            src={post.images[0].startsWith('http') ? `https://images.weserv.nl/?url=${encodeURIComponent(post.images[0])}&default=${encodeURIComponent(post.images[0])}` : post.images[0]} 
            alt="Livro" 
            crossOrigin="anonymous"
            className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-110" 
          />
          {isClubThought && (
            <div className="absolute top-2 left-2 bg-black/80 text-yellow-400 text-[7px] font-black uppercase px-2 py-1 rounded-md backdrop-blur-sm">
              Análise de Clube
            </div>
          )}
        </div>
      ) : isClubThought ? (
        <div className="w-full md:w-[25%] py-4 md:py-0 md:h-full bg-yellow-50 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 px-4 md:px-6 border-b md:border-b-0 md:border-r border-yellow-100 shrink-0">
          <BookOpen className="text-yellow-600" size={24} />
          <span className="text-[7px] md:text-[8px] font-black text-yellow-800 uppercase tracking-widest text-center">Análise do Clube</span>
        </div>
      ) : null}

      <div className="flex flex-col flex-1 p-3 md:p-5 overflow-hidden">
        
        <div className="flex items-center justify-between mb-2">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-2 group/user">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-50 flex items-center justify-center overflow-hidden border border-yellow-100 group-hover/user:border-yellow-400 transition-colors">
              {post.author?.avatar_url ? (
                <img 
                  src={post.author.avatar_url.startsWith('http') ? `https://images.weserv.nl/?url=${encodeURIComponent(post.author.avatar_url)}&default=${encodeURIComponent(post.author.avatar_url)}` : post.author.avatar_url} 
                  alt={post.author.username} 
                  crossOrigin="anonymous" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <UserIcon className="text-yellow-700" size={14} />
              )}
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-[12px] md:text-[13px] leading-none group-hover/user:text-yellow-600 transition-colors">@{post.author?.username}</h4>
              <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </Link>
          {(isAdmin || isOwner) && (
            <button 
              onClick={async (e) => { 
                console.log('Botão de excluir clicado no PostCard. ID:', post.id);
                e.preventDefault();
                e.stopPropagation(); 
                if(onDelete) {
                  console.log('Chamando onDelete prop...');
                  try {
                    await onDelete(post.id);
                  } catch (err) {
                    console.error('Erro ao executar onDelete:', err);
                    alert('Erro ao excluir. Tente novamente.');
                  }
                } else {
                  console.warn('onDelete prop não fornecida para o PostCard!');
                }
              }} 
              className="bg-red-500 text-white p-2 md:p-2.5 transition-all rounded-lg md:rounded-xl shadow-lg hover:scale-110 active:scale-95 z-10"
              title="Excluir Publicação"
            >
              <Trash2 size={14} md:size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="mb-2">
          <h3 className="text-[14px] md:text-base font-black text-gray-900 font-serif leading-tight truncate uppercase tracking-tighter">{post.book_title}</h3>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[11px] md:text-[12px] text-gray-400 italic truncate shrink-1">por {post.book_author}</p>
            <div className="flex shrink-0 ml-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={10} md:size={12} fill={i < (post.rating || 5) ? "#EAB308" : "none"} className={i < (post.rating || 5) ? "text-yellow-500" : "text-gray-100"} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-2 pr-1 scrollbar-hide min-h-[40px]">
          <p className="text-gray-700 text-[13px] md:text-[14px] leading-relaxed italic border-l-2 border-yellow-100 pl-2 md:pl-3">
            "{post.content}"
          </p>
        </div>

        <div className="pt-2 md:pt-3 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={handleLike} className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-500' : 'text-gray-400'}`}>
              <Heart size={18} md:size={20} fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 2} />
              <span className="text-[11px] md:text-[12px] font-black">{likesCount}</span>
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1 transition-colors ${showComments ? 'text-black' : 'text-gray-400'}`}
            >
              <MessageCircle size={18} md:size={20} />
              <span className="text-[11px] md:text-[12px] font-black">{comments.length || post.comments_count || 0}</span>
              {showComments ? <ChevronUp size={12} md:size={14} /> : <ChevronDown size={12} md:size={14} />}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={handleShare}
                className="flex items-center gap-1 text-gray-400 hover:text-black transition-colors"
                title="Compartilhar Link"
              >
                <Share2 size={18} md:size={20} />
                <span className="text-[11px] md:text-[12px] font-black">Link</span>
              </button>
            </div>
          </div>

          {showComments && (
            <div className="mt-2 pt-2 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
              <div className="max-h-24 md:max-h-32 overflow-y-auto space-y-1.5 mb-2 scrollbar-hide">
                {comments.length > 0 ? comments.map(c => (
                  <div key={c.id} className="flex gap-1.5 items-start">
                    <span className="text-[10px] md:text-[11px] font-black text-black shrink-0">@{c.author?.username}:</span>
                    <span className="text-[11px] md:text-[12px] text-gray-700 flex-1 leading-tight">{c.content}</span>
                  </div>
                )) : (
                  <p className="text-[9px] md:text-[10px] text-gray-300 font-bold uppercase tracking-widest text-center py-1.5">Sem comentários ainda</p>
                )}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-1">
                <input 
                  className="flex-1 bg-white border border-gray-300 text-[12px] text-black px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 transition-all placeholder:text-gray-400" 
                  placeholder="Comentar..." 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                />
                <button type="submit" className="p-1.5 bg-black text-yellow-400 rounded-lg hover:scale-105 transition-transform shadow-md"><Send size={12} /></button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
