import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public/queue-board').then((m) => m.QueueBoard),
    title: 'Live clinic queues · DoctorQ',
  },
  {
    path: 'q/:id',
    loadComponent: () => import('./public/queue-detail').then((m) => m.QueueDetail),
    title: 'Queue · DoctorQ',
  },
  {
    path: 'login',
    loadComponent: () => import('./console/login').then((m) => m.Login),
    title: 'Staff sign in · DoctorQ',
  },
  {
    path: 'console',
    canActivate: [authGuard],
    loadComponent: () => import('./console/console-shell').then((m) => m.ConsoleShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'queues' },
      {
        path: 'queues',
        loadComponent: () => import('./console/queue-control').then((m) => m.QueueControl),
        title: 'Queue control · DoctorQ',
      },
      {
        path: 'doctors',
        loadComponent: () => import('./console/doctors-page').then((m) => m.DoctorsPage),
        title: 'Doctors · DoctorQ',
      },
      {
        // Not admin-only: staff reach this page when `allowStaffHospitals` is on. What they can
        // do once here is decided by the page and, for real, by firestore.rules.
        path: 'hospitals',
        loadComponent: () => import('./console/hospitals-page').then((m) => m.HospitalsPage),
        title: 'Hospitals · DoctorQ',
      },
      {
        path: 'staff',
        canActivate: [adminGuard],
        loadComponent: () => import('./console/staff-page').then((m) => m.StaffPage),
        title: 'Staff · DoctorQ',
      },
      {
        path: 'approvals',
        canActivate: [adminGuard],
        loadComponent: () => import('./console/approvals-page').then((m) => m.ApprovalsPage),
        title: 'Approvals · DoctorQ',
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () => import('./console/settings-page').then((m) => m.SettingsPage),
        title: 'Settings · DoctorQ',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
