
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

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    const checkSession = async () => {
      try {
        if (!isSupabaseConfigured) {
          const savedDemoUser = localStorage.getItem('nobel_demo_session');
          if (savedDemoUser && mounted) {
            const user = JSON.parse(savedDemoUser);
            setSession({ user: { id: user.id } });
            setProfile(user);
          }
          if (mounted) setLoading(false);
          return;
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(currentSession);
          if (currentSession) {
            fetchProfile(currentSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
        if (mounted) setLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      if (currentSession) {
        fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
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
        console.warn("Perfil não encontrado, pode ter sido deletado.");
        // Se o usuário existe no Auth mas não no Profiles, algo está errado.
        // Não resetamos tudo imediatamente para dar chance ao usuário de criar o perfil,
        // mas paramos o loading.
        setLoading(false);
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
          <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black text-[10px] font-black uppercase h-10 z-[10002] tracking-[0.1em] shadow-md flex items-center justify-center gap-3 border-b-2 border-black/10">
            <span className="animate-pulse text-red-600 font-serif text-lg">●</span> 
            MODO DE DEMONSTRAÇÃO: NOBEL CONECTA PETRÓPOLIS
          </div>
        )}
        
        {session && <Navbar profile={profile} onLogout={handleLogout} isDemo={isDemo} />}
        
        <main className={`transition-all ${session ? 'pt-16 md:pt-0 pb-24 md:pb-8 md:pl-[240px]' : ''} ${isDemo && session ? 'pt-[6.5rem] md:pt-10' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
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
                  <Route path="/profile/:id" element={session ? <ProfileView currentUserId={session?.user?.id} /> : <Navigate to="/login" />} />
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
