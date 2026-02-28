
import React, { useState, useEffect } from 'react';
import { Shield, ShoppingBag, MessageSquare, Users, Trash2, Plus, ExternalLink, AlertTriangle, UserCheck, ShieldAlert, Phone, Save } from 'lucide-react';
import { Profile, Post, Book } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Link } from 'react-router-dom';

interface AdminDashboardProps {
  profile: Profile | null;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ profile }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('5524999999999');

  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  useEffect(() => {
    const savedNumber = localStorage.getItem('nobel_conecta_whatsapp');
    if (savedNumber) setWhatsappNumber(savedNumber);
    
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const handleSaveWhatsapp = () => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    localStorage.setItem('nobel_conecta_whatsapp', cleanNumber);
    setWhatsappNumber(cleanNumber);
    alert('Número do WhatsApp atualizado com sucesso!');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Em modo demo, pegamos do localStorage
      if (!isSupabaseConfigured) {
        const savedPosts = localStorage.getItem('nobel_conecta_demo_posts');
        const savedBooks = localStorage.getItem('nobel_conecta_shop_books');
        
        // Simulação de usuários para o modo demo
        const demoUsers: Profile[] = [
          { id: '1', username: 'maria_leitora', full_name: 'Maria Silva', role: 'user', favorite_genres: ['Romance'], reading_now: 'Orgulho e Preconceito' },
          { id: '2', username: 'pedro_livros', full_name: 'Pedro Santos', role: 'user', favorite_genres: ['Ficção'], reading_now: '1984' },
          { id: 'admin-user', username: 'nobel_oficial', full_name: 'Equipe Nobel Petrópolis', role: 'admin', favorite_genres: ['Gestão'], reading_now: 'Curadoria' }
        ];

        if (savedPosts) setPosts(JSON.parse(savedPosts));
        if (savedBooks) setBooks(JSON.parse(savedBooks));
        setUsers(demoUsers);
      } else {
        const { data: postsData } = await supabase.from('posts').select('*, author:profiles(*)').order('created_at', { ascending: false });
        if (postsData) setPosts(postsData);
        
        const { data: usersData } = await supabase.from('profiles').select('*').order('username', { ascending: true });
        if (usersData) setUsers(usersData);

        const savedBooks = localStorage.getItem('nobel_conecta_shop_books');
        if (savedBooks) setBooks(JSON.parse(savedBooks));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    console.log('handleDeletePost (Admin) iniciada para ID:', postId);
    // Removido window.confirm para evitar travamentos
    const confirmed = true;
    
    if (!isSupabaseConfigured) {
      console.log('Modo Demo (Admin): excluindo localmente...');
      const updated = posts.filter(p => p.id !== postId);
      setPosts(updated);
      localStorage.setItem('nobel_conecta_demo_posts', JSON.stringify(updated));
    } else {
      try {
        console.log('Chamando Supabase para deletar post via Admin:', postId);
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) {
          console.error('Erro do Supabase na exclusão Admin:', error);
          throw error;
        }
        console.log('Post deletado com sucesso via Admin.');
        fetchData();
      } catch (err: any) {
        console.error('Erro capturado no catch de exclusão Admin:', err);
        alert('Erro ao excluir: ' + (err.message || 'Acesso negado'));
      }
    }
  };

  const handleDeleteBook = (id: string) => {
    const updated = books.filter(b => b.id !== id);
    setBooks(updated);
    localStorage.setItem('nobel_conecta_shop_books', JSON.stringify(updated));
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black font-serif">Acesso Negado</h2>
        <p className="text-gray-500 mt-2">Você não tem permissão para acessar esta área.</p>
        <Link to="/" className="mt-6 bg-black text-yellow-400 px-6 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest">Voltar ao Início</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 mb-24">
      <div className="flex items-center gap-4 mb-10">
        <div className="bg-black p-4 rounded-2xl shadow-xl">
          <Shield className="text-yellow-400" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Painel de Controle</h1>
          <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Comunidade Petrópolis literária</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><MessageSquare size={24} /></div>
            <span className="text-2xl font-black font-serif">{posts.length}</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total de Postagens</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><ShoppingBag size={24} /></div>
            <span className="text-2xl font-black font-serif">{books.length}</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Livros na Vitrine</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl"><Users size={24} /></div>
            <span className="text-2xl font-black font-serif">Ativo</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status do Sistema</p>
        </div>
      </div>

      <div className="space-y-12">
        {/* Moderação de Conteúdo */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black font-serif text-gray-900">Moderação de Conteúdo</h2>
            <Link to="/" className="text-[10px] font-black uppercase text-gray-400 hover:text-black flex items-center gap-2">Ver no Feed <ExternalLink size={12} /></Link>
          </div>
          
          <div className="bg-white border-2 border-gray-50 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Autor</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Conteúdo</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {posts.slice(0, 10).map(post => (
                  <tr key={post.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 overflow-hidden">
                          {post.author?.avatar_url && <img src={post.author.avatar_url} className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-xs font-black">@{post.author?.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 line-clamp-1 italic">"{post.content}"</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gestão da Vitrine */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black font-serif text-gray-900">Gestão da Vitrine</h2>
            <Link to="/shop" className="text-[10px] font-black uppercase text-gray-400 hover:text-black flex items-center gap-2">Ver Vitrine <ExternalLink size={12} /></Link>
          </div>
          
          <div className="bg-white border-2 border-gray-50 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Livro</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Preço</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {books.map(book => (
                  <tr key={book.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-12 rounded-lg bg-gray-100 overflow-hidden">
                          <img src={book.cover_url} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-black">{book.title}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{book.author}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-yellow-600">{book.price}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteBook(book.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gestão de Usuários */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black font-serif text-gray-900">Gestão de Usuários</h2>
            <span className="text-[10px] font-black uppercase text-gray-400">{users.length} Leitores Cadastrados</span>
          </div>
          
          <div className="bg-white border-2 border-gray-50 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Leitor</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Cargo</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Lendo Agora</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <Users size={20} className="text-gray-300" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900">{u.full_name}</p>
                          <p className="text-[10px] text-gray-400 font-bold">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        {u.role === 'admin' ? 'Administrador' : 'Leitor'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-gray-500 font-medium italic truncate max-w-[150px]">
                        {u.reading_now || 'Nenhum livro no momento'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          title="Ver Perfil"
                          className="p-2 text-gray-300 hover:text-black transition-colors"
                        >
                          <ExternalLink size={16} />
                        </button>
                        {u.role !== 'admin' && (
                          <button 
                            title="Bloquear Usuário"
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <ShieldAlert size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Atalhos Rápidos */}
        <section>
          <h2 className="text-xl font-black font-serif text-gray-900 mb-6">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/shop" className="flex items-center justify-between p-6 bg-black text-yellow-400 rounded-2xl hover:scale-[1.02] transition-all shadow-lg group">
              <div className="flex items-center gap-4">
                <Plus size={24} />
                <span className="font-black uppercase tracking-widest text-xs">Adicionar Livro à Vitrine</span>
              </div>
              <ShoppingBag className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link to="/events" className="flex items-center justify-between p-6 bg-yellow-400 text-black rounded-2xl hover:scale-[1.02] transition-all shadow-lg group">
              <div className="flex items-center gap-4">
                <Plus size={24} />
                <span className="font-black uppercase tracking-widest text-xs">Criar Novo Evento</span>
              </div>
              <Users className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </section>

        {/* Configurações da Loja */}
        <section className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Phone className="text-gray-400" size={20} />
            <h2 className="text-xl font-black font-serif text-gray-900">Configurações da Loja</h2>
          </div>
          <div className="max-w-md">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Número do WhatsApp (com DDD)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ex: 5524988887777"
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none font-bold text-sm focus:border-black transition-all"
              />
              <button 
                onClick={handleSaveWhatsapp}
                className="bg-black text-yellow-400 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-2 italic">* Use o formato: Código do País + DDD + Número (ex: 55 24 9...) sem espaços ou traços.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
