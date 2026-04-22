import { useState, useEffect, ImgHTMLAttributes } from 'react';
import { extractDriveId, DEFAULT_PLACEHOLDER } from '../utils/imageUtils';

interface DriveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | undefined;
  fallback?: string;
}

/**
 * Smart Google Drive image component that tries multiple URL formats
 * automatically before falling back to placeholder.
 */
export default function DriveImage({ src, fallback = DEFAULT_PLACEHOLDER, alt = '', ...rest }: DriveImageProps) {
  const buildSources = (input: string | undefined): string[] => {
    if (!input) return [fallback];
    const id = extractDriveId(input);
    if (!id) {
      // Non-Drive URL — just use as-is + fallback
      return [input, fallback];
    }
    return [
      `https://lh3.googleusercontent.com/d/${id}=w2000`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      fallback,
    ];
  };

  const [sources, setSources] = useState<string[]>(() => buildSources(src));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setSources(buildSources(src));
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const currentSrc = sources[idx] || fallback;

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx < sources.length - 1) setIdx(idx + 1);
      }}
    />
  );
}
