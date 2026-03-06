
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageSquare, Share2, Trash2, Quote, User as UserIcon, Send, ChevronDown, ChevronUp, BookOpen, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
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
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);

  const isOwner = currentProfile?.id === post.user_id;

  useEffect(() => {
    if (showComments) {
      if (isSupabaseConfigured) {
        supabase.from('creative_comments').select('*, author:profiles(*)').eq('post_id', post.id).then(({ data }) => {
          if (data) setComments(data);
        });
      }
    }
  }, [showComments, post.id]);

  useEffect(() => {
    if (post && !isLiking) {
      setLiked(post.user_has_liked || false);
      setLikesCount(post.likes_count || 0);
    }
    if (post && !isSubmittingComment) {
      setCommentsCount(post.comments_count || 0);
    }
  }, [post.id, post.user_has_liked, post.likes_count, post.comments_count, isLiking, isSubmittingComment]);

  useEffect(() => {
    if (isSupabaseConfigured && post.id) {
      const likesChannel = supabase
        .channel(`creative_likes:${post.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'creative_likes',
          filter: `post_id=eq.${post.id}`
        }, async () => {
          const { count, error } = await supabase
            .from('creative_likes')
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
          table: 'creative_comments',
          filter: `post_id=eq.${post.id}`
        }, async () => {
          const { count, error } = await supabase
            .from('creative_comments')
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
          await supabase.from('creative_likes').delete().eq('user_id', currentProfile.id).eq('post_id', post.id);

          // Deduct points when unliking to prevent accumulation
          await awardPoints(currentProfile.id, 'like', currentProfile, -1);
        } else {
          // Check if already liked to prevent duplicates
          const { data: existingLike } = await supabase
            .from('creative_likes')
            .select('id')
            .eq('user_id', currentProfile.id)
            .eq('post_id', post.id)
            .maybeSingle();

          if (!existingLike) {
            const { error: insertError } = await supabase.from('creative_likes').insert({ user_id: currentProfile.id, post_id: post.id });
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
    if (!newComment.trim() || !currentProfile || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const tempId = Math.random().toString(36).substr(2, 9);
    const commentObj: Comment = {
      id: tempId,
      post_id: post.id,
      user_id: currentProfile.id,
      content: newComment,
      created_at: new Date().toISOString(),
      author: currentProfile
    };

    const previousComments = [...comments];
    const updated = [...comments, commentObj];
    setComments(updated);
    setCommentsCount(prev => prev + 1);

    if (isSupabaseConfigured) {
      try {
        const { data: insertedData, error: insertError } = await supabase.from('creative_comments').insert({
          post_id: post.id,
          user_id: currentProfile.id,
          content: newComment
        }).select('id').single();

        if (insertError) throw insertError;

        if (insertedData) {
          setComments(prevComments =>
            prevComments.map(c => c.id === tempId ? { ...c, id: insertedData.id } : c)
          );
        }

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
        setNewComment('');
      } catch (err) {
        console.error('Erro ao inserir comentário:', err);
        // Revert local state on error
        setComments(previousComments);
        setCommentsCount(prev => Math.max(0, prev - 1));
        alert('Erro ao enviar comentário. Tente novamente.');
      } finally {
        setIsSubmittingComment(false);
      }
    } else {
      setNewComment('');
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentProfile) return;

    const commentToDelete = comments.find(c => c.id === commentId);

    const previousComments = [...comments];
    const updated = comments.filter(c => c.id !== commentId);
    setComments(updated);
    setCommentsCount(prev => Math.max(0, prev - 1));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('creative_comments')
          .delete()
          .eq('id', commentId);

        if (error) {
          console.error('Erro Supabase ao deletar comentário criativo:', error);
          throw error;
        }

        // Se deletou com sucesso, revogar os pontos do autor do comentário
        if (commentToDelete) {
          await awardPoints(commentToDelete.user_id, 'comment', null, -2);
        }

        console.log('Comentário criativo deletado com sucesso:', commentId);
      } catch (err: any) {
        console.error('Erro ao deletar comentário criativo:', err);
        setComments(previousComments);
        setCommentsCount(prev => prev + 1);
        alert('Erro ao excluir comentário: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  const getProxiedUrl = (url: string) => {
    if (!url || !url.startsWith('http')) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&fit=cover`;
  };

  const handleShare = async () => {
    const shareText = `
┏━━━━━━━━━━━━━━━━━━━━┓
  MURAL DE ESCRITA ✍️
  NOBEL CONECTA
┗━━━━━━━━━━━━━━━━━━━━┛

✨ "${post.title || 'Escrito Livre'}"

"${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"

✍️ Por: @${post.author?.username}

Veja o texto completo no Nobel Conecta:
`;
    const shareUrl = window.location.origin + `/#/creative?id=${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Nobel Conecta - ${post.title || 'Texto Literário'}`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        console.log('Erro ao compartilhar:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('Card de texto e link copiados! Agora você pode compartilhar no WhatsApp ou Instagram.');
      } catch (err) {
        alert('Não foi possível copiar o link.');
      }
    }
  };

  const handleShareImage = async () => {
    if (!cardRef.current || isGeneratingImage) return;

    setIsGeneratingImage(true);
    console.log('Iniciando geração de imagem criativa para:', post.title);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const options = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node.tagName === 'BUTTON') return false;
          if (node.classList?.contains('backdrop-blur-sm')) return false;
          if (node.classList?.contains('ml-auto') && node.classList?.contains('flex')) return false;
          return true;
        },
        style: {
          borderRadius: '40px',
          transform: 'scale(1)',
        },
        skipFonts: true,
        includeQueryParams: true
      };

      const images = cardRef.current.querySelectorAll('img');
      images.forEach(img => {
        if (!img.crossOrigin) {
          img.crossOrigin = 'anonymous';
        }
      });

      let dataUrl;
      try {
        console.log('Tentando toPng principal para criativo...');
        dataUrl = await toPng(cardRef.current, options);
      } catch (e) {
        console.warn('Png generation failed for creative, trying simplified png...', e);
        dataUrl = await toPng(cardRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 1,
          cacheBust: false
        });
      }

      const fileName = `nobel-criativo-${(post.title || 'texto').replace(/\s+/g, '-').toLowerCase()}.png`;

      if (navigator.share && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], fileName, { type: 'image/png' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Nobel Conecta - ${post.title}`,
              text: `Confira este texto criativo no Nobel Conecta!`
            });
            return;
          }
        } catch (shareErr) {
          console.error('Erro ao compartilhar imagem criativa:', shareErr);
        }
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      alert('Imagem gerada com sucesso! O download foi iniciado.');

    } catch (err: any) {
      console.error('Erro crítico na geração da imagem criativa:', err);
      alert('Não foi possível gerar a imagem devido a restrições de segurança do navegador (CORS). Tente usar as opções normais de compartilhamento ou tirar um print da tela.');
    } finally {
      setIsGeneratingImage(false);
    }
  };


  return (
    <div ref={cardRef} className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
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
            onClick={() => {
              if (onDelete) {
                onDelete(post.id);
              } else {
                console.warn('onDelete prop not provided to CreativePostCard');
              }
            }}
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
            <button
              onClick={handleShareImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 text-yellow-600 hover:text-yellow-700 transition-colors"
              title="Compartilhar como Imagem"
            >
              {isGeneratingImage ? <Loader2 className="animate-spin" size={22} /> : <ImageIcon size={22} />}
              <span className="text-xs font-black hidden md:inline">Imagem</span>
            </button>
            <button onClick={handleShare} className="flex items-center gap-2 text-gray-400 hover:text-black transition-colors" title="Compartilhar Link">
              <Share2 size={22} />
              <span className="text-xs font-black hidden md:inline">Link</span>
            </button>
          </div>
        </div>

        {showComments && (
          <div className="mt-6 pt-6 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
            <div className="max-h-40 overflow-y-auto space-y-3 mb-4 scrollbar-hide">
              {comments.length > 0 ? comments.map(c => {
                const isCommentOwner = currentProfile?.id === c.user_id;
                const canDeleteComment = isAdmin || isCommentOwner || isOwner;

                return (
                  <div key={c.id} className="flex gap-3 items-start group/comment">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.author?.avatar_url ? (
                        <img
                          src={getProxiedUrl(c.author.avatar_url)}
                          alt={c.author?.username}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon size={12} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] md:text-[12px] font-black text-black">@{c.author?.username}</span>
                        {canDeleteComment && (
                          <button
                            onClick={(e) => {
                              console.log('Botão excluir comentário criativo clicado para:', c.id);
                              e.stopPropagation();
                              handleDeleteComment(c.id);
                            }}
                            className="flex p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir Comentário"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] md:text-xs text-gray-700 leading-tight mt-0.5">{c.content}</p>
                    </div>
                  </div>
                );
              }) : (
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
