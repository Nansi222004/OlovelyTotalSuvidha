import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'all', label: 'All', icon: '🏠' },
  { id: 'wedding', label: 'Wedding', icon: '💍' },
  { id: 'winter', label: 'Winter', icon: '❄️' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'beauty', label: 'Beauty', icon: '💄' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'fashion', label: 'Fashion', icon: '👕' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
];

interface HorizontalTabsProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function HorizontalTabs({ activeTab: controlledActiveTab, onTabChange }: HorizontalTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState('all');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  return (
    <div className="px-4 mb-6">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex-shrink-0 flex flex-col items-center min-w-[60px] py-2 transition-all relative ${
              activeTab === tab.id
                ? 'text-primary-dark'
                : 'text-neutral-600'
            }`}
          >
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-amber-200/40 rounded-full -z-10" />
            )}
            <span className="text-xl mb-0.5">{tab.icon}</span>
            <span
              className={`text-xs ${
                activeTab === tab.id ? 'font-semibold' : 'font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

