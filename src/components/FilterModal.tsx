import { useState, useEffect } from 'preact/hooks';
import { filterSignal } from '../store.ts';
import { db } from '../db.ts';

export function FilterModal({ onClose }: { onClose: () => void }) {
  const currentFilters = filterSignal.value;
  const [correspondents, setCorrespondents] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  // Locals
  const [selectedCorr, setSelectedCorr] = useState<number | ''>(currentFilters.correspondent || '');
  const [selectedType, setSelectedType] = useState<number | ''>(currentFilters.document_type || '');
  const [selectedTag, setSelectedTag] = useState<number | ''>(currentFilters.tags__id__all || '');
  const [dateFrom, setDateFrom] = useState(currentFilters.created__date__gte || '');
  const [dateTo, setDateTo] = useState(currentFilters.created__date__lte || '');

  // Navigation State: 'main' | 'corr' | 'type' | 'tag'
  const [view, setView] = useState<'main' | 'corr' | 'type' | 'tag'>('main');
  const [searchText, setSearchText] = useState('');
  
  useEffect(() => {
    db.correspondents.toArray().then(setCorrespondents);
    db.documentTypes.toArray().then(setDocTypes);
    db.tags.toArray().then(setTags);
  }, []);

  const handleApply = () => {
    const filters: Record<string, any> = {};
    if (selectedCorr) filters.correspondent = selectedCorr;
    if (selectedType) filters.document_type = selectedType;
    if (selectedTag) filters.tags__id__all = selectedTag;
    if (dateFrom) filters.created__date__gte = dateFrom;
    if (dateTo) filters.created__date__lte = dateTo;
    
    filterSignal.value = filters;
    onClose();
  };

  const clearFilters = () => {
    filterSignal.value = {};
    onClose();
  };

  const renderContent = () => {
    if (view === 'corr') {
      const filtered = correspondents.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <input type="search" placeholder="Korrespondent suchen..." value={searchText} onInput={(e) => setSearchText((e.target as HTMLInputElement).value)} className="filter-input" autoFocus />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
             <button className="menu-button" onClick={() => { setSelectedCorr(''); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>Alle {selectedCorr === '' && '✓'}</button>
             {filtered.map(c => (
               <button key={c.id} className="menu-button" onClick={() => { setSelectedCorr(c.id); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>{c.name} {selectedCorr === c.id && '✓'}</button>
             ))}
          </div>
        </div>
      );
    }

    if (view === 'type') {
      const filtered = docTypes.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <input type="search" placeholder="Typ suchen..." value={searchText} onInput={(e) => setSearchText((e.target as HTMLInputElement).value)} className="filter-input" autoFocus />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
             <button className="menu-button" onClick={() => { setSelectedType(''); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>Alle {selectedType === '' && '✓'}</button>
             {filtered.map(c => (
               <button key={c.id} className="menu-button" onClick={() => { setSelectedType(c.id); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>{c.name} {selectedType === c.id && '✓'}</button>
             ))}
          </div>
        </div>
      );
    }

    if (view === 'tag') {
      const filtered = tags.filter(t => t.name.toLowerCase().includes(searchText.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <input type="search" placeholder="Tag suchen..." value={searchText} onInput={(e) => setSearchText((e.target as HTMLInputElement).value)} className="filter-input" autoFocus />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
             <button className="menu-button" onClick={() => { setSelectedTag(''); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>Alle {selectedTag === '' && '✓'}</button>
             {filtered.map(t => (
               <button key={t.id} className="menu-button" onClick={() => { setSelectedTag(t.id); setView('main'); setSearchText(''); }} style={{ justifyContent: 'space-between' }}>{t.name} {selectedTag === t.id && '✓'}</button>
             ))}
          </div>
        </div>
      );
    }

    // Default 'main' view
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="filter-section">
          <h3>Korrespondent</h3>
          <button type="button" className="filter-input" style={{ textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setView('corr')}>
            <span>{selectedCorr ? correspondents.find(c => c.id === selectedCorr)?.name || 'Geladen...' : 'Alle'}</span>
            <span style={{opacity: 0.5}}>▶</span>
          </button>
        </div>

        <div className="filter-section">
          <h3>Dokumententyp</h3>
          <button type="button" className="filter-input" style={{ textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setView('type')}>
            <span>{selectedType ? docTypes.find(d => d.id === selectedType)?.name || 'Geladen...' : 'Alle'}</span>
            <span style={{opacity: 0.5}}>▶</span>
          </button>
        </div>

        <div className="filter-section">
          <h3>Tag / Filter</h3>
          <button type="button" className="filter-input" style={{ textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setView('tag')}>
            <span>{selectedTag ? tags.find(t => t.id === selectedTag)?.name || 'Geladen...' : 'Alle'}</span>
            <span style={{opacity: 0.5}}>▶</span>
          </button>
        </div>

        <div className="filter-section">
          <h3>Zeitraum (Ausgestellt)</h3>
          <div className="date-row">
            <input type="date" value={dateFrom} onChange={e => setDateFrom((e.target as HTMLInputElement).value)} className="filter-input" />
            <span>bis</span>
            <input type="date" value={dateTo} onChange={e => setDateTo((e.target as HTMLInputElement).value)} className="filter-input" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {view === 'main' ? (
            <h2>Suche & Filter</h2>
          ) : (
            <button className="header-button" onClick={() => { setView('main'); setSearchText(''); }}>← Zurück</button>
          )}
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </div>

        <div className="filter-actions">
          <button onClick={clearFilters} className="btn secondary-button">Zurücksetzen</button>
          <button onClick={handleApply} className="btn primary-button">Anwenden</button>
        </div>
      </div>
    </div>
  );
}
