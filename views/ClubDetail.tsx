
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../supabase';
import { BookClub as Club, Post, Profile } from '../types';
import PostCard from '../components/PostCard';
import { Users, Info, ChevronLeft, Calendar, MessageSquare, Shield, BookOpen, Trash2, Plus, PenSquare } from 'lucide-react';
import CreatePostModal from '../components/CreatePostModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmModal from '../components/ConfirmModal';

interface ClubDetailProps {
  profile: Profile | null;
}

const ClubDetail: React.FC<ClubDetailProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'members' | 'info'>('posts');
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
    profile?.username === 'nobelpetro' ||
    club?.admin_id === profile?.id;

  useEffect(() => {
    if (id) {
      fetchClubData();
    }
  }, [id, profile]);

  const fetchClubData = async () => {
    try {
      if (!isSupabaseConfigured) {
        // Mock data for demo
        const demoClubs: Club[] = [
          {
            id: '1',
            name: 'Clássicos de Mistério',
            description: 'Um clube dedicado a desvendar os maiores enigmas da literatura policial. De Agatha Christie a Sherlock Holmes.',
            current_book: 'Dom Casmurro',
            current_book_author: 'Machado de Assis',
            image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=800',
            admin_id: 'system',
            member_ids: ['system'],
            created_at: new Date().toISOString()
          }
        ];
        const currentClub = demoClubs.find(c => c.id === id) || null;
        setClub(currentClub);
        setIsMember(true);
        setLoading(false);
        return;
      }

      // Fetch club details
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', id)
        .single();

      if (clubError) throw clubError;
      setClub(clubData);

      // Fetch members
      const { data: memberData, error: memberError } = await supabase
        .from('club_members')
        .select('profiles(*)')
        .eq('club_id', id);

      if (memberError) throw memberError;
      const memberList = memberData.map((m: any) => m.profiles);
      setMembers(memberList);
      setIsMember(memberList.some(m => m.id === profile?.id));

      // Fetch posts
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles(*),
          likes(count),
          comments(count)
        `)
        .eq('club_id', id)
        .order('created_at', { ascending: false });

      if (postError) throw postError;
      setPosts(postData || []);

    } catch (err) {
      console.error('Error fetching club data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    if (!profile || !id || !isSupabaseConfigured) return;

    try {
      const { error } = await supabase
        .from('club_members')
        .insert({ club_id: id, user_id: profile.id });

      if (error) throw error;
      setIsMember(true);
      fetchClubData();
    } catch (err) {
      console.error('Error joining club:', err);
    }
  };

  const handleLeaveClub = async () => {
    if (!profile || !id || !isSupabaseConfigured) return;

    setConfirmModal({
      isOpen: true,
      title: "Sair do Clube?",
      message: "Tem certeza que deseja sair deste clube de leitura?",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('club_members')
            .delete()
            .eq('club_id', id)
            .eq('user_id', profile.id);

          if (error) throw error;
          setIsMember(false);
          fetchClubData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Error leaving club:', err);
        }
      }
    });
  };

  const handleDeleteClub = async () => {
    if (!id || !isSupabaseConfigured) return;

    setConfirmModal({
      isOpen: true,
      title: "Excluir Clube?",
      message: "ATENÇÃO: Isso excluirá o clube e todas as suas postagens permanentemente. Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('clubs')
            .delete()
            .eq('id', id);

          if (error) throw error;
          navigate('/clubs');
        } catch (err) {
          console.error('Error deleting club:', err);
        }
      }
    });
  };

  if (loading) return <div className="p-10 text-center font-serif italic text-gray-400">Entrando no clube...</div>;
  if (!club) return <div className="p-10 text-center">Clube não encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header Banner */}
      <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-gray-900">
        <img
          src={club.image_url}
          alt={club.name}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        <button
          onClick={() => navigate('/clubs')}
          className="absolute top-6 left-6 p-3 bg-white/10 backdrop-blur-md text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="absolute bottom-10 left-6 right-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-white/80 text-[10px] uppercase font-black tracking-widest bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                  <Users size={12} className="text-yellow-400" />
                  {members.length} membros
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white font-serif tracking-tight leading-none mb-4 italic">
                {club.name}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {isMember ? (
                <button
                  onClick={handleLeaveClub}
                  className="px-6 py-4 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/20 transition-all"
                >
                  Sair do Clube
                </button>
              ) : (
                <button
                  onClick={handleJoinClub}
                  className="px-8 py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all"
                >
                  Entrar no Clube
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={handleDeleteClub}
                  className="p-4 bg-red-500/20 backdrop-blur-md text-red-500 border border-red-500/30 rounded-2xl hover:bg-red-500/30 transition-all"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-0">
        {/* Tabs */}
        <div className="flex gap-1 mt-8 mb-8 bg-gray-100 p-1.5 rounded-2xl max-w-md mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${activeTab === 'posts' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <MessageSquare size={14} /> Discussão
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${activeTab === 'members' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <Users size={14} /> Membros
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${activeTab === 'info' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <Info size={14} /> Sobre
          </button>
        </div>

        {/* Content */}
        {activeTab === 'posts' && (
          <div className="space-y-6">
            {isMember ? (
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-full p-8 bg-white border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition-all group"
              >
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-yellow-50 transition-colors">
                  <PenSquare size={32} />
                </div>
                <div>
                  <h3 className="text-black font-black uppercase tracking-widest text-xs">O que você está lendo?</h3>
                  <p className="text-[10px] italic">Inicie um novo debate no clube</p>
                </div>
              </button>
            ) : (
              <div className="bg-yellow-50 border border-yellow-100 p-8 rounded-[2.5rem] text-center">
                <Shield size={32} className="mx-auto text-yellow-600 mb-4" />
                <h3 className="font-black text-yellow-900 uppercase tracking-widest text-sm mb-2">Discussão Restrita</h3>
                <p className="text-yellow-700 text-xs italic mb-6">Entre no clube para participar dos debates e compartilhar suas leituras.</p>
                <button
                  onClick={handleJoinClub}
                  className="bg-black text-yellow-400 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]"
                >
                  Entrar no Clube Agora
                </button>
              </div>
            )}

            {posts.length > 0 ? (
              posts.map(post => (
                <PostCard key={post.id} post={post} currentUser={profile} />
              ))
            ) : (
              <div className="text-center py-20 italic text-gray-400">
                <BookOpen size={48} className="mx-auto text-gray-100 mb-4" />
                <p className="text-xs uppercase tracking-widest font-black">Nenhum post ainda. Seja o primeiro a debater!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {members.map(member => (
              <div
                key={member.id}
                onClick={() => navigate(`/profile/${member.username}`)}
                className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
              >
                <img
                  src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`}
                  className="w-12 h-12 rounded-2xl border-2 border-gray-50"
                  alt={member.username}
                />
                <div>
                  <p className="font-black text-gray-900 leading-tight">@{member.username}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {member.role === 'admin' ? 'Curador Nobel' : 'Membro'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100">
            <h3 className="text-2xl font-black font-serif italic mb-6">Manifesto do Clube</h3>
            <p className="text-gray-600 leading-relaxed italic mb-10 text-lg">
              "{club.description}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-50">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <Calendar size={20} className="text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-widest text-[10px] text-gray-400 mb-1">Fundado em</h4>
                  <p className="text-sm font-black">{format(new Date(club.created_at), "MMMM 'de' yyyy", { locale: ptBR })}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <Shield size={20} className="text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-widest text-[10px] text-gray-400 mb-1">Moderação</h4>
                  <p className="text-sm font-black">Sistema Nobel de Curadoria</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        clubId={id}
        onPostCreated={fetchClubData}
      />

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

export default ClubDetail;
