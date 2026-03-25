import Dexie, { type Table } from 'dexie';

export interface OfflineDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  added: string;
  modified: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  blob?: Blob;
  thumbnailBlob?: Blob;
  is_offline?: number; // 0 or 1 for indexing
}

export interface OfflineMetadata {
  id: number;
  name: string;
  slug?: string;
  color?: string;
}

export class PaperlessDB extends Dexie {
  documents!: Table<OfflineDocument>;
  tags!: Table<OfflineMetadata>;
  correspondents!: Table<OfflineMetadata>;
  documentTypes!: Table<OfflineMetadata>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('PaperlessDB');
    this.version(1).stores({
      documents: 'id, title, created, correspondent, document_type',
      settings: 'key',
      metadata: 'key'
    });
    this.version(2).stores({
      documents: 'id, title, correspondent, document_type, tags, is_offline',
      tags: 'id, name',
      correspondents: 'id, name',
      documentTypes: 'id, name',
      settings: 'key'
    });
  }
}


export const db = new PaperlessDB();
