export class PaperlessAPI {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token;
  }

  static async getToken(baseUrl: string, username: string, password: string): Promise<string> {
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${cleanUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${this.token}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async getDocuments(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`documents/?${query}`);
  }

  async getDocument(id: number) {
    return this.fetch(`documents/${id}/`);
  }

  async getTags() {
    return this.fetch('tags/');
  }

  async getCorrespondents() {
    return this.fetch('correspondents/');
  }

  async getDocumentTypes() {
    return this.fetch('document_types/');
  }

  async uploadDocument(file: Blob, title: string) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    
    return this.fetch('documents/post_document/', {
      method: 'POST',
      body: formData,
      // Fetch will automatically set content-type for FormData
      headers: {
        'Authorization': `Token ${this.token}`,
      }
    });
  }

  async downloadDocument(id: number): Promise<Blob> {
    const url = `${this.baseUrl}/api/documents/${id}/download/`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${this.token}`,
      },
    });

    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }
}
