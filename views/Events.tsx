
import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Plus, Trash2, CheckCircle2, AlertCircle, Clock, ExternalLink, Info, Heart, MessageCircle, Send, X, Camera, Image as ImageIcon, Edit2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Profile, LibraryEvent as Event } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmModal from '../components/ConfirmModal';

interface EventsViewProps {
  profile: Profile | null;
}

const EventsView: React.FC<EventsViewProps> = ({ profile }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState<string[]>([]);
  const [likedEvents, setLikedEvents] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [eventComments, setEventComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    description: '',
    date: new Date().toISOString(),
    location: '',
    image_url: '',
    max_participants: 20
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

  const isAdmin = profile?.role === 'admin' ||
    profile?.username === 'nobel_oficial' ||
    profile?.username === 'nobelpetro';

  useEffect(() => {
    fetchEvents();
    if (profile) {
      fetchUserParticipations();
      fetchUserLikes();
    }
  }, [profile]);

  const fetchEvents = async () => {
    try {
      if (!isSupabaseConfigured) {
        const demo: Event[] = [{
          id: '1',
          title: 'Aniversário na Nobel',
          description: 'Comemoração pelo aniversário do Matheus! Venha comemorar conosco neste dia especial.',
          date: '2026-03-05',
          time: '16:00',
          location: 'Nobel Petrópolis',
          image_url: 'https://images.unsplash.com/photo-1530103862676-fa8c91abe178?q=80&w=2070&auto=format&fit=crop',
          type: 'upcoming',
          participants_count: 15,
          max_participants: 50,
          created_at: new Date().toISOString()
        }];
        setEvents(demo);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .select('*, event_participants(count), event_likes(count), event_comments(count)')
        .order('date', { ascending: true });

      if (error) throw error;

      setEvents(data.map((e: any) => ({
        ...e,
        participants_count: e.event_participants?.[0]?.count || 0,
        likes_count: e.event_likes?.[0]?.count || 0,
        comments_count: e.event_comments?.[0]?.count || 0
      })));
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserParticipations = async () => {
    if (!profile || !isSupabaseConfigured) return;
    const { data } = await supabase.from('event_participants').select('event_id').eq('user_id', profile.id);
    if (data) setParticipating(data.map(p => p.event_id));
  };

  const fetchUserLikes = async () => {
    if (!profile || !isSupabaseConfigured) return;
    const { data } = await supabase.from('event_likes').select('event_id').eq('user_id', profile.id);
    if (data) setLikedEvents(data.map(p => p.event_id));
  };

  const fetchComments = async (eventId: string) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('event_comments')
      .select('*, author:profiles(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (data) setEventComments(data);
  };

  const handleLike = async (eventId: string) => {
    if (!profile || !isSupabaseConfigured) return;
    const isLiked = likedEvents.includes(eventId);

    if (isLiked) {
      setLikedEvents(prev => prev.filter(id => id !== eventId));
      await supabase.from('event_likes').delete().eq('user_id', profile.id).eq('event_id', eventId);
    } else {
      setLikedEvents(prev => [...prev, eventId]);
      await supabase.from('event_likes').insert({ user_id: profile.id, event_id: eventId });
    }
    fetchEvents();
  };

  const handleAddComment = async (eventId: string) => {
    if (!profile || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('event_comments').insert({
        event_id: eventId,
        user_id: profile.id,
        content: newComment
      });
      if (!error) {
        setNewComment('');
        fetchComments(eventId);
        fetchEvents();
      }
    }
    setIsSubmittingComment(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isSupabaseConfigured) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `events/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('events')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('events')
        .getPublicUrl(filePath);

      setNewEvent({ ...newEvent, image_url: publicUrl });
    } catch (err) {
      alert('Erro no upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleParticipate = async (eventId: string) => {
    if (!profile) return;

    setConfirmModal({
      isOpen: true,
      title: "Confirmar Presença?",
      message: "Você deseja confirmar sua vaga neste evento presencial?",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        if (!isSupabaseConfigured) {
          setParticipating(prev => [...prev, eventId]);
          return;
        }

        try {
          const { error } = await supabase
            .from('event_participants')
            .insert({ event_id: eventId, user_id: profile.id });

          if (error) {
            if (error.code === '23505') alert('Você já está inscrito neste evento.');
            else throw error;
          } else {
            setParticipating(prev => [...prev, eventId]);
            fetchEvents();
          }
        } catch (err) {
          alert('Erro ao confirmar presença.');
        }
      }
    });
  };

  const handleDeleteEvent = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Evento?",
      message: "Tem certeza que deseja cancelar este evento permanentemente?",
      onConfirm: async () => {
        if (isSupabaseConfigured) {
          await supabase.from('events').delete().eq('id', id);
          fetchEvents();
        } else {
          setEvents(events.filter(e => e.id !== id));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (!isSupabaseConfigured) {
        if (editingEvent) {
          const updatedEvents = events.map(ev => ev.id === editingEvent.id ? { ...ev, ...newEvent } : ev);
          setEvents(updatedEvents);
        } else {
          const newEvData = {
            ...newEvent,
            id: Math.random().toString(),
            participants_count: 0,
            created_at: new Date().toISOString()
          } as Event;
          setEvents(prev => [...prev, newEvData]);
        }
        setShowCreateModal(false);
        setEditingEvent(null);
        return;
      }

      if (editingEvent) {
        const { error } = await supabase.from('events').update(newEvent).eq('id', editingEvent.id);
        if (error) throw error;
        alert('Evento editado com sucesso!');
      } else {
        const { error } = await supabase.from('events').insert([newEvent]);
        if (error) throw error;
        alert('Evento criado com sucesso!');
      }

      setShowCreateModal(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (err) {
      alert('Erro ao salvar evento.');
    }
  };

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
      image_url: event.image_url,
      max_participants: event.max_participants
    });
    setShowCreateModal(true);
  };

  if (loading) return <div className="p-10 text-center text-gray-400 font-serif italic">Preparando os convites...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-black text-gray-900 font-serif tracking-tight">Cultura & Momentos</h2>
          <p className="text-gray-400 mt-2 font-black text-[10px] uppercase tracking-[0.2em] bg-gray-50 inline-block px-3 py-1 rounded-full border border-gray-100">Encontros presenciais na Nobel Petrópolis</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingEvent(null);
              setNewEvent({
                title: '',
                description: '',
                date: new Date().toISOString(),
                location: '',
                image_url: '',
                max_participants: 20
              });
              setShowCreateModal(true);
            }}
            className="bg-black text-yellow-400 p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all group"
          >
            <Plus size={28} className="group-hover:rotate-90 transition-transform" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 pb-32">
        {events.length > 0 ? (
          events.map(event => (
            <div key={event.id} className="bg-white rounded-[3rem] shadow-xl border border-gray-100 group relative overflow-hidden flex flex-col md:flex-row min-h-[400px]">
              {/* Artwork Section (Portrait) */}
              <div className="w-full md:w-[40%] bg-gray-100 relative overflow-hidden shrink-0 aspect-[3/4] md:aspect-auto">
                {event.image_url ? (
                  <img src={event.image_url} className="w-full h-full object-cover object-top transition-transform duration-1000 group-hover:scale-110" alt={event.title} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                    <ImageIcon size={48} />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Arte do Evento</span>
                  </div>
                )}
                <div className="absolute top-6 left-6 bg-black/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl text-center shadow-2xl border border-white/10">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-yellow-400">
                    {format(new Date(event.date), 'MMM', { locale: ptBR })}
                  </span>
                  <span className="text-2xl font-black tracking-tighter">
                    {format(new Date(event.date), 'dd')}
                  </span>
                </div>
              </div>

              {/* Content Section */}
              <div className="flex-1 p-8 md:p-10 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-gray-900 font-serif italic leading-tight mb-2 uppercase tracking-tighter">{event.title}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-gray-400 font-black text-[10px] uppercase tracking-widest">
                        <Clock size={14} className="text-yellow-600" />
                        {format(new Date(event.date), 'HH:mm')}h
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 font-black text-[10px] uppercase tracking-widest">
                        <MapPin size={14} className="text-yellow-600" />
                        {event.location}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(event)} className="p-3 text-blue-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit2 size={20} />
                      </button>
                      <button onClick={() => handleDeleteEvent(event.id)} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed italic mb-8 pl-4 border-l-4 border-yellow-200 uppercase tracking-tight">
                    "{event.description}"
                  </p>

                  <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between mb-8">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Público Confirmado</span>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-yellow-600" />
                        <span className="text-lg font-black text-gray-900 tracking-tighter">
                          {event.participants_count || 0} <span className="text-gray-300 font-medium">/ {event.max_participants}</span>
                        </span>
                      </div>
                    </div>
                    {participating.includes(event.id) ? (
                      <div className="bg-green-100 text-green-700 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-sm">
                        <CheckCircle2 size={16} /> Confirmado
                      </div>
                    ) : (
                      <button
                        onClick={() => handleParticipate(event.id)}
                        disabled={(event.participants_count || 0) >= (event.max_participants || 0)}
                        className="bg-black text-yellow-400 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        {(event.participants_count || 0) >= (event.max_participants || 0) ? 'Esgotado' : 'Participar'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Social Interactions */}
                <div className="pt-6 border-t border-gray-50 flex items-center gap-6">
                  <button
                    onClick={() => handleLike(event.id)}
                    className={`flex items-center gap-2 group transition-colors ${likedEvents.includes(event.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                  >
                    <Heart size={20} fill={likedEvents.includes(event.id) ? "currentColor" : "none"} className="group-active:scale-125 transition-transform" />
                    <span className="text-xs font-black">{(event as any).likes_count || 0}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowComments(showComments === event.id ? null : event.id);
                      if (showComments !== event.id) fetchComments(event.id);
                    }}
                    className={`flex items-center gap-2 group transition-colors ${showComments === event.id ? 'text-black' : 'text-gray-400 hover:text-black'}`}
                  >
                    <MessageCircle size={20} />
                    <span className="text-xs font-black">{(event as any).comments_count || 0}</span>
                  </button>
                </div>

                {/* Comments Panel */}
                {showComments === event.id && (
                  <div className="mt-6 pt-6 border-t border-gray-100 animate-in slide-in-from-top-2">
                    <div className="max-h-40 overflow-y-auto space-y-4 mb-4 scrollbar-hide">
                      {eventComments.length > 0 ? eventComments.map(c => (
                        <div key={c.id} className="flex gap-3">
                          <img src={c.author?.avatar_url || 'https://via.placeholder.com/150'} className="w-6 h-6 rounded-lg object-cover" />
                          <div className="flex-1">
                            <span className="text-[10px] font-black text-gray-900">@{c.author?.username}</span>
                            <p className="text-[11px] text-gray-600 leading-tight">{c.content}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-center text-[10px] text-gray-300 font-black uppercase tracking-widest py-4">Dúvidas ou sugestões? Comente aqui!</p>
                      )}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleAddComment(event.id); }} className="flex gap-3">
                      <input
                        className="flex-1 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
                        placeholder="Escreva algo..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <button type="submit" className="p-2 bg-black text-yellow-400 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md">
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-gray-100 italic">
            <Calendar className="mx-auto text-gray-100 mb-6" size={64} />
            <p className="text-gray-400 font-bold uppercase text-[11px] tracking-[0.3em] px-12 leading-relaxed">Explorando novos roteiros... em breve novos eventos incríveis na Nobel.</p>
          </div>
        )}
      </div>

      {/* Modal de Criação (Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[20000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black font-serif italic mb-2 tracking-tighter">{editingEvent ? 'Editar Evento' : 'Novo Momento'}</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">
                  {editingEvent ? 'Atualize os detalhes da experiência' : 'Crie uma experiência inesquecível'}
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-black">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-6">
              {/* Image Selection */}
              <div className="relative aspect-[16/9] bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 overflow-hidden group">
                {newEvent.image_url ? (
                  <>
                    <img src={newEvent.image_url} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, image_url: '' })}
                      className="absolute top-4 right-4 bg-black/80 text-white p-2 rounded-xl hover:bg-red-500 transition-colors shadow-2xl"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors gap-3">
                    <div className="bg-white p-4 rounded-full shadow-lg text-yellow-600">
                      {uploadingImage ? <Clock className="animate-spin" size={24} /> : <Camera size={24} />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Arte de Divulgação (Portrait)</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              <div className="space-y-4">
                <input
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm text-black"
                  placeholder="Nome do Evento"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
                />
                <textarea
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm min-h-[120px] text-black italic"
                  placeholder="Conte-nos o que espera os leitores..."
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600" size={16} />
                    <input
                      type="datetime-local"
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-xs text-black"
                      value={newEvent.date ? new Date(newEvent.date).toISOString().slice(0, 16) : ''}
                      onChange={e => setNewEvent({ ...newEvent, date: new Date(e.target.value).toISOString() })}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600" size={16} />
                    <input
                      type="number"
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm text-black"
                      placeholder="Vagas"
                      value={newEvent.max_participants}
                      onChange={e => setNewEvent({ ...newEvent, max_participants: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600" size={16} />
                  <input
                    className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm text-black"
                    placeholder="Local (Ex: Ala Nobel Café)"
                    value={newEvent.location}
                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 bg-black text-yellow-400 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {uploadingImage ? 'Enviando Foto...' : (editingEvent ? 'Salvar Edição' : 'Publicar Evento')}
                </button>
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

export default EventsView;
