
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, BookOpen, Send, User as UserIcon, MessageSquare, ShieldCheck, Trophy, Trash2, Camera, Loader2, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, uploadFile } from '../supabase';
import { awardPoints } from '../src/services/pointsService';
import { BookClub, Profile, Post } from '../types';
import PostCard from '../components/PostCard';

interface ClubDetailProps {
  profile: Profile | null;
}

const CLUBS_STORAGE_KEY = 'nobel_conecta_clubs';
const POSTS_STORAGE_KEY = 'nobel_conecta_demo_posts';

const ClubDetail: React.FC<ClubDetailProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<BookClub | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newThought, setNewThought] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [analysisImage, setAnalysisImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchClubData();
  }, [id, profile]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadFile('posts', e.target.files[0]);
      setAnalysisImage(url);
    } catch (err) {
      alert('Erro no upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const fetchClubData = async () => {
    if (!id) return;

    if (!isSupabaseConfigured) {
      const savedClubs = localStorage.getItem(CLUBS_STORAGE_KEY);
      if (savedClubs) {
        const clubs: BookClub[] = JSON.parse(savedClubs);
        const found = clubs.find(c => c.id === id);
        if (found) {
          setClub(found);
          setIsMember(found.member_ids.includes(profile?.id || ''));
        }
      }

      const savedPosts = localStorage.getItem(POSTS_STORAGE_KEY);
      if (savedPosts) {
        const allPosts: Post[] = JSON.parse(savedPosts);
        setPosts(allPosts.filter(p => p.club_id === id));
      }
      return;
    }

    try {
      // Fetch club
      const { data: clubData, error: clubError } = await supabase
        .from('book_clubs')
        .select('*')
        .eq('id', id)
        .single();

      if (clubError) throw clubError;
      setClub(clubData);
      setIsMember(clubData.member_ids.includes(profile?.id || ''));

      // Fetch posts for this club
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, author:profiles(*), likes(user_id), comments(count)')
        .eq('club_id', id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;
      setPosts(postsData?.map((p: any) => ({
        ...p,
        likes_count: p.likes?.length || 0,
        comments_count: p.comments?.[0]?.count || 0
      })) || []);
    } catch (err) {
      console.error('Error fetching club detail:', err);
    }
  };

  const handleJoin = async () => {
    if (!profile || !club) return;

    const newMembers = isMember 
      ? club.member_ids.filter(mid => mid !== profile.id)
      : [...club.member_ids, profile.id];

    if (!isSupabaseConfigured) {
      const savedClubs = localStorage.getItem(CLUBS_STORAGE_KEY);
      if (savedClubs) {
        const clubs: BookClub[] = JSON.parse(savedClubs);
        const updatedClubs = clubs.map(c => {
          if (c.id === club.id) return { ...c, member_ids: newMembers };
          return c;
        });
        localStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(updatedClubs));
        setClub({ ...club, member_ids: newMembers });
        setIsMember(!isMember);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('book_clubs')
        .update({ member_ids: newMembers })
        .eq('id', club.id);

      if (error) throw error;
      
      // Ganho de pontos por entrar no clube
      if (!isMember) {
        await awardPoints(profile.id, 'join_club', profile);
        alert('Bem-vindo ao clube! Você ganhou +5 pontos Nobel.');
      }

      setClub({ ...club, member_ids: newMembers });
      setIsMember(!isMember);
    } catch (err) {
      alert('Erro ao atualizar participação.');
    }
  };

  const handleSubmitThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThought.trim() || !profile || !club) return;

    const thoughtData = {
      user_id: profile.id,
      content: newThought,
      book_title: club.current_book,
      book_author: club.current_book_author,
      images: analysisImage ? [analysisImage] : [],
      created_at: new Date().toISOString(),
      type: 'club_thought' as const,
      club_id: club.id
    };

    if (!isSupabaseConfigured) {
      const thought: Post = {
        id: Math.random().toString(36).substr(2, 9),
        ...thoughtData,
        author: profile,
        likes_count: 0,
        comments_count: 0
      };
      const savedPosts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]');
      const updated = [thought, ...savedPosts];
      localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(updated));
      setPosts([thought, ...posts]);
    } else {
      try {
        const { data, error } = await supabase.from('posts').insert(thoughtData).select('*, author:profiles(*)').single();
        if (error) throw error;
        
        // Ganho de pontos por análise de clube
        await awardPoints(profile.id, 'club_thought', profile);

        if (data) {
          setPosts([data, ...posts]);
        } else {
          fetchClubData();
        }
      } catch (err) {
        alert('Erro ao publicar análise.');
      }
    }

    setNewThought('');
    setAnalysisImage(null);
    alert('Sua análise foi enviada ao clube! +10 pontos Nobel pela colaboração.');
  };

  const handleDeletePost = async (postId: string) => {
    console.log('handleDeletePost (Clube) iniciada para ID:', postId);
    const confirmed = true;
    
    if (!isSupabaseConfigured) {
      console.log('Modo Demo (Clube): excluindo localmente...');
      const savedPosts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]');
      const updated = savedPosts.filter((p: Post) => p.id !== postId);
      localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(updated));
      setPosts(posts.filter(p => p.id !== postId));
    } else {
      try {
        console.log('Chamando Supabase para deletar análise do clube:', postId);
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) {
          console.error('Erro do Supabase na exclusão do clube:', error);
          throw error;
        }
        console.log('Análise do clube deletada com sucesso do Supabase.');
        setPosts(posts.filter(p => p.id !== postId));
      } catch (err: any) {
        console.error('Erro capturado no catch de exclusão do clube:', err);
        alert('Erro ao excluir análise: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  if (!club) return <div className="p-10 text-center font-serif italic text-gray-400">Procurando clube...</div>;

  const isOrganizer = club.admin_id === profile?.id;
  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  const handleDeleteClub = async () => {
    // Removido window.confirm para evitar travamentos
    const confirmed = true;
    
    if (!isSupabaseConfigured) {
      const savedClubs = localStorage.getItem(CLUBS_STORAGE_KEY);
      if (savedClubs) {
        const clubs: BookClub[] = JSON.parse(savedClubs);
        const updatedClubs = clubs.filter(c => c.id !== club.id);
        localStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(updatedClubs));
        
        const savedPosts = localStorage.getItem(POSTS_STORAGE_KEY);
        if (savedPosts) {
          const allPosts: Post[] = JSON.parse(savedPosts);
          const filteredPosts = allPosts.filter(p => p.club_id !== club.id);
          localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(filteredPosts));
        }
        navigate('/clubs');
      }
    } else {
      try {
        const { error } = await supabase.from('book_clubs').delete().eq('id', club.id);
        if (error) throw error;
        navigate('/clubs');
      } catch (err) {
        alert('Erro ao excluir clube.');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-16 mb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/clubs')} className="p-2 bg-white border border-gray-100 rounded-xl text-gray-900 shadow-sm hover:bg-gray-50"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-black font-serif">Espaço do Clube</h2>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 shadow-2xl relative overflow-hidden mb-8 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
          <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden shadow-2xl shrink-0 border-4 border-yellow-400">
            <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
              {isOrganizer && (
                <span className="bg-black text-yellow-400 text-[7px] md:text-[8px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-2">
                  <ShieldCheck size={10} /> Organizador
                </span>
              )}
              <span className="text-gray-400 text-[8px] md:text-[9px] uppercase font-bold tracking-widest">{club.member_ids.length} Membros</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-serif italic leading-tight mb-3 text-gray-900">{club.name}</h1>
            <p className="text-gray-500 text-xs md:text-sm italic mb-6 leading-relaxed line-clamp-3 md:line-clamp-none">"{club.description}"</p>
            
            <div className="flex items-center justify-center md:justify-start gap-3">
               <button 
                 onClick={handleJoin}
                 className={`px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${isMember ? 'bg-gray-100 text-gray-400' : 'bg-yellow-400 text-black shadow-xl hover:scale-105 active:scale-95'}`}
               >
                 {isMember ? 'Sair do Clube' : 'Participar'}
               </button>
               {(isOrganizer || isAdmin) && (
                 <button 
                   onClick={handleDeleteClub}
                   className="p-3 md:p-4 bg-red-50 text-red-500 rounded-xl md:rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                   title="Excluir Clube"
                 >
                   <Trash2 size={18} />
                 </button>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
        <div className="bg-black text-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl flex flex-col gap-1 md:gap-2">
          <BookOpen className="text-yellow-400" size={20} />
          <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Leitura Atual</p>
          <p className="text-xs md:text-sm font-black italic truncate">{club.current_book}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col gap-1 md:gap-2">
          <Trophy className="text-yellow-600" size={20} />
          <p className="text-[8px] text-yellow-700 font-black uppercase tracking-widest">Ranking</p>
          <p className="text-xs md:text-sm font-black text-yellow-800">Top #1 Interação</p>
        </div>
      </div>

      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
           <h3 className="font-black text-lg md:text-xl text-gray-900 font-serif italic">Mural de Considerações</h3>
           <MessageSquare size={18} className="text-gray-200" />
        </div>

        {isMember ? (
          <form onSubmit={handleSubmitThought} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 border-yellow-400/20 shadow-lg mb-8 transition-all focus-within:border-yellow-400">
            <textarea 
              className="w-full bg-transparent border-none outline-none text-xs md:text-sm text-gray-900 font-medium italic resize-none placeholder-gray-300 focus:ring-0" 
              placeholder="O que você está achando deste livro? Compartilhe..."
              rows={3}
              value={newThought}
              onChange={e => setNewThought(e.target.value)}
            />
            
            {analysisImage && (
              <div className="mt-4 relative w-20 h-20 rounded-xl overflow-hidden shadow-md">
                <img src={analysisImage} className="w-full h-full object-cover" alt="Análise" />
                <button 
                  type="button"
                  onClick={() => setAnalysisImage(null)}
                  className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
              <button 
                type="button"
                onClick={() => document.getElementById('analysis-image-upload')?.click()}
                className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-colors"
                title="Adicionar Foto"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
              <input id="analysis-image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              
              <button type="submit" className="bg-black text-yellow-400 px-5 md:px-6 py-2.5 md:py-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg font-black uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2">
                Publicar <Send size={12} />
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-[1.5rem] border border-gray-100 mb-8">
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest px-8">Entre no clube para participar das discussões</p>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
          {posts.length > 0 ? (
            posts.map(post => <PostCard key={post.id} post={post} currentProfile={profile} onDelete={handleDeletePost} />)
          ) : (
            <div className="text-center py-16 md:py-24 bg-gray-50 rounded-[2rem] md:rounded-[2.5rem] border-2 border-dashed border-gray-100">
               <BookOpen className="mx-auto text-gray-200 mb-3 md:mb-4" size={40} md:size={48} />
               <p className="text-gray-300 font-black uppercase text-[8px] md:text-[9px] tracking-widest">Aguardando a primeira análise</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClubDetail;
