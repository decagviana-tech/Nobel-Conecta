import { supabase, isSupabaseConfigured } from '../../supabase';

interface LogOptions {
  userId?: string;
  action: string;
  errorObj?: any;
  metadata?: Record<string, any>;
}

export const logError = async ({ userId, action, errorObj, metadata }: LogOptions) => {
  // Para ambiente de desenvolvimento ou sem supabase com logs no console
  if (!isSupabaseConfigured) {
    console.group(`[ERROR LOG]: ${action}`);
    console.error(errorObj);
    if(metadata) console.info('Metadata:', metadata);
    console.groupEnd();
    return;
  }

  try {
    // Formata o erro para String para não quebrar a tabela do banco
    const errorMessage = errorObj instanceof Error 
      ? errorObj.message 
      : typeof errorObj === 'string' 
        ? errorObj 
        : JSON.stringify(errorObj);

    // Envia o registro do erro silenciosamente para os administradores
    await supabase.from('app_logs').insert({
      user_id: userId || null,
      action: action,
      error_message: errorMessage,
      metadata: metadata || {}
    });
  } catch (err) {
    // Isso é um Fallback de extrema segurança; se o próprio envio de erro falhar, ele apenas loga no navegador
    console.error('Falha grave: O próprio logger falhou ao reportar no Supabase.', err);
  }
};
