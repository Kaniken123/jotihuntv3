import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { gameService } from '../services/gameService';
import { Article } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { ArrowLeft, MessageCircle, AlertTriangle, Newspaper, Calendar, Tag, Check, CheckCircle, MapPin, Send } from 'lucide-react';

const UpdateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hint solution modal state
  const [showSolutionModal, setShowSolutionModal] = useState(false);
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
  const { t } = useTranslation();

  useEffect(() => {
    if (id) {
      loadArticle(parseInt(id));
    }
  }, [id]);

  const loadArticle = async (articleId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await gameService.getArticle(articleId);
      setArticle(data);
      
      // Automatically mark as read when viewing detail
      if (!data.is_read) {
        await gameService.markArticleAsRead(articleId);
        setArticle(prev => prev ? { ...prev, is_read: true, read_at: new Date().toISOString() } : null);
      }
    } catch (error: any) {
      console.error('Failed to load article:', error);
      setError(error.response?.data?.message || t('updateDetail.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAssignmentCompletion = async (isCompleted: boolean, notes?: string) => {
    if (!article) return;
    
    try {
      const newStatus = !isCompleted;
      await gameService.toggleAssignmentCompletion(article.id, newStatus, notes);
      setArticle(prev => prev ? { 
        ...prev, 
        is_completed: newStatus,
        completed_at: newStatus ? new Date().toISOString() : undefined
      } : null);
    } catch (error) {
      console.error('Failed to toggle assignment completion:', error);
    }
  };

  const handleSubmitSolution = async () => {
    if (!article || !solutionForm.solution.trim()) return;
    
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
        article.id,
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
    } catch (error) {
      console.error('Failed to submit solution:', error);
    } finally {
      setIsSubmittingSolution(false);
    }
  };

  const openSolutionModal = () => {
    setShowSolutionModal(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hint':
        return <MessageCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
      case 'assignment':
        return <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />;
      case 'news':
        return <Newspaper className="w-6 h-6 text-green-600 dark:text-green-400" />;
      default:
        return <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />;
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
    return {
      full: date.toLocaleString(),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || t('updateDetail.notFound')}
          </p>
          <button
            onClick={() => navigate('/updates')}
            className="btn btn-primary"
          >
            {t('updateDetail.backToUpdates')}
          </button>
        </div>
      </div>
    );
  }

  const dateInfo = formatDate(article.published_at);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/updates')}
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('updateDetail.backToUpdates')}</span>
        </button>
      </div>

      {/* Article Header */}
      <div className={`card p-6 mb-6 ${article.is_read ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getTypeIcon(article.type)}
            <h1 className={`text-3xl font-bold ${
              article.is_read 
                ? 'text-gray-600 dark:text-gray-400' 
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {article.title}
            </h1>
            {article.is_read && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center space-x-3 mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(article.type)}`}>
            <Tag className="w-4 h-4 mr-1" />
            {t(`updateDetail.types.${article.type}`, article.type)}
          </span>
          
          {article.area && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getAreaColor(article.area)}`}>
              <Tag className="w-4 h-4 mr-1" />
              {article.area}
            </span>
          )}
        </div>

        {/* Date Info */}
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{t('updateDetail.published')} {dateInfo.relative}</span>
          </div>
          <span className="text-gray-400">•</span>
          <span>{dateInfo.full}</span>
          {article.is_read && article.read_at && (
            <>
              <span className="text-gray-400">•</span>
              <span className="text-green-600 dark:text-green-400">
                {t('updateDetail.read')} {getRelativeTime(new Date(article.read_at))}
              </span>
            </>
          )}
        </div>

        {/* Assignment Alert and Completion */}
        {article.type === 'assignment' && (
          <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">{t('updateDetail.assignmentStatus')}</span>
              </div>
              <button
                onClick={() => handleToggleAssignmentCompletion(!!article.is_completed)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                {t('updateDetail.completed')} {getRelativeTime(new Date(article.completed_at))}
              </p>
            )}
          </div>
        )}

        {/* Hint Solution */}
        {article.type === 'hint' && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">{t('updateDetail.hintSolution')}</span>
              </div>
              <button
                onClick={openSolutionModal}
                className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>{t('updateDetail.submitSolution')}</span>
              </button>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
              {t('updateDetail.hintSolutionDesc')}
            </p>
          </div>
        )}

        {/* Team Area Highlight */}
        {state.team?.area && article.area === state.team.area && (
          <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <p className="text-primary-700 dark:text-primary-300 font-medium">
              {t('updateDetail.teamAreaRelevant', { area: state.team.area })}
            </p>
          </div>
        )}
      </div>

      {/* Article Content */}
      <div className="card p-6">
        <div className="prose dark:prose-invert max-w-none">
          <div 
            className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      </div>

      {/* Related Actions */}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/updates')}
          className="btn btn-secondary"
        >
          {t('updateDetail.backToAll')}
        </button>

        {article.type === 'assignment' && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('updateDetail.needHelp')}</span> {t('updateDetail.contactLeader')}{' '}
            <button
              onClick={() => navigate('/chat')}
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('updateDetail.teamChat')}
            </button>
          </div>
        )}
      </div>

      {/* Hint Solution Modal */}
      {showSolutionModal && article && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {article.title}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: article.content.length > 200 ? article.content.substring(0, 200) + '...' : article.content }} />
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

export default UpdateDetail;