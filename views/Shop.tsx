
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, MessageCircle, Plus, Trash2, X, Tag, Camera, Loader2, BookOpen } from 'lucide-react';
import { Book, Profile } from '../types';
import { supabase, uploadFile, isSupabaseConfigured } from '../supabase';

const INITIAL_BOOKS: Book[] = [
  { id: '1', title: 'Torto Arado', author: 'Itamar Vieira Junior', price: 'R$ 64,90', cover_url: 'https://m.media-amazon.com/images/I/81S89vV7YmL.jpg', description: 'Um fenômeno literário.' },
  { id: '2', title: 'Tudo é Rio', author: 'Carla Madeira', price: 'R$ 59,90', cover_url: 'https://m.media-amazon.com/images/I/71Riz967kGL.jpg', description: 'Narrativa poética.' },
  { id: '3', title: 'Dom Casmurro', author: 'Machado de Assis', price: 'R$ 45,00', cover_url: 'https://m.media-amazon.com/images/I/81A66-rYV6L.jpg', description: 'Clássico imortal.' },
  { id: '4', title: 'A Hora da Estrela', author: 'Clarice Lispector', price: 'R$ 39,90', cover_url: 'https://m.media-amazon.com/images/I/817-vUu3Y3L.jpg', description: 'Obra prima de Clarice.' },
  { id: '5', title: 'O Avesso do Pele', author: 'Jeferson Tenório', price: 'R$ 54,90', cover_url: 'https://m.media-amazon.com/images/I/71iW3r6fP0L.jpg', description: 'Vencedor do Jabuti.' },
  { id: '6', title: 'Solitária', author: 'Eliana Alves Cruz', price: 'R$ 49,90', cover_url: 'https://m.media-amazon.com/images/I/81gLw+n8qFL.jpg', description: 'Impactante e necessário.' }
];

const SHOP_STORAGE_KEY = 'nobel_conecta_shop_books';

interface ShopProps {
  profile: Profile | null;
}

const Shop: React.FC<ShopProps> = ({ profile }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', price: '', cover_url: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin' ||
    profile?.username === 'nobel_oficial' ||
    profile?.username === 'nobelpetro';

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        const saved = localStorage.getItem(SHOP_STORAGE_KEY);
        setBooks(saved ? JSON.parse(saved) : INITIAL_BOOKS);
        return;
      }

      const { data, error } = await supabase
        .from('shop_books')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error('Erro ao buscar livros:', err);
      // Fallback para localStorage apenas se o Supabase falhar ou não estiver configurado
      const saved = localStorage.getItem(SHOP_STORAGE_KEY);
      if (saved) setBooks(JSON.parse(saved));
      else setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = (title: string) => {
    // Real Nobel Petrópolis WhatsApp (Landline formatted for WA: 552422358014)
    const storeNumber = '552422358014';
    const message = encodeURIComponent(`Olá Nobel Petrópolis! Vi o livro "${title}" no Nobel Conecta e gostaria de reservar.`);
    window.open(`https://wa.me/${storeNumber}?text=${message}`, '_blank');
  };

  const handleSeeReviews = (title: string) => {
    navigate(`/?search=${encodeURIComponent(title)}`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploading(true);
      try {
        const url = await uploadFile('posts', e.target.files[0]);
        setNewBook({ ...newBook, cover_url: url });
      } catch (err) {
        alert('Erro ao processar imagem.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleAddBook = async () => {
    if (!newBook.title || !newBook.price || !newBook.cover_url) {
      alert('Preencha título, preço e selecione a foto.');
      return;
    }

    try {
      if (!isSupabaseConfigured) {
        const bookToAdd: Book = { ...newBook, id: Math.random().toString(36).substr(2, 9) };
        const updated = [bookToAdd, ...books];
        setBooks(updated);
        localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('shop_books')
          .insert([newBook]);

        if (error) throw error;
        await fetchBooks();
      }

      setShowAddModal(false);
      setNewBook({ title: '', author: '', price: '', cover_url: '', description: '' });
    } catch (err) {
      console.error('Erro ao adicionar livro:', err);
      alert('Erro ao salvar livro no banco de dados.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!isSupabaseConfigured) {
        const updated = books.filter(b => b.id !== id);
        setBooks(updated);
        localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('shop_books')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchBooks();
      }
    } catch (err) {
      console.error('Erro ao deletar livro:', err);
      alert('Erro ao remover livro.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 py-6 md:pt-10 mb-24">
      <div className="mb-8 flex flex-col items-center">
        <div className="bg-yellow-400 p-3 rounded-2xl shadow-md mb-4">
          <ShoppingBag className="text-black" size={24} />
        </div>
        <h2 className="text-2xl md:text-4xl font-black text-gray-900 font-serif tracking-tight">Vitrine Nobel</h2>
        <p className="text-gray-400 mt-1 font-bold uppercase tracking-[0.2em] text-[8px]">Comunidade Petrópolis literária</p>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 flex items-center gap-2 bg-black text-yellow-400 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg"
          >
            <Plus size={16} strokeWidth={3} /> Novo Livro
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-black uppercase tracking-widest text-[10px]">Carregando Vitrine...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
            <ShoppingBag className="mb-4 opacity-20" size={48} />
            <p className="font-black uppercase tracking-widest text-[10px]">Nenhum livro na vitrine ainda</p>
          </div>
        ) : (
          books.map(book => (
            <div key={book.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col group hover:shadow-lg transition-all">
              <div className="relative aspect-[2/3] overflow-hidden bg-gray-50">
                <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-yellow-400 text-[8px] font-black px-2 py-1 rounded-lg">
                  {book.price}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="absolute top-2 left-2 bg-red-500 text-white p-2 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                    title="Remover da Vitrine"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <div className="p-2 flex flex-col flex-1">
                <h3 className="text-[10px] font-bold text-gray-900 font-serif leading-tight line-clamp-1 mb-0.5">{book.title}</h3>
                <p className="text-[7px] text-gray-400 mb-2 font-black uppercase tracking-tighter truncate">{book.author}</p>

                <div className="mt-auto space-y-1">
                  <button
                    onClick={() => handleBuy(book.title)}
                    className="w-full bg-black text-yellow-400 font-black py-2 rounded-lg flex items-center justify-center gap-1 transition-all hover:bg-gray-800 uppercase tracking-widest text-[7px]"
                  >
                    <MessageCircle size={10} />
                    <span>Reservar</span>
                  </button>
                  <button
                    onClick={() => handleSeeReviews(book.title)}
                    className="w-full bg-gray-50 text-gray-400 font-black py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all hover:bg-yellow-50 hover:text-yellow-700 border border-gray-100 uppercase tracking-widest text-[6px]"
                  >
                    <BookOpen size={10} />
                    <span>Resenhas</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-6 md:p-10 shadow-2xl relative max-h-[95vh] overflow-y-auto">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-black hover:text-white transition-all"><X size={16} /></button>
            <h3 className="text-xl font-black text-gray-900 font-serif mb-6">Novo Item na Vitrine</h3>

            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 group hover:border-yellow-400 transition-colors cursor-pointer relative overflow-hidden h-32" onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <Loader2 className="animate-spin text-yellow-500" size={24} />
                ) : newBook.cover_url ? (
                  <img src={newBook.cover_url} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="text-gray-300 mb-1" size={32} />
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Capa (Foto 2:3)</span>
                  </>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>

              <div className="space-y-3">
                <input className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl outline-none font-bold text-sm placeholder:text-gray-300 focus:bg-white focus:border-black transition-all" placeholder="Título" value={newBook.title} onChange={e => setNewBook({ ...newBook, title: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl outline-none font-bold text-sm" placeholder="Autor" value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} />
                  <input className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl outline-none font-bold text-sm" placeholder="Preço" value={newBook.price} onChange={e => setNewBook({ ...newBook, price: e.target.value })} />
                </div>
                <textarea className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl outline-none resize-none font-medium text-xs" placeholder="Breve frase..." rows={2} value={newBook.description} onChange={e => setNewBook({ ...newBook, description: e.target.value })} />
              </div>

              <button
                onClick={handleAddBook}
                disabled={uploading}
                className="w-full bg-black text-yellow-400 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-lg mt-4"
              >
                {uploading ? 'Subindo Imagem...' : 'Publicar na Vitrine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
