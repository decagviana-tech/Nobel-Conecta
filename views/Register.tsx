
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, UserPlus, Loader2, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    username: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // MODO DE DEMONSTRAÇÃO
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        // Simula a criação de um perfil no localStorage para que o login funcione
        const demoUser = {
          id: 'demo-user-' + Math.random().toString(36).substr(2, 4),
          username: formData.username.toLowerCase().replace(/\s/g, ''),
          full_name: formData.fullName,
          role: 'user',
          favorite_genres: ['Explorando'],
          reading_now: 'Novo Leitor Nobel'
        };
        
        // No modo demo, apenas confirmamos e enviamos para o login
        alert('Modo Demo: Conta simulada com sucesso! Agora você pode entrar com qualquer e-mail/senha ou os dados que acabou de criar.');
        setLoading(false);
        navigate('/login');
      }, 1500);
      return;
    }

    // MODO PRODUÇÃO (SUPABASE)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username.toLowerCase().replace(/\s/g, ''),
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Tentamos o upsert, mas não deixamos ele travar o processo principal
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              full_name: formData.fullName,
              username: formData.username.toLowerCase().replace(/\s/g, ''),
              role: formData.email === 'nobel.petropolis@gmail.com' ? 'admin' : 'user'
            }, { onConflict: 'id' });
        } catch (pErr) {
          console.warn('Aviso no perfil (pode ter sido criado pelo trigger):', pErr);
        }
        
        setLoading(false);
        if (authData.session) {
          alert('Conta criada e logada com sucesso!');
          navigate('/');
        } else {
          alert('Conta criada! Verifique seu e-mail para confirmar o acesso e depois faça login.');
          navigate('/login');
        }
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Erro no registro:', err);
      if (err.message?.includes('already registered')) {
        setError('Este e-mail já está cadastrado. Por favor, faça login.');
      } else {
        setError(err.message || 'Erro ao criar conta. Verifique os dados e tente novamente.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-5 shadow-lg -rotate-6">
            <BookOpen className="text-black" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Criar Conta</h1>
          <p className="text-gray-400 mt-2 text-center font-medium">Comunidade Petrópolis literária</p>
          
          {!isSupabaseConfigured && (
            <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-2 text-blue-700 text-[9px] font-bold uppercase tracking-wider">
              <Info size={14} /> Modo de Demonstração Ativo
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nome</label>
              <input 
                required
                className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
                placeholder="Ex: João"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">@User</label>
              <input 
                required
                className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
                placeholder="leitor1"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">E-mail</label>
            <input 
              required
              type="email"
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Senha</label>
            <input 
              required
              type="password"
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="Min. 6 caracteres"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-black hover:bg-gray-800 text-yellow-400 font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 mt-6 transform active:scale-95 uppercase tracking-widest text-sm"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><UserPlus size={20} /> Cadastrar</>}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-gray-400">Já tem conta? </span>
          <Link to="/login" className="text-black font-black hover:underline underline-offset-8 decoration-yellow-400 decoration-4">
            Fazer login
          </Link>
        </div>
      </div>

      <p className="mt-12 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em]">
        Livraria Nobel Petrópolis &bull; 2026
      </p>
    </div>
  );
};

export default Register;
