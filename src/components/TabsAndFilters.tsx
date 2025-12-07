import { TabType, FilterType } from '@/types/places';
import { Home, Utensils, CheckCircle, Coffee, Wine, Compass, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabsAndFiltersProps {
  activeTab: TabType;
  activeFilter: FilterType;
  onTabChange: (tab: TabType) => void;
  onFilterChange: (filter: FilterType) => void;
}

export const TabsAndFilters = ({
  activeTab,
  activeFilter,
  onTabChange,
  onFilterChange,
}: TabsAndFiltersProps) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'todo', label: 'Things to Do', icon: <Compass className="w-4 h-4" /> },
    { id: 'eat', label: 'Things to Eat', icon: <Utensils className="w-4 h-4" /> },
    { id: 'completed', label: 'Completed', icon: <CheckCircle className="w-4 h-4" /> },
  ];

  const filters: { id: FilterType; icon: React.ReactNode; label: string }[] = [
    { id: 'all', icon: <Home className="w-4 h-4" />, label: 'All' },
    { id: 'restaurant', icon: <Utensils className="w-4 h-4" />, label: 'Food' },
    { id: 'cafe', icon: <Coffee className="w-4 h-4" />, label: 'Cafe' },
    { id: 'bar', icon: <Wine className="w-4 h-4" />, label: 'Bar' },
    { id: 'attraction', icon: <Building className="w-4 h-4" />, label: 'Places' },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'tab-button flex items-center gap-2',
              activeTab === tab.id && 'tab-button-active'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'filter-chip flex items-center gap-1.5 whitespace-nowrap',
              activeFilter === filter.id && 'filter-chip-active'
            )}
          >
            {filter.icon}
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
};
