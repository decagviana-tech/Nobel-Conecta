
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Post as CreativePost, Profile } from '../types';
import { Plus, Loader2, Image as ImageIcon, Sparkles, Heart, MessageSquare, Trash2, Send, ArrowRight } from 'lucide-react';
import CreativePostCard from '../components/CreativePostCard';
import ConfirmModal from '../components/ConfirmModal';

interface CreativeSpaceProps {
  profile: Profile | null;
}

const CreativeSpace: React.FC<CreativeSpaceProps> = ({ profile }) => {
  const [posts, setPosts] = useState<CreativePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    type: 'poem' as 'poem' | 'quote' | 'short_story' | 'art_description',
    image_url: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      if (!isSupabaseConfigured) {
        // Demo mode
        const demo: CreativePost[] = [{
          id: '1',
          title: 'O Silêncio das Páginas',
          content: 'No entrelaço das letras, encontro o porto seguro onde a alma descansa e o sonho desperta.',
          type: 'poem',
          user_id: 'system',
          author: { username: 'nobel_conecta', avatar_url: '' } as any,
          images: [],
          likes_count: 24,
          comments_count: 5,
          created_at: new Date().toISOString()
        }];
        setPosts(demo);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('creative_posts')
        .select(`
          *,
          author:profiles(*),
          creative_likes(count),
          creative_comments(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data.map((p: any) => ({
        ...p,
        likes_count: p.creative_likes?.[0]?.count || 0,
        comments_count: p.creative_comments?.[0]?.count || 0
      })));
    } catch (err) {
      console.error('Error fetching creative posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isSupabaseConfigured) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('creative_posts')
        .insert({
          ...newPost,
          user_id: profile.id
        });

      if (error) throw error;
      setShowCreateModal(false);
      setNewPost({ title: '', content: '', type: 'poem', image_url: '' });
      fetchPosts();
    } catch (err) {
      alert('Erro ao publicar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Criação?",
      message: "Tem certeza que deseja apagar esta obra permanentemente do seu portfólio criativo?",
      onConfirm: async () => {
        if (!isSupabaseConfigured) {
          setPosts(posts.filter(p => p.id !== id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        try {
          await supabase.from('creative_posts').delete().eq('id', id);
          fetchPosts();
        } catch (err) {
          alert('Erro ao excluir.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (loading) return <div className="p-10 text-center font-serif italic text-gray-400">Inspirando a alma...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-12">
      {/* Header Estilizado */}
      <div className="bg-black rounded-[2.5rem] p-10 mb-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-400 p-2.5 rounded-2xl">
              <Sparkles className="text-black" size={24} />
            </div>
            <h2 className="text-4xl font-black font-serif italic tracking-tighter">Espaço Criativo</h2>
          </div>
          <p className="text-gray-400 text-sm max-w-sm leading-relaxed italic">
            Onde as palavras ganham vida e a arte encontra seu lar. Compartilhe seus poemas, contos e pensamentos com a comunidade Nobel.
          </p>
        </div>

        {/* Floating Icons background decoration */}
        <div className="absolute top-10 right-10 text-white/5 rotate-12">
          <Heart size={120} strokeWidth={2} />
        </div>
        <div className="absolute -bottom-10 left-20 text-white/5 -rotate-12">
          <MessageSquare size={160} strokeWidth={2} />
        </div>
      </div>

      {/* Botão de Criação */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full mb-10 group"
      >
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 group-hover:border-yellow-400 group-hover:bg-yellow-50/30 transition-all duration-500">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-yellow-400 group-hover:text-black group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
            <Plus size={32} strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h3 className="text-black font-black uppercase tracking-[0.2em] text-[10px] mb-1">O que a sua alma diz hoje?</h3>
            <p className="text-gray-400 text-[10px] italic">Clique aqui para publicar uma nova criação</p>
          </div>
        </div>
      </button>

      <div className="space-y-12 pb-24">
        {posts.map(post => (
          <div key={post.id} className="relative group">
            <CreativePostCard
              post={post}
              currentProfile={profile}
              onDelete={handleDeletePost}
              isAdmin={profile?.role === 'admin'}
            />
          </div>
        ))}
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[20000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl relative">
            <div className="p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-black text-yellow-400 p-2 rounded-xl">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-3xl font-black font-serif italic tracking-tighter">Manifeste-se</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Tipo de Obra</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'poem', label: 'Poesia' },
                      { id: 'quote', label: 'Citação' },
                      { id: 'short_story', label: 'Conto' },
                      { id: 'art_description', label: 'Insight' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewPost({ ...newPost, type: type.id as any })}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${newPost.type === type.id
                          ? 'bg-black text-yellow-400'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    className="w-full bg-transparent border-b-2 border-gray-100 py-4 text-2xl font-black font-serif italic outline-none focus:border-black transition-colors"
                    placeholder="Dê um título à sua obra..."
                    value={newPost.title}
                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                    required
                  />

                  <textarea
                    className="w-full bg-gray-50 rounded-3xl p-8 text-sm leading-relaxed outline-none min-h-[200px] italic border-2 border-transparent focus:border-yellow-400 transition-all custom-scrollbar"
                    placeholder="Sua inspiração aqui..."
                    value={newPost.content}
                    onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                    required
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-black text-yellow-400 py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : (
                      <>
                        <Send size={18} /> Publicar Obra
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-100 text-gray-400 py-5 rounded-2xl font-black uppercase tracking-widest text-xs"
                  >
                    Guardar para Depois
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default CreativeSpace;
