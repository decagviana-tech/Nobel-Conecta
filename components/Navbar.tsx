
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, LogOut, BookOpen, ShoppingBag, Calendar, PenTool, Users, ArrowRight, Shield, MessageCircle, Gift, Bell, Ticket } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { Profile } from '../types';

interface NavbarProps {
  profile: Profile | null;
  onLogout: () => void;
  isDemo?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ profile, onLogout, isDemo }) => {
  const location = useLocation();
  const isAdmin = profile?.role === 'admin' || 
                  profile?.username === 'nobel_oficial' || 
                  profile?.username === 'nobelpetro';

  const MobileNavLink = ({ to, icon: Icon, label }: any) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center transition-all group flex-1 ${
          isActive ? 'text-black' : 'text-gray-400'
        }`}
      >
        <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-yellow-400 shadow-md' : ''}`}>
          <Icon size={20} strokeWidth={isActive ? 3 : 2} className={isActive ? 'text-black' : 'text-gray-400'} />
        </div>
        <span className={`text-[9px] mt-1 font-black uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      </Link>
    );
  };

  const DesktopNavLink = ({ to, icon: Icon, label }: any) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group mb-1 border-2 ${
          isActive ? 'bg-black text-yellow-400 border-black shadow-lg' : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-black'
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className={`font-black uppercase tracking-widest text-[9px] ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
          {label}
        </span>
        {isActive && <ArrowRight size={14} className="ml-auto animate-pulse" />}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-gray-100 z-[10000] flex items-center justify-center px-6 shadow-sm">
        <div className="absolute left-6">
          <Link to="/" className="bg-black p-2 rounded-xl shadow-sm block">
            <BookOpen className="text-yellow-400" size={18} />
          </Link>
        </div>
        
        <Link to="/" className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter font-serif leading-none">
            Nobel
          </h1>
          <span className="text-yellow-500 italic font-serif text-sm">Conecta</span>
        </Link>

        <div className="absolute right-6">
          <NotificationBell profile={profile} />
        </div>
      </div>

      {/* Desktop Sidebar (Fica na esquerda) */}
      <nav className={`hidden md:flex fixed left-0 ${isDemo ? 'top-10' : 'top-0'} bottom-0 w-[240px] bg-white border-r border-gray-100 z-[10000] flex-col shadow-[10px_0_30px_rgba(0,0,0,0.02)]`}>
        {/* Header Fixo */}
        <div className="p-8 pb-4 flex flex-col items-center">
          <Link to="/" className="flex flex-col items-center gap-3 group">
            <div className="bg-black p-4 rounded-2xl group-hover:rotate-6 transition-transform shadow-xl">
              <BookOpen className="text-yellow-400" size={36} />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter font-serif leading-none">
                Nobel
              </h1>
              <p className="text-yellow-500 italic font-serif text-lg">Conecta</p>
            </div>
          </Link>
          <div className="h-1 w-16 bg-gray-100 rounded-full mt-6" />
        </div>
        
        {/* Menu Rolável */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.3em] mb-2 ml-3">Menu Principal</p>
            <DesktopNavLink to="/" icon={Home} label="Início" />
            <DesktopNavLink to="/clubs" icon={Users} label="Clubes Literários" />
            <DesktopNavLink to="/creative" icon={PenTool} label="Mural de Escrita" />
            <DesktopNavLink to="/shop" icon={ShoppingBag} label="Vitrine Nobel" />
            <DesktopNavLink to="/events" icon={Calendar} label="Agenda Cultural" />
            <DesktopNavLink to="/messages" icon={MessageCircle} label="Mensagens" />
            <DesktopNavLink to="/giveaways" icon={Gift} label="Sorteios" />
            <DesktopNavLink to="/rewards" icon={Ticket} label="Resgate de Pontos" />
            
            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.3em] mb-2 ml-3">Administração</p>
                <DesktopNavLink to="/admin" icon={Shield} label="Painel Admin" />
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.3em] mb-2 ml-3">Pessoal</p>
              <DesktopNavLink to={`/profile/${profile?.id}`} icon={User} label="Minha Estante" />
            </div>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="p-3 bg-white border-t border-gray-50">
          <div className="flex items-center justify-between mb-3 px-1">
             <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.3em]">Alertas</p>
             <NotificationBell profile={profile} />
          </div>
          <div className="flex items-center gap-2.5 mb-2 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0">
               {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User size={16} className="text-gray-300" />}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-black text-[9px] text-gray-900 truncate">@{profile?.username || 'leitor'}</p>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-green-500"></div>
                <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">Online</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout} 
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all font-black uppercase tracking-[0.2em] text-[7px]"
          >
            <LogOut size={12} />
            Sair da Conta
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav (Continua embaixo no celular por usabilidade) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[10000] flex justify-around items-center h-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] px-1 pb-2 backdrop-blur-md bg-white/95">
        <MobileNavLink to="/" icon={Home} label="Início" />
        <MobileNavLink to="/clubs" icon={Users} label="Clubes" />
        <MobileNavLink to="/events" icon={Calendar} label="Agenda" />
        <MobileNavLink to="/messages" icon={MessageCircle} label="Chat" />
        <MobileNavLink to="/giveaways" icon={Gift} label="Prêmios" />
        <MobileNavLink to="/rewards" icon={Ticket} label="Pontos" />
        {isAdmin && <MobileNavLink to="/admin" icon={Shield} label="Admin" />}
        <MobileNavLink to={`/profile/${profile?.id}`} icon={User} label="Perfil" />
      </nav>
    </>
  );
};

export default Navbar;
