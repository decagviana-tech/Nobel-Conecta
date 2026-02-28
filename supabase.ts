
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''; 
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isPlaceHolder = (val: string) => !val || val.includes('sua-url') || val.includes('sua-chave') || val.includes('your-project') || val === 'your-anon-key';

export const isSupabaseConfigured = !isPlaceHolder(SUPABASE_URL) && !isPlaceHolder(SUPABASE_KEY);

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://vazio.supabase.co', 
  isSupabaseConfigured ? SUPABASE_KEY : 'mock-key'
);

export async function uploadFile(bucket: string, file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    // No modo demo, transformamos a imagem em Base64 para que ela possa ser salva no localStorage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  try {
    const { error: uploadError, data } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        console.error(`ERRO: O bucket "${bucket}" não foi encontrado no Supabase Storage. Certifique-se de criá-lo no painel do Supabase ou rodar o script SQL de criação.`);
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.error('Erro no upload real:', err);
    // Fallback para Base64 se o upload real falhar
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}
