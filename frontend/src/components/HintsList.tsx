import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { gameService } from '../services/gameService';
import { Article } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { MessageCircle, AlertTriangle, Newspaper, Filter, ExternalLink, Check, CheckCircle, MapPin, Send } from 'lucide-react';

interface HintSolution {
  id: number;
  solution: string;
  rd_coordinates?: string;
  fox_team?: string;
  is_correct: boolean;
  reveals_fox_location: boolean;
  created_at: string;
}

const HintsList: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Solution modal state
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [solutions, setSolutions] = useState<HintSolution[]>([]);
  const [solutionForm, setSolutionForm] = useState({
    solution: '',
    foxCoordinates: {
      alpha: { rd_x: '', rd_y: '' },
      bravo: { rd_x: '', rd_y: '' },
      charlie: { rd_x: '', rd_y: '' },
      delta: { rd_x: '', rd_y: '' },
      echo: { rd_x: '', rd_y: '' },
      foxtrot: { rd_x: '', rd_y: '' }
    }
  });
  const [isSubmittingSolution, setIsSubmittingSolution] = useState(false);

  const { state } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    loadArticles();
    loadSolutions();
  }, []);

  useEffect(() => {
    filterArticles();
  }, [articles, selectedType, selectedArea, searchTerm]);

  const loadArticles = async () => {
    try {
      const data = await gameService.getArticles();
      setArticles(data);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSolutions = async () => {
    try {
      const data = await gameService.getHintSolutions();
      setSolutions(data);
    } catch (error) {
      console.error('Failed to load hint solutions:', error);
    }
  };

  const handleMarkAsRead = async (articleId: number) => {
    try {
      await gameService.markArticleAsRead(articleId);
      setArticles(prevArticles =>
        prevArticles.map(article =>
          article.id === articleId
            ? { ...article, is_read: true, read_at: new Date().toISOString() }
            : article
        )
      );
    } catch (error) {
      console.error('Failed to mark article as read:', error);
    }
  };

  const handleToggleAssignmentCompletion = async (articleId: number, currentStatus: boolean, notes?: string) => {
    try {
      const newStatus = !currentStatus;
      await gameService.toggleAssignmentCompletion(articleId, newStatus, notes);
      setArticles(prevArticles =>
        prevArticles.map(article =>
          article.id === articleId
            ? { 
                ...article, 
                is_completed: newStatus,
                completed_at: newStatus ? new Date().toISOString() : undefined
              }
            : article
        )
      );
    } catch (error) {
      console.error('Failed to toggle assignment completion:', error);
    }
  };

  const handleSubmitSolution = async () => {
    if (!selectedArticle || !solutionForm.solution.trim()) return;
    
    setIsSubmittingSolution(true);
    try {
      // Filter out empty coordinates
      const filteredCoordinates: any = {};
      Object.entries(solutionForm.foxCoordinates).forEach(([area, coords]) => {
        if (coords.rd_x.trim() && coords.rd_y.trim()) {
          filteredCoordinates[area] = {
            rd_x: coords.rd_x.trim(),
            rd_y: coords.rd_y.trim()
          };
        }
      });

      await gameService.submitHintSolution(
        selectedArticle.id,
        solutionForm.solution,
        Object.keys(filteredCoordinates).length > 0 ? filteredCoordinates : undefined
      );
      
      // Reset form
      setSolutionForm({
        solution: '',
        foxCoordinates: {
          alpha: { rd_x: '', rd_y: '' },
          bravo: { rd_x: '', rd_y: '' },
          charlie: { rd_x: '', rd_y: '' },
          delta: { rd_x: '', rd_y: '' },
          echo: { rd_x: '', rd_y: '' },
          foxtrot: { rd_x: '', rd_y: '' }
        }
      });
      setShowSolutionModal(false);
      
      // Reload solutions
      await loadSolutions();
    } catch (error) {
      console.error('Failed to submit solution:', error);
    } finally {
      setIsSubmittingSolution(false);
    }
  };

  const openSolutionModal = (article: Article) => {
    setSelectedArticle(article);
    setShowSolutionModal(true);
  };

  const filterArticles = () => {
    let filtered = articles;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(article => article.type === selectedType);
    }

    // Filter by area
    if (selectedArea !== 'all') {
      if (selectedArea === 'general') {
        filtered = filtered.filter(article => !article.area);
      } else {
        filtered = filtered.filter(article => article.area === selectedArea);
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by date (newest first)
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.published_at);
      const dateB = new Date(b.published_at);
      return dateB.getTime() - dateA.getTime();
    });

    setFilteredArticles(filtered);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hint':
        return <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'assignment':
        return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      case 'news':
        return <Newspaper className="w-5 h-5 text-green-600 dark:text-green-400" />;
      default:
        return <MessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hint':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'assignment':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'news':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getAreaColor = (area?: string) => {
    if (!area) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    
    const colors: { [key: string]: string } = {
      'Alpha': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Bravo': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Charlie': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Delta': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Echo': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Foxtrot': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    };
    
    return colors[area] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return t('time.minutesAgo', { count: diffMinutes });
    } else if (diffHours < 24) {
      return t('time.hoursAgo', { count: diffHours });
    } else if (diffDays < 7) {
      return t('time.daysAgo', { count: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  };

  const uniqueAreas = Array.from(new Set(articles.map(a => a.area).filter(Boolean)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('hints.title')}
        </h1>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('hints.filters')}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hints.search')}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('hints.searchPlaceholder')}
                className="input"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hints.type')}
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input"
              >
                <option value="all">{t('hints.allTypes')}</option>
                <option value="hint">{t('hints.hints')}</option>
                <option value="assignment">{t('hints.assignments')}</option>
                <option value="news">{t('hints.news')}</option>
              </select>
            </div>

            {/* Area Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hints.area')}
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="input"
              >
                <option value="all">{t('hints.allAreas')}</option>
                <option value="general">{t('hints.general')}</option>
                {uniqueAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('hints.showing', { shown: filteredArticles.length, total: articles.length })}
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {articles.length === 0 ? t('hints.noneAvailable') : t('hints.noneMatch')}
            </p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <div 
              key={article.id} 
              className={`card p-6 hover:shadow-md transition-all ${
                article.is_read ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(article.type)}
                  <h3 className={`text-lg font-semibold ${
                    article.is_read 
                      ? 'text-gray-500 dark:text-gray-400' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {article.title}
                  </h3>
                  {article.is_read && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(article.type)}`}>
                    {article.type}
                  </span>
                  
                  {article.area && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAreaColor(article.area)}`}>
                      {article.area}
                    </span>
                  )}
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none mb-4">
                <div 
                  className={article.is_read 
                    ? 'text-gray-500 dark:text-gray-400' 
                    : 'text-gray-700 dark:text-gray-300'
                  }
                  dangerouslySetInnerHTML={{ 
                    __html: article.content.length > 200 
                      ? `${article.content.substring(0, 200)}...` 
                      : article.content 
                  }}
                />
              </div>

              {/* Assignment completion section */}
              {article.type === 'assignment' && (
                <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        {t('updateDetail.assignmentStatus')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleAssignmentCompletion(article.id, !!article.is_completed)}
                      className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        article.is_completed
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {article.is_completed ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{t('updateDetail.completed')}</span>
                        </>
                      ) : (
                        <>
                          <span>{t('updateDetail.markAsDone')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  {article.is_completed && article.completed_at && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      {t('updateDetail.completed')} {formatDate(article.completed_at)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                <div className="flex items-center space-x-4">
                  <span>{t('updateDetail.published')} {formatDate(article.published_at)}</span>
                  {article.is_read && article.read_at && (
                    <span className="text-green-600 dark:text-green-400">
                      {t('updateDetail.read')} {formatDate(article.read_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {!article.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(article.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t('hints.markAsRead')}</span>
                    </button>
                  )}

                  {/* Hint solution button */}
                  {article.type === 'hint' && (
                    <button
                      onClick={() => openSolutionModal(article)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{t('updateDetail.submitSolution')}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/updates/${article.id}`)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                >
                  <span>{t('hints.viewDetails')}</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Highlight user's team area */}
              {state.team?.area && article.area === state.team.area && (
                <div className="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                    {t('updateDetail.teamAreaRelevant', { area: state.team.area })}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {articles.filter(a => a.type === 'hint').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('hints.hints')}</div>
        </div>
        
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {articles.filter(a => a.type === 'assignment').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('hints.assignments')}</div>
        </div>
        
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {articles.filter(a => a.type === 'news').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('hints.news')}</div>
        </div>
      </div>

      {/* Hint Solution Modal */}
      {showSolutionModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('updateDetail.submitSolution')}
              </h2>
              <button
                onClick={() => setShowSolutionModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                {selectedArticle.title}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('updateDetail.solutionLabel')}
                </label>
                <textarea
                  value={solutionForm.solution}
                  onChange={(e) => setSolutionForm(prev => ({ ...prev, solution: e.target.value }))}
                  placeholder={t('updateDetail.solutionPlaceholder')}
                  className="input min-h-[80px]"
                  rows={3}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('updateDetail.foxLocations')}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {t('updateDetail.foxLocationsHelp')}
                </p>
                
                <div className="space-y-3">
                  {(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'] as const).map((area) => {
                    const areaKey = area.toLowerCase() as keyof typeof solutionForm.foxCoordinates;
                    return (
                      <div key={area} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {area} {t('updateDetail.teamSuffix')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              {t('updateDetail.xCoord')}
                            </label>
                            <input
                              type="number"
                              value={solutionForm.foxCoordinates[areaKey].rd_x}
                              onChange={(e) => setSolutionForm(prev => ({
                                ...prev,
                                foxCoordinates: {
                                  ...prev.foxCoordinates,
                                  [areaKey]: {
                                    ...prev.foxCoordinates[areaKey],
                                    rd_x: e.target.value
                                  }
                                }
                              }))}
                              placeholder="e.g. 123456"
                              className="input text-sm"
                              min="10000"
                              max="280000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              {t('updateDetail.yCoord')}
                            </label>
                            <input
                              type="number"
                              value={solutionForm.foxCoordinates[areaKey].rd_y}
                              onChange={(e) => setSolutionForm(prev => ({
                                ...prev,
                                foxCoordinates: {
                                  ...prev.foxCoordinates,
                                  [areaKey]: {
                                    ...prev.foxCoordinates[areaKey],
                                    rd_y: e.target.value
                                  }
                                }
                              }))}
                              placeholder="e.g. 456789"
                              className="input text-sm"
                              min="300000"
                              max="620000"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSolutionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmitSolution}
                disabled={!solutionForm.solution.trim() || isSubmittingSolution}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
              >
                {isSubmittingSolution ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>{t('updateDetail.submitting')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{t('updateDetail.submitSolution')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HintsList;