import React from 'react';
import { Area } from '../types';
import { Clock, Eye, EyeOff, Target } from 'lucide-react';

interface FoxStatusOverlayProps {
  areas: Area[];
}

const FoxStatusOverlay: React.FC<FoxStatusOverlayProps> = ({ areas }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 text-white';
      case 'hunted':
        return 'bg-red-500 text-white';
      case 'inactive':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Eye className="w-4 h-4" />;
      case 'hunted':
        return <Target className="w-4 h-4" />;
      case 'inactive':
        return <EyeOff className="w-4 h-4" />;
      default:
        return <EyeOff className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Actief';
      case 'hunted':
        return 'Gejaagd';
      case 'inactive':
        return 'Inactief';
      default:
        return 'Onbekend';
    }
  };

  const formatTimeSince = (dateString?: string) => {
    if (!dateString) return 'Onbekend';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Nu';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m geleden`;
    } else if (diffHours < 24) {
      return `${diffHours}u geleden`;
    } else {
      return `${diffDays}d geleden`;
    }
  };

  // Sort areas by name for consistent display
  const sortedAreas = [...areas].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="absolute top-4 right-4 z-10 max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Target className="w-4 h-4 text-orange-600" />
            <span>Vossen Status</span>
          </h3>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {sortedAreas.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              Geen vossen beschikbaar
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {sortedAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`p-1 rounded-full ${getStatusColor(area.status)}`}>
                      {getStatusIcon(area.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {area.fox_team_name || area.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {getStatusText(area.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeSince(area.last_seen)}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {area.points} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Summary */}
        {sortedAreas.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-semibold text-green-600 dark:text-green-400">
                  {sortedAreas.filter(a => a.status === 'active').length}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Actief</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-600 dark:text-red-400">
                  {sortedAreas.filter(a => a.status === 'hunted').length}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Gejaagd</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-600 dark:text-gray-400">
                  {sortedAreas.filter(a => a.status === 'inactive').length}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Inactief</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoxStatusOverlay;