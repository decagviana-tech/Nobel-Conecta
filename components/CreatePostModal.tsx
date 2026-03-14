
import React, { useState, useRef } from 'react';
import { X, Camera, Star, Loader2, PenTool, BookOpen } from 'lucide-react';
import { supabase, uploadFile, isSupabaseConfigured } from '../supabase';
import { awardPoints } from '../src/services/pointsService';
import { Post, Profile } from '../types';
import { compressImage } from '../src/utils/imageUtils';

interface CreatePostModalProps {
  userId: string;
  currentProfile: Profile;
  onClose: () => void;
  onSuccess: (newPost?: Post) => void;
  postType?: 'review' | 'creative';
  editingPost?: Post;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ userId, currentProfile, onClose, onSuccess, postType = 'review', editingPost }) => {
  const [loading, setLoading] = useState(false);
  const [bookTitle, setBookTitle] = useState(editingPost?.book_title || '');
  const [bookAuthor, setBookAuthor] = useState(editingPost?.book_author || '');
  const [creativeTitle, setCreativeTitle] = useState(editingPost?.title || '');
  const [content, setContent] = useState(editingPost?.content || '');
  const [rating, setRating] = useState(editingPost?.rating || 5);
  const [images, setImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCreative = postType === 'creative';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      // Removido o filtro rígido de 5MB para permitir que fotos de celulares modernos 
      // entrem no fluxo e sejam comprimidas no handleSubmit.
      setImages(prev => [...prev, ...selected].slice(0, 3));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    if (!isCreative && (!bookTitle || !bookAuthor)) return;

    setLoading(true);

    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        try {
          // Compressão aplicada nas imagens da timeline/resenhas
          const compressedFile = await compressImage(file, 0.4, 1000);
          const url = await uploadFile('posts', compressedFile);
          imageUrls.push(url);
        } catch (uploadErr) {
          console.error('Error uploading post image:', uploadErr);
        }
      }

      const postData: any = {
        user_id: userId,
        content: content,
        type: postType
      };

      if (!editingPost) {
        postData.created_at = new Date().toISOString();
      }

      if (imageUrls.length > 0) {
        postData.images = editingPost?.images ? [...editingPost.images, ...imageUrls] : imageUrls;
      } else if (editingPost?.images) {
        postData.images = editingPost.images;
      } else {
        postData.images = [];
      }

      if (isCreative) {
        postData.title = creativeTitle || 'Texto sem título';
      } else {
        postData.book_title = bookTitle;
        postData.book_author = bookAuthor;
        postData.rating = rating;
      }

      if (!isSupabaseConfigured) {
        setTimeout(() => {
          onSuccess({
            ...postData,
            id: editingPost?.id || Math.random().toString(36).substr(2, 9),
            likes_count: editingPost?.likes_count || 0,
            comments_count: editingPost?.comments_count || 0,
            user_has_liked: editingPost?.user_has_liked || false,
            author: currentProfile,
          });
          setLoading(false);
        }, 800);
        return;
      }

      if (editingPost) {
        const { error } = await supabase.from('posts').update(postData).eq('id', editingPost.id);
        if (error) {
          console.error('Supabase update error:', error);
          throw new Error(`Erro ao atualizar no banco: ${error.message}`);
        }
      } else {
        const { error } = await supabase.from('posts').insert(postData);
        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(`Erro ao salvar no banco: ${error.message}`);
        }

        // Ganho de pontos (apenas na criação)
        try {
          const actionType = postType === 'creative' ? 'creative' : 'review';
          await awardPoints(userId, actionType, currentProfile);
          const label = postType === 'creative' ? 'seu texto autoral' : 'sua resenha';
          alert(`Parabéns! Você ganhou +10 pontos Nobel por ${label}.`);
        } catch (pointsErr) {
          console.warn('Erro ao atualizar pontos:', pointsErr);
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Submit error:', err);
      alert(err.message || 'Erro ao postar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="p-8 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg ${isCreative ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black shadow-yellow-400/20'}`}>
              {isCreative ? <PenTool size={24} /> : <BookOpen size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-serif">
                {isCreative ? (editingPost ? 'Editar Mural' : 'Mural Literário') : (editingPost ? 'Editar Resenha' : 'Nova Resenha')}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Incentive a leitura</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black p-3 bg-gray-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 md:p-10 space-y-8 bg-white">
          {isCreative ? (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Título da sua obra</label>
              <input
                className="w-full px-6 py-5 bg-white text-black border border-gray-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-black transition-all font-serif italic text-xl placeholder:text-gray-300 focus:bg-white"
                placeholder="Ex: Noites na Rua 16..."
                value={creativeTitle}
                onChange={(e) => setCreativeTitle(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Título do Livro</label>
                <input
                  required
                  className="w-full px-6 py-5 bg-white text-black border border-gray-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-bold placeholder:text-gray-300 focus:bg-white"
                  placeholder="Nome do livro que você leu"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Autor</label>
                <input
                  required
                  className="w-full px-6 py-5 bg-white text-black border border-gray-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-bold placeholder:text-gray-300 focus:bg-white"
                  placeholder="Quem escreveu?"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Sua Avaliação</label>
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setRating(star)} className="hover:scale-110 transition-transform">
                      <Star size={36} fill={star <= rating ? "#EAB308" : "none"} className={star <= rating ? "text-yellow-500" : "text-gray-200"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">
              {isCreative ? 'Seu Texto' : 'Sua Resenha'}
            </label>
            <textarea
              required
              rows={isCreative ? 10 : 5}
              className="w-full px-6 py-5 bg-white text-black border border-gray-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-yellow-400 resize-none font-medium leading-relaxed placeholder:text-gray-300 transition-all focus:bg-white"
              placeholder={isCreative ? "Inspire-se..." : "O que você achou desta obra?"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {!isCreative && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 ml-1 text-center md:text-left">Fotos do seu livro</label>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-[1.5rem] flex flex-col items-center justify-center text-gray-400 hover:text-yellow-500 hover:border-yellow-400 transition-all bg-white"
                  disabled={images.length >= 3}
                >
                  <Camera size={28} />
                  <span className="text-[8px] font-black uppercase mt-2">Adicionar</span>
                </button>
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-[1.5rem] overflow-hidden border-2 border-white shadow-md">
                    <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
            </div>
          )}
        </form>

        <div className="p-8 bg-gray-50 border-t flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-6 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs font-black transition-all hover:scale-[1.02] active:scale-95 ${isCreative ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'}`}
          >
            {loading ? <Loader2 className="animate-spin" /> : (isCreative ? (editingPost ? 'Salvar Edição' : 'Publicar no Mural') : (editingPost ? 'Salvar Edição' : 'Publicar Resenha'))}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
