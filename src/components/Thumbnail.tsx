import { useEffect, useState } from 'preact/hooks';
import { apiSignal } from '../store.ts';
import { db } from '../db.ts';

export function Thumbnail({ documentId }: { documentId: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchThumb = async () => {
      try {
        // Try local DB first
        const localDoc = await db.documents.get(documentId);
        if (localDoc?.thumbnailBlob) {
          if (active) setImgSrc(URL.createObjectURL(localDoc.thumbnailBlob));
          return;
        }

        const api = apiSignal.value;
        if (!api) return;
        
        const url = await api.getThumbnail(documentId);
        if (active) setImgSrc(url);
      } catch (err) {
        if (active) setError(true);
      }
    };
    fetchThumb();

    return () => {
      active = false;
      if (imgSrc) URL.revokeObjectURL(imgSrc); // cleanup memory
    };
  }, [documentId, apiSignal.value]);

  if (error || !imgSrc) {
    return (
      <div className="thumbnail-placeholder">
        <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
        </svg>
      </div>
    );
  }

  return <img src={imgSrc} alt={`Vorschau ${documentId}`} loading="lazy" className="document-thumbnail" />;
}
