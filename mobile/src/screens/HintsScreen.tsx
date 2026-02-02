import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { gameService } from '../services/gameService';
import { Article } from '../types';
import { format } from 'date-fns';

type FilterType = 'all' | 'hint' | 'assignment' | 'news';

// Helper function to strip HTML tags safely (iterative to handle nested tags)
// Note: Content is rendered as plain text in React Native, not as HTML
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  let text = html;
  let previousText = '';
  while (previousText !== text) {
    previousText = text;
    text = text.replace(/<[^>]*>/g, '');
  }
  return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
};

const HintsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setIsLoading(true);
      const data = await gameService.getArticles();
      setArticles(data);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadArticles();
    setIsRefreshing(false);
  }, []);

  const filteredArticles = articles.filter((article) => {
    if (filter === 'all') return true;
    return article.type === filter;
  });

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'hint':
        return 'bulb';
      case 'assignment':
        return 'clipboard';
      case 'news':
        return 'newspaper';
      default:
        return 'document';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'hint':
        return '#F59E0B';
      case 'assignment':
        return '#8B5CF6';
      case 'news':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const handleArticlePress = (article: Article) => {
    // Navigate to detail screen
    (navigation as any).navigate('HintDetail', { article });
  };

  const renderArticle = ({ item }: { item: Article }) => (
    <TouchableOpacity
      style={[styles.articleCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleArticlePress(item)}
    >
      <View style={[styles.typeIndicator, { backgroundColor: getTypeColor(item.type) }]}>
        <Ionicons name={getTypeIcon(item.type) as any} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.articleContent}>
        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.articlePreview} numberOfLines={2}>
          {stripHtmlTags(item.content)}
        </Text>
        <View style={styles.articleMeta}>
          {item.area && (
            <View style={styles.areaBadge}>
              <Text style={styles.areaText}>{item.area}</Text>
            </View>
          )}
          <Text style={styles.dateText}>
            {format(new Date(item.published_at), 'dd MMM yyyy HH:mm')}
          </Text>
        </View>
        {item.is_completed && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const FilterButton: React.FC<{ type: FilterType; label: string; icon: string }> = ({
    type,
    label,
    icon,
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Ionicons
        name={icon as any}
        size={16}
        color={filter === type ? '#FFFFFF' : '#6B7280'}
      />
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading updates...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Updates & Hints</Text>
        <Text style={styles.headerSubtitle}>
          {filteredArticles.length} item{filteredArticles.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FilterButton type="all" label="All" icon="list" />
        <FilterButton type="hint" label="Hints" icon="bulb" />
        <FilterButton type="assignment" label="Tasks" icon="clipboard" />
        <FilterButton type="news" label="News" icon="newspaper" />
      </View>

      {/* Articles List */}
      <FlatList
        data={filteredArticles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>No updates yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#1E40AF',
  },
  typeIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  articleContent: {
    flex: 1,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E40AF',
    marginLeft: 8,
  },
  articlePreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  areaBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  areaText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    color: '#10B981',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export default HintsScreen;
