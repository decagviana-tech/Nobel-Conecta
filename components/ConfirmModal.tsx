
import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
    variant = 'danger'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-2xl ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                            <AlertCircle size={24} />
                        </div>
                        <button onClick={onCancel} className="text-gray-400 hover:text-black transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onConfirm}
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all ${variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-yellow-400 text-black hover:bg-yellow-500'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
