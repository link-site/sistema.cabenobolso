import React from 'react';
import { Sidebar } from './Sidebar';
import { MenuTab } from '../types';

interface NavigationProps {
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
  isSyncing?: boolean;
  onOpenLoginModal?: () => void;
  onOpenWhitelistModal?: () => void;
  onResetToDefault?: () => void;
}

export const Navigation: React.FC<NavigationProps> = (props) => {
  return <Sidebar {...props} />;
};

export { Sidebar };
