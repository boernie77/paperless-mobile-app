import { useEffect, useState, useRef } from 'preact/hooks';
import { apiSignal } from '../store.ts';

import * as pdfjsLib from 'pdfjs-dist';
// Vite specific import logic for worker
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentViewerProps {
  document: any;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Lade Dokument...');
  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  // Pinch state
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  // Pan state
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  // Prevent double-tap from firing right after a pinch release
  const wasPinchingRef = useRef(false);
  const lastTapRef = useRef(0);

  const getPinchDistance = (e: TouchEvent) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      wasPinchingRef.current = true;
      pinchRef.current = { distance: getPinchDistance(e), scale: zoomScale };
      panRef.current = null;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      panRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        originX: panX,
        originY: panY,
      };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const ratio = getPinchDistance(e) / pinchRef.current.distance;
      const next = Math.min(Math.max(pinchRef.current.scale * ratio, 0.75), 4);
      setZoomScale(next);
      if (next <= 1) { setPanX(0); setPanY(0); }
    } else if (e.touches.length === 1 && panRef.current && zoomScale > 1) {
      e.preventDefault();
      setPanX(panRef.current.originX + e.touches[0].clientX - panRef.current.startX);
      setPanY(panRef.current.originY + e.touches[0].clientY - panRef.current.startY);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) {
      panRef.current = null;
      // Double-tap: reset zoom & pan — but not when releasing a pinch
      if (!wasPinchingRef.current && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          setZoomScale(1);
          setPanX(0);
          setPanY(0);
        }
        lastTapRef.current = now;
      }
      // Suppress double-tap detection for a bit after pinch ends
      setTimeout(() => { wasPinchingRef.current = false; }, 400);
    }
  };

  useEffect(() => {
    let active = true;

    const renderPdf = async (blob: Blob) => {
      try {
        if (active) setStatus('Bereite Anzeige vor...');
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        if (!active) return;
        
        const container = containerRef.current;
        if (!container) return;
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (!active) break;
          // Status update (don't force standard states if showing the first page immediately is better, but this gives feedback)
          if (active && pageNum === 1) setStatus(`Lade Seite 1 von ${pdf.numPages}...`);
          
          const page = await pdf.getPage(pageNum);
          // Scale for mobile screens (higher density is clearer)
          const viewport = page.getViewport({ scale: 1.5 }); 
          
          const canvas = window.document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto'; // Maintain aspect ratio
          canvas.style.marginBottom = '1rem';
          canvas.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
          canvas.style.borderRadius = '4px';
          
          container.appendChild(canvas);
          
          const renderContext: any = {
            canvasContext: canvas.getContext('2d')!,
            viewport: viewport
          };
          
          // Render in background
          await page.render(renderContext).promise;
          
          // Hide loading completely after first page is ready
          if (pageNum === 1 && active) setLoading(false);
        }
      } catch (err) {
        console.error('PDF Render Error:', err);
        if (active) {
          setStatus('Fehler beim Anzeigen des PDFs innerhalb der App.');
          setLoading(false);
        }
      }
    };

    const loadDocument = async () => {
      const api = apiSignal.value;
      if (!api && !document.blob) {
        if (active) { setStatus('Keine Internetverbindung und nicht offline verfügbar.'); setLoading(false); }
        return;
      }

      try {
        const blob = document.blob || await api!.downloadDocument(document.id);
        
        if (blob.type === 'application/pdf' || document.title.toLowerCase().endsWith('.pdf')) {
          await renderPdf(blob);
        } else {
          // Image fallback handles regular non-pdf documents via <img> tag
          const url = URL.createObjectURL(blob);
          if (active) { setContentUrl(url); setLoading(false); }
        }
      } catch (err) {
        console.error("Failed to fetch document", err);
        if (active) { setStatus('Dokument konnte nicht geladen werden.'); setLoading(false); }
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (contentUrl) {
        URL.revokeObjectURL(contentUrl);
      }
    };
  }, [document.id, document.blob]);

  return (
    <div className="viewer-modal">
      <div className="viewer-header">
        <button className="header-button" onClick={onClose}>← Zurück</button>
        <span className="viewer-title">{document.title}</span>
      </div>
      <div
        className="viewer-content"
        style={{
          flexDirection: 'column',
          backgroundColor: '#f1f5f9',
          overflow: zoomScale > 1 ? 'hidden' : 'auto',
          padding: '1rem',
          alignItems: 'center',
          justifyContent: 'flex-start',
          touchAction: zoomScale > 1 ? 'none' : 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading && <div className="loading" style={{ margin: 'auto', color: 'var(--text-dim)' }}>{status}</div>}

        {/* PDF Container */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            maxWidth: '800px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
            transformOrigin: 'top center',
            willChange: 'transform',
          }}
        >
          {/* Canvases will be injected here */}
        </div>

        {/* Fallback Image viewer */}
        {!loading && contentUrl && (
          <img
            src={contentUrl}
            alt={document.title}
            style={{
              maxWidth: '100%',
              borderRadius: '4px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
              transformOrigin: 'top center',
              willChange: 'transform',
            }}
          />
        )}
      </div>
    </div>
  );
}
