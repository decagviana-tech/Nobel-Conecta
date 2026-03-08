import imageCompression from 'browser-image-compression';

/**
 * Comprime uma imagem antes de fazer o upload para o Supabase.
 * Isso economiza Storage e Bandwidth.
 */
export async function compressImage(file: File, maxSizeMB: number = 0.5, maxWidthOrHeight: number = 1920): Promise<File> {
    const options = {
        maxSizeMB: maxSizeMB,
        maxWidthOrHeight: maxWidthOrHeight,
        useWebWorker: false, // Disabled Web Worker for better stability on WebViews/Mobile
    };

    try {
        const compressedFile = await imageCompression(file, options);
        // Ensure the returned object is a File with a name, some devices return a Blob without a name
        return new File([compressedFile], file.name || 'image.jpg', {
            type: compressedFile.type || 'image/jpeg',
            lastModified: Date.now()
        });
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
