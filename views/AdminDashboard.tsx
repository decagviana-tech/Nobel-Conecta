
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Profile, Post, Book } from '../types';
import {
  Users,
  Settings,
  Shield,
  UserPlus,
  Trash2,
  Search,
  BookOpen,
  Ticket,
  BarChart3,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Search as SearchIcon,
  Crown,
  Plus,
  User as UserIcon
} from 'lucide-react';
import { useAdmin } from '../src/hooks/useAdmin';
import ConfirmModal from '../components/ConfirmModal';

interface AdminDashboardProps {
  profile: Profile | null;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ profile }) => {
  const isAdmin = useAdmin(profile);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'shop' | 'moderation' | 'redemptions' | 'giveaways'>('stats');
  const [users, setUsers] = useState<Profile[]>([]);
  const [shops, setShops] = useState<any[]>([]); // To manage shop books directly
  const [posts, setPosts] = useState<Post[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingRedemptions: 0,
    activeGiveaways: 0,
    vipUsers: 0,
    totalInteractions: 0
  });
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
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const results = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('shop_books').select('*').order('title', { ascending: true }),
        supabase.from('posts').select('*, author:profiles(*)').order('created_at', { ascending: false }),
        supabase.from('redemptions').select('*, user:profiles!user_id(*), reward:rewards!reward_id(*)').order('created_at', { ascending: false }),
        supabase.from('giveaways').select('*, participants:giveaway_participants(profiles(username))').order('created_at', { ascending: false }),
        supabase.from('redemptions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('giveaways').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('likes').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('points', 500)
      ]);

      const [resUsr, resShp, resPst, resRedem, resGivList, resPend, resGivCount, resInt, resVip] = results;

      const userData = resUsr.data || [];
      const shopData = resShp.data || [];
      const postData = resPst.data || [];
      const redemptionData = resRedem.data || [];
      const giveawayListData = resGivList.data || [];
      const pendingCount = resPend.count || 0;
      const giveawayCount = resGivCount.count || 0;
      const interactionsCount = resInt.count || 0;
      const vipCount = resVip.count || 0;

      setUsers(userData);
      setShops(shopData);
      setPosts(postData);
      setRedemptions(redemptionData);
      setGiveaways(giveawayListData);
      setStats({
        totalUsers: userData.length,
        pendingRedemptions: pendingCount,
        activeGiveaways: giveawayCount,
        vipUsers: vipCount,
        totalInteractions: interactionsCount
      });
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Apagar Publicação?",
      message: "Tem certeza que deseja remover esta publicação permanentemente?",
      onConfirm: async () => {
        try {
          await supabase.from('posts').delete().eq('id', postId);
          fetchData();
        } catch (err) {
          alert('Erro ao excluir publicação.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Banir Usuário?",
      message: "Tem certeza que deseja apagar este usuário permanentemente? Esta ação removerá todo o histórico de interações.",
      onConfirm: async () => {
        try {
          await supabase.from('profiles').delete().eq('id', userId);
          fetchData();
        } catch (err) {
          alert('Erro ao excluir usuário.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleAdmin = async (targetUser: Profile) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';

    setConfirmModal({
      isOpen: true,
      title: "Alterar Privilégios?",
      message: `Deseja realmente ${newRole === 'admin' ? 'promover' : 'remover'} as permissões de administrador deste usuário?`,
      onConfirm: async () => {
        try {
          await supabase.from('profiles').update({ role: newRole }).eq('id', targetUser.id);
          fetchData();
        } catch (err) {
          alert('Erro ao alterar privilégios.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleApproveRedemption = async (redemptionId: string, userId: string, rewardTitle: string) => {
    try {
      const { error } = await supabase
        .from('redemptions')
        .update({ status: 'completed' })
        .eq('id', redemptionId);

      if (error) throw error;

      // Notificar usuário
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'system',
        title: '🎁 Resgate Aprovado!',
        content: `Seu resgate do prêmio "${rewardTitle}" foi confirmado na loja. Parabéns!`,
        link: '/rewards'
      });

      fetchData();
      alert('Resgate aprovado com sucesso!');
    } catch (err) {
      alert('Erro ao aprovar resgate.');
    }
  };

  const handleCancelRedemption = async (redemption: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancelar Resgate?",
      message: "Isso cancelará o pedido. Atenção: no momento o estorno de pontos deve ser feito manualmente se necessário.",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('redemptions')
            .update({ status: 'cancelled' })
            .eq('id', redemption.id);

          if (error) throw error;

          fetchData();
        } catch (err) {
          alert('Erro ao cancelar resgate.');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRunRaffle = async (giveawayId: string) => {
    try {
      const { data: participants, error: pError } = await supabase
        .from('giveaway_participants')
        .select('user_id')
        .eq('giveaway_id', giveawayId);

      if (pError) throw pError;
      if (!participants || participants.length === 0) {
        alert('Não há participantes para este sorteio.');
        return;
      }

      const winnerIndex = Math.floor(Math.random() * participants.length);
      const winnerId = participants[winnerIndex].user_id;

      const { error: uError } = await supabase
        .from('giveaways')
        .update({
          winner_id: winnerId,
          is_active: false
        })
        .eq('id', giveawayId);

      if (uError) throw uError;

      fetchData();
      alert('Sorteio realizado com sucesso! O vencedor foi selecionado.');
    } catch (err) {
      alert('Erro ao realizar sorteio.');
    }
  };

  if (loading && isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-serif italic">Acessando arquivos confidenciais...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] border border-red-50 shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Shield size={40} />
        </div>
        <h2 className="text-3xl font-black font-serif italic mb-4 tracking-tighter">Acesso Negado</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8 italic">
          Desculpe, Curador. Esta área é restrita apenas à administração central da Nobel Petrópolis.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-black text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
        >
          Voltar para a Segurança
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:pt-12 pb-24">
      {/* Admin Header */}
      <div className="bg-black rounded-[3rem] p-12 mb-10 text-white relative overflow-hidden shadow-2xl border-4 border-yellow-400/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-yellow-400 p-2.5 rounded-2xl">
                <Shield className="text-black" size={24} />
              </div>
              <h1 className="text-4xl md:text-5xl font-black font-serif italic tracking-tighter">Centro de Controle</h1>
            </div>
            <p className="text-gray-400 text-sm max-w-sm leading-relaxed italic">
              Bem-vindo, Administrador. Aqui você gerencia a ecossistema Nobel Conecta: usuários, recompensas e métricas vitais.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Total Usuários</p>
              <p className="text-3xl font-black tracking-tighter font-serif italic">{users.length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Livros no Shop</p>
              <p className="text-3xl font-black tracking-tighter font-serif italic">{shops.length}</p>
            </div>
          </div>
        </div>

        {/* Background Decoration */}
        <Settings className="absolute -right-10 -bottom-10 text-white/5 rotate-12" size={300} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 md:gap-2 mb-10 bg-gray-100 p-1 md:p-2 rounded-[2rem] max-w-2xl mx-auto md:mx-0 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'stats' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <BarChart3 size={14} className="md:w-4 md:h-4" /> Dashboard
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <Users size={14} className="md:w-4 md:h-4" /> Usuários
        </button>
        <button
          onClick={() => setActiveTab('moderation')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'moderation' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <Shield size={14} className="md:w-4 md:h-4" /> Moderação
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'shop' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <BookOpen size={14} className="md:w-4 md:h-4" /> Loja
        </button>
        <button
          onClick={() => setActiveTab('redemptions')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'redemptions' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <Ticket size={14} className="md:w-4 md:h-4" /> Resgates
          {stats.pendingRedemptions > 0 && (
            <span className="bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center animate-pulse">
              {stats.pendingRedemptions}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('giveaways')}
          className={`px-3 py-3 md:flex-1 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'giveaways' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <Ticket size={14} className="md:w-4 md:h-4" /> Sorteios
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'users' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black font-serif italic tracking-tight">Comunidade Nobel</h3>
              <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-50 border-none rounded-2xl pl-12 pr-6 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-yellow-400 transition-all w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Perfil</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Email</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Pontos</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Cargo</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users
                    .filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(u => (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <img
                              src={(u.avatar_url && !u.avatar_url.includes('dicebear')) ? u.avatar_url : `https://ui-avatars.com/api/?name=${u.username?.replace(/^@/, '')}&background=EAB308&color=000&bold=true`}
                              className="w-10 h-10 rounded-xl border-2 border-gray-100"
                              alt=""
                            />
                            <div>
                              <p className="font-black text-gray-900">@{u.username?.replace(/^@/, '')}</p>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Registrado em {new Date(u.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-gray-500">{u.email}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                            <span className="font-black text-gray-900">{u.points || 0}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-black text-yellow-400' : 'bg-gray-100 text-gray-400'
                            }`}>
                            {u.role === 'admin' ? 'Administrador' : 'Leitor'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleToggleAdmin(u)}
                              className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm"
                              title={u.role === 'admin' ? 'Remover Admin' : 'Dar Admin'}
                            >
                              <Shield size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                              title="Excluir Usuário"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
                <BarChart3 size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Interações Totais</p>
              <h4 className="text-3xl font-black font-serif italic mb-2 tracking-tighter">{stats.totalInteractions}</h4>
              <p className="text-[10px] text-green-500 font-bold">Curtidas no total</p>
            </div>

            <div
              onClick={() => setActiveTab('redemptions')}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm cursor-pointer hover:border-yellow-400 transition-all group"
            >
              <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Ticket size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Resgates Pendentes</p>
              <h4 className="text-3xl font-black font-serif italic mb-2 tracking-tighter">{stats.pendingRedemptions}</h4>
              <p className="text-[10px] text-gray-400 font-bold">Aguardando aprovação</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-6">
                <Crown size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Melhores Leitores</p>
              <h4 className="text-3xl font-black font-serif italic mb-2 tracking-tighter">{stats.vipUsers}</h4>
              <p className="text-[10px] text-yellow-600 font-bold">+500 pontos</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-6">
                <Calendar size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Sorteios Ativos</p>
              <h4 className="text-3xl font-black font-serif italic mb-2 tracking-tighter">{stats.activeGiveaways}</h4>
              <p className="text-[10px] text-gray-400 font-bold">Em andamento</p>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black font-serif italic tracking-tight">Moderação de Conteúdo</h3>
              <div className="flex items-center gap-2">
                <Shield className="text-yellow-500" size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{posts.length} publicações</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Autor</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Título / Livro</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {posts
                    .filter(p =>
                      p.book_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.author?.username?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                              {p.author?.avatar_url ? (
                                <img src={p.author.avatar_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <UserIcon size={14} className="text-gray-300" />
                              )}
                            </div>
                            <span className="font-black text-gray-900 text-sm">@{p.author?.username}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-bold text-gray-900 text-sm truncate max-w-xs">{p.book_title || p.title || 'Sem título'}</p>
                          <p className="text-[9px] text-gray-400 font-medium truncate max-w-xs">{p.content.substring(0, 60)}...</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${p.type === 'review' ? 'bg-blue-50 text-blue-500' :
                            p.type === 'creative' ? 'bg-purple-50 text-purple-500' : 'bg-gray-100 text-gray-400'
                            }`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-xs text-gray-400">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDeletePost(p.id)}
                              className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                              title="Remover Publicação"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'redemptions' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black font-serif italic tracking-tight">Resgates de Recompensas</h3>
              <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar resgate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-50 border-none rounded-2xl pl-12 pr-6 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-yellow-400 transition-all w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Usuário</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Recompensa</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Código</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {redemptions
                    .filter(r => {
                      if (!searchQuery) return true;
                      const search = searchQuery.toLowerCase();
                      const u = Array.isArray(r.user) ? r.user[0] : r.user;
                      const rw = Array.isArray(r.reward) ? r.reward[0] : r.reward;

                      const userMatch = u?.username?.toLowerCase().includes(search);
                      const rewardMatch = rw?.title?.toLowerCase().includes(search);
                      const codeMatch = r.redemption_code?.toLowerCase().includes(search);
                      return userMatch || rewardMatch || codeMatch;
                    })
                    .map(r => {
                      const u = Array.isArray(r.user) ? r.user[0] : r.user;
                      const rw = Array.isArray(r.reward) ? r.reward[0] : r.reward;

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                                {u?.avatar_url ? (
                                  <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <UserIcon size={14} className="text-gray-300" />
                                )}
                              </div>
                              <span className="font-black text-gray-900 text-sm">@{u?.username?.replace(/^@/, '') || 'usuário'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <p className="font-bold text-gray-900 text-sm">{rw?.title || 'Prêmio'}</p>
                            <p className="text-[9px] text-yellow-600 font-black uppercase">{rw?.points_required || 0} Pontos</p>
                          </td>
                          <td className="px-8 py-5">
                            <code className="bg-gray-100 px-2 py-1 rounded text-[10px] font-mono font-bold text-gray-600">
                              {r.redemption_code || '---'}
                            </code>
                          </td>
                          <td className="px-8 py-5 text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${r.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                              r.status === 'completed' ? 'bg-green-50 text-green-600 border border-green-100' :
                                'bg-red-50 text-red-600 border border-red-100'
                              }`}>
                              {r.status === 'pending' ? 'Pendente' :
                                r.status === 'completed' ? 'Entregue' : 'Cancelado'}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            {r.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleApproveRedemption(r.id, r.user_id, rw?.title || 'Prêmio')}
                                  className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-sm"
                                  title="Aprovar e Dar Baixa"
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleCancelRedemption(r)}
                                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                  title="Cancelar Resgate"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black font-serif italic tracking-tight">Estoque da Loja Nobel</h3>
              <button className="bg-black text-yellow-400 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 transition-all">
                <Plus size={16} /> Novo Livro no Shop
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.map(book => (
                <div key={book.id} className="bg-gray-50 rounded-3xl p-6 flex items-start gap-4 border border-transparent hover:border-yellow-200 transition-all group">
                  <div className="w-20 h-28 bg-gray-200 rounded-xl overflow-hidden shadow-md shrink-0">
                    <img src={book.image_url} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-gray-900 leading-tight mb-1">{book.title}</h4>
                    <p className="text-[10px] text-gray-400 font-bold italic mb-4">{book.author}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">R$ {book.price}</span>
                      <div className="flex items-center gap-1">
                        <button className="p-2 text-gray-300 hover:text-gray-900"><Settings size={14} /></button>
                        <button className="p-2 text-red-100 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'giveaways' && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black font-serif italic tracking-tight">Gestão de Sorteios</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {giveaways.map(g => (
                <div key={g.id} className="bg-gray-50 rounded-3xl p-6 border border-transparent hover:border-yellow-200 transition-all">
                  <div className="flex gap-4 mb-4">
                    <img src={g.book_image_url} className="w-16 h-24 object-cover rounded-xl shadow-sm" alt="" />
                    <div className="flex-1">
                      <h4 className="font-black text-gray-900 leading-tight">{g.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase">Termina em: {new Date(g.end_date).toLocaleDateString()}</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${g.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {g.is_active ? 'Ativo' : 'Encerrado'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-6">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Participantes ({g.participants?.length || 0})</p>
                    <div className="flex flex-wrap gap-1">
                      {g.participants?.map((p: any, idx: number) => {
                        const username = p.profiles?.username || 'usuário';
                        return (
                          <span key={idx} className="text-[9px] font-bold bg-gray-50 px-2 py-0.5 rounded-full text-gray-600">
                            @{username.replace(/^@/, '')}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {g.is_active ? (
                    <button
                      onClick={() => handleRunRaffle(g.id)}
                      className="w-full bg-black text-yellow-400 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                      <Ticket size={16} /> Realizar Sorteio Agora
                    </button>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex items-center gap-3">
                      <Crown className="text-yellow-600" size={20} />
                      <div>
                        <p className="text-[8px] font-black uppercase text-yellow-600">Vencedor:</p>
                        <p className="font-black text-gray-900">
                          {g.winner_id ? (users.find(u => u.id === g.winner_id)?.username || 'Vencedor Sorteado') : '---'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {giveaways.length === 0 && (
                <div className="col-span-2 py-20 text-center">
                  <Ticket className="mx-auto text-gray-200 mb-4" size={48} />
                  <p className="text-gray-400 italic">Nenhum sorteio cadastrado no momento.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div >
  );
};

export default AdminDashboard;
