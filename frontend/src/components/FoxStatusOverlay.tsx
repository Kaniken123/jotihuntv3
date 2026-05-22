import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area } from '../types';
import { Clock, Eye, EyeOff, Target, ChevronDown, ChevronUp } from 'lucide-react';

interface FoxStatusOverlayProps {
  areas: Area[];
}

const FoxStatusOverlay: React.FC<FoxStatusOverlayProps> = ({ areas }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'hunted':
        return 'bg-red-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Eye className="w-3 h-3" />;
      case 'hunted':
        return <Target className="w-3 h-3" />;
      case 'inactive':
        return <EyeOff className="w-3 h-3" />;
      default:
        return <EyeOff className="w-3 h-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('fox.active');
      case 'hunted':
        return t('fox.hunted');
      case 'inactive':
        return t('fox.inactive');
      default:
        return t('fox.unknown');
    }
  };

  const formatTimeSince = (dateString?: string) => {
    if (!dateString) return t('fox.unknown');

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return t('fox.now');
    } else if (diffMinutes < 60) {
      return t('fox.minutesAgo', { n: diffMinutes });
    } else if (diffHours < 24) {
      return t('fox.hoursAgo', { n: diffHours });
    } else {
      return t('fox.daysAgo', { n: diffDays });
    }
  };

  // Sort areas by name for consistent display
  const sortedAreas = [...areas].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[280px]">
        {/* Header with summary and toggle */}
        <div 
          className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t('fox.status')}</span>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {sortedAreas.filter(a => a.status === 'active').length}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {sortedAreas.filter(a => a.status === 'hunted').length}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {sortedAreas.filter(a => a.status === 'inactive').length}
                  </span>
                </div>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-600">
            <div className="max-h-64 overflow-y-auto">
              {sortedAreas.map((area) => (
                <div key={area.id} className="p-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(area.status)}`}></div>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {area.name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded-full text-white ${getStatusColor(area.status)}`}>
                        {getStatusText(area.status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {area.points}{t('fox.points')}
                    </div>
                  </div>
                  
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{t('fox.statusLabel')}: {formatTimeSince(area.updated_at)}</span>
                    </div>
                    {area.last_seen && (
                      <div className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{t('fox.seen')}: {formatTimeSince(area.last_seen)}</span>
                      </div>
                    )}
                  </div>
                  
                  {area.lat && area.lng && (
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {t('fox.location')}: {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoxStatusOverlay;