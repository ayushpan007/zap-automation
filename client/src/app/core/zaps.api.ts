import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { AppDef, Repo, Run, Zap, ZapInput } from './api.types';

/**
 * The only place that knows API URLs. Components ask for data by intent (list, save…),
 * the way an Express controller calls a service instead of writing queries inline.
 * Returns cold Observables: nothing is sent until something subscribes.
 */
@Injectable({ providedIn: 'root' })
export class ZapsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Zap[]> {
    return this.http.get<{ zaps: Zap[] }>('/api/zaps').pipe(map((r) => r.zaps));
  }
  get(id: string): Observable<Zap> {
    return this.http.get<Zap>(`/api/zaps/${id}`);
  }
  create(input: ZapInput): Observable<Zap> {
    return this.http.post<Zap>('/api/zaps', input);
  }
  update(id: string, patch: Partial<ZapInput>): Observable<Zap> {
    return this.http.patch<Zap>(`/api/zaps/${id}`, patch);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/zaps/${id}`);
  }
  runs(id: string): Observable<Run[]> {
    return this.http.get<{ runs: Run[] }>(`/api/zaps/${id}/runs`).pipe(map((r) => r.runs));
  }
  apps(): Observable<AppDef[]> {
    return this.http.get<{ apps: AppDef[] }>('/api/apps').pipe(map((r) => r.apps));
  }
  repos(): Observable<Repo[]> {
    return this.http.get<{ repos: Repo[] }>('/api/github/repos').pipe(map((r) => r.repos));
  }
}
