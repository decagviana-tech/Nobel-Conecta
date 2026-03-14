
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, BookText, Search, X, Users, Compass, ShoppingBag, PenTool } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../supabase';
import { Post, Profile } from '../types';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { awardPoints } from '../src/services/pointsService';

interface HomeProps {
  profile: Profile | null;
}

const STORAGE_KEY = 'nobel_conecta_demo_posts';
const FOLLOW_KEY = 'nobel_conecta_following';

const Home: React.FC<HomeProps> = ({ profile }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'explorar' | 'seguindo'>('explorar');
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPosts();
    loadFollowing();
  }, [profile?.id]);

  const loadFollowing = async () => {
    if (!profile?.id) return;

    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(FOLLOW_KEY);
      if (saved) {
        const ids = JSON.parse(saved);
        setFollowingIds([...ids, profile.id]);
      } else {
        setFollowingIds([profile.id]);
      }
      return;
    }

    try {
      const { getFollowingIds } = await import('../src/services/socialService');
      const ids = await getFollowingIds(profile.id);
      // Incluímos o próprio ID para que o usuário veja suas próprias postagens na aba Seguindo
      setFollowingIds([...ids, profile.id]);
    } catch (err) {
      console.error('Error loading following:', err);
      setFollowingIds([profile.id]);
    }
  };

  const fetchPosts = async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPosts(JSON.parse(saved).filter((p: Post) => p.type === 'review' || !p.type));
      } else {
        const initialPost: Post = {
          id: '1',
          user_id: 'admin-user',
          book_title: 'Dom Casmurro',
          book_author: 'Machado de Assis',
          content: 'Reli este clássico hoje e a dúvida continua: Capitu traiu ou não? A escrita de Machado é insuperável. Recomendo a edição da Nobel Petrópolis.',
          rating: 5,
          images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800'],
          created_at: new Date().toISOString(),
          likes_count: 12,
          comments_count: 4,
          user_has_liked: false,
          type: 'review',
          author: {
            id: 'admin-user',
            username: 'nobel_oficial',
            full_name: 'Livraria Nobel',
            avatar_url: '',
            role: 'admin',
            favorite_genres: ['Clássicos'],
            created_at: new Date().toISOString()
          }
        };
        setPosts([initialPost]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([initialPost]));
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, author:profiles(*), likes:likes(user_id), comments:comments(count)`)
        .eq('type', 'review')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched posts data:', data);
      setPosts(data.map((p: any) => ({
        ...p,
        likes_count: p.likes?.length || 0,
        comments_count: p.comments?.[0]?.count || 0,
        user_has_liked: profile?.id ? p.likes?.some((l: any) => l.user_id === profile.id) : false
      })));
    } catch (err) {
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost?: Post) => {
    if (newPost) {
      const reviewPost = { ...newPost, type: 'review' as const };
      const updatedPosts = [reviewPost, ...posts];
      setPosts(updatedPosts);
      if (!isSupabaseConfigured) {
        const allPosts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([reviewPost, ...allPosts]));
      }
    } else {
      fetchPosts();
    }
    setShowCreateModal(false);
  };

  const handleDeletePost = async (postId: string) => {
    console.log('handleDeletePost iniciada para ID:', postId);
    // Removido window.confirm pois está travando no ambiente do usuário
    const confirmed = true;

    if (!isSupabaseConfigured) {
      console.log('Modo Demo: excluindo localmente...');
      const updatedPosts = posts.filter(p => p.id !== postId);
      setPosts(updatedPosts);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const allPosts = JSON.parse(saved);
        const filtered = allPosts.filter((p: Post) => p.id !== postId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }
    } else {
      try {
        console.log('Chamando Supabase para deletar post:', postId);

        const postToDelete = posts.find(p => p.id === postId);

        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) {
          console.error('Erro do Supabase na exclusão:', error);
          throw error;
        }

        if (postToDelete) {
          await awardPoints(postToDelete.user_id, 'review', null, -10);
        }

        console.log('Post deletado com sucesso do Supabase.');
        setPosts(prev => prev.filter(p => p.id !== postId));
      } catch (err: any) {
        console.error('Erro capturado no catch de exclusão:', err);
        alert('Erro ao excluir: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm ||
      post.book_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab = activeTab === 'explorar' || followingIds.includes(post.user_id);

    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 md:pt-12">
      {/* Botões de Ação Rápida */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Link to="/shop" className="bg-yellow-400 text-black p-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all border-2 border-white">
          <ShoppingBag size={20} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">Vitrine</span>
        </Link>
        <Link to="/creative" className="bg-black text-yellow-400 p-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all border-2 border-white">
          <PenTool size={20} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">Mural</span>
        </Link>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gray-50 text-gray-900 p-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm hover:scale-105 active:scale-95 transition-all border-2 border-white"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">Resenha</span>
        </button>
      </div>

      {/* Seletor de Abas */}
      <div className="flex border-b border-gray-100 mb-6 bg-white rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab('explorar')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'explorar' ? 'text-black border-b-2 border-yellow-400 bg-yellow-50/30' : 'text-gray-400 hover:text-black'}`}
        >
          <Compass size={16} /> Explorar
        </button>
        <button
          onClick={() => {
            setActiveTab('seguindo');
            loadFollowing();
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'seguindo' ? 'text-black border-b-2 border-yellow-400 bg-yellow-50/30' : 'text-gray-400 hover:text-black'}`}
        >
          <Users size={16} /> Seguindo
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="O que você quer ler hoje?"
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-100 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-yellow-400 text-sm font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>}
      </div>

      <div className="space-y-4 pb-20">
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-40 bg-gray-50 rounded-2xl animate-pulse"></div>)
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <PostCard key={post.id} post={post} currentProfile={profile} onDelete={handleDeletePost} />
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
            <Users className="mx-auto text-gray-100 mb-3" size={40} />
            <p className="text-gray-400 font-bold uppercase text-[11px] tracking-[0.2em]">
              {activeTab === 'seguindo' ? 'Siga alguém para ver atualizações aqui' : 'Nenhuma resenha encontrada'}
            </p>
          </div>
        )}
      </div>

      {showCreateModal && profile && (
        <CreatePostModal
          userId={profile.id}
          currentProfile={profile}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handlePostCreated}
          postType="review"
        />
      )}
    </div>
  );
};

export default Home;
