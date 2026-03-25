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
  const [tags, setTags] = useState<Record<number, string>>({});
  const [correspondents, setCorrespondents] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('-created');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);

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
          setTags(tagMap);
          await db.tags.bulkPut(tagRes.results);

          const corrMap: Record<number, string> = {};
          corrRes.results.forEach((c: any) => corrMap[c.id] = c.name);
          setCorrespondents(corrMap);
          await db.correspondents.bulkPut(corrRes.results);
          await db.documentTypes.bulkPut(typeRes.results);
        } else {
          const offlineTags = await db.tags.toArray();
          const tagMap: Record<number, string> = {};
          offlineTags.forEach((t: any) => tagMap[t.id] = t.name);
          setTags(tagMap);

          const offlineCorr = await db.correspondents.toArray();
          const corrMap: Record<number, string> = {};
          offlineCorr.forEach((c: any) => corrMap[c.id] = c.name);
          setCorrespondents(corrMap);
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
      let result = [...items];
      if (filters.correspondent__id) {
        result = result.filter(d => d.correspondent === filters.correspondent__id);
      }
      if (filters.document_type__id) {
        result = result.filter(d => d.document_type === filters.document_type__id);
      }
      if (filters.tags__id__all) {
        result = result.filter(d => d.tags?.includes(filters.tags__id__all));
      }
      if (filters.created__date__gte) {
        const from = new Date(filters.created__date__gte).getTime();
        result = result.filter(d => d.created && new Date(d.created).getTime() >= from);
      }
      if (filters.created__date__lte) {
        const to = new Date(filters.created__date__lte).getTime();
        result = result.filter(d => d.created && new Date(d.created).getTime() <= to);
      }
      return result;
    };

    const fetchData = async () => {
      if (page === 1) setLoading(true);
      else setIsLoadingMore(true);

      const api = apiSignal.value;
      
      if (!api) {
        // Offline mode: Get all docs and filter locally (offline has no pagination support in this simplified setup)
        let offlineDocs = await db.documents.toArray();
        if (inboxOnly && Object.keys(filters).length === 0) {
          const inboxTagIds = Object.keys(tags)
            .filter(k => tags[parseInt(k)]?.toLowerCase().includes('inbox') || tags[parseInt(k)]?.toLowerCase().includes('posteingang'))
            .map(k => parseInt(k));
          offlineDocs = offlineDocs.filter(d => d.tags?.some((t: number) => inboxTagIds.includes(t)));
        }

        offlineDocs = applyLocalFilters(offlineDocs);
        offlineDocs.sort((a,b) => {
          if (ordering === '-created') return new Date(b.created).getTime() - new Date(a.created).getTime();
          if (ordering === 'created') return new Date(a.created).getTime() - new Date(b.created).getTime();
          if (ordering === '-added') return new Date(b.added).getTime() - new Date(a.added).getTime();
          if (ordering === 'added') return new Date(a.added).getTime() - new Date(b.added).getTime();
          if (ordering === 'title') return a.title.localeCompare(b.title);
          if (ordering === '-title') return b.title.localeCompare(a.title);
          return 0;
        });

        setDocs(offlineDocs);
        setHasMore(false);
        setLoading(false);
        setIsLoadingMore(false);
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
           const inboxTagId = Object.keys(tags).find(k => 
              tags[parseInt(k)]?.toLowerCase().includes('inbox') || 
              tags[parseInt(k)]?.toLowerCase().includes('posteingang')
           );
           if (inboxTagId) params.tags__id__all = inboxTagId;
           else params.tags__name__iexact = 'inbox';
        }
        
        const result = await api.getDocuments(params);
        const newDocs = result.results;
        
        if (page === 1 && !inboxOnly && Object.keys(filters).length === 0) {
            await db.documents.bulkPut(newDocs.map((d: any) => ({ ...d, blob: undefined })));
        }
        
        const filteredNewDocs = applyLocalFilters(newDocs);
        
        if (page === 1) {
          setDocs(filteredNewDocs);
        } else {
          setDocs(prev => [...prev, ...filteredNewDocs]);
        }
        
        setHasMore(!!result.next);

        // Auto-download logic
        if (autoDownload && api) {
          for (const doc of filteredNewDocs) {
            if (!doc.blob) {
              // Trigger background download (don't await to avoid blocking UI)
              Promise.all([
                api.downloadDocument(doc.id),
                api.getThumbnailBlob(doc.id)
              ]).then(async ([blob, thumbnailBlob]) => {
                await db.documents.put({ ...doc, blob, thumbnailBlob });
                setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, blob, thumbnailBlob } : d));
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Fetch failed', err);
        if (page === 1) {
           let offlineDocs = await db.documents.toArray();
           setDocs(applyLocalFilters(offlineDocs));
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };
    
    fetchData();
  }, [apiSignal.value, inboxOnly, filterSignal.value, ordering, page]);

  useEffect(() => {
    // Reset page when filters or ordering changes
    setPage(1);
    setDocs([]);
  }, [inboxOnly, filterSignal.value, ordering]);

  // Infinite Scroll Observer
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
      await db.documents.put({ ...doc, blob, thumbnailBlob });
      alert(doc.title + ' ist jetzt offline verfügbar.');
      setDocs(docs.map(d => d.id === doc.id ? { ...d, blob, thumbnailBlob } : d));
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

  if (loading) return <div className="loading">Hole Dokumente...</div>;

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
      
      <div className="document-list">
        {filteredDocs.length === 0 ? (
          <p className="empty-msg">Keine Dokumente gefunden.</p>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="doc-card" onClick={() => setSelectedDoc(doc)}>
              <div className="doc-thumbnail-col">
                <Thumbnail documentId={doc.id} />
                {doc.blob && <div className="offline-badge">✓</div>}
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
                  {doc.blob ? '✅' : '📥'}
                </button>
              </div>
            </div>
          ))
        )}
        {/* Invisible anchor for infinite scroll */}
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
