
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LogIn, Loader2, Sparkles, ShieldCheck, CheckCircle2, Users, CalendarHeart, Gift } from 'lucide-react';
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
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

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
          const { data: profileData, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!pError && profileData) {
            if (setProfile) setProfile(profileData);
          } else {
            console.warn('Perfil não encontrado no login, App.tsx cuidará da criação automática.');
          }
        } catch (pErr) {
          console.warn('Erro ao carregar perfil no login:', pErr);
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

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setRecoverySent(true);
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: window.location.origin + window.location.pathname + '#/reset-password',
      });

      if (error) throw error;

      setRecoverySent(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white md:bg-gray-50 flex items-center justify-center p-0 md:p-6">

      {/* Outer Container - Split Layout on Desktop */}
      <div className="w-full max-w-6xl md:bg-white md:rounded-[3rem] shadow-none md:shadow-[0_30px_70px_rgba(0,0,0,0.1)] md:border md:border-gray-100 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-[800px] relative">

        {/* LEFT SIDE - Presentation / Landing Info (DARK MODE TEST) */}
        <div className="w-full md:w-[55%] bg-black p-8 md:p-16 flex flex-col justify-center relative overflow-hidden text-white z-10">
          {/* Decorative Elements */}
          <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/3"></div>
          <div className="hidden md:block absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full blur-[120px] opacity-10 translate-y-1/3 -translate-x-1/4"></div>

          <div className="relative z-20">
            <div className="w-14 h-14 md:w-20 md:h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6 md:mb-8 shadow-2xl rotate-3 border-2 border-white/10">
              <BookOpen className="text-black" size={32} />
              {!isSupabaseConfigured && (
                <div className="absolute -top-2 -right-2 bg-yellow-300 text-black p-1 rounded-full shadow-lg border-2 border-white">
                  <Sparkles size={12} />
                </div>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-serif tracking-tight leading-[1.1] mb-5 md:mb-6 text-yellow-400">
              Transforme sua <span className="italic block md:inline font-light text-white">leitura</span> em conexões reais.
            </h1>

            <p className="text-base md:text-xl font-medium opacity-80 mb-10 md:mb-14 max-w-md text-gray-300">
              O <strong className="font-black text-yellow-400">Nobel Conecta</strong> é a comunidade interativa da Livraria Nobel Petrópolis. Discuta livros, emita sua opinião e participe.
            </p>

            <div className="space-y-6 md:space-y-8">
              <div className="flex items-start gap-4 group">
                <div className="bg-white/5 transition-colors group-hover:bg-yellow-400/10 p-3 md:p-4 rounded-2xl shrink-0 border border-white/5">
                  <Users size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Clubes do Livro</h3>
                  <p className="text-gray-400 font-medium text-sm mt-1 leading-relaxed">Junte-se, divulgue ou crie seu próprio grupo de leitura focado nos seus gêneros favoritos.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="bg-white/5 transition-colors group-hover:bg-yellow-400/10 p-3 md:p-4 rounded-2xl shrink-0 border border-white/5">
                  <CalendarHeart size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Eventos Literários</h3>
                  <p className="text-gray-400 font-medium text-sm mt-1 leading-relaxed">Fique sabendo em primeira mão dos lançamentos, sessões de autógrafos e encontros.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="bg-white/5 transition-colors group-hover:bg-yellow-400/10 p-3 md:p-4 rounded-2xl shrink-0 border border-white/5">
                  <BookOpen size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Suas Leituras e Resenhas</h3>
                  <p className="text-gray-400 font-medium text-sm mt-1 leading-relaxed">Compartilhe o que você está lendo no momento, escreva resenhas e inspire toda a comunidade.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="bg-white/5 transition-colors group-hover:bg-yellow-400/10 p-3 md:p-4 rounded-2xl shrink-0 border border-white/5">
                  <Gift size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Resgate Prêmios</h3>
                  <p className="text-gray-400 font-medium text-sm mt-1 leading-relaxed">Interaja na comunidade, ganhe pontos e troque por cupons, brindes e livros novos.</p>
                </div>
              </div>
            </div>

            <div className="mt-10 md:hidden">
              <button
                type="button"
                onClick={() => document.getElementById('login-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-5 rounded-[2rem] shadow-xl transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                Acessar minha conta
              </button>
            </div>

            <div className="mt-10 md:mt-12 pt-8 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/40 font-black uppercase text-[10px] tracking-[0.2em] mb-4 md:mb-0">Nobel Petrópolis &copy; 2026</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - The Form */}
        <div id="login-form" className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-white relative">
          {success && (
            <div className="absolute inset-0 bg-yellow-400 z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
              <CheckCircle2 size={64} className="text-black mb-4 animate-bounce" />
              <h2 className="text-2xl font-black text-black font-serif">Bem-vindo(a)!</h2>
              <p className="text-black/60 font-bold uppercase text-[10px] tracking-widest mt-2">Carregando comunidade...</p>
            </div>
          )}

          <div className="max-w-md mx-auto w-full">
            <div className="mb-10 lg:hidden flex justify-center">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center -rotate-3">
                <BookOpen className="text-yellow-400" size={24} />
              </div>
            </div>

            <div className="mb-8 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                {isRecovering ? 'Recuperar Senha' : 'Entrar'}
              </h2>
              <p className="text-gray-400 mt-2 font-medium">
                {isRecovering 
                  ? 'Enviaremos um link de acesso para o seu e-mail.' 
                  : 'Bom te ver de novo! Acesse sua conta.'}
              </p>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-lg">
                {error}
              </div>
            )}

            {recoverySent ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">E-mail enviado!</h3>
                <p className="text-gray-500 mb-8 font-medium">Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
                <button
                  onClick={() => {
                    setIsRecovering(false);
                    setRecoverySent(false);
                  }}
                  className="text-black font-black hover:underline underline-offset-8 decoration-yellow-400 decoration-4"
                >
                  Voltar para o login
                </button>
              </div>
            ) : isRecovering ? (
              <form onSubmit={handleRecoverPassword} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">E-mail da Conta</label>
                  <input
                    required
                    type="email"
                    className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
                    placeholder="seu@email.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black hover:bg-gray-800 text-yellow-400 font-black py-5 md:py-6 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-3 mt-4 transform active:scale-95 uppercase tracking-widest text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Enviar Link de Recuperação'}
                </button>

                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => setIsRecovering(false)}
                    className="text-gray-400 font-bold hover:text-black transition-colors"
                  >
                    Cancelar e voltar
                  </button>
                </div>
              </form>
            ) : (
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
                  <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Senha</label>
                    <button
                      type="button"
                      onClick={() => setIsRecovering(true)}
                      className="text-[10px] font-black text-yellow-600 hover:text-black uppercase tracking-widest transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
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
                  className="w-full bg-black hover:bg-gray-800 text-yellow-400 font-black py-5 md:py-6 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-3 mt-4 transform active:scale-95 uppercase tracking-widest text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Entrar na Comunidade'}
                </button>
              </form>
            )}

            {!isRecovering && !recoverySent && (
              <div className="mt-10 pt-8 border-t border-gray-100 text-center text-sm md:text-base">
                <span className="text-gray-400">Ainda não faz parte? </span>
                <Link to="/register" className="text-black font-black hover:underline underline-offset-8 decoration-yellow-400 decoration-4 ml-1">
                  Criar conta gratuita
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
