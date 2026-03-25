import { CapacitorHttp, HttpResponse } from '@capacitor/core';

export class PaperlessAPI {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token;
  }

  static async getToken(baseUrl: string, username: string, password: string): Promise<string> {
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const response: HttpResponse = await CapacitorHttp.post({
      url: `${cleanUrl}/api/token/`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: { username, password }
    });

    if (response.status >= 400) {
      throw new Error(`Login failed: ${response.status}`);
    }

    // CapacitorHttp parse json automatically into response.data
    return response.data.token;
  }

  private async request(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.baseUrl}/api/${endpoint}`;
    
    const options: any = {
      url,
      method,
      headers: {
        'Authorization': `Token ${this.token}`,
        'Accept': 'application/json',
      }
    };

    if (data) {
      options.data = data;
      // Note: for FormData upload, CapacitorHttp requires special handling.
      // But for JSON data it's straightforward.
    }

    const response: HttpResponse = await CapacitorHttp.request(options);

    if (response.status >= 400) {
      throw new Error(`API error: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.data;
  }

  async getDocuments(params: Record<string, string> = {}) {
    // Manually construct query string for CapacitorHttp
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `documents/?${query}` : 'documents/';
    return this.request(endpoint);
  }

  async getAllDocuments(): Promise<any[]> {
    let allResults: any[] = [];
    let page = 1;
    while (true) {
      const response = await this.getDocuments({ 
        page: String(page), 
        page_size: '50' 
      });
      allResults = [...allResults, ...response.results];
      if (!response.next) break;
      page++;
      // Safety break to avoid infinite loop
      if (page > 200) break;
    }
    return allResults;
  }

  async getDocument(id: number) {
    return this.request(`documents/${id}/`);
  }

  async getTags() {
    return this.request('tags/?page_size=10000');
  }

  async getCorrespondents() {
    return this.request('correspondents/?page_size=10000');
  }

  async getDocumentTypes() {
    return this.request('document_types/?page_size=10000');
  }

  async getThumbnail(id: number): Promise<string> {
    const blob = await this.getThumbnailBlob(id);
    return URL.createObjectURL(blob);
  }

  async getThumbnailBlob(id: number): Promise<Blob> {
    const url = `${this.baseUrl}/api/documents/${id}/thumb/`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${this.token}`,
      },
    });
    if (!response.ok) throw new Error('Thumbnail request failed');
    return response.blob();
  }

  async uploadDocument(file: Blob, title: string) {
    // For file upload via CapacitorHttp, we have to use multipart/form-data.
    // CapacitorHttp supports FormData but its behavior varies.
    // Fallback to standard fetch ONLY for uploads if CapacitorHttp fails.
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    
    const url = `${this.baseUrl}/api/documents/post_document/`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Token ${this.token}`,
      }
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
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
