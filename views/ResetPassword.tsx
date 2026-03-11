
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, KeyRound, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => navigate('/login'), 2000);
      }, 1500);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setError(err.message || 'Erro ao redefinir senha. O link pode ter expirado.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden">
        {success && (
          <div className="absolute inset-0 bg-yellow-400 z-50 flex flex-col items-center justify-center animate-in fade-in duration-500 text-center p-6">
            <CheckCircle2 size={64} className="text-black mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-black font-serif">Senha Alterada!</h2>
            <p className="text-black/70 font-bold uppercase text-[10px] tracking-widest mt-2">Sua senha foi atualizada com sucesso. Redirecionando para o login...</p>
          </div>
        )}

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-5 shadow-lg rotate-3">
            <ShieldCheck className="text-yellow-400" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight text-center">Nova Senha</h1>
          <p className="text-gray-400 mt-2 text-center font-medium">Escolha uma nova senha segura para sua conta.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nova Senha</label>
            <input 
              required
              type="password"
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="Mín. 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Senha</label>
            <input 
              required
              type="password"
              className="w-full px-5 py-4 bg-gray-50 text-black border border-gray-100 rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all font-bold placeholder:text-gray-300 caret-yellow-500"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-black hover:bg-gray-800 text-yellow-400 font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 mt-6 transform active:scale-95 uppercase tracking-widest text-sm"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><KeyRound size={20} /> Salvar Nova Senha</>}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <Link to="/login" className="text-gray-400 font-bold hover:text-black transition-colors">
            Voltar para o login
          </Link>
        </div>
      </div>

      <p className="mt-12 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em]">
        Livraria Nobel Petrópolis &bull; 2026
      </p>
    </div>
  );
};

export default ResetPassword;
