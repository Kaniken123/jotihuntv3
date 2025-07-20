import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gameService } from '../services/gameService';
import { Article } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { MessageCircle, AlertTriangle, Newspaper, Filter, ExternalLink, Check, CheckCircle } from 'lucide-react';

const HintsList: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadArticles();
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
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
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
          Game Updates
        </h1>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hints, assignments, news..."
                className="input"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input"
              >
                <option value="all">All Types</option>
                <option value="hint">Hints</option>
                <option value="assignment">Assignments</option>
                <option value="news">News</option>
              </select>
            </div>

            {/* Area Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Area
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="input"
              >
                <option value="all">All Areas</option>
                <option value="general">General</option>
                {uniqueAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {filteredArticles.length} of {articles.length} updates
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {articles.length === 0 ? 'No updates available yet.' : 'No updates match your filters.'}
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
                        Assignment Status
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
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <span>Mark as Done</span>
                        </>
                      )}
                    </button>
                  </div>
                  {article.is_completed && article.completed_at && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      Completed {formatDate(article.completed_at)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                <div className="flex items-center space-x-4">
                  <span>Published {formatDate(article.published_at)}</span>
                  {article.is_read && article.read_at && (
                    <span className="text-green-600 dark:text-green-400">
                      Read {formatDate(article.read_at)}
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
                      <span>Mark as Read</span>
                    </button>
                  )}
                </div>
                
                <button
                  onClick={() => navigate(`/updates/${article.id}`)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Highlight user's team area */}
              {state.team?.area && article.area === state.team.area && (
                <div className="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                    📍 This update is relevant to your team's area ({state.team.area})
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
          <div className="text-sm text-gray-600 dark:text-gray-400">Hints</div>
        </div>
        
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {articles.filter(a => a.type === 'assignment').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Assignments</div>
        </div>
        
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {articles.filter(a => a.type === 'news').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">News</div>
        </div>
      </div>
    </div>
  );
};

export default HintsList;