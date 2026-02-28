
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Clock, Plus, Trash2, X, Camera, Loader2 } from 'lucide-react';
import { LibraryEvent, Profile } from '../types';
import { uploadFile, supabase } from '../supabase';

const INITIAL_EVENTS: LibraryEvent[] = [];

const EVENTS_STORAGE_KEY = 'nobel_conecta_events';

interface EventsProps {
  profile: Profile | null;
}

const Events: React.FC<EventsProps> = ({ profile }) => {
  const [events, setEvents] = useState<LibraryEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '', image_url: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  useEffect(() => {
    const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Remove o evento fake antigo se ele ainda estiver no localStorage do usuário
      const filtered = parsed.filter((e: any) => e.id !== 'e1');
      setEvents(filtered);
      if (filtered.length !== parsed.length) {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(filtered));
      }
    } else {
      setEvents(INITIAL_EVENTS);
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(INITIAL_EVENTS));
    }
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setLoading(true);
      try {
        const url = await uploadFile('posts', e.target.files[0]);
        setNewEvent({ ...newEvent, image_url: url });
      } catch (err) {
        alert('Erro no upload.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.image_url) {
      alert('Preencha o título e selecione uma foto para o evento.');
      return;
    }
    const eventToAdd: LibraryEvent = {
      ...newEvent,
      id: Math.random().toString(36).substr(2, 9),
      type: 'upcoming'
    };
    const updated = [eventToAdd, ...events];
    setEvents(updated);
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updated));
    setShowModal(false);
    setNewEvent({ title: '', date: '', time: '', location: '', description: '', image_url: '' });
  };

  const handleSuggestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
      // Envia uma notificação para os admins
      const { data: admins } = await supabase.from('profiles').select('id').or('role.eq.admin,username.eq.nobel_oficial,username.eq.nobelpetro');
      
      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          type: 'event_suggestion',
          title: '💡 Sugestão de Evento',
          content: `${profile.full_name} sugeriu o evento: ${newEvent.title}`,
          link: '/admin'
        }));
        
        await supabase.from('notifications').insert(notifications);
        alert('Obrigado! Sua sugestão foi enviada para a equipe Nobel Petrópolis.');
        setShowModal(false);
        setNewEvent({ title: '', date: '', time: '', location: '', description: '', image_url: '' });
      }
    } catch (err) {
      alert('Sua sugestão foi anotada! (Modo Demo)');
      setShowModal(false);
    }
  };

  const handleDelete = (id: string) => {
    // Removido window.confirm para evitar travamentos
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-12 mb-24">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 font-serif tracking-tight">Agenda Cultural</h2>
          <p className="text-gray-400 mt-2 font-medium">Comunidade Petrópolis literária</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className={`flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl active:scale-95 w-full md:w-auto ${isAdmin ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'}`}
        >
          {isAdmin ? (
            <><Plus size={18} strokeWidth={3} /> Anunciar Evento</>
          ) : (
            <><Plus size={18} strokeWidth={3} /> Sugerir Evento</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {events.length > 0 ? events.map(event => (
          <div key={event.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm flex flex-col md:flex-row group hover:shadow-lg transition-all duration-500 relative">
            {isAdmin && (
              <button 
                onClick={() => handleDelete(event.id)}
                className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur p-2.5 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-md border border-gray-100"
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className="md:w-1/3 aspect-[2/3] overflow-hidden bg-gray-100">
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <div className="p-6 md:p-10 md:w-2/3 flex flex-col">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="flex items-center gap-1.5 text-[8px] font-black text-yellow-700 bg-yellow-400/20 px-3 py-1.5 rounded-full uppercase tracking-widest">
                  <Calendar size={12} /> {event.date}
                </span>
                <span className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-widest">
                  <Clock size={12} /> {event.time}
                </span>
              </div>
              <h4 className="text-xl md:text-3xl font-bold text-gray-900 font-serif mb-4 leading-tight">{event.title}</h4>
              <p className="text-gray-600 text-xs md:text-sm mb-6 leading-relaxed line-clamp-2 italic">"{event.description}"</p>
              <div className="mt-auto flex items-center gap-2 text-gray-400 text-[8px] font-black uppercase tracking-widest pt-4 border-t border-gray-100">
                <MapPin size={14} className="text-red-400" />
                {event.location}
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
             <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
             <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Nenhum evento agendado</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2.5 bg-gray-100 rounded-full hover:bg-black hover:text-white transition-all"><X size={18} /></button>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-yellow-400 rounded-2xl shadow-lg shadow-yellow-400/20">
                <Calendar className="text-black" size={20} />
              </div>
              <h3 className="text-xl font-black text-gray-900 font-serif">
                {isAdmin ? 'Novo Evento Nobel' : 'Sugerir Evento'}
              </h3>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 group hover:border-yellow-400 transition-colors cursor-pointer relative overflow-hidden aspect-[2/3] w-48 mx-auto" onClick={() => fileInputRef.current?.click()}>
                {loading ? (
                  <Loader2 className="animate-spin text-yellow-500" size={24} />
                ) : newEvent.image_url ? (
                  <img src={newEvent.image_url} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="text-gray-400 group-hover:text-yellow-500 transition-colors mb-1" size={32} />
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center">Clique para enviar o Convite (Retrato)</span>
                  </>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Título do Evento</label>
                  <input 
                    className="w-full px-5 py-4 bg-white text-black border-2 border-gray-100 rounded-xl outline-none font-bold placeholder:text-gray-300 focus:border-yellow-400 transition-all shadow-sm" 
                    placeholder="Ex: Noite de Autógrafos" 
                    value={newEvent.title} 
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Data</label>
                    <input className="w-full px-5 py-4 bg-white text-black border-2 border-gray-100 rounded-xl outline-none font-bold placeholder:text-gray-300 focus:border-yellow-400 transition-all shadow-sm" placeholder="Ex: 20 Out" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Hora</label>
                    <input className="w-full px-5 py-4 bg-white text-black border-2 border-gray-100 rounded-xl outline-none font-bold placeholder:text-gray-300 focus:border-yellow-400 transition-all shadow-sm" placeholder="Ex: 18:30" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Local</label>
                  <input className="w-full px-5 py-4 bg-white text-black border-2 border-gray-100 rounded-xl outline-none font-bold placeholder:text-gray-300 focus:border-yellow-400 transition-all shadow-sm" placeholder="Ex: Rua 16 de Março, 99" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Descrição Curta</label>
                  <textarea className="w-full px-5 py-4 bg-white text-black border-2 border-gray-100 rounded-xl outline-none resize-none font-medium placeholder:text-gray-300 focus:border-yellow-400 transition-all shadow-sm" placeholder="Conte um pouco sobre o evento..." rows={3} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
                </div>
              </div>

              <button 
                onClick={isAdmin ? handleAddEvent : handleSuggestEvent}
                disabled={loading}
                className="w-full bg-black text-yellow-400 font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all active:scale-95"
              >
                {loading ? 'Processando...' : isAdmin ? 'Salvar Evento' : 'Enviar Sugestão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
