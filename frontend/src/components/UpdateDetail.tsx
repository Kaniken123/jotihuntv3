import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/authService';
import { Article } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { ArrowLeft, MessageCircle, AlertTriangle, Newspaper, Calendar, Tag } from 'lucide-react';

const UpdateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state } = useAuth();

  useEffect(() => {
    if (id) {
      loadArticle(parseInt(id));
    }
  }, [id]);

  const loadArticle = async (articleId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/jotihunt/articles/${articleId}`);
      setArticle(response.data);
    } catch (error: any) {
      console.error('Failed to load article:', error);
      setError(error.response?.data?.message || 'Failed to load article');
    } finally {
      setIsLoading(false);
    }
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
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
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
            {error || 'Article not found'}
          </p>
          <button
            onClick={() => navigate('/updates')}
            className="btn btn-primary"
          >
            Back to Updates
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
          <span>Back to Updates</span>
        </button>
      </div>

      {/* Article Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getTypeIcon(article.type)}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {article.title}
            </h1>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center space-x-3 mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(article.type)}`}>
            <Tag className="w-4 h-4 mr-1" />
            {article.type.charAt(0).toUpperCase() + article.type.slice(1)}
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
            <span>Published {dateInfo.relative}</span>
          </div>
          <span className="text-gray-400">•</span>
          <span>{dateInfo.full}</span>
        </div>

        {/* Assignment Alert */}
        {article.type === 'assignment' && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Action Required</span>
            </div>
          </div>
        )}

        {/* Team Area Highlight */}
        {state.team?.area && article.area === state.team.area && (
          <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <p className="text-primary-700 dark:text-primary-300 font-medium">
              📍 This update is relevant to your team's area ({state.team.area})
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
          ← Back to All Updates
        </button>

        {article.type === 'assignment' && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Need help?</span> Contact your team leader or check the{' '}
            <button
              onClick={() => navigate('/chat')}
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              team chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateDetail;