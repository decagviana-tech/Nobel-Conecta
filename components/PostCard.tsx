
import React, { useState, useEffect, useRef } from 'react';
import { Star, MessageCircle, Heart, Trash2, Edit2, User as UserIcon, Send, ChevronDown, ChevronUp, BookOpen, Share2, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Post, Profile, Comment } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { createNotification } from '../src/services/notificationService';
import { awardPoints } from '../src/services/pointsService';
import { toProxyBase64 } from '../src/utils/imageUtils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Link } from 'react-router-dom';

interface PostCardProps {
  post: Post;
  currentProfile: Profile | null;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentProfile, onDelete, onEdit }) => {
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

  const isAdmin = currentProfile?.role === 'admin' ||
    currentProfile?.username === 'nobel_oficial' ||
    currentProfile?.username === 'nobelpetro';
  const isOwner = currentProfile?.id === post.user_id;

  useEffect(() => {
    if (showComments) {
      if (isSupabaseConfigured) {
        supabase.from('comments').select('*, author:profiles(*)').eq('post_id', post.id).then(({ data }) => {
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
        .channel(`post_likes:${post.id}`)
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
        .channel(`post_comments:${post.id}`)
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

  const handleShare = async () => {
    const stars = "⭐".repeat(post.rating || 5);
    const shareText = `
┏━━━━━━━━━━━━━━━━━━━━┓
  NOBEL CONECTA 📚
┗━━━━━━━━━━━━━━━━━━━━┛

📖 Livro: ${post.book_title}
👤 Autor: ${post.book_author}
⭐ Avaliação: ${stars}

"${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}"

✍️ Resenha por: @${post.author?.username}

Confira a resenha completa em:
`;
    const shareUrl = window.location.origin + `/?search=${encodeURIComponent(post.book_title || '')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Nobel Conecta - ${post.book_title}`,
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
    console.log('Iniciando geração de imagem para:', post.book_title);

    try {
      // Pequeno delay para garantir que imagens foram carregadas e animações pararam
      await new Promise(resolve => setTimeout(resolve, 1000));

      const options = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          // Esconder botões e elementos que usam backdrop-blur/filter que quebram o html-to-image
          if (node.tagName === 'BUTTON') return false;
          if (node.classList?.contains('backdrop-blur-sm')) return false;
          if (node.classList?.contains('ml-auto') && node.classList?.contains('flex')) return false;
          return true;
        },
        style: {
          borderRadius: '24px',
          transform: 'scale(1)',
        },
        skipFonts: true, // Prevents hanging on font loading
        includeQueryParams: true // Helps with cache busting on some CDNs
      };

      // Converter TODAS as imagens do card para base64 local ANTES de desenhar
      // Isso burla o CORS do html-to-image porque a imagem passa a "nascer" no proprio domínimo
      const images = cardRef.current.querySelectorAll('img');
      const originalSrcs = new Map<HTMLImageElement, string>();

      try {
        await Promise.all(Array.from(images).map(async (element) => {
          const img = element as HTMLImageElement;
          originalSrcs.set(img, img.src);
          // Only proxy if not already local or base64
          if (!img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
            img.src = await toProxyBase64(img.src);
          }
        }));
      } catch (proxyErr) {
        console.warn('Falha no pre-proxy das imagens, tentando fallback nativo', proxyErr);
      }

      let dataUrl;
      try {
        console.log('Tentando toPng principal...');
        dataUrl = await toPng(cardRef.current, options);
      } catch (e) {
        console.warn('Png generation failed, trying simplified png...', e);
        dataUrl = await toPng(cardRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 1,
          cacheBust: false
        });
      }

      const fileName = `nobel-conecta-${(post.book_title || 'resenha').replace(/\s+/g, '-').toLowerCase()}.png`;

      // Tentar usar a API de compartilhamento do sistema (funciona bem em mobille)
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], fileName, { type: 'image/png' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Resenha: ${post.book_title}`,
              text: `Confira minha resenha de ${post.book_title} no Nobel Conecta!`
            });
            return;
          }
        } catch (shareErr) {
          console.error('Erro ao compartilhar via API nativa:', shareErr);
        }
      }

      // Se não puder compartilhar ou falhar, faz o download comum
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      alert('Imagem gerada com sucesso! O download foi iniciado.');

    } catch (err: any) {
      console.error('Erro crítico na geração da imagem:', err);
      alert('Não foi possível gerar a imagem devido a restrições de segurança do navegador (CORS). Tente usar as opções normais de compartilhamento ou tirar um print da tela.');
    } finally {
      // Restaurar as fontes originais das imagens
      if (cardRef.current) {
        const images = cardRef.current.querySelectorAll('img');
        images.forEach(img => {
          if (img.dataset.originalSrc) {
            img.src = img.dataset.originalSrc;
          }
        });
      }
      setIsGeneratingImage(false);
    }
  };

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
                `@${currentProfile.username} curtiu sua resenha de "${post.book_title}".`,
                `/?search=${encodeURIComponent(post.book_title || '')}`
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
        const { data: insertedData, error: insertError } = await supabase.from('comments').insert({
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
            `@${currentProfile.username} comentou na sua resenha: "${newComment.substring(0, 30)}${newComment.length > 30 ? '...' : ''}"`,
            `/?search=${encodeURIComponent(post.book_title || '')}`
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
          .from('comments')
          .delete()
          .eq('id', commentId);

        if (error) {
          console.error('Erro Supabase ao deletar comentário:', error);
          throw error;
        }

        // Se deletou com sucesso, revogar os pontos do autor do comentário
        if (commentToDelete) {
          await awardPoints(commentToDelete.user_id, 'comment', null, -2);
        }

        console.log('Comentário deletado com sucesso:', commentId);
      } catch (err: any) {
        console.error('Erro ao deletar comentário:', err);
        setComments(previousComments);
        setCommentsCount(prev => prev + 1);
        alert('Erro ao excluir comentário: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  const isCreative = post.type === 'creative';
  const isClubThought = post.type === 'club_thought';

  const getProxiedUrl = (url: string) => {
    if (!url || !url.startsWith('http')) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&fit=cover`;
  };

  return (
    <div ref={cardRef} className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-3 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row w-full relative">

      {post.images && post.images.length > 0 ? (
        <div className="w-full md:w-[45%] aspect-[3/4] md:aspect-[4/5] overflow-hidden bg-gray-50 shrink-0 border-r border-gray-50 relative group/img">
          <img
            src={getProxiedUrl(post.images[0])}
            alt={post.book_title}
            crossOrigin="anonymous"
            className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
          />
          {isClubThought && (
            <div className="absolute top-2 left-2 bg-black/80 text-yellow-400 text-[10px] font-black uppercase px-2 py-1 rounded-md backdrop-blur-sm">
              Análise de Clube
            </div>
          )}
        </div>
      ) : isClubThought ? (
        <div className="w-full md:w-[25%] py-4 md:py-0 bg-yellow-50 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 px-4 md:px-6 border-b md:border-b-0 md:border-r border-yellow-100 shrink-0">
          <BookOpen className="text-yellow-600" size={24} />
          <span className="text-[10px] font-black text-yellow-800 uppercase tracking-widest text-center">Análise do Clube</span>
        </div>
      ) : null}

      <div className="flex flex-col flex-1 p-3 md:p-5 overflow-hidden">

        <div className="flex items-center justify-between mb-2">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-2 group/user">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-50 flex items-center justify-center overflow-hidden border border-yellow-100 group-hover/user:border-yellow-400 transition-colors">
              {post.author?.avatar_url ? (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0 border-2 border-white shadow-sm">
                  <img
                    src={post.author?.avatar_url ? getProxiedUrl(post.author.avatar_url) : `https://ui-avatars.com/api/?name=${post.author?.username}`}
                    alt={post.author?.username}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                </div>
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
            <div className="flex items-center gap-2 z-10">
              {isOwner && onEdit && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(post);
                  }}
                  className="bg-blue-50 text-blue-500 p-2 md:p-2.5 transition-all rounded-lg md:rounded-xl shadow-sm hover:scale-110 active:scale-95"
                  title="Editar Publicação"
                >
                  <Edit2 size={16} strokeWidth={2.5} />
                </button>
              )}
              <button
                onClick={async (e) => {
                  console.log('Botão de excluir clicado no PostCard. ID:', post.id);
                  e.preventDefault();
                  e.stopPropagation();
                  if (onDelete) {
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
                className="bg-red-500 text-white p-2 md:p-2.5 transition-all rounded-lg md:rounded-xl shadow-lg hover:scale-110 active:scale-95"
                title="Excluir Publicação"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            </div>
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
              <Heart size={18} className="md:w-5 md:h-5" fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 2} />
              <span className="text-[11px] md:text-[12px] font-black">{likesCount}</span>
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1 transition-colors ${showComments ? 'text-black' : 'text-gray-400'}`}
            >
              <MessageCircle size={18} className="md:w-5 md:h-5" />
              <span className="text-[11px] md:text-[12px] font-black">{commentsCount}</span>
              {showComments ? <ChevronUp size={12} className="md:w-3.5 md:h-3.5" /> : <ChevronDown size={12} className="md:w-3.5 md:h-3.5" />}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleShare}
                className="flex items-center gap-1 text-gray-400 hover:text-black transition-colors"
                title="Compartilhar Link"
              >
                <Share2 size={18} className="md:w-5 md:h-5" />
                <span className="text-[11px] md:text-[12px] font-black">Link</span>
              </button>
            </div>
          </div>

          {showComments && (
            <div className="mt-2 pt-2 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
              <div className="max-h-24 md:max-h-32 overflow-y-auto space-y-1.5 mb-2 scrollbar-hide">
                {comments.length > 0 ? comments.map(c => {
                  const isCommentOwner = currentProfile?.id === c.user_id;
                  const canDeleteComment = isAdmin || isCommentOwner || isOwner;

                  return (
                    <div key={c.id} className="flex gap-1.5 items-start group/comment">
                      <span className="text-[10px] md:text-[11px] font-black text-black shrink-0">@{c.author?.username}:</span>
                      <span className="text-[11px] md:text-[12px] text-gray-700 flex-1 leading-tight">{c.content}</span>
                      {canDeleteComment && (
                        <button
                          onClick={(e) => {
                            console.log('Botão excluir comentário clicado para:', c.id);
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
                  );
                }) : (
                  <p className="text-[10px] md:text-[11px] text-gray-300 font-bold uppercase tracking-widest text-center py-1.5">Sem comentários ainda</p>
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
