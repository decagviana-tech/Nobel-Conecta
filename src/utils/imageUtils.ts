import imageCompression from 'browser-image-compression';

/**
 * Comprime uma imagem antes de fazer o upload para o Supabase.
 * Isso economiza Storage e Bandwidth.
 */
export async function compressImage(file: File, maxSizeMB: number = 0.5, maxWidthOrHeight: number = 1920): Promise<File> {
    // Se o arquivo for muito pequeno (menos que o alvo), não precisa comprimir
    if (file.size < maxSizeMB * 1024 * 1024) {
        return file;
    }

    const options = {
        maxSizeMB: maxSizeMB,
        maxWidthOrHeight: maxWidthOrHeight,
        useWebWorker: false, // Disabled Web Worker for better stability on WebViews/Mobile
    };

    try {
        console.log(`Comprimindo imagem: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        const compressedBlob = await imageCompression(file, options);
        
        // Ensure the returned object is a File with a name, some devices return a Blob without a name
        const compressedFile = new File([compressedBlob], file.name || 'image.jpg', {
            type: compressedBlob.type || 'image/jpeg',
            lastModified: Date.now()
        });
        
        console.log(`Imagem comprimida com sucesso: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        return compressedFile;
    } catch (error) {
        console.warn('Erro ao comprimir imagem, retornando original:', error);
        return file;
    }
}

export async function toProxyBase64(url: string): Promise<string> {
    if (!url) return '';
    // Se já for base64 ou formato local, retorna direto
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
        return url;
    }

    try {
        // Cache bust query para forçar o browser a ignorar cache sem CORS
        const separator = url.includes('?') ? '&' : '?';
        const bustUrl = `${url}${separator}cb=${new Date().getTime()}`;

        const response = await fetch(bustUrl, { mode: 'cors', cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`Failed to proxy image ${url}:`, error);
        // Fallback: pixel transparente 1x1. Impede que a lib de print tente baixar a imagem externa e acuse erro de CORS (tainted canvas)
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
}

/**
 * Verifica se um avatar_url é válido (ou seja, não é um placeholder indesejado).
 */
export function isValidAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  
  // Lista de IDs de fotos do Unsplash que são comumente usadas como placeholders genéricos
  const forbiddenIds = [
    '1494790108377', // A foto da mulher que o usuário mencionou
    '1535713875002', // Homem (comum)
    '1438761681033', // Mulher (comum)
    '1570295999233'  // Outro comum
  ];

  const lowerUrl = url.toLowerCase();
  
  // Se for da Dicebear ou UI Avatars, consideramos válido para o fallback do sistema,
  // mas se o usuário quer "coloque sua foto aqui", talvez queiramos ignorar até esses?
  // O usuário disse: "quando o usuário não coloca uma foto pessoal continua aparecendo"
  // Então se a URL for da Dicebear/UI-Avatars e o usuário não a "escolheu", pode ser um problema.
  
  return !forbiddenIds.some(id => lowerUrl.includes(id));
}
