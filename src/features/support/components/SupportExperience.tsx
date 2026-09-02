import type { ReactNode } from 'react';
import type { SupportViewer } from '../types';
import AdminSupportDashboard from './admin/AdminSupportDashboard';
import UserSupportDashboard from './user/UserSupportDashboard';

interface SupportExperienceProps {
  mode: 'user' | 'admin';
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

export default function SupportExperience({ mode, viewer, ticketWorkspace }: SupportExperienceProps) {
  if (mode === 'admin') {
    return <AdminSupportDashboard viewer={viewer} ticketWorkspace={ticketWorkspace} />;
  }

  return <UserSupportDashboard viewer={viewer} ticketWorkspace={ticketWorkspace} />;
}

