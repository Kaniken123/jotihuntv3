import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { gameService } from '../services/gameService';
import { Article } from '../types';
import { format } from 'date-fns';

const HintDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { article: initialArticle } = route.params as { article: Article };
  
  const [article, setArticle] = useState<Article>(initialArticle);
  const [isMarking, setIsMarking] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  useEffect(() => {
    // Mark as read when opening
    if (!article.is_read) {
      markAsRead();
    }
  }, []);

  const markAsRead = async () => {
    try {
      await gameService.markArticleAsRead(article.id);
      setArticle({ ...article, is_read: true, read_at: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAsCompleted = async () => {
    setIsMarking(true);
    try {
      await gameService.markArticleAsCompleted(article.id, completionNotes);
      setArticle({
        ...article,
        is_completed: true,
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes,
      });
      setShowNotesInput(false);
      Alert.alert('Success', 'Task marked as completed!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to mark as completed');
    } finally {
      setIsMarking(false);
    }
  };

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

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'hint':
        return 'Hint';
      case 'assignment':
        return 'Assignment';
      case 'news':
        return 'News';
      default:
        return 'Update';
    }
  };

  // Simple HTML to text conversion
  const parseHtmlContent = (html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1E40AF" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Type Badge */}
      <View style={[styles.typeBadge, { backgroundColor: getTypeColor(article.type) }]}>
        <Ionicons name={getTypeIcon(article.type) as any} size={16} color="#FFFFFF" />
        <Text style={styles.typeText}>{getTypeLabel(article.type)}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{article.title}</Text>

      {/* Meta Info */}
      <View style={styles.metaContainer}>
        {article.area && (
          <View style={styles.areaBadge}>
            <Ionicons name="location" size={14} color="#1E40AF" />
            <Text style={styles.areaText}>{article.area}</Text>
          </View>
        )}
        <View style={styles.dateContainer}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.dateText}>
            {format(new Date(article.published_at), 'EEEE, dd MMMM yyyy - HH:mm')}
          </Text>
        </View>
      </View>

      {/* Read Status */}
      {article.is_read && article.read_at && (
        <View style={styles.statusContainer}>
          <Ionicons name="eye" size={14} color="#10B981" />
          <Text style={styles.statusText}>
            Read on {format(new Date(article.read_at), 'dd MMM yyyy HH:mm')}
          </Text>
        </View>
      )}

      {/* Completed Status */}
      {article.is_completed && article.completed_at && (
        <View style={[styles.statusContainer, styles.completedStatus]}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.statusText}>
            Completed on {format(new Date(article.completed_at), 'dd MMM yyyy HH:mm')}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.contentCard}>
        <Text style={styles.content}>{parseHtmlContent(article.content)}</Text>
      </View>

      {/* Completion Notes (if exists) */}
      {article.completion_notes && (
        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>Completion Notes</Text>
          <Text style={styles.notesContent}>{article.completion_notes}</Text>
        </View>
      )}

      {/* Mark as Completed Button (for assignments) */}
      {article.type === 'assignment' && !article.is_completed && (
        <View style={styles.actionContainer}>
          {showNotesInput ? (
            <View style={styles.notesInputContainer}>
              <TextInput
                style={styles.notesInput}
                placeholder="Add completion notes (optional)..."
                placeholderTextColor="#9CA3AF"
                value={completionNotes}
                onChangeText={setCompletionNotes}
                multiline
                numberOfLines={3}
              />
              <View style={styles.notesButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowNotesInput(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.completeButton, isMarking && styles.buttonDisabled]}
                  onPress={markAsCompleted}
                  disabled={isMarking}
                >
                  {isMarking ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      <Text style={styles.completeButtonText}>Complete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.markCompleteButton}
              onPress={() => setShowNotesInput(true)}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
              <Text style={styles.markCompleteText}>Mark as Completed</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1E40AF',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 12,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  metaContainer: {
    marginBottom: 16,
    gap: 8,
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  areaText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#6B7280',
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  completedStatus: {
    backgroundColor: '#DCFCE7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#10B981',
    fontSize: 12,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
  notesCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  notesContent: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 24,
  },
  notesInputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  notesButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  markCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  markCompleteText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HintDetailScreen;
