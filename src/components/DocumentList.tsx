import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { apiSignal, filterSignal } from '../store.ts';
import { db } from '../db.ts';
import { Thumbnail } from './Thumbnail.tsx';
import { DocumentViewer } from './DocumentViewer.tsx';

interface DocumentListProps {
  inboxOnly?: boolean;
}

export function DocumentList({ inboxOnly = false }: DocumentListProps) {
  const [docs, setDocs] = useState<any[]>([]);
  const [meta, setMeta] = useState({ tags: {}, correspondents: {}, documentTypes: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('-created');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);

  const tags = (meta.tags as any);
  const correspondents = (meta.correspondents as any);

  // Metadata Fetching
  useEffect(() => {
    const fetchMetadata = async () => {
      const api = apiSignal.value;
      try {
        if (api) {
          const [tagRes, corrRes, typeRes] = await Promise.all([
            api.getTags(),
            api.getCorrespondents(),
            api.getDocumentTypes()
          ]);
          
          const tagMap: Record<number, string> = {};
          tagRes.results.forEach((t: any) => tagMap[t.id] = t.name);

          const corrMap: Record<number, string> = {};
          corrRes.results.forEach((c: any) => corrMap[c.id] = c.name);

          const typeMap: Record<number, string> = {};
          typeRes.results.forEach((t: any) => typeMap[t.id] = t.name);

          setMeta({ tags: tagMap, correspondents: corrMap, documentTypes: typeMap });
          
          await Promise.all([
            db.tags.bulkPut(tagRes.results),
            db.correspondents.bulkPut(corrRes.results),
            db.documentTypes.bulkPut(typeRes.results)
          ]);
        } else {
          const [offlineTags, offlineCorr, offlineTypes] = await Promise.all([
            db.tags.toArray(),
            db.correspondents.toArray(),
            db.documentTypes.toArray()
          ]);

          const tagMap: Record<number, string> = {};
          offlineTags.forEach((t: any) => tagMap[t.id] = t.name);

          const corrMap: Record<number, string> = {};
          offlineCorr.forEach((c: any) => corrMap[c.id] = c.name);

          const typeMap: Record<number, string> = {};
          offlineTypes.forEach((t: any) => typeMap[t.id] = t.name);

          setMeta({ tags: tagMap, correspondents: corrMap, documentTypes: typeMap });
        }
      } catch (err) {
        console.error('Metadata fetch failed', err);
      }
    };
    fetchMetadata();
    
    const checkSettings = async () => {
      const setting = await db.settings.get('auto_download');
      setAutoDownload(!!setting?.value);
    };
    checkSettings();
  }, [apiSignal.value]);

  // Main Document fetching
  useEffect(() => {
    const filters = filterSignal.value;
    
    const applyLocalFilters = (items: any[]) => {
      let resultItems = [...items];
      if (filters.correspondent__id) {
        resultItems = resultItems.filter(d => d.correspondent === filters.correspondent__id);
      }
      if (filters.document_type__id) {
        resultItems = resultItems.filter(d => d.document_type === filters.document_type__id);
      }
      if (filters.tags__id__all) {
        resultItems = resultItems.filter(d => d.tags?.includes(filters.tags__id__all));
      }
      if (filters.created__date__gte) {
        const from = new Date(filters.created__date__gte).getTime();
        resultItems = resultItems.filter(d => d.created && new Date(d.created).getTime() >= from);
      }
      if (filters.created__date__lte) {
        const to = new Date(filters.created__date__lte).getTime();
        resultItems = resultItems.filter(d => d.created && new Date(d.created).getTime() <= to);
      }
      return resultItems;
    };

    const fetchData = async () => {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      const api = apiSignal.value;
      
      if (!api) {
        try {
          // Offline Mode with Pagination
          const PAGE_SIZE = 25;
          let allOffline = await db.documents.where('is_offline').equals(1).toArray();
          allOffline = applyLocalFilters(allOffline);
          
          allOffline.sort((a,b) => {
            if (ordering === '-created') return new Date(b.created).getTime() - new Date(a.created).getTime();
            if (ordering === 'created') return new Date(a.created).getTime() - new Date(b.created).getTime();
            return 0;
          });

          const totalResults = allOffline.length;
          const paginatedDocs = allOffline.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

          if (page === 1) setDocs(paginatedDocs);
          else setDocs(prev => [...prev, ...paginatedDocs]);
          
          setHasMore(totalResults > page * PAGE_SIZE);
          setError(null);
        } catch (e) {
          setError('Offline-Modus: Fehler beim Laden');
        } finally {
          setLoading(false);
          setIsLoadingMore(false);
        }
        return;
      }
      
      try {
        const params: Record<string, string> = {
          page: String(page),
          ordering: ordering
        };
        
        Object.entries(filters).forEach(([k, v]) => {
           if (v !== undefined && v !== null && v !== '') params[k] = String(v);
        });
        
        if (inboxOnly && Object.keys(filters).length === 0) {
           const inboxTagId = Object.keys(meta.tags).find(k => 
              (meta.tags as any)[parseInt(k)]?.toLowerCase().includes('inbox') || 
              (meta.tags as any)[parseInt(k)]?.toLowerCase().includes('posteingang')
           );
           if (inboxTagId) params.tags__id__all = inboxTagId;
           else params.tags__name__iexact = 'inbox';
        }
        
        const result = await api.getDocuments(params);
        const newDocs = result.results;
        
        // Enrich with local offline data
        const localOfflineDocs = await db.documents.where('id').anyOf(newDocs.map((d: any) => d.id)).toArray();
        const enrichedDocs = newDocs.map((d: any) => {
          const offline = localOfflineDocs.find(od => od.id === d.id);
          return { ...d, blob: offline?.blob, thumbnailBlob: offline?.thumbnailBlob, is_offline: offline?.is_offline || (offline?.blob ? 1 : 0) };
        });
        
        const finalDocs = applyLocalFilters(enrichedDocs);
        if (page === 1) setDocs(finalDocs);
        else setDocs(prev => [...prev, ...finalDocs]);
        
        setHasMore(!!result.next);
        setError(null);

        if (autoDownload) {
          for (const doc of finalDocs) {
            if (!doc.is_offline) {
              Promise.all([
                api.downloadDocument(doc.id),
                api.getThumbnailBlob(doc.id)
              ]).then(async ([blob, thumbnailBlob]) => {
                await db.documents.put({ ...doc, blob, thumbnailBlob, is_offline: 1 });
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (page === 1) {
          try {
            const offlineDocs = await db.documents.where('is_offline').equals(1).toArray();
            if (offlineDocs.length > 0) {
              setDocs(applyLocalFilters(offlineDocs));
              setHasMore(false);
              setError(null);
              setLoading(false);
              setIsLoadingMore(false);
              return;
            }
          } catch (dbErr) { }
        }
        setError('Fehler beim Laden (Offline?)');
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };
    
    fetchData();
  }, [apiSignal.value, inboxOnly, filterSignal.value, ordering, page]);

  useEffect(() => {
    setPage(1);
    setDocs([]);
  }, [inboxOnly, filterSignal.value, ordering]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(p => p + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, isLoadingMore, hasMore]);

  const toggleOffline = async (doc: any) => {
    const api = apiSignal.value;
    if (!api) return;

    try {
      const [blob, thumbnailBlob] = await Promise.all([
        api.downloadDocument(doc.id),
        api.getThumbnailBlob(doc.id) 
      ]);
      await db.documents.put({ ...doc, blob, thumbnailBlob, is_offline: 1 });
      alert(doc.title + ' ist jetzt offline verfügbar.');
      setDocs(docs.map(d => d.id === doc.id ? { ...d, blob, thumbnailBlob, is_offline: 1 } : d));
    } catch (err) {
      alert('Download fehlgeschlagen.');
    }
  };

  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.content?.toLowerCase().includes(search.toLowerCase()) ||
    (doc.correspondent && correspondents[doc.correspondent]?.toLowerCase().includes(search.toLowerCase()))
  );

  if (selectedDoc) {
    return <DocumentViewer document={selectedDoc} onClose={() => setSelectedDoc(null)} />;
  }

  if (loading && page === 1) return <div className="loading">Hole Dokumente...</div>;

  return (
    <div className="document-container">
      <div className="search-bar" style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.5rem' }}>
          <input 
            type="search" 
            placeholder="Suchen..." 
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            style={{ flex: 1, padding: '0.9rem 1.2rem' }}
          />
          <button 
            onClick={() => setShowSortModal(true)}
            className="filter-input"
            style={{ width: 'auto', background: 'var(--surface)', cursor: 'pointer', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', fontSize: '1.2rem' }}
          >
            <span>⇅</span>
          </button>
        </div>
        
        <div className="active-filters-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
          {Object.keys(filterSignal.value).length > 0 && (
            <span className="tag-pill" 
              style={{ background: 'var(--primary)', color: 'white', fontWeight: 'bold' }}
            >
              Filter aktiv
            </span>
          )}
          
          {(search || Object.keys(filterSignal.value).length > 0) && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: '500' }}>
              {filteredDocs.length} Treffer
            </span>
          )}

          {Object.keys(filterSignal.value).length > 0 && (
            <button 
              onClick={() => { filterSignal.value = {}; }} 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '0', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}
            >
              Alle Filter löschen
            </button>
          )}
        </div>
      </div>

      {error && !loading && <div style={{ padding: '1rem', color: '#ef4444', textAlign: 'center' }}>{error}</div>}
      
      <div className="document-list">
        {filteredDocs.length === 0 && !loading ? (
          <p className="empty-msg">Keine Dokumente gefunden.</p>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="doc-card" onClick={() => setSelectedDoc(doc)}>
              <div className="doc-thumbnail-col">
                <Thumbnail documentId={doc.id} />
                {(doc.is_offline === 1 || doc.blob) && <div className="offline-badge">✓</div>}
              </div>
              <div className="doc-info">
                <h3>{doc.title}</h3>
                <p className="doc-date">
                  {new Date(doc.created).toLocaleDateString('de-DE')}
                  {doc.correspondent && <span className="doc-corr"> • {correspondents[doc.correspondent]}</span>}
                </p>
                <div className="doc-tags">
                  {doc.tags?.map((tId: number) => (
                    <span key={tId} className="tag-pill">{tags[tId] || `Tag ${tId}`}</span>
                  ))}
                </div>
              </div>
              <div className="doc-actions">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleOffline(doc); }} 
                  className="text-button small"
                  title="Offline speichern"
                >
                  {(doc.is_offline === 1 || doc.blob) ? '✅' : '📥'}
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={lastElementRef} style={{ height: '20px', margin: '20px 0' }} />
        
        {isLoadingMore && (
           <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)' }}>
             Lade weitere Dokumente...
           </div>
        )}
      </div>

      {showSortModal && (
        <div className="modal-overlay" onClick={() => setShowSortModal(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <button className="header-button" onClick={() => setShowSortModal(false)}>← Zurück</button>
              <h2 style={{ fontSize: '1.2rem' }}>Sortieren nach</h2>
              <div style={{ width: '40px' }}></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="menu-button" onClick={() => { setOrdering('-created'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Neueste (Ausgestellt) {ordering === '-created' && '✓'}
              </button>
              <button className="menu-button" onClick={() => { setOrdering('created'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Älteste (Ausgestellt) {ordering === 'created' && '✓'}
              </button>
              <button className="menu-button" onClick={() => { setOrdering('-added'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Zuletzt Hinzugefügt {ordering === '-added' && '✓'}
              </button>
              <button className="menu-button" onClick={() => { setOrdering('added'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Zuerst Hinzugefügt {ordering === 'added' && '✓'}
              </button>
              <button className="menu-button" onClick={() => { setOrdering('title'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Titel (A-Z) {ordering === 'title' && '✓'}
              </button>
              <button className="menu-button" onClick={() => { setOrdering('-title'); setShowSortModal(false); }} style={{ justifyContent: 'space-between', padding: '1rem' }}>
                Titel (Z-A) {ordering === '-title' && '✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
