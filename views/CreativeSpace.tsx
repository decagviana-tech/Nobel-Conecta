
import React, { useState, useEffect } from 'react';
import { PenTool, Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { awardPoints } from '../src/services/pointsService';
import { Post, Profile } from '../types';
import CreatePostModal from '../components/CreatePostModal';
import CreativePostCard from '../components/CreativePostCard';

interface CreativeSpaceProps {
  profile: Profile | null;
}

const STORAGE_KEY = 'nobel_conecta_creative_posts';

const CreativeSpace: React.FC<CreativeSpaceProps> = ({ profile }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  useEffect(() => {
    fetchPosts();
  }, [profile?.id]);

  const fetchPosts = async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPosts(parsed.filter((p: any) => p.id !== 'c1'));
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, author:profiles(*), likes:likes(user_id), comments:comments(count)')
        .eq('type', 'creative')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data?.map((p: any) => ({
        ...p,
        likes_count: p.likes?.length || 0,
        comments_count: p.comments?.[0]?.count || 0,
        user_has_liked: profile?.id ? p.likes?.some((l: any) => l.user_id === profile.id) : false
      })) || []);
    } catch (err) {
      console.error('Error fetching creative posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = async (newPost?: Post) => {
    if (newPost) {
      await fetchPosts();
    } else {
      await fetchPosts();
    }
    setShowCreateModal(false);
  };

  const handleDelete = async (id: string) => {
    console.log('Iniciando exclusão do post:', id);
    // Removido window.confirm para evitar travamentos
    const confirmed = true;
    
    if (!isSupabaseConfigured) {
      console.log('Modo Demo: excluindo localmente');
      const updated = posts.filter(p => p.id !== id);
      setPosts(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return;
    }

    try {
      console.log('Chamando Supabase para excluir:', id);
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) {
        console.error('Erro retornado pelo Supabase:', error);
        throw error;
      }
      console.log('Exclusão bem-sucedida no Supabase');
      setPosts(posts.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Erro catastrófico na exclusão:', err);
      alert('Erro ao excluir: ' + (err.message || 'Verifique sua conexão.'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-16 mb-24">
      <div className="flex flex-col items-center text-center mb-12">
        <div className="w-16 h-16 bg-black text-yellow-400 rounded-3xl flex items-center justify-center shadow-xl rotate-3 mb-6">
          <PenTool size={32} />
        </div>
        <h2 className="text-4xl font-black text-gray-900 font-serif tracking-tight">Mural de Escrita</h2>
        <p className="text-gray-400 mt-2 font-medium italic">Comunidade Petrópolis literária</p>
      </div>

      <div className="space-y-10">
        {loading ? (
          <div className="text-center py-20 text-gray-400 font-serif italic">Carregando mural...</div>
        ) : posts.map(post => (
          <CreativePostCard 
            key={post.id} 
            post={post} 
            currentProfile={profile} 
            onDelete={handleDelete} 
            isAdmin={isAdmin} 
          />
        ))}

        {posts.length === 0 && !loading && (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <PenTool className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">O mural está esperando suas palavras</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 md:bottom-24 right-6 bg-yellow-400 text-black p-6 rounded-[2rem] shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 border-4 border-white"
      >
        <Plus size={32} strokeWidth={4} />
      </button>

      {showCreateModal && profile && (
        <CreatePostModal 
          userId={profile.id} 
          currentProfile={profile}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handlePostCreated}
          postType="creative"
        />
      )}
    </div>
  );
};

export default CreativeSpace;
