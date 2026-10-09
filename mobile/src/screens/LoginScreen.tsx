import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';

interface TenantOption {
  id: number;
  name: string;
  slug: string;
  user_id: number;
}

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !password.trim()) {
      setError('Vul je voor- en achternaam en een wachtwoord in');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minstens 6 tekens zijn');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await authService.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      });
      Alert.alert(
        'Registratie ingediend',
        'Een beheerder beoordeelt je account. Je inlognaam en e-mail (naam@jotihunt-gog.nl) zijn automatisch toegewezen. Je kunt inloggen zodra je bent goedgekeurd.'
      );
      setMode('login');
      setPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Registratie mislukt';
      setError(msg);
      Alert.alert('Registratie mislukt', msg);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Tenant selection state
  const [showTenantSelection, setShowTenantSelection] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);

  const handleLogin = async (selectedTenantId?: number) => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[LoginScreen] Starting login...');
      const result = await login(username, password, selectedTenantId);
      console.log('[LoginScreen] Login result:', JSON.stringify(result));

      if (result.requires_tenant_selection && result.tenant_options) {
        setTenantOptions(result.tenant_options);
        setShowTenantSelection(true);
        setIsLoading(false);
        return;
      }

      // Login successful - navigation will be handled by App.tsx
      console.log('[LoginScreen] Login successful, waiting for navigation...');
    } catch (err: any) {
      console.error('[LoginScreen] Login error:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'Login failed. Please check your credentials.';
      setError(errorMessage);
      Alert.alert('Login Error', errorMessage);
      setIsLoading(false);
    }
  };

  const handleTenantSelect = (tenantId: number) => {
    setShowTenantSelection(false);
    handleLogin(tenantId);
  };

  if (showTenantSelection) {
    return (
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Select Team</Text>
          <Text style={styles.subtitle}>Choose which team to log in as</Text>

          <View style={styles.tenantList}>
            {tenantOptions.map((tenant) => (
              <TouchableOpacity
                key={tenant.id}
                style={styles.tenantButton}
                onPress={() => handleTenantSelect(tenant.id)}
              >
                <Ionicons name="people" size={24} color="#1E40AF" />
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.tenantSlug}>{tenant.slug}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowTenantSelection(false)}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <Ionicons name="location" size={64} color="#1E40AF" />
            <Text style={styles.title}>Jotihunt</Text>
            <Text style={styles.subtitle}>Hunter Mobile App</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {mode === 'login' ? (
            /* Username Input */
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Gebruikersnaam"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          ) : (
            <>
              {/* First + Last name (register) */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Voornaam"
                  placeholderTextColor="#9CA3AF"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Achternaam"
                  placeholderTextColor="#9CA3AF"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </>
          )}

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Primary Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={() => (mode === 'login' ? handleLogin() : handleRegister())}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>
                {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'register' && (
            <Text style={styles.registerNote}>
              Je inlognaam en e-mail worden automatisch toegewezen (naam@jotihunt-gog.nl).
              Een beheerder keurt je account goed voordat je kunt inloggen.
            </Text>
          )}

          {/* Toggle login / register */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setError('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? 'Nog geen account? Maak er een aan'
                : 'Heb je al een account? Log in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#1E40AF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  registerNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 17,
  },
  toggleButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  toggleText: {
    color: '#1E40AF',
    fontSize: 15,
    fontWeight: '500',
  },
  demoInfo: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 13,
    color: '#3B82F6',
    marginBottom: 4,
  },
  tenantList: {
    marginTop: 16,
  },
  tenantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tenantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  tenantSlug: {
    fontSize: 14,
    color: '#6B7280',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#1E40AF',
    fontSize: 16,
  },
});

export default LoginScreen;
