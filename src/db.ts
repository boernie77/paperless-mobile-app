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
}

export interface OfflineTag {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export class PaperlessDB extends Dexie {
  documents!: Table<OfflineDocument>;
  tags!: Table<OfflineTag>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('PaperlessDB');
    this.version(1).stores({
      documents: 'id, title, correspondent, document_type, *tags',
      tags: 'id, name',
      settings: 'key'
    });
  }
}

export const db = new PaperlessDB();
