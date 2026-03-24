import { useState, useEffect } from 'preact/hooks';
import { filterSignal } from '../store.ts';
import { db } from '../db.ts';

export function FilterModal({ onClose }: { onClose: () => void }) {
  const currentFilters = filterSignal.value;
  const [correspondents, setCorrespondents] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  // Locals
  const [selectedCorr, setSelectedCorr] = useState<number | ''>(currentFilters.correspondent__id || '');
  const [selectedType, setSelectedType] = useState<number | ''>(currentFilters.document_type__id || '');
  const [dateFrom, setDateFrom] = useState(currentFilters.created__date__gte || '');
  const [dateTo, setDateTo] = useState(currentFilters.created__date__lte || '');

  // Sub-Modal states
  const [showCorrSelect, setShowCorrSelect] = useState(false);
  const [corrSearch, setCorrSearch] = useState('');
  
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');

  useEffect(() => {
    db.correspondents.toArray().then(setCorrespondents);
    db.documentTypes.toArray().then(setDocTypes);
    db.tags.toArray().then(setTags);
  }, []);

  const handleApply = () => {
    const filters: Record<string, any> = {};
    if (selectedCorr) filters.correspondent__id = selectedCorr;
    if (selectedType) filters.document_type__id = selectedType;
    if (dateFrom) filters.created__date__gte = dateFrom;
    if (dateTo) filters.created__date__lte = dateTo;
    
    filterSignal.value = filters;
    onClose();
  };

  const clearFilters = () => {
    filterSignal.value = {};
    onClose();
  };

  // Corr Sub-Modal Render
  if (showCorrSelect) {
    const filteredCorr = correspondents.filter(c => c.name.toLowerCase().includes(corrSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
    
    return (
      <div className="modal-overlay">
        <div className="filter-modal">
          <div className="modal-header">
            <button className="text-button" onClick={() => setShowCorrSelect(false)}>Zurück</button>
            <h2 style={{ fontSize: '1.2rem' }}>Korrespondent ausw.</h2>
            <div style={{ width: '40px' }}></div>
          </div>
          <input 
            type="search" 
            placeholder="Korrespondent suchen..." 
            value={corrSearch}
            onInput={(e) => setCorrSearch((e.target as HTMLInputElement).value)}
            className="filter-input"
            autoFocus
          />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className="menu-button" 
              onClick={() => { setSelectedCorr(''); setShowCorrSelect(false); }}
              style={{ justifyContent: 'space-between', padding: '0.8rem' }}
            >
              Alle {selectedCorr === '' && '✓'}
            </button>
            {filteredCorr.map(c => (
              <button 
                key={c.id} 
                className="menu-button" 
                onClick={() => { setSelectedCorr(c.id); setShowCorrSelect(false); }}
                style={{ justifyContent: 'space-between', padding: '0.8rem' }}
              >
                {c.name} {selectedCorr === c.id && '✓'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Document Type Sub-Modal Render
  if (showTypeSelect) {
    const filteredTypes = docTypes.filter(c => c.name.toLowerCase().includes(typeSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
    
    return (
      <div className="modal-overlay">
        <div className="filter-modal">
          <div className="modal-header">
            <button className="text-button" onClick={() => setShowTypeSelect(false)}>Zurück</button>
            <h2 style={{ fontSize: '1.2rem' }}>Dokumententyp ausw.</h2>
            <div style={{ width: '40px' }}></div>
          </div>
          <input 
            type="search" 
            placeholder="Typ suchen..." 
            value={typeSearch}
            onInput={(e) => setTypeSearch((e.target as HTMLInputElement).value)}
            className="filter-input"
            autoFocus
          />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className="menu-button" 
              onClick={() => { setSelectedType(''); setShowTypeSelect(false); }}
              style={{ justifyContent: 'space-between', padding: '0.8rem' }}
            >
              Alle {selectedType === '' && '✓'}
            </button>
            {filteredTypes.map(c => (
              <button 
                key={c.id} 
                className="menu-button" 
                onClick={() => { setSelectedType(c.id); setShowTypeSelect(false); }}
                style={{ justifyContent: 'space-between', padding: '0.8rem' }}
              >
                {c.name} {selectedType === c.id && '✓'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Normal Filter Modal
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Suche & Filter</h2>
          <button className="text-button" onClick={onClose}>✕</button>
        </div>

        <div className="filter-section">
          <h3>Korrespondent</h3>
          <button 
            type="button"
            className="filter-input" 
            style={{ textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setShowCorrSelect(true)}
          >
            <span>{selectedCorr ? correspondents.find(c => c.id === selectedCorr)?.name || 'Unbekannt' : 'Alle'}</span>
            <span style={{opacity: 0.5}}>▼</span>
          </button>
        </div>

        <div className="filter-section">
          <h3>Dokumententyp</h3>
          <button 
            type="button"
            className="filter-input" 
            style={{ textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setShowTypeSelect(true)}
          >
            <span>{selectedType ? docTypes.find(d => d.id === selectedType)?.name || 'Unbekannt' : 'Alle'}</span>
            <span style={{opacity: 0.5}}>▼</span>
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

        <div className="filter-actions">
          <button onClick={clearFilters} className="text-button">Zurücksetzen</button>
          <button onClick={handleApply} className="primary-button">Anwenden</button>
        </div>
      </div>
    </div>
  );
}
