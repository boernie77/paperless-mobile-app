import { useState, useEffect } from 'preact/hooks';
import { filterSignal } from '../store.ts';
import { db } from '../db.ts';

export function FilterModal({ onClose }: { onClose: () => void }) {
  const currentFilters = filterSignal.value;
  const [correspondents, setCorrespondents] = useState<any[]>([]);
  const [corrSearch, setCorrSearch] = useState('');
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  // Locale State for the form
  const [selectedCorr, setSelectedCorr] = useState<number | ''>(currentFilters.correspondent__id || '');
  const [selectedType, setSelectedType] = useState<number | ''>(currentFilters.document_type__id || '');
  const [selectedTags, setSelectedTags] = useState<number[]>(currentFilters.tags__id__all ? currentFilters.tags__id__all.split(',').map(Number) : []);
  const [dateFrom, setDateFrom] = useState(currentFilters.created__date__gte || '');
  const [dateTo, setDateTo] = useState(currentFilters.created__date__lte || '');

  useEffect(() => {
    db.correspondents.toArray().then(setCorrespondents);
    db.documentTypes.toArray().then(setDocTypes);
    db.tags.toArray().then(setTags);
  }, []);

  const handleApply = () => {
    const filters: Record<string, any> = {};
    if (selectedCorr) filters.correspondent__id = selectedCorr;
    if (selectedType) filters.document_type__id = selectedType;
    if (selectedTags.length > 0) filters.tags__id__all = selectedTags.join(',');
    if (dateFrom) filters.created__date__gte = dateFrom;
    if (dateTo) filters.created__date__lte = dateTo;
    
    filterSignal.value = filters;
    onClose();
  };

  const clearFilters = () => {
    filterSignal.value = {};
    onClose();
  };

  const filteredCorrespondents = correspondents.filter(c => c.name.toLowerCase().includes(corrSearch.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Suche & Filter</h2>
          <button className="text-button" onClick={onClose}>✕</button>
        </div>

        <div className="filter-section">
          <h3>Korrespondent</h3>
          <input 
            type="text" 
            placeholder="Korrespondent suchen..." 
            value={corrSearch}
            onInput={(e) => setCorrSearch((e.target as HTMLInputElement).value)}
            className="filter-input"
          />
          <select 
            value={selectedCorr} 
            onChange={e => setSelectedCorr(Number((e.target as HTMLSelectElement).value) || '')}
            className="filter-input"
            size={4}
          >
            <option value="">Alle</option>
            {filteredCorrespondents.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-section">
          <h3>Dokumententyp</h3>
          <select 
            value={selectedType} 
            onChange={e => setSelectedType(Number((e.target as HTMLSelectElement).value) || '')}
            className="filter-input"
          >
            <option value="">Alle</option>
            {docTypes.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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
