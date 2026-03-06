
import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Users, Trophy, Loader2, Plus, Trash2, CheckCircle2, Camera, Image as ImageIcon, Edit2 } from 'lucide-react';
import { supabase, uploadFile, isSupabaseConfigured } from '../supabase';
import { awardPoints } from '../src/services/pointsService';
import { Profile, Giveaway } from '../types';
import { compressImage } from '../src/utils/imageUtils';
import ConfirmModal from '../components/ConfirmModal';

interface GiveawaysViewProps {
  profile: Profile | null;
}

const GiveawaysView: React.FC<GiveawaysViewProps> = ({ profile }) => {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGiveaway, setNewGiveaway] = useState<Partial<Giveaway>>({
    title: '',
    description: '',
    book_image_url: '',
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: true
  });
  const [uploading, setUploading] = useState(false);
  const [editingGiveaway, setEditingGiveaway] = useState<Giveaway | null>(null);
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

  const isAdmin = profile?.role === 'admin' ||
    profile?.username === 'nobel_oficial' ||
    profile?.username === 'nobelpetro';

  useEffect(() => {
    fetchGiveaways();
    if (profile) fetchUserParticipations();
  }, [profile]);

  const fetchGiveaways = async () => {
    if (!isSupabaseConfigured) {
      // Demo data
      const demo: Giveaway[] = [{
        id: '1',
        title: 'Sorteio: Dom Casmurro (Edição Luxo)',
        description: 'Participe do sorteio desta edição especial de capa dura do clássico de Machado de Assis.',
        book_image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800',
        end_date: '2026-03-15',
        participants_count: 45,
        is_active: true,
        created_at: new Date().toISOString()
      }];
      setGiveaways(demo);
      setLoading(false);
      return;
    }

    try {
      // Fetch giveaways and their participant counts
      const { data, error } = await supabase
        .from('giveaways')
        .select('*, giveaway_participants(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGiveaways(data.map((g: any) => ({
        ...g,
        participants_count: g.giveaway_participants?.[0]?.count || 0
      })));
    } catch (err: any) {
      console.error('Error fetching giveaways:', err);
      if (err.message?.includes('relation "public.giveaways" does not exist')) {
        // Silently handle missing table for now
        setGiveaways([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserParticipations = async () => {
    if (!profile || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('giveaway_participants')
      .select('giveaway_id')
      .eq('user_id', profile.id);

    if (data) setParticipating(data.map(p => p.giveaway_id));
  };

  const handleParticipate = (giveawayId: string) => {
    if (!profile) return;

    setConfirmModal({
      isOpen: true,
      title: "Participar do Sorteio?",
      message: "Deseja entrar neste sorteio? Sorteios ativos dão pontos Nobel!",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        if (!isSupabaseConfigured) {
          setParticipating(prev => [...prev, giveawayId]);
          alert('Você está participando! (Modo Demo)');
          return;
        }

        try {
          const { error } = await supabase
            .from('giveaway_participants')
            .insert({ giveaway_id: giveawayId, user_id: profile.id });

          if (error) {
            if (error.code === '23505') alert('Você já está participando deste sorteio!');
            else throw error;
          } else {
            setParticipating(prev => [...prev, giveawayId]);
            await awardPoints(profile.id, 'giveaway', profile);
            fetchGiveaways();
            alert('Boa sorte! Você entrou no sorteio e ganhou +5 pontos Nobel.');
          }
        } catch (err) {
          alert('Erro ao participar.');
        }
      }
    });
  };

  const handleSaveGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      alert('Funcionalidade disponível apenas com Supabase configurado.');
      return;
    }

    try {
      if (editingGiveaway) {
        const { error } = await supabase.from('giveaways').update(newGiveaway).eq('id', editingGiveaway.id);
        if (error) throw error;
        alert('Sorteio editado com sucesso!');
      } else {
        const { error } = await supabase.from('giveaways').insert(newGiveaway);
        if (error) throw error;

        // Enviar notificação para todos os usuários sobre o novo sorteio
        try {
          const { data: profiles } = await supabase.from('profiles').select('id');
          if (profiles) {
            const notifications = profiles.map(p => ({
              user_id: p.id,
              type: 'giveaway',
              title: '🎁 Novo Sorteio Nobel!',
              content: `Participe agora do sorteio: ${newGiveaway.title}`,
              link: '/giveaways'
            }));
            await supabase.from('notifications').insert(notifications);
          }
        } catch (notifErr) {
          console.warn('Não foi possível enviar notificações:', notifErr);
        }
        alert('Sorteio criado com sucesso!');
      }

      setShowCreateModal(false);
      setEditingGiveaway(null);
      fetchGiveaways();
    } catch (err) {
      alert('Erro ao salvar sorteio. Verifique se as tabelas foram criadas no SQL Editor.');
    }
  };

  const handleEditClick = (giveaway: Giveaway) => {
    setEditingGiveaway(giveaway);
    setNewGiveaway({
      title: giveaway.title,
      description: giveaway.description,
      book_image_url: giveaway.book_image_url,
      end_date: giveaway.end_date.split('T')[0],
      is_active: giveaway.is_active
    });
    setShowCreateModal(true);
  };

  const handleDeleteGiveaway = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Sorteio?",
      message: "Tem certeza que deseja excluir este sorteio permanentemente?",
      onConfirm: async () => {
        if (!isSupabaseConfigured) {
          setGiveaways(giveaways.filter(g => g.id !== id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        try {
          await supabase.from('giveaways').delete().eq('id', id);
          fetchGiveaways();
        } catch (err) {
          alert('Erro ao excluir.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      const originalFile = e.target.files[0];
      const compressedFile = await compressImage(originalFile, 0.4, 1000);
      const url = await uploadFile('giveaways', compressedFile);
      setNewGiveaway(prev => ({ ...prev, book_image_url: url }));
    } catch (err) {
      alert('Erro no upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-serif italic text-gray-400">Preparando os prêmios...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Sorteios Nobel</h2>
          <p className="text-gray-400 mt-1 font-medium text-xs uppercase tracking-widest">Sua chance de ganhar novos mundos</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingGiveaway(null);
              setNewGiveaway({
                title: '',
                description: '',
                book_image_url: '',
                end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                is_active: true
              });
              setShowCreateModal(true);
            }}
            className="bg-black text-yellow-400 p-3 rounded-2xl shadow-xl hover:scale-110 transition-all"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      <div className="space-y-6 pb-24">
        {giveaways.length > 0 ? (
          giveaways.map(giveaway => (
            <div key={giveaway.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 group">
              <div className="relative h-64 md:h-80 overflow-hidden bg-gray-900 flex items-center justify-center">
                <img src={giveaway.book_image_url} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 shadow-2xl" alt={giveaway.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8">
                  <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <Gift size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sorteio Ativo</span>
                  </div>
                  <h3 className="text-white text-2xl font-black font-serif italic leading-tight">{giveaway.title}</h3>
                </div>
              </div>

              <div className="p-8">
                <p className="text-gray-500 text-sm leading-relaxed mb-8 italic">"{giveaway.description}"</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                    <Calendar className="text-yellow-600" size={18} />
                    <div>
                      <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Encerra em</p>
                      <p className="text-xs font-black">{new Date(giveaway.end_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                    <Users className="text-yellow-600" size={18} />
                    <div>
                      <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Participantes</p>
                      <p className="text-xs font-black">{giveaway.participants_count || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {participating.includes(giveaway.id) ? (
                    <div className="flex-1 bg-green-50 text-green-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> Já participando
                    </div>
                  ) : (
                    <button
                      onClick={() => handleParticipate(giveaway.id)}
                      className="flex-1 bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Trophy size={16} /> Quero Participar
                    </button>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditClick(giveaway)}
                        className="p-4 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-100 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => handleDeleteGiveaway(giveaway.id)}
                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-gray-100">
            <Gift className="mx-auto text-gray-100 mb-4" size={48} />
            <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Nenhum sorteio ativo no momento</p>
          </div>
        )}
      </div>

      {/* Modal de Criação (Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[20000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl my-auto">
            <h3 className="text-2xl font-black font-serif italic mb-6">{editingGiveaway ? 'Editar Sorteio' : 'Novo Sorteio'}</h3>
            <form onSubmit={handleSaveGiveaway} className="space-y-4">
              <div className="relative group cursor-pointer">
                <div className="w-full h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden relative">
                  {uploading ? (
                    <Loader2 className="animate-spin text-yellow-600" />
                  ) : newGiveaway.book_image_url ? (
                    <img src={newGiveaway.book_image_url} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="text-gray-300 mb-2" size={32} />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capa do Livro</p>
                    </>
                  )}
                  <label className="absolute inset-0 cursor-pointer">
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
                {newGiveaway.book_image_url && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-xl backdrop-blur-md">
                    <Camera size={14} />
                  </div>
                )}
              </div>

              <input
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold text-sm text-black"
                placeholder="Título do Sorteio"
                value={newGiveaway.title}
                onChange={e => setNewGiveaway({ ...newGiveaway, title: e.target.value })}
                required
              />
              <textarea
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm min-h-[100px] text-black"
                placeholder="Descrição do prêmio..."
                value={newGiveaway.description}
                onChange={e => setNewGiveaway({ ...newGiveaway, description: e.target.value })}
                required
              />
              <input
                type="date"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold text-sm text-black"
                value={newGiveaway.end_date}
                onChange={e => setNewGiveaway({ ...newGiveaway, end_date: e.target.value })}
                required
              />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-black text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                  {editingGiveaway ? 'Salvar Edição' : 'Criar Sorteio'}
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancelar</button>
              </div>
            </form>
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

export default GiveawaysView;
