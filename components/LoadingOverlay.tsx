
import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCcw } from 'lucide-react';

interface LoadingOverlayProps {
  onReset?: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ onReset }) => {
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowReset(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[200]">
      <div className="relative">
        <div className="p-8 bg-gray-900 rounded-[2.5rem] shadow-[0_0_50px_rgba(234,179,8,0.2)] border border-gray-800 animate-pulse">
           <BookOpen className="text-yellow-400" size={80} />
        </div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-64 text-center">
          <p className="text-yellow-400 font-serif italic text-lg tracking-tight">Folheando as páginas...</p>
          <div className="mt-4 flex justify-center gap-1">
             <div className="w-1.5 h-1.5 bg-yellow-400/20 rounded-full animate-bounce delay-75"></div>
             <div className="w-1.5 h-1.5 bg-yellow-400/50 rounded-full animate-bounce delay-150"></div>
             <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce delay-300"></div>
          </div>
        </div>
      </div>

      {showReset && onReset && (
        <button 
          onClick={onReset}
          className="mt-32 flex items-center gap-2 text-gray-500 hover:text-yellow-400 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <RefreshCcw size={14} />
          Demorando muito? Clique para resetar
        </button>
      )}
    </div>
  );
};

export default LoadingOverlay;
