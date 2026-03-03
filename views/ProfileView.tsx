
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Book, Tag, Camera, Loader2, ArrowLeft, UserPlus, UserMinus, Trophy, Star, MessageCircle, Trash2 } from 'lucide-react';
import { supabase, uploadFile, isSupabaseConfigured } from '../supabase';
import { Profile, Post } from '../types';
import PostCard from '../components/PostCard';

interface ProfileViewProps {
  currentUserId: string;
}

const FOLLOW_KEY = 'nobel_conecta_following';

const ProfileView: React.FC<ProfileViewProps> = ({ currentUserId }) => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [uploading, setUploading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = currentUserId === id;

  useEffect(() => {
    if (id) {
      fetchData(id);
      checkFollowingStatus(id);
    }
  }, [id]);

  const checkFollowingStatus = (targetId: string) => {
    const saved = localStorage.getItem(FOLLOW_KEY);
    if (saved) {
      const following = JSON.parse(saved) as string[];
      setIsFollowing(following.includes(targetId));
    }
  };

  const handleToggleFollow = () => {
    if (!id) return;
    const saved = localStorage.getItem(FOLLOW_KEY);
    let following: string[] = saved ? JSON.parse(saved) : [];

    if (isFollowing) {
      following = following.filter(fid => fid !== id);
    } else {
      following.push(id);
    }

    localStorage.setItem(FOLLOW_KEY, JSON.stringify(following));
    setIsFollowing(!isFollowing);
  };

  const fetchData = async (userId: string) => {
    setLoading(true);
    
    // Timeout de segurança para não travar a tela
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 4000);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const demoProfile: Profile = {
          id: userId,
          username: userId === 'admin-user' ? 'nobel_oficial' : 'leitor_petropolis',
          full_name: userId === 'admin-user' ? 'Livraria Nobel' : 'Leitor Nobel',
          role: userId === 'admin-user' ? 'admin' : 'user',
          bio: 'Apaixonado pela história de Petrópolis e por literatura russa.',
          favorite_genres: ['Clássicos', 'História'],
          reading_now: 'Memórias Póstumas de Brás Cubas'
        };
        setProfile(demoProfile);
        setEditForm(demoProfile);
        
        const allPosts = JSON.parse(localStorage.getItem('nobel_conecta_demo_posts') || '[]');
        const creativePosts = JSON.parse(localStorage.getItem('nobel_conecta_creative_posts') || '[]');
        setPosts([...allPosts, ...creativePosts].filter((p: Post) => p.user_id === userId));
        setLoading(false);
        clearTimeout(timeout);
      }, 500);
      return;
    }

    try {
      const [pRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts').select('*, author:profiles(*), likes(user_id), comments(count)').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      if (pRes.error) {
        console.warn('Perfil não encontrado ou erro:', pRes.error);
      } else {
        setProfile(pRes.data);
        setEditForm(pRes.data);
      }
      setPosts(postsRes.data?.map((p: any) => ({
        ...p,
        likes_count: p.likes?.length || 0,
        comments_count: p.comments?.[0]?.count || 0
      })) || []);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
      clearTimeout(timeout);
    }
  };

  const handleUpdate = async () => {
    if (!profile) return;
    setLoading(true);

    const updatedData = {
      full_name: editForm.full_name,
      username: editForm.username,
      bio: editForm.bio,
      reading_now: editForm.reading_now,
      favorite_genres: editForm.favorite_genres
    };

    if (!isSupabaseConfigured) {
      setProfile(prev => ({ ...prev!, ...updatedData }));
      setIsEditing(false);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', profile.id);

      if (error) throw error;
      setProfile(prev => ({ ...prev!, ...updatedData }));
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar:', err);
      alert('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !profile) return;
    setUploading(true);
    try {
      const url = await uploadFile('avatars', e.target.files[0]);
      if (isSupabaseConfigured) {
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
      }
      setProfile(prev => ({ ...prev!, avatar_url: url }));
    } catch (err: any) {
      alert('Erro no upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("⚠️ ATENÇÃO: Você tem certeza que deseja excluir sua conta permanentemente? Esta ação não pode ser desfeita e você perderá todos os seus pontos, publicações e conquistas.");
    
    if (!confirmed) return;

    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Modo Demo
        localStorage.removeItem('nobel_demo_session');
        // Limpar posts do usuário no localStorage
        const allPosts = JSON.parse(localStorage.getItem('nobel_conecta_demo_posts') || '[]');
        const creativePosts = JSON.parse(localStorage.getItem('nobel_conecta_creative_posts') || '[]');
        localStorage.setItem('nobel_conecta_demo_posts', JSON.stringify(allPosts.filter((p: any) => p.user_id !== currentUserId)));
        localStorage.setItem('nobel_conecta_creative_posts', JSON.stringify(creativePosts.filter((p: any) => p.user_id !== currentUserId)));
      } else {
        // Modo Real (Supabase)
        // Deletar perfil (posts devem ter cascade ou ser deletados manualmente se necessário)
        const { error } = await supabase.from('profiles').delete().eq('id', currentUserId);
        if (error) throw error;
        await supabase.auth.signOut();
      }
      
      alert("Sua conta foi excluída com sucesso. Sentiremos sua falta!");
      window.location.href = '#/login';
      window.location.reload();
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      alert("Erro ao excluir conta: " + (err.message || "Tente novamente mais tarde."));
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    console.log('handleDeletePost (Perfil) iniciada para ID:', postId);
    const confirmed = true;
    
    if (!isSupabaseConfigured) {
      console.log('Modo Demo (Perfil): excluindo localmente...');
      const allPosts = JSON.parse(localStorage.getItem('nobel_conecta_demo_posts') || '[]');
      const creativePosts = JSON.parse(localStorage.getItem('nobel_conecta_creative_posts') || '[]');
      
      const filteredDemo = allPosts.filter((p: Post) => p.id !== postId);
      const filteredCreative = creativePosts.filter((p: Post) => p.id !== postId);
      
      localStorage.setItem('nobel_conecta_demo_posts', JSON.stringify(filteredDemo));
      localStorage.setItem('nobel_conecta_creative_posts', JSON.stringify(filteredCreative));
      setPosts(posts.filter(p => p.id !== postId));
    } else {
      try {
        console.log('Chamando Supabase para deletar post do perfil:', postId);
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) {
          console.error('Erro do Supabase na exclusão do perfil:', error);
          throw error;
        }
        console.log('Post do perfil deletado com sucesso do Supabase.');
        setPosts(posts.filter(p => p.id !== postId));
      } catch (err: any) {
        console.error('Erro capturado no catch de exclusão do perfil:', err);
        alert('Erro ao excluir publicação: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  if (loading && !profile) return <div className="p-8 text-center text-gray-400 font-serif italic">Preparando estante...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-16">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 bg-white border border-gray-100 rounded-xl text-gray-900 shadow-sm hover:bg-gray-50"><ArrowLeft size={20} /></Link>
        <h2 className="text-xl font-black font-serif">Perfil do Leitor</h2>
      </div>

      <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-[2.5rem] bg-yellow-50 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center rotate-3">
              {uploading ? (
                <Loader2 className="animate-spin text-yellow-600" />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                <User size={56} className="text-yellow-200" />
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute -bottom-2 -right-2 bg-black text-yellow-400 p-3 rounded-2xl cursor-pointer hover:scale-110 transition-transform border-4 border-white shadow-lg">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="space-y-4 max-w-sm mx-auto text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Nome Completo</label>
                    <input className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold text-black focus:border-black transition-all" value={editForm.full_name || ''} onChange={e => setEditForm({...editForm, full_name: e.target.value})} placeholder="Nome Completo" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Username (@)</label>
                    <input className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold text-black focus:border-black transition-all" value={editForm.username || ''} onChange={e => setEditForm({...editForm, username: e.target.value.replace('@', '').toLowerCase()})} placeholder="username" />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Sua Bio</label>
                  <textarea className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none resize-none text-black focus:border-black transition-all" value={editForm.bio || ''} onChange={e => setEditForm({...editForm, bio: e.target.value})} rows={3} placeholder="Sua bio literária..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Lendo Agora</label>
                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-xs text-black focus:border-black transition-all" value={editForm.reading_now || ''} onChange={e => setEditForm({...editForm, reading_now: e.target.value})} placeholder="Título do livro" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Gêneros (separados por vírgula)</label>
                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-xs text-black focus:border-black transition-all" value={editForm.favorite_genres?.join(', ') || ''} onChange={e => setEditForm({...editForm, favorite_genres: e.target.value.split(',').map(s => s.trim())})} placeholder="Ex: Terror, Romance" />
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <div className="flex gap-4">
                    <button onClick={handleUpdate} className="flex-1 bg-black text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all">Salvar</button>
                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancelar</button>
                  </div>
                  
                  <button 
                    onClick={handleDeleteAccount}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 text-red-500 font-black uppercase tracking-widest text-[8px] hover:bg-red-50 rounded-xl transition-all border border-red-100 group"
                  >
                    <Trash2 size={12} className="group-hover:animate-bounce" />
                    Excluir Minha Conta Permanentemente
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-black text-gray-900 font-serif italic tracking-tight">{profile?.full_name}</h2>
                <p className="text-yellow-600 font-black text-xs uppercase tracking-[0.2em] mt-2">@{profile?.username}</p>
                <p className="mt-6 text-gray-500 leading-relaxed text-sm italic max-w-sm mx-auto">"{profile?.bio || "Um leitor curioso de Petrópolis."}"</p>
                
                <div className="flex flex-wrap gap-4 justify-center mt-10">
                  {isOwnProfile ? (
                    <button onClick={() => setIsEditing(true)} className="px-12 py-4 bg-black text-yellow-400 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Editar Perfil</button>
                  ) : (
                    <>
                      <button 
                        onClick={handleToggleFollow}
                        className={`flex items-center justify-center gap-3 px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing ? 'bg-gray-100 text-gray-400' : 'bg-black text-yellow-400 shadow-xl hover:scale-105 active:scale-95'}`}
                      >
                        {isFollowing ? <><UserMinus size={16} /> Deixar de Seguir</> : <><UserPlus size={16} /> Seguir Leitor</>}
                      </button>
                      <Link 
                        to={`/messages/${profile?.id}`}
                        className="flex items-center justify-center gap-3 px-12 py-4 bg-yellow-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        <MessageCircle size={16} /> Enviar Mensagem
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
        <div className="bg-black text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col gap-2 relative overflow-hidden group">
          <Book className="text-yellow-400" size={24} />
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Lendo agora</p>
          <p className="text-xs font-black truncate italic">{profile?.reading_now || "..."}</p>
          <div className="absolute top-[-20px] right-[-20px] opacity-[0.05] group-hover:scale-110 transition-transform"><Book size={80} /></div>
        </div>
        <div className="bg-yellow-400 text-black p-6 rounded-[2.5rem] shadow-lg flex flex-col gap-2 relative overflow-hidden group">
          <Trophy className="text-black" size={24} />
          <p className="text-[9px] text-black/50 font-black uppercase tracking-widest">Pontos Nobel</p>
          <p className="text-xl font-black">{profile?.points || 0} pts</p>
          <div className="absolute top-[-20px] right-[-20px] opacity-[0.1] group-hover:scale-110 transition-transform"><Star size={80} fill="black" /></div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col gap-2 md:col-span-1 col-span-2">
          <Tag className="text-black" size={24} />
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Gêneros favoritos</p>
          <p className="text-xs font-black uppercase truncate">
            {profile?.favorite_genres && profile.favorite_genres.length > 0 
              ? profile.favorite_genres.join(', ') 
              : "Explorando"}
          </p>
        </div>
      </div>

      <div className="space-y-8 pb-24">
        <h3 className="font-black text-xl text-gray-900 font-serif italic border-b border-gray-100 pb-4">Linha do Tempo Literária</h3>
        {posts.length > 0 ? (
          <div className="space-y-6">
            {posts.map(post => <PostCard key={post.id} post={post} currentProfile={profile} onDelete={handleDeletePost} />)}
          </div>
        ) : (
          <div className="text-center py-24 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Ainda não há nada na estante.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
