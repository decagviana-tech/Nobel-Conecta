
import React, { useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Gift, MessageCircle, Star, Info, X, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { AppNotification, Profile } from '../types';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationBellProps {
  profile: Profile | null;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ profile }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      fetchNotifications();

      // Request permission only if not already determined
      if ('Notification' in window && window.Notification.permission === 'default') {
        requestNotificationPermission();
      }

      if (isSupabaseConfigured) {
        const channel = supabase
          .channel(`notifications:${profile.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`
          }, () => {
            fetchNotifications();
          })
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Permissão de notificação concedida!');
      }
    }
  };

  const fetchNotifications = async () => {
    if (!profile || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      // Filter out notifications that were recently deleted locally
      let filteredData = data.filter(n => !deletedIds.has(n.id));

      // Strict deduplication by ID just in case Supabase sends duplicates in rapid succession
      const uniqueMap = new Map();
      filteredData.forEach(notif => {
        if (!uniqueMap.has(notif.id)) {
          uniqueMap.set(notif.id, notif);
        }
      });
      filteredData = Array.from(uniqueMap.values());

      setNotifications(filteredData);
      setUnreadCount(filteredData.filter(n => !n.read).length);
    }
  };

  const markAsRead = async (id: string) => {
    if (!isSupabaseConfigured) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) {
      console.error('Erro ao marcar como lida:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!profile || !isSupabaseConfigured) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    if (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    if (!isSupabaseConfigured) return;

    // Add to deleted tracking to prevent reappearing
    setDeletedIds(prev => new Set(prev).add(id));

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir notificação:', error);
      // Remove from deleted tracking if it failed
      setDeletedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchNotifications();
    } else {
      // Recalculate unread count
      setNotifications(current => {
        const filtered = current.filter(n => n.id !== id);
        setUnreadCount(filtered.filter(n => !n.read).length);
        return filtered;
      });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle size={14} className="text-blue-500" />;
      case 'comment': return <MessageSquare size={14} className="text-green-500" />;
      case 'giveaway': return <Gift size={14} className="text-yellow-500" />;
      case 'like': return <Star size={14} className="text-red-500" fill="currentColor" />;
      default: return <Info size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group"
      >
        <Bell size={22} className={unreadCount > 0 ? 'text-yellow-600 animate-swing' : 'text-gray-400'} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 md:right-auto md:left-0 mt-3 w-80 md:w-96 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-[20000] overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right md:origin-top-left">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-black text-xs uppercase tracking-widest text-gray-900">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[9px] font-black text-yellow-600 uppercase tracking-widest hover:underline"
              >
                Ler todas
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-50 flex gap-4 transition-colors relative group ${notif.read ? 'opacity-60' : 'bg-yellow-50/30'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`text-xs leading-tight ${notif.read ? 'text-gray-500' : 'text-black font-black'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                          className="p-1.5 hover:bg-yellow-100 rounded-lg text-yellow-600 relative z-10 transition-colors"
                          title="Marcar como lida"
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 relative z-10 transition-colors"
                        title="Excluir notificação"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{notif.content}</p>
                    <p className="text-[8px] text-gray-300 font-bold uppercase mt-2">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {notif.link && (
                    <Link
                      to={notif.link}
                      onClick={() => {
                        setIsOpen(false);
                        markAsRead(notif.id);
                      }}
                      className="absolute inset-0 z-0"
                    />
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Bell className="mx-auto text-gray-100 mb-4" size={40} />
                <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Tudo limpo por aqui</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50/50 text-center">
            <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Fique por dentro das novidades</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
