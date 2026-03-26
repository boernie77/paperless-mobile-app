import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { apiSignal, filterSignal, failedDocsSignal, duplicateDocsSignal, ownerFilterSignal } from '../store.ts';
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    (localStorage.getItem('viewMode') as 'list' | 'grid') || 'list'
  );
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);

  const toggleViewMode = () => {
    const next = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(next);
    localStorage.setItem('viewMode', next);
  };

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
        // Fallback to cached DB metadata when API is unreachable
        try {
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
        } catch (dbErr) { }
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

      // Sort helper for offline docs (supports all orderings)
      const sortOfflineDocs = (items: any[]) => [...items].sort((a, b) => {
        if (ordering === '-created') return new Date(b.created).getTime() - new Date(a.created).getTime();
        if (ordering === 'created') return new Date(a.created).getTime() - new Date(b.created).getTime();
        if (ordering === '-added') return new Date(b.added || b.created).getTime() - new Date(a.added || a.created).getTime();
        if (ordering === 'added') return new Date(a.added || a.created).getTime() - new Date(b.added || b.created).getTime();
        if (ordering === 'title') return (a.title || '').localeCompare(b.title || '');
        if (ordering === '-title') return (b.title || '').localeCompare(a.title || '');
        return 0;
      });

      if (!api) {
        // Pure offline mode - load all at once for smooth scrolling
        try {
          let allOffline = await db.documents.where('is_offline').equals(1).toArray();
          allOffline = applyLocalFilters(allOffline);
          setDocs(sortOfflineDocs(allOffline));
          setHasMore(false);
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

        const activeDiagnostic = failedDocsSignal.value || duplicateDocsSignal.value;

        if (activeDiagnostic) {
          params['id__in'] = activeDiagnostic.map(d => d.id).join(',');
        } else {
          // If offline docs exist, prefer them for instant smooth display
          let allOfflineDocs = await db.documents.where('is_offline').equals(1).toArray();
          const ownerFilter = ownerFilterSignal.value;
          if (ownerFilter && ownerFilter.length > 0) {
            allOfflineDocs = allOfflineDocs.filter((d: any) => ownerFilter.includes(d.owner));
          }
          if (allOfflineDocs.length > 0) {
            const filtered = applyLocalFilters(allOfflineDocs);
            setDocs(sortOfflineDocs(filtered));
            setHasMore(false);
            setError(null);
            setLoading(false);
            setIsLoadingMore(false);
            return;
          }

          // No offline docs - use standard API filters
          Object.entries(filters).forEach(([k, v]) => {
             if (v !== undefined && v !== null && v !== '') params[k] = String(v);
          });

          if (ownerFilter && ownerFilter.length > 0) {
            params['owner__id__in'] = ownerFilter.join(',');
          }

          if (inboxOnly) {
             const inboxTagId = Object.keys(meta.tags).find(k =>
                (meta.tags as any)[parseInt(k)]?.toLowerCase().includes('inbox') ||
                (meta.tags as any)[parseInt(k)]?.toLowerCase().includes('posteingang')
             );
             if (inboxTagId) params.tags__id__all = inboxTagId;
             else params.tags__name__iexact = 'inbox';
          }
        }

        const result = await api.getDocuments(params);
        console.log(`Loaded page ${page}, total count: ${result.count}, results: ${result.results.length}`);
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

        // Offline fallback - load all at once for smooth scrolling
        try {
          let allOffline = await db.documents.where('is_offline').equals(1).toArray();
          allOffline = applyLocalFilters(allOffline);
          if (allOffline.length > 0) {
            setDocs(sortOfflineDocs(allOffline));
            setHasMore(false);
            setError(null);
            return;
          }
        } catch (dbErr) { }

        const fallbackData = failedDocsSignal.value || duplicateDocsSignal.value;

        if (fallbackData && page === 1) {
          // If we have failure/duplicate metadata, use it as a final fallback
          setDocs(fallbackData.map(f => ({ ...f, created: new Date().toISOString() })) as any);
          setHasMore(false);
          const type = failedDocsSignal.value ? 'Fehler' : 'Duplikate';
          setError(api ? `Fehler beim Laden (${type})` : `Offline: Zeige Metadaten der ${type}`);
        } else {
          setError(api ? 'Fehler beim Laden' : 'Fehler beim Laden (Offline?)');
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };
    
    fetchData();
  }, [apiSignal.value, inboxOnly, filterSignal.value, ordering, page]);

  useEffect(() => {
    setPage(1);
  }, [apiSignal.value, inboxOnly, filterSignal.value, ordering, failedDocsSignal.value, duplicateDocsSignal.value]);

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
    return <DocumentViewer document={selectedDoc} onClose={() => setSelectedDoc(null)} searchTerm={search} />;
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
            onClick={toggleViewMode}
            className="filter-input"
            style={{ width: 'auto', background: 'var(--surface)', cursor: 'pointer', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', fontSize: '1.2rem' }}
            title={viewMode === 'list' ? 'Kachelansicht' : 'Listenansicht'}
          >
            {viewMode === 'list' ? '⊞' : '☰'}
          </button>
          <button
            onClick={() => setShowSortModal(true)}
            className="filter-input"
            style={{ width: 'auto', background: 'var(--surface)', cursor: 'pointer', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', fontSize: '1.2rem' }}
          >
            <span>⇅</span>
          </button>
        </div>
        
        <div className="active-filters-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {failedDocsSignal.value && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               ⚠️ {failedDocsSignal.value.length} Fehlerhafte Dokumente
               <button onClick={() => failedDocsSignal.value = null} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.2rem', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {duplicateDocsSignal.value && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               🔄 {duplicateDocsSignal.value.length} ID-Duplikate
               <button onClick={() => duplicateDocsSignal.value = null} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0 0.2rem', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

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

          {(search || Object.keys(filterSignal.value).length > 0) && (
            <button 
              onClick={() => { filterSignal.value = {}; setSearch(''); (document.querySelector('input[type="search"]') as any).value = ''; }} 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '0', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}
            >
              Suche & Filter löschen
            </button>
          )}
        </div>
      </div>

      {error && !loading && <div style={{ padding: '1rem', color: '#ef4444', textAlign: 'center' }}>{error}</div>}

      {filteredDocs.length === 0 && !loading ? (
        <p className="empty-msg">Keine Dokumente gefunden.</p>
      ) : viewMode === 'list' ? (
        <div className="document-list">
          {filteredDocs.map(doc => (
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
                {(doc.is_offline === 1 || doc.blob) ? (
                  doc.tags?.[2] != null && (
                    <span className="tag-pill">{tags[doc.tags[2]] || `Tag ${doc.tags[2]}`}</span>
                  )
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleOffline(doc); }}
                    className="text-button small"
                    title="Offline speichern"
                  >
                    📥
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={lastElementRef} style={{ height: '20px', margin: '20px 0' }} />
          {isLoadingMore && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)' }}>
              Lade weitere Dokumente...
            </div>
          )}
        </div>
      ) : (
        <div className="document-grid">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="doc-tile" onClick={() => setSelectedDoc(doc)}>
              <div className="doc-tile-thumbnail">
                <Thumbnail documentId={doc.id} />
                {(doc.is_offline === 1 || doc.blob) && <div className="offline-badge">✓</div>}
              </div>
              <div className="doc-tile-info">
                <h3>{doc.title}</h3>
                <p className="doc-date">
                  {new Date(doc.created).toLocaleDateString('de-DE')}
                  {doc.correspondent && <span className="doc-corr"> • {correspondents[doc.correspondent]}</span>}
                </p>
                <div className="doc-tile-footer">
                  <div className="doc-tags" style={{ flex: 1 }}>
                    {doc.tags?.slice(0, (doc.is_offline === 1 || doc.blob) ? 3 : 2).map((tId: number) => (
                      <span key={tId} className="tag-pill">{tags[tId] || `Tag ${tId}`}</span>
                    ))}
                  </div>
                  {!(doc.is_offline === 1 || doc.blob) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleOffline(doc); }}
                      className="text-button small"
                      title="Offline speichern"
                    >
                      📥
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={lastElementRef} style={{ height: '20px', gridColumn: '1 / -1', margin: '20px 0' }} />
          {isLoadingMore && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)', gridColumn: '1 / -1' }}>
              Lade weitere Dokumente...
            </div>
          )}
        </div>
      )}

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
