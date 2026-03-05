
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from './supabase';
import { Profile } from './types';
import Login from './views/Login';
import Register from './views/Register';
import Home from './views/Home';
import ProfileView from './views/ProfileView';
import Shop from './views/Shop';
import Events from './views/Events';
import CreativeSpace from './views/CreativeSpace';
import BookClubs from './views/BookClubs';
import ClubDetail from './views/ClubDetail';
import MessagesView from './views/MessagesView';
import GiveawaysView from './views/GiveawaysView';
import RewardsView from './views/RewardsView';
import AdminDashboard from './views/AdminDashboard';
import Navbar from './components/Navbar';
import LoadingOverlay from './components/LoadingOverlay';
import { motion, AnimatePresence } from 'motion/react';
import { useAdmin } from './src/hooks/useAdmin';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = React.useRef(true);

  const isAdmin = useAdmin(profile);

  useEffect(() => {
    isMounted.current = true;
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    const checkSession = async () => {
      try {
        if (!isSupabaseConfigured) {
          const savedDemoUser = localStorage.getItem('nobel_demo_session');
          if (savedDemoUser && isMounted.current) {
            const user = JSON.parse(savedDemoUser);
            setSession({ user: { id: user.id } });
            setProfile(user);
          }
          if (isMounted.current) setLoading(false);
          return;
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (isMounted.current) {
          setSession(currentSession);
          if (currentSession) {
            fetchProfile(currentSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
        if (isMounted.current) setLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;
      setSession(currentSession);
      if (currentSession) {
        fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const handleProfileUpdate = (event: any) => {
      if (isMounted.current) {
        setProfile(prev => prev ? { ...prev, ...event.detail } : null);
      }
    };

    window.addEventListener('nobel_profile_updated', handleProfileUpdate);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
      window.removeEventListener('nobel_profile_updated', handleProfileUpdate);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn("Perfil não encontrado, tentando criar automaticamente...");

        // Tenta recuperar dados do metadata do usuário (caso tenha vindo do registro)
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted.current) {
          const metadata = user.user_metadata;
          const newProfile = {
            id: user.id,
            full_name: metadata?.full_name || user.email?.split('@')[0] || 'Novo Leitor',
            username: metadata?.username || user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'leitor' + Math.random().toString(36).substr(2, 4),
            role: (user.email === 'nobel.petropolis@gmail.com' || user.email === 'decagviana@gmail.com' || user.email === 'nobelpetro@gmail.com') ? 'admin' : 'user',
            points: 0
          };

          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .single();

          if (!createError && isMounted.current) {
            setProfile(createdProfile);
          } else {
            console.error("Erro ao criar perfil automático:", createError);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error("Erro ao buscar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nobel_demo_session');
    if (isSupabaseConfigured) {
      supabase.auth.signOut();
    }
    setSession(null);
    setProfile(null);
    setLoading(false); // Importante: para a tela de carregamento
    window.location.href = '#/login';
  };

  if (loading) return <LoadingOverlay onReset={handleLogout} />;

  const isDemo = !isSupabaseConfigured;

  return (
    <HashRouter>
      <div className="min-h-screen bg-white">
        {isDemo && (
          <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black text-[10px] font-black uppercase h-12 z-[10002] tracking-[0.1em] shadow-md flex flex-col items-center justify-center border-b-2 border-black/10 px-4 text-center leading-tight">
            <div className="flex items-center gap-2">
              <span className="animate-pulse text-red-600 font-serif text-lg">●</span>
              MODO DE DEMONSTRAÇÃO: DADOS SALVOS APENAS NESTE DISPOSITIVO
            </div>
            <div className="text-[8px] opacity-70 normal-case font-bold">
              Conecte o Supabase para sincronizar entre celular e computador.
            </div>
          </div>
        )}

        {session && <Navbar profile={profile} onLogout={handleLogout} isDemo={isDemo} />}

        <main className={`transition-all ${session ? 'pt-16 md:pt-0 pb-24 md:pb-8 md:pl-[240px]' : ''} ${isDemo && session ? 'pt-[6.5rem] md:pt-10' : ''}`}>
          <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={session ? 'authenticated' : 'anonymous'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Routes>
                  <Route path="/" element={session ? <Home profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/login" element={!session ? <Login setSession={setSession} setProfile={setProfile} /> : <Navigate to="/" />} />
                  <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
                  <Route path="/profile/:id" element={session ? <ProfileView currentUserId={session?.user?.id} currentProfile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/shop" element={session ? <Shop profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/events" element={session ? <Events profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/creative" element={session ? <CreativeSpace profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/clubs" element={session ? <BookClubs profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/clubs/:id" element={session ? <ClubDetail profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/messages" element={session ? <MessagesView profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/messages/:contactId" element={session ? <MessagesView profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/giveaways" element={session ? <GiveawaysView profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/rewards" element={session ? <RewardsView profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="/admin" element={session ? <AdminDashboard profile={profile} /> : <Navigate to="/login" />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
