import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

/**
 * Every screen in the app. Pages are lazy-loaded (loadComponent), so each page's code is
 * downloaded only when the user first navigates there.
 *
 *   /login       public     sign in with GitHub
 *   /zaps        signed in  list of the user's Zaps         GET /api/zaps
 *   /zaps/new    signed in  builder for a new Zap           GET /api/apps, /api/github/repos; POST /api/zaps
 *   /zaps/:id    signed in  edit a Zap + its run history    GET/PATCH/DELETE /api/zaps/:id, GET /api/zaps/:id/runs
 *   **           public     not found
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'zaps' },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · Zaps',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'zaps',
        title: 'Zaps',
        loadComponent: () => import('./features/zaps/zap-list.page').then((m) => m.ZapListPage),
      },
      {
        path: 'zaps/new',
        title: 'New Zap · Zaps',
        loadComponent: () => import('./features/zaps/zap-editor.page').then((m) => m.ZapEditorPage),
      },
      {
        path: 'zaps/:id',
        title: 'Edit Zap · Zaps',
        loadComponent: () => import('./features/zaps/zap-editor.page').then((m) => m.ZapEditorPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Not found · Zaps',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
