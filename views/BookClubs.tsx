
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, BookOpen, ChevronRight, Search, X, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { BookClub, Profile } from '../types';

interface BookClubsProps {
  profile: Profile | null;
}

const CLUBS_STORAGE_KEY = 'nobel_conecta_clubs';

const BookClubs: React.FC<BookClubsProps> = ({ profile }) => {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form de criação
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBook, setNewBook] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=800');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchClubs();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      const { uploadFile } = await import('../supabase');
      const url = await uploadFile('posts', e.target.files[0]);
      setNewImageUrl(url);
    } catch (err) {
      alert('Erro no upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const fetchClubs = async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(CLUBS_STORAGE_KEY);
      if (saved) {
        setClubs(JSON.parse(saved));
      } else {
        const initial: BookClub[] = [
          {
            id: 'club-1',
            name: 'Clássicos da 16',
            description: 'Lendo o melhor da literatura mundial toda quarta-feira.',
            current_book: 'Dom Casmurro',
            current_book_author: 'Machado de Assis',
            image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800',
            admin_id: 'admin-user',
            member_ids: ['admin-user', 'leitor-1'],
            created_at: new Date().toISOString()
          }
        ];
        setClubs(initial);
        localStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(initial));
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('book_clubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClubs(data || []);
    } catch (err: any) {
      console.error('Error fetching clubs:', err);
      // Fallback to local if table doesn't exist yet
      if (err.message?.includes('relation "public.book_clubs" does not exist')) {
        const saved = localStorage.getItem(CLUBS_STORAGE_KEY);
        if (saved) setClubs(JSON.parse(saved));
      }
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const clubData = {
      name: newName,
      description: newDesc,
      current_book: newBook,
      current_book_author: 'Autor Indefinido',
      image_url: newImageUrl,
      admin_id: profile.id,
      member_ids: [profile.id],
      created_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const club: BookClub = {
        id: Math.random().toString(36).substr(2, 9),
        ...clubData
      };
      const updated = [club, ...clubs];
      setClubs(updated);
      localStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(updated));
    } else {
      try {
        const { error } = await supabase.from('book_clubs').insert(clubData);
        if (error) throw error;
        fetchClubs();
      } catch (err) {
        alert('Erro ao criar clube. Verifique se a tabela book_clubs existe no Supabase.');
      }
    }

    setShowCreateModal(false);
    setNewName(''); setNewDesc(''); setNewBook('');
    setNewImageUrl('https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=800');
  };

  const filteredClubs = clubs.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.current_book.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  const handleDeleteClub = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Removido window.confirm para evitar travamentos
    const confirmed = true;

    if (!isSupabaseConfigured) {
      const updated = clubs.filter(c => c.id !== id);
      setClubs(updated);
      localStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(updated));
    } else {
      try {
        const { error } = await supabase.from('book_clubs').delete().eq('id', id);
        if (error) throw error;
        fetchClubs();
      } catch (err) {
        alert('Erro ao excluir clube.');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:pt-12 mb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Clubes Literários</h2>
          <p className="text-gray-400 mt-1 font-medium text-xs">Comunidade Petrópolis literária</p>
        </div>
        <div className="bg-black p-3 rounded-2xl shadow-xl">
          <Users className="text-yellow-400" size={24} />
        </div>
      </div>

      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text"
          placeholder="Buscar clubes de leitores..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-100 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-yellow-400 text-sm font-bold text-black"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredClubs.length > 0 ? filteredClubs.map(club => (
          <div key={club.id} className="relative group">
            {isAdmin && (
              <button 
                onClick={(e) => handleDeleteClub(e, club.id)}
                className="absolute -top-2 -right-2 p-3 bg-red-500 text-white rounded-full shadow-xl hover:scale-110 transition-all z-30 border-4 border-white"
                title="Excluir Clube"
              >
                <Trash2 size={16} strokeWidth={3} />
              </button>
            )}
            <Link 
              to={`/clubs/${club.id}`}
              className="bg-white border border-gray-100 rounded-[2rem] p-5 flex items-center gap-5 hover:shadow-xl hover:scale-[1.01] transition-all"
            >
              <div className="w-20 h-28 rounded-xl overflow-hidden shadow-md shrink-0">
                <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-gray-900 font-serif text-lg leading-tight group-hover:text-yellow-600 transition-colors">{club.name}</h3>
                <p className="text-gray-400 text-[10px] mt-1 line-clamp-2 italic leading-relaxed">"{club.description}"</p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="bg-yellow-400 text-black text-[8px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1">
                    <BookOpen size={10} /> Lendo: {club.current_book}
                  </span>
                  <span className="text-[9px] text-gray-300 font-bold uppercase">{club.member_ids.length} membros</span>
                </div>
              </div>
              <ChevronRight className="text-gray-200 group-hover:text-black transition-colors" size={24} />
            </Link>
          </div>
        )) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
            <BookOpen className="mx-auto text-gray-100 mb-3" size={40} />
            <p className="text-gray-400 font-bold uppercase text-[9px] tracking-[0.2em]">Nenhum clube encontrado</p>
          </div>
        )}
      </div>

      {/* FAB - Fundar Clube */}
      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-6 bg-yellow-400 text-black p-4 rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 border-4 border-white flex items-center gap-2 pr-6"
      >
        <Plus size={24} strokeWidth={4} />
        <span className="font-black text-[10px] uppercase tracking-widest">Fundar Clube</span>
      </button>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative my-auto border border-gray-100">
            <button 
              onClick={() => setShowCreateModal(false)} 
              className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full hover:bg-black hover:text-white transition-all"
            >
              <X size={16} />
            </button>
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-gray-900 font-serif">Fundar seu Clube</h3>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Comunidade Petrópolis literária</p>
            </div>
            
            <form onSubmit={handleCreateClub} className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-44 bg-gray-100 rounded-2xl overflow-hidden shadow-xl border-4 border-yellow-400 relative group cursor-pointer" onClick={() => document.getElementById('club-image-upload')?.click()}>
                  <img src={newImageUrl} className="w-full h-full object-cover" alt="Capa do Clube" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="text-white" size={32} />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input id="club-image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Clique na capa para alterar a foto</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Nome do Clube</label>
                <input 
                  required 
                  placeholder="Ex: Leitores de Inverno"
                  className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-200 rounded-xl outline-none font-bold focus:bg-white focus:border-yellow-400 transition-all placeholder:text-gray-300" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Breve Descrição</label>
                <textarea 
                  required 
                  placeholder="Conte o propósito do seu clube..."
                  className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-200 rounded-xl outline-none text-xs font-medium italic focus:bg-white focus:border-yellow-400 transition-all placeholder:text-gray-300" 
                  rows={3} 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Primeiro Livro</label>
                <input 
                  required 
                  placeholder="Ex: Torto Arado"
                  className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-200 rounded-xl outline-none font-bold focus:bg-white focus:border-yellow-400 transition-all placeholder:text-gray-300" 
                  value={newBook} 
                  onChange={e => setNewBook(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-black text-yellow-400 font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-[11px]"
                >
                  Fundar e Publicar
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full bg-white text-gray-400 border border-gray-100 font-black py-4 rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Voltar e Explorar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookClubs;
