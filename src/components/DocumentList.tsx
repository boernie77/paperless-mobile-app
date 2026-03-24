import { useEffect, useState } from 'preact/hooks';
import { apiSignal } from '../store.ts';
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
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
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

      if (!api) {
        let offlineDocs = await db.documents.toArray();
        if (inboxOnly) {
          const inboxTagIds = Object.keys(tags)
            .filter(k => tags[parseInt(k)]?.toLowerCase().includes('inbox') || tags[parseInt(k)]?.toLowerCase().includes('posteingang'))
            .map(k => parseInt(k));
          offlineDocs = offlineDocs.filter(d => d.tags?.some((t: number) => inboxTagIds.includes(t)));
        }
        setDocs(offlineDocs);
        setLoading(false);
        return;
      }
      
      try {
        const params: Record<string, string> = {};
        if (inboxOnly) params.tags__name__iexact = 'inbox';
        
        const result = await api.getDocuments(params);
        const onlineDocs = result.results;
        
        if (!inboxOnly) {
           await db.documents.bulkPut(onlineDocs.map((d: any) => ({ ...d, blob: undefined })));
        }
        
        setDocs(onlineDocs);
      } catch (err) {
        let offlineDocs = await db.documents.toArray();
        setDocs(offlineDocs);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [apiSignal.value, inboxOnly]);

  const toggleOffline = async (doc: any) => {
    const api = apiSignal.value;
    if (!api) return;

    try {
      const blob = await api.downloadDocument(doc.id);
      await db.documents.update(doc.id, { blob });
      alert(doc.title + ' ist jetzt offline verfügbar.');
      setDocs(docs.map(d => d.id === doc.id ? { ...d, blob } : d));
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
      <div className="search-bar">
        <input 
          type="search" 
          placeholder="Titel, Inhalt oder Korrespondent suchen..." 
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
      </div>
      
      <div className="document-list">
        {filteredDocs.length === 0 ? (
          <p className="empty-msg">Keine Dokumente gefunden.</p>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="doc-card" onClick={() => setSelectedDoc(doc)}>
              <div className="doc-thumbnail-col">
                <Thumbnail documentId={doc.id} />
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
      </div>
    </div>
  );
}
