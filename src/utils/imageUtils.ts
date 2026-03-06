export async function toProxyBase64(url: string): Promise<string> {
    if (!url) return '';
    // Se já for base64 ou formato local, retorna direto
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
        return url;
    }

    try {
        const response = await fetch(url, { mode: 'cors' });
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
        // Se falhar o proxy, retorna a URL original pra não quebrar a página toda, 
        // embora o toPng vá reclamar depois.
        return url;
    }
}
