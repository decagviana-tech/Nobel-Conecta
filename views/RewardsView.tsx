
import React, { useState, useEffect } from 'react';
import { supabase, uploadFile, isSupabaseConfigured } from '../supabase';
import { Profile, Reward, Redemption } from '../types';
import {
  Ticket,
  Gift,
  ShoppingBag,
  Book,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  X,
  ChevronRight,
  Coins,
  Edit2,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressImage } from '../src/utils/imageUtils';
import ConfirmModal from '../components/ConfirmModal';

interface RewardsViewProps {
  profile: Profile | null;
}

const RewardsView: React.FC<RewardsViewProps> = ({ profile }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newReward, setNewReward] = useState<Partial<Reward>>({
    title: '',
    description: '',
    points_required: 100,
    type: 'discount',
    is_active: true,
    stock: 10
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'available' | 'my_redemptions'>('available');
  const [error, setError] = useState<string | null>(null);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  const isAdmin = profile?.role === 'admin' ||
    profile?.username === 'nobel_oficial' ||
    profile?.username === 'nobelpetro';

  const [rewardToDelete, setRewardToDelete] = useState<string | null>(null);
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
    fetchRewards();
    if (profile) {
      fetchRedemptions();
    }

    // Configurar Realtime para Rewards
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:rewards')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'rewards' 
        }, payload => {
          console.log('Mudança em tempo real detectada:', payload);
          if (payload.eventType === 'INSERT') {
            setRewards(prev => [...prev, payload.new as Reward].sort((a,b) => a.points_required - b.points_required));
          } else if (payload.eventType === 'UPDATE') {
            setRewards(prev => prev.map(r => r.id === payload.new.id ? payload.new as Reward : r));
          } else if (payload.eventType === 'DELETE') {
            setRewards(prev => prev.filter(r => r.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const fetchRewards = async () => {
    try {
      if (!isSupabaseConfigured) {
        const savedRewards = localStorage.getItem('nobel_conecta_demo_rewards');
        if (savedRewards) {
          setRewards(JSON.parse(savedRewards));
        } else {
          const demoRewards: Reward[] = [
            {
              id: '1',
              title: 'Cupom de 10% de Desconto',
              description: 'Válido para qualquer livro na loja física Nobel Petrópolis.',
              points_required: 150,
              type: 'discount',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: '2',
              title: 'Marcador de Página Exclusivo',
              description: 'Um marcador de metal com design literário exclusivo.',
              points_required: 300,
              type: 'gift',
              image_url: 'https://picsum.photos/seed/bookmark/400/300',
              stock: 5,
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: '3',
              title: 'Ecobag Nobel Conecta',
              description: 'Sacola ecológica de algodão cru com estampa literária.',
              points_required: 800,
              type: 'gift',
              image_url: 'https://picsum.photos/seed/ecobag/400/300',
              stock: 2,
              is_active: true,
              created_at: new Date().toISOString()
            }
          ];
          setRewards(demoRewards);
          localStorage.setItem('nobel_conecta_demo_rewards', JSON.stringify(demoRewards));
        }
        return;
      }

      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .order('points_required', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('column "is_active" does not exist')) {
          setError('A tabela de recompensas precisa ser atualizada. Por favor, execute o script SQL no Supabase.');
        } else {
          throw error;
        }
      } else {
        setRewards(data || []);
        setError(null);
      }
    } catch (err: any) {
      console.error('Erro ao buscar recompensas:', err);
      setError(`Erro ao carregar recompensas: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      if (!isSupabaseConfigured) {
        const savedRedemptions = localStorage.getItem('nobel_demo_redemptions');
        if (savedRedemptions) {
          setRedemptions(JSON.parse(savedRedemptions));
        }
        return;
      }

      const { data, error } = await supabase
        .from('redemptions')
        .select('*, reward:rewards(*)')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRedemptions(data || []);
    } catch (err) {
      console.error('Erro ao buscar resgates:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressedFile = await compressImage(file, 0.6, 1200);
      const url = await uploadFile('rewards', compressedFile);
      setNewImageUrl(url);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveReward = async () => {
    if (!newReward.title?.trim() || !newReward.description?.trim()) {
      alert('Por favor, preencha o Título e a Descrição do prêmio.');
      return;
    }

    if ((newReward.type === 'gift' || newReward.type === 'book') && (newReward.stock === undefined || newReward.stock < 0)) {
      alert('Para brindes e livros, é necessário informar a quantidade em estoque.');
      return;
    }

    try {
      setLoading(true);
      const rewardData: any = {
        title: newReward.title,
        description: newReward.description,
        points_required: newReward.points_required,
        type: newReward.type,
        image_url: newImageUrl || newReward.image_url,
        stock: (newReward.type === 'gift' || newReward.type === 'book') ? (newReward.stock || 0) : null,
        genre: newReward.type === 'book' ? newReward.genre : null,
        is_active: newReward.is_active !== undefined ? newReward.is_active : true
      };

      if (!isSupabaseConfigured) {
        if (editingReward) {
          const updatedRewards = rewards.map(r => r.id === editingReward.id ? { ...r, ...rewardData } : r);
          setRewards(updatedRewards);
          localStorage.setItem('nobel_conecta_demo_rewards', JSON.stringify(updatedRewards));
          alert('Recompensa editada com sucesso (Modo Demo)!');
        } else {
          const newRewardObj = {
            ...rewardData,
            id: `demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            created_at: new Date().toISOString()
          } as Reward;
          setRewards(prev => {
            const updated = [...prev, newRewardObj].sort((a,b) => a.points_required - b.points_required);
            localStorage.setItem('nobel_conecta_demo_rewards', JSON.stringify(updated));
            return updated;
          });
          alert('Recompensa criada com sucesso (Modo Demo)!');
        }
      } else {
        if (editingReward) {
          console.log('--- DIAGNÓSTICO DE EDIÇÃO ---');
          console.log('ID:', editingReward.id);
          console.log('Payload:', rewardData);
          
          const { error, status } = await supabase
            .from('rewards')
            .update(rewardData)
            .eq('id', editingReward.id);

          if (error) {
            console.error('Erro detalhado do Supabase:', error);
            alert(`ERRO NO BANCO (${error.code}): ${error.message}\nDetalhe: ${error.details || 'Sem detalhes'}\nDica: ${error.hint || 'Sem dica'}`);
            throw error;
          }
          
          console.log('Status da resposta Supabase:', status);
          alert('Recompensa editada com sucesso!');
        } else {
          const { error } = await supabase
            .from('rewards')
            .insert([{ ...rewardData, created_at: new Date().toISOString() }]);

          if (error) throw error;
          alert('Recompensa criada com sucesso!');
        }
        
        // Recarregar tudo para garantir integridade
        await fetchRewards();
      }

      setShowCreateModal(false);
      setEditingReward(null);
      setNewReward({
        title: '',
        description: '',
        points_required: 100,
        type: 'discount',
        is_active: true,
        stock: 10
      });
      setNewImageUrl('');
    } catch (err: any) {
      console.error('Erro ao salvar recompensa:', err);
      alert(`Erro ao salvar recompensa: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (reward: Reward) => {
    setEditingReward(reward);
    setNewReward({
      title: reward.title,
      description: reward.description || '',
      points_required: reward.points_required,
      type: reward.type as any,
      is_active: reward.is_active,
      stock: reward.stock || 0,
      image_url: reward.image_url || '',
      genre: reward.genre || ''
    });
    setNewImageUrl(reward.image_url || '');
    setShowCreateModal(true);
  };

  const handleDeleteReward = async (id: string) => {
    console.log('--- INÍCIO PROCESSO DE EXCLUSÃO ---');
    console.log('ID alvo:', id);
    console.log('Estado atual de rewards (count):', rewards.length);

    console.log('Procedendo com a exclusão otimista...');

    // Guardar estado anterior para rollback em caso de erro
    const previousRewards = [...rewards];

    // Atualização otimista: remove da tela imediatamente
    setRewards(prev => {
      const filtered = prev.filter(r => String(r.id) !== String(id));
      console.log('Rewards após filtro otimista (count):', filtered.length);
      return filtered;
    });

    setRewardToDelete(null);

    try {
      if (!isSupabaseConfigured) {
        console.log('Modo Demo: salvando no localStorage');
        const updatedRewards = previousRewards.filter(r => String(r.id) !== String(id));
        localStorage.setItem('nobel_conecta_demo_rewards', JSON.stringify(updatedRewards));
        console.log('Removido do localStorage com sucesso');
      } else {
        console.log('Modo Supabase: enviando DELETE para o servidor');
        // Tenta excluir permanentemente
        const { error } = await supabase.from('rewards').delete().eq('id', id);

        if (error) {
          console.error('Erro retornado pelo Supabase:', error);

          // Erro 23503 é violação de chave estrangeira (já foi resgatado)
          if (error.code === '23503' || error.message?.includes('foreign key')) {
            console.log('Detectada restrição de chave estrangeira. Oferecendo desativação...');
            setConfirmModal({
              isOpen: true,
              title: "Desativar Recompensa?",
              message: "Esta recompensa já possui resgates vinculados e não pode ser apagada do histórico. Deseja apenas desativá-la para que não apareça mais na lista?",
              onConfirm: async () => {
                console.log('Usuário aceitou desativação. Enviando UPDATE...');
                const { error: updateError } = await supabase
                  .from('rewards')
                  .update({ is_active: false })
                  .eq('id', id);

                if (updateError) {
                  console.error('Erro ao desativar:', updateError);
                  alert(`Erro ao desativar: ${updateError.message}`);
                } else {
                  console.log('Recompensa desativada com sucesso (soft delete)');
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
              }
            });
          } else {
            throw error;
          }
        } else {
          console.log('Exclusão confirmada pelo Supabase');
        }
      }
    } catch (err: any) {
      console.error('ERRO CRÍTICO NA EXCLUSÃO:', err);
      // Reverte a interface em caso de erro real
      setRewards(previousRewards);
      alert(`Não foi possível excluir: ${err.message || 'Erro de conexão ou permissão'}`);
    }
    console.log('--- FIM PROCESSO DE EXCLUSÃO ---');
  };

  const handleRedeem = async (reward: Reward) => {
    if (!profile) return;

    if ((profile.points || 0) < reward.points_required) {
      alert('Você não tem pontos suficientes.');
      return;
    }

    if ((reward.type === 'gift' || reward.type === 'book') && reward.stock !== undefined && reward.stock <= 0) {
      alert('Este item está esgotado.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Confirmar Resgate?",
      message: `Deseja resgatar "${reward.title}" por ${reward.points_required} pontos?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const redemptionCode = reward.type === 'discount'
            ? `NOBEL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            : null;

          const redemptionData: Partial<Redemption> = {
            user_id: profile.id,
            reward_id: reward.id,
            status: 'pending',
            redemption_code: redemptionCode || undefined,
            created_at: new Date().toISOString()
          };

          const newPoints = (profile.points || 0) - reward.points_required;

          if (!isSupabaseConfigured) {
            // Mock points update
            const updatedProfile = { ...profile, points: newPoints };
            localStorage.setItem('nobel_demo_session', JSON.stringify(updatedProfile));

            const newRedemption = { ...redemptionData, id: Math.random().toString(), reward } as Redemption;
            const updatedRedemptions = [newRedemption, ...redemptions];
            setRedemptions(updatedRedemptions);
            localStorage.setItem('nobel_demo_redemptions', JSON.stringify(updatedRedemptions));

            // Update local rewards stock
            if ((reward.type === 'gift' || reward.type === 'book') && reward.stock !== undefined) {
              setRewards(rewards.map(r => r.id === reward.id ? { ...r, stock: r.stock! - 1 } : r));
            }

            alert('Resgate realizado com sucesso! Verifique em "Meus Resgates".');
            window.location.reload(); // To refresh profile points in navbar
          } else {
            // Usar RPC para resgate atômico (evita erros de estoque/pontos)
            const { error: rpcError } = await supabase.rpc('redeem_reward', {
              p_reward_id: reward.id,
              p_user_id: profile.id,
              p_points_req: reward.points_required,
              p_redemption_code: redemptionCode
            });

            if (rpcError) throw rpcError;

            // Integração WhatsApp se for item físico (brinde ou livro)
            if (reward.type === 'gift' || reward.type === 'book') {
              const whatsappNumber = '552422358014'; // Nobel Petrópolis
              const message = encodeURIComponent(
                `Olá! Gostaria de reservar meu prêmio "${reward.title}" que acabei de resgatar no Nobel Conecta.\n\n` +
                `👤 Usuário: @${profile.username}\n` +
                `📱 Email: ${profile.email || 'N/A'}\n` +
                `📖 Item: ${reward.title}\n\n` +
                `Estou enviando esta mensagem para garantir minha reserva na loja.`
              );

              const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

              alert('Resgate realizado! Redirecionando para o WhatsApp da loja para sua reserva...');
              window.open(whatsappUrl, '_blank');
            } else {
              alert('Resgate realizado com sucesso! Seu código de desconto está disponível em "Meus Resgates".');
            }

            fetchRedemptions();
            fetchRewards();
            // Disparar evento customizado para o App.tsx atualizar o perfil (evita reload total)
            const event = new CustomEvent('nobel_profile_updated', {
              detail: { points: newPoints }
            });
            window.dispatchEvent(event);
          }
        } catch (err: any) {
          console.error('Erro ao realizar resgate:', err);
          alert(`Erro ao realizar resgate: ${err.message || 'Erro desconhecido'}`);
        }
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-12 pb-24">
      {/* Header com Pontos */}
      <div className="bg-black rounded-[2.5rem] p-8 mb-8 text-white relative overflow-hidden shadow-2xl">
        {isAdmin && (
          <div className="absolute top-6 right-6 z-20">
            <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
              <Shield size={10} /> Admin Mode
            </span>
          </div>
        )}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-400 p-2 rounded-xl">
              <Coins className="text-black" size={20} />
            </div>
            <p className="text-yellow-400 font-black uppercase tracking-[0.2em] text-[9px]">Seu Saldo Nobel</p>
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-2 font-serif italic">
            {profile?.points || 0} <span className="text-xl text-gray-400 font-sans not-italic">pts</span>
          </h1>
          <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
            Continue participando da comunidade para ganhar mais pontos e trocar por prêmios exclusivos!
          </p>
        </div>

        {/* Background Decoration */}
        <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
          <Ticket size={240} strokeWidth={1} />
        </div>
      </div>

      {/* Tabela de Pontuação */}
      <div className="bg-white rounded-[2rem] p-6 mb-8 border border-gray-100 shadow-sm">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-gray-400">
          <Coins size={14} className="text-yellow-500" /> Como ganhar pontos?
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Resenha</p>
            <p className="text-sm font-black text-black">+10 pts</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Mural</p>
            <p className="text-sm font-black text-black">+10 pts</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Clube</p>
            <p className="text-sm font-black text-black">+10 pts</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Comentar</p>
            <p className="text-sm font-black text-black">+2 pts</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Curtir</p>
            <p className="text-sm font-black text-black">+1 pt</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Sorteio</p>
            <p className="text-sm font-black text-black">+5 pts</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-4">
          <AlertCircle className="text-red-500 shrink-0 mt-1" size={20} />
          <div>
            <h3 className="text-red-900 font-black uppercase tracking-widest text-[10px] mb-1">Atenção</h3>
            <p className="text-red-700 text-sm leading-relaxed mb-3">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchRewards();
                if (profile) fetchRedemptions();
              }}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-red-200 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-gray-100 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'available' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          Prêmios Disponíveis
        </button>
        <button
          onClick={() => setActiveTab('my_redemptions')}
          className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'my_redemptions' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          Meus Resgates
        </button>
      </div>

      {activeTab === 'available' ? (
        <>
          {isAdmin && (
            <button
              onClick={() => {
                setEditingReward(null);
                setNewReward({ title: '', description: '', points_required: 100, type: 'discount', is_active: true, stock: 10 });
                setNewImageUrl('');
                setShowCreateModal(true);
              }}
              className="w-full mb-8 py-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-3 text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition-all group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-black uppercase tracking-widest text-[11px]">Adicionar Novo Prêmio</span>
            </button>
          )}

          <div className="space-y-6">
            {rewards
              .filter(r => r.is_active !== false)
              .map((reward) => (
                <motion.div
                  key={reward.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-row items-center p-4 gap-6"
                >
                  {reward.image_url ? (
                    <div className="w-24 h-32 sm:w-32 sm:h-40 shrink-0 overflow-hidden rounded-2xl relative bg-gray-900">
                      <img
                        src={reward.image_url}
                        alt={reward.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className={`w-24 h-32 sm:w-32 sm:h-40 shrink-0 flex flex-col items-center justify-center rounded-2xl relative overflow-hidden ${reward.type === 'discount' ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'
                      }`}>
                      <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="grid grid-cols-4 gap-2 p-2">
                          {[...Array(12)].map((_, i) => (
                            <div key={i} className="w-full aspect-square border border-current rounded-full" />
                          ))}
                        </div>
                      </div>
                      {reward.type === 'discount' ? (
                        <>
                          <Ticket size={32} strokeWidth={2.5} />
                          <span className="text-[9px] font-black uppercase tracking-widest mt-2 text-center px-1">10% DESCONTO</span>
                        </>
                      ) : reward.type === 'book' ? (
                        <>
                          <Book size={32} strokeWidth={2.5} />
                          <span className="text-[10px] font-black uppercase tracking-widest mt-2">LIVRO</span>
                        </>
                      ) : (
                        <>
                          <Gift size={32} strokeWidth={2.5} />
                          <span className="text-[10px] font-black uppercase tracking-widest mt-2">BRINDE</span>
                        </>
                      )}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-white rounded-full" />
                      <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-white rounded-full" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col py-2 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {reward.type === 'discount' ? (
                          <Ticket size={12} className="text-yellow-500" />
                        ) : reward.type === 'book' ? (
                          <Book size={12} className="text-yellow-500" />
                        ) : (
                          <ShoppingBag size={12} className="text-yellow-500" />
                        )}
                        <span className="text-[8px] font-black uppercase tracking-widest text-yellow-600">
                          {reward.type === 'discount' ? 'Cupom' : reward.type === 'book' ? 'Livro' : 'Brinde'}
                        </span>
                        {reward.type === 'book' && reward.genre && (
                          <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ml-1">
                            {reward.genre}
                          </span>
                        )}
                      </div>
                      <div className="bg-black text-yellow-400 px-2 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest">
                        {reward.points_required} pts
                      </div>
                    </div>

                    <h3 className="text-lg font-black tracking-tight text-gray-900 mb-1 font-serif italic">{reward.title}</h3>
                    <p className="text-gray-500 text-xs mb-4 italic leading-relaxed">"{reward.description}"</p>

                    {(reward.type === 'gift' || reward.type === 'book') && reward.stock !== undefined && (
                      <div className="mb-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${reward.stock > 0 ? 'bg-yellow-400' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((reward.stock / 10) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${reward.stock > 0 ? 'text-gray-400' : 'text-red-600'}`}>
                          {reward.stock > 0 ? `${reward.stock} un` : 'Esgotado'}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleRedeem(reward)}
                        disabled={(profile?.points || 0) < reward.points_required || ((reward.type === 'gift' || reward.type === 'book') && reward.stock === 0)}
                        className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all ${(profile?.points || 0) >= reward.points_required && ((reward.type !== 'gift' && reward.type !== 'book') || (reward.stock || 0) > 0)
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500 shadow-md'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          }`}
                      >
                        {(profile?.points || 0) >= reward.points_required ? 'Resgatar' : 'Faltam Pontos'}
                      </button>

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditClick(reward);
                            }}
                            className="p-4 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-100 transition-all cursor-pointer flex items-center justify-center"
                            title="Editar recompensa"
                          >
                            <Edit2 size={20} />
                          </button>

                          <div className="relative">
                            <AnimatePresence mode="wait">
                              {rewardToDelete === reward.id ? (
                                <motion.div
                                  key="confirm"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="flex items-center gap-2 bg-red-50 p-2 rounded-2xl border border-red-100"
                                >
                                  <button
                                    onClick={() => handleDeleteReward(reward.id)}
                                    className="px-3 py-2 bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-[8px] hover:bg-red-600 transition-colors"
                                  >
                                    Sim, Excluir
                                  </button>
                                  <button
                                    onClick={() => setRewardToDelete(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600"
                                  >
                                    <X size={16} />
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.button
                                  key="delete"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Botão de lixeira clicado para ID:', reward.id);
                                    setRewardToDelete(reward.id);
                                  }}
                                  className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all cursor-pointer relative z-20 flex items-center justify-center"
                                  title="Excluir recompensa"
                                >
                                  <Trash2 size={20} />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {redemptions.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Clock size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Você ainda não realizou nenhum resgate</p>
            </div>
          ) : (
            redemptions.map((redemption) => (
              <div
                key={redemption.id}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${redemption.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-yellow-50 text-yellow-500'
                  }`}>
                  {redemption.status === 'completed' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 truncate">{redemption.reward?.title || 'Prêmio'}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {format(new Date(redemption.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {redemption.redemption_code && (
                  <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                    <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Código</p>
                    <p className="font-mono font-black text-gray-900 text-sm">{redemption.redemption_code}</p>
                  </div>
                )}

                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${redemption.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  {redemption.status === 'completed' ? 'Concluído' : 'Pendente'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Criação */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-black tracking-tighter font-serif italic">{editingReward ? 'Editar Prêmio' : 'Novo Prêmio'}</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                  {/* Upload de Imagem */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Foto do Brinde (Opcional)</label>
                    <div className="relative aspect-[4/5] w-32 mx-auto rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden group">
                      {newImageUrl ? (
                        <>
                          <img src={newImageUrl} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setNewImageUrl('')}
                            className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all">
                          {uploading ? (
                            <Loader2 size={24} className="text-yellow-500 animate-spin" />
                          ) : (
                            <>
                              <ImageIcon size={24} className="text-gray-300 mb-1" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Clique para enviar</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Título</label>
                      <input
                        type="text"
                        value={newReward.title}
                        onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm"
                        placeholder="Ex: Cupom de 10%"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Pontos Necessários</label>
                      <input
                        type="number"
                        value={newReward.points_required}
                        onChange={(e) => setNewReward({ ...newReward, points_required: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Tipo</label>
                      <select
                        value={newReward.type}
                        onChange={(e) => setNewReward({ ...newReward, type: e.target.value as 'discount' | 'gift' | 'book' })}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm"
                      >
                        <option value="discount">Cupom</option>
                        <option value="gift">Brinde</option>
                        <option value="book">Livro</option>
                      </select>
                    </div>

                    {newReward.type === 'book' && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Gênero Literário</label>
                        <input
                          type="text"
                          value={newReward.genre || ''}
                          onChange={(e) => setNewReward({ ...newReward, genre: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm"
                          placeholder="Ex: Fantasia, Romance, Suspense..."
                        />
                      </div>
                    )}

                    {(newReward.type === 'gift' || newReward.type === 'book') && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Quantidade em Estoque</label>
                        <input
                          type="number"
                          min="0"
                          value={newReward.stock}
                          onChange={(e) => setNewReward({ ...newReward, stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm"
                          placeholder="Ex: 10"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Regras / Descrição</label>
                    <textarea
                      value={newReward.description}
                      onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 text-sm"
                      placeholder="Ex: Válido para livros de ficção..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-4 border-t border-gray-50">
                  <button
                    onClick={handleSaveReward}
                    className="flex-1 bg-black text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-[1.02] transition-all"
                  >
                    {editingReward ? 'Salvar Edição' : 'Criar Prêmio'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

export default RewardsView;
