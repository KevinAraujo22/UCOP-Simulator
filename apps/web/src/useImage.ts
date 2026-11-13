import { useEffect, useState } from 'react';

/** Carrega uma imagem para usar no Konva (null enquanto carrega ou se falhar). */
export function useImage(src: string | null | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let alive = true;
    const img = new window.Image();
    img.onload = () => alive && setImage(img);
    img.onerror = () => alive && setImage(null);
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return image;
}
