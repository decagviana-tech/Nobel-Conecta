
import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Profile, Message } from '../types';
import { Send, ArrowLeft, User, Loader2, MessageSquare, Search, Edit2, Check, X } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { createNotification } from '../src/services/notificationService';

interface MessagesViewProps {
  profile: Profile | null;
}

const MessagesView: React.FC<MessagesViewProps> = ({ profile }) => {
  const { contactId } = useParams<{ contactId?: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<{ profile: Profile; lastMessage: Message }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactProfile, setContactProfile] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');

  useEffect(() => {
    if (profile) {
      fetchConversations();
    }
  }, [profile]);

  useEffect(() => {
    if (profile && contactId) {
      fetchMessages(contactId);
      fetchContactProfile(contactId);

      // Real-time subscription
      if (isSupabaseConfigured) {
        const channel = supabase
          .channel(`messages:${profile.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${profile.id}`
          }, (payload) => {
            const msg = payload.new as Message;
            if (msg.sender_id === contactId) {
              setMessages(prev => [...prev, msg]);
            }
            fetchConversations();
          })
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }
  }, [profile, contactId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchContactProfile = async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setContactProfile(data);
  };

  const fetchConversations = async () => {
    if (!profile || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      // Get all messages where user is sender or receiver
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by contact
      const groups: { [key: string]: { profile: Profile; lastMessage: Message } } = {};
      data.forEach((msg: Message) => {
        const contactId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;
        const contactProfile = msg.sender_id === profile.id ? msg.receiver : msg.sender;

        if (!groups[contactId] && contactProfile) {
          groups[contactId] = {
            profile: contactProfile,
            lastMessage: msg
          };
        }
      });

      setConversations(Object.values(groups));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (id: string) => {
    if (!profile || !isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', profile.id)
        .eq('sender_id', id)
        .eq('read', false);

    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !contactId || !isSupabaseConfigured) return;

    setSending(true);
    const msgData = {
      sender_id: profile.id,
      receiver_id: contactId,
      content: newMessage,
      created_at: new Date().toISOString(),
      read: false
    };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(msgData)
        .select()
        .single();

      if (error) throw error;
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      fetchConversations();

      // Notificar o destinatário
      await createNotification(
        contactId,
        'message',
        'Nova mensagem!',
        `@${profile.username} te enviou uma mensagem: "${newMessage.substring(0, 30)}${newMessage.length > 30 ? '...' : ''}"`,
        `/messages/${profile.id}`
      );
    } catch (err) {
      alert('Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editMessageContent.trim()) return;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('messages').update({ content: editMessageContent }).eq('id', id);
        if (error) throw error;
      }

      setMessages(msgs => msgs.map(m => m.id === id ? { ...m, content: editMessageContent } : m));
      setEditingMessageId(null);
      fetchConversations();
    } catch (err) {
      alert('Erro ao editar mensagem');
    }
  };

  const handleSearchUsers = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (!isSupabaseConfigured) {
      setSearchResults([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${term}%`)
        .neq('id', profile?.id)
        .limit(5);

      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  if (loading) return <div className="p-10 text-center font-serif italic text-gray-400">Abrindo correspondências...</div>;

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-6rem)] flex flex-col md:flex-row bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
      {/* Sidebar - Lista de Conversas */}
      <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col ${contactId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
          <h2 className="text-xl font-black font-serif italic mb-4">Mensagens</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Buscar usuários para conversar..."
              value={searchTerm}
              onChange={(e) => handleSearchUsers(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="p-4">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Resultados da busca</p>
              {searchResults.length > 0 ? (
                searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSearchTerm('');
                      setIsSearching(false);
                      navigate(`/messages/${user.id}`);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-yellow-50 rounded-2xl transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                      {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-300" />}
                    </div>
                    <div>
                      <p className="font-black text-xs text-gray-900">@{user.username}</p>
                      <p className="text-[9px] text-gray-400">{user.full_name}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-[10px] text-gray-300 italic p-4">Nenhum usuário encontrado...</p>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsSearching(false);
                }}
                className="w-full mt-4 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest hover:text-black"
              >
                Limpar busca
              </button>
            </div>
          ) : conversations.length > 0 ? (
            conversations.map(conv => (
              <Link
                key={conv.profile.id}
                to={`/messages/${conv.profile.id}`}
                className={`flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-yellow-50/30 transition-all ${contactId === conv.profile.id ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                  {conv.profile.avatar_url ? <img src={conv.profile.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-3 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-black text-xs text-gray-900 truncate">@{conv.profile.username}</p>
                    <span className="text-[8px] text-gray-400 font-bold">{new Date(conv.lastMessage.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className={`text-[10px] truncate ${conv.lastMessage.read || conv.lastMessage.sender_id === profile?.id ? 'text-gray-400' : 'text-black font-black'}`}>
                    {conv.lastMessage.sender_id === profile?.id ? 'Você: ' : ''}{conv.lastMessage.content}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-10 text-center">
              <MessageSquare className="mx-auto text-gray-100 mb-4" size={40} />
              <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Nenhuma conversa iniciada</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-white ${!contactId ? 'hidden md:flex' : 'flex'}`}>
        {contactId && contactProfile ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
              <button onClick={() => navigate('/messages')} className="md:hidden p-2 hover:bg-gray-50 rounded-xl"><ArrowLeft size={20} /></button>
              <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-100">
                {contactProfile.avatar_url ? <img src={contactProfile.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-300" />}
              </div>
              <div>
                <p className="font-black text-sm text-gray-900">@{contactProfile.username}</p>
                <p className="text-[9px] text-green-500 font-black uppercase tracking-widest">Online agora</p>
              </div>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
              {messages.map((msg, i) => {
                const isMine = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm ${isMine ? 'bg-black text-white rounded-tr-none' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-none'}`}>
                      {editingMessageId === msg.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <input
                            className="text-black bg-white/90 rounded-lg p-2 w-full text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                            value={editMessageContent}
                            onChange={e => setEditMessageContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(msg.id!);
                              } else if (e.key === 'Escape') {
                                setEditingMessageId(null);
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end mt-1">
                            <button title="Cancelar" onClick={() => setEditingMessageId(null)} className="p-1.5 rounded-lg bg-gray-500/20 hover:bg-gray-500 text-white transition-colors"><X size={14} /></button>
                            <button title="Salvar" onClick={() => handleSaveEdit(msg.id!)} className="p-1.5 rounded-lg bg-green-500/80 hover:bg-green-500 text-white transition-colors"><Check size={14} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <p className="leading-relaxed whitespace-pre-wrap pr-4">{msg.content}</p>
                          {isMine && (
                            <button
                              onClick={() => {
                                setEditingMessageId(msg.id!);
                                setEditMessageContent(msg.content);
                              }}
                              className="absolute top-0 -right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-gray-800 text-white rounded-lg hover:bg-yellow-500 hover:text-black transition-all shadow-md"
                              title="Editar Mensagem"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <p className={`text-[8px] mt-2 font-bold uppercase tracking-widest ${isMine ? 'text-white/40 text-right' : 'text-gray-300'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input de Mensagem */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:bg-white focus:border-yellow-400 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-black text-yellow-400 p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-24 h-24 bg-yellow-50 rounded-[2rem] flex items-center justify-center mb-6">
              <MessageSquare className="text-yellow-400" size={48} />
            </div>
            <h3 className="text-xl font-black font-serif italic mb-2">Suas Conversas Privadas</h3>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">Selecione uma conversa ao lado ou visite o perfil de um leitor para iniciar um novo papo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesView;
