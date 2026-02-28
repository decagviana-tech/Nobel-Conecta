
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LogIn, Loader2, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

interface LoginProps {
  setSession?: (session: any) => void;
  setProfile?: (profile: any) => void;
}

const Login: React.FC<LoginProps> = ({ setSession, setProfile }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const isAdmin = email.toLowerCase() === 'admin@nobel.com' || email.toLowerCase().includes('nobel');
        const demoUser = {
          id: isAdmin ? 'admin-user' : 'demo-user-' + Math.random().toString(36).substr(2, 4),
          username: isAdmin ? 'nobel_oficial' : (email.split('@')[0] || 'leitor_nobel'),
          full_name: isAdmin ? 'Equipe Nobel Petrópolis' : 'Leitor Nobel',
          role: isAdmin ? 'admin' : 'user',
          favorite_genres: isAdmin ? ['Gestão Literária'] : ['Clássicos'],
          reading_now: isAdmin ? 'Curadoria de Acervo Nobel' : 'Dom Casmurro'
        };
        localStorage.setItem('nobel_demo_session', JSON.stringify(demoUser));
        setSuccess(true);
        setTimeout(() => {
          if (setSession) setSession({ user: { id: demoUser.id } });
          if (setProfile) setProfile(demoUser);
        }, 800);
      }, 1000);
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setError(error.message || 'E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      if (data?.user) {
        setSuccess(true);
        
        // Busca o perfil, mas não deixa o erro de perfil travar o login
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          
          if (setProfile) setProfile(profileData);
        } catch (pErr) {
          console.warn('Perfil não carregado imediatamente:', pErr);
        }
        
        // Pequena pausa apenas para mostrar a animação de sucesso
        setTimeout(() => {
          if (setSession) setSession(data.session);
        }, 800);
      }
    } catch (err: any) {
      setError('Erro de conexão. Verifique sua internet ou tente novamente em instantes.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-[0_30px_70px_rgba(0,0,0,0.15)] border border-gray-100 relative overflow-hidden">
        {success && (
          <div className="absolute inset-0 bg-yellow-400 z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
            <CheckCircle2 size={64} className="text-black mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-black font-serif">Bem-vindo(a)!</h2>
            <p className="text-black/60 font-bold uppercase text-[10px] tracking-widest mt-2">Carregando sua estante...</p>
          </div>
        )}

        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-black rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl rotate-3 relative border-4 border-white">
            <BookOpen className="text-yellow-400" size={40} />
            {!isSupabaseConfigured && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black p-1.5 rounded-full shadow-lg border-2 border-white">
                <Sparkles size={14} />
              </div>
            )}
          </div>
          <h1 className="text-4xl font-black text-gray-900 font-serif tracking-tight">Nobel <span className="text-yellow-500 italic">Conecta</span></h1>
          <p className="text-gray-400 mt-3 text-center font-medium max-w-[250px]">
            Comunidade Petrópolis literária
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">E-mail</label>
            <input 
              required
              type="email" 
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Senha</label>
            <input 
              required
              type="password" 
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-black hover:bg-gray-800 text-yellow-400 font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 mt-6 transform active:scale-95 uppercase tracking-widest text-sm"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Entrar na Comunidade'}
          </button>
        </form>

        <div className="mt-10 text-center text-sm">
          <span className="text-gray-400">Novo por aqui? </span>
          <Link to="/register" className="text-black font-black hover:underline underline-offset-8 decoration-yellow-400 decoration-4">
            Cadastre-se grátis
          </Link>
        </div>
      </div>
      
      <p className="mt-12 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em]">
        Livraria Nobel Petrópolis &bull; 2026
      </p>
    </div>
  );
};

export default Login;
