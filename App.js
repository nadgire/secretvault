import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { AuthService } from './src/services/AuthService';
import DatabaseService from './src/services/DatabaseService';
import SyncService from './src/services/SyncService';

// Google G Logo Component with authentic colors
const GoogleGLogo = ({ size = 20 }) => (
  <Image 
    source={{ 
      uri: 'https://img.icons8.com/color/512/google-logo.png'
    }} 
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('signin'); // 'signin' or 'signup'
  const [isOnline, setIsOnline] = useState(true);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await DatabaseService.initDB();
      
      // Subscribe to sync events
      const unsubscribe = SyncService.subscribe((event) => {
        if (event.isOnline !== undefined) {
          setIsOnline(event.isOnline);
        }
        if (event.syncInProgress !== undefined) {
          setSyncInProgress(event.syncInProgress);
        }
        if (event.syncCompleted) {
          Alert.alert('Sync Complete', `${event.syncedCount} items synced successfully`);
        }
        if (event.syncFailed) {
          Alert.alert('Sync Failed', event.error);
        }
      });

      // Check initial online status
      await SyncService.checkOnlineStatus();
      
      // Check sign-in status
      await checkSignInStatus();
      
      return unsubscribe;
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      Alert.alert('Error', 'Failed to initialize app');
    }
  };

  const checkSignInStatus = async () => {
    try {
      const signedIn = await AuthService.isAuthenticated();
      setIsSignedIn(signedIn);
      
      if (signedIn) {
        const user = await AuthService.getCurrentUser();
        let userInfo = user?.user || null;
        
        // Try to get user from local database if available
        if (!userInfo && user?.email) {
          userInfo = await DatabaseService.getUserByEmail(user.email);
        }
        
        setUserInfo(userInfo);
      }
    } catch (error) {
      console.error('Check sign-in status error:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      let result;
      
      if (isOnline) {
        // Online: Try cloud authentication
        try {
          result = await AuthService.signInWithGoogle();
          // Save user offline for future offline access
          await DatabaseService.saveUserOffline(result.userInfo);
        } catch (error) {
          // If cloud fails but we have offline data, use that
          const user = await AuthService.authenticateWithGoogle();
          const offlineUser = await DatabaseService.getUserByEmail(user.userInfo.email);
          if (offlineUser) {
            result = { userInfo: offlineUser };
            Alert.alert('Offline Mode', 'Signed in using offline data. Will sync when online.');
          } else {
            throw error;
          }
        }
      } else {
        // Offline: Check local database
        const user = await AuthService.authenticateWithGoogle();
        const offlineUser = await DatabaseService.getUserByEmail(user.userInfo.email);
        if (offlineUser) {
          result = { userInfo: offlineUser };
          Alert.alert('Offline Mode', 'Signed in offline. Will sync when connection is restored.');
        } else {
          throw new Error('No offline account found. Please connect to internet for first-time sign in.');
        }
      }
      
      setUserInfo(result.userInfo);
      setIsSignedIn(true);
      
      if (isOnline) {
        Alert.alert('Success', 'Signed in successfully!');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      if (!isOnline) {
        Alert.alert('No Internet', 'Internet connection required for account creation.');
        return;
      }
      
      const result = await AuthService.signUpWithGoogle();
      // Save user offline for future offline access
      await DatabaseService.saveUserOffline(result.userInfo);
      
      setUserInfo(result.userInfo);
      setIsSignedIn(true);
      Alert.alert('Success', 'Account created and signed in successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      setUserInfo(null);
      setIsSignedIn(false);
      Alert.alert('Success', 'Signed out successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your connection.');
      return;
    }
    
    const result = await SyncService.performSync();
    if (result.success) {
      Alert.alert('Sync Complete', result.message);
    } else {
      Alert.alert('Sync Failed', result.message);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {isSignedIn && userInfo ? (
          // Dashboard View
          <View style={styles.dashboardContainer}>
            <View style={styles.dashboardHeader}>
              <View style={styles.headerContent}>
                <View style={styles.logoContainer}>
                  <Image 
                    source={require('./src/assets/images/logo.png')} 
                    style={styles.headerLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.headerTitle}>SecretVault</Text>
                </View>
                
                <TouchableOpacity style={styles.menuButton}>
                  <View style={styles.menuDot} />
                  <View style={styles.menuDot} />
                  <View style={styles.menuDot} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Network Status Bar */}
            <View style={[styles.networkStatus, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.networkStatusText}>
                {isOnline ? '🟢 Online' : '🔴 Offline'} 
                {syncInProgress && ' - Syncing...'}
              </Text>
              {isOnline && !syncInProgress && (
                <TouchableOpacity onPress={handleManualSync} style={styles.syncButton}>
                  <Text style={styles.syncButtonText}>🔄 Sync</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.userSection}>
              <View style={styles.userCard}>
                <View style={styles.userInfo}>
                  {userInfo.picture ? (
                    <Image source={{ uri: userInfo.picture }} style={styles.userAvatar} />
                  ) : (
                    <View style={styles.userAvatarPlaceholder}>
                      <Text style={styles.userAvatarText}>
                        {userInfo.name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{userInfo.name}</Text>
                    <Text style={styles.userEmail}>{userInfo.email}</Text>
                    <Text style={styles.userStatus}>
                      {!isOnline ? 'Working offline' : 'Connected to cloud'}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : currentScreen === 'signin' ? (
          // Sign In Screen
          <View style={styles.loginContainer}>
            <View style={styles.loginHeader}>
              <View style={styles.brandSection}>
                <Image 
                  source={require('./src/assets/images/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.brandName}>SecretVault</Text>
                <Text style={styles.brandTagline}>Secure Password Management</Text>
              </View>
            </View>

            <View style={styles.loginFormContainer}>
              <View style={styles.loginCard}>
                <View style={styles.cardContent}>
                  <Text style={styles.loginTitle}>Welcome Back</Text>
                  <Text style={styles.loginSubtitle}>
                    Sign in to access your secure vault
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.googleButton, loading && styles.buttonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                    activeOpacity={0.95}
                  >
                    <View style={styles.googleButtonContent}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#1a73e8" style={styles.loadingIcon} />
                      ) : (
                        <GoogleGLogo size={20} />
                      )}
                      <Text style={styles.googleButtonText}>
                        {loading ? 'Signing in...' : 'Continue with Google'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.orDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.switchContainer}>
                    <Text style={styles.switchText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => setCurrentScreen('signup')}>
                      <Text style={styles.switchLink}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Protected by industry-standard encryption
                </Text>
              </View>
            </View>
          </View>
        ) : (
          // Sign Up Screen
          <View style={styles.loginContainer}>
            <View style={styles.loginHeader}>
              <View style={styles.brandSection}>
                <Image 
                  source={require('./src/assets/images/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.brandName}>SecretVault</Text>
                <Text style={styles.brandTagline}>Secure Password Management</Text>
              </View>
            </View>

            <View style={styles.loginFormContainer}>
              <View style={styles.loginCard}>
                <View style={styles.cardContent}>
                  <Text style={styles.loginTitle}>Join SecretVault</Text>
                  <Text style={styles.loginSubtitle}>
                    Create your account with Google to get started
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.googleButton, loading && styles.buttonDisabled]}
                    onPress={handleGoogleSignUp}
                    disabled={loading}
                    activeOpacity={0.95}
                  >
                    <View style={styles.googleButtonContent}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#1a73e8" style={styles.loadingIcon} />
                      ) : (
                        <GoogleGLogo size={20} />
                      )}
                      <Text style={styles.googleButtonText}>
                        {loading ? 'Creating Account...' : 'Sign up with Google'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.trustIndicators}>
                    <View style={styles.trustItem}>
                      <Text style={styles.trustIcon}>🔐</Text>
                      <Text style={styles.trustText}>End-to-end encrypted</Text>
                    </View>
                    <View style={styles.trustItem}>
                      <Text style={styles.trustIcon}>🛡️</Text>
                      <Text style={styles.trustText}>Zero-knowledge security</Text>
                    </View>
                  </View>

                  <View style={styles.switchContainer}>
                    <Text style={styles.switchText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => setCurrentScreen('signin')}>
                      <Text style={styles.switchLink}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  By signing up, you agree to our Terms of Service
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Base styles
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: height,
  },

  // Login Container
  loginContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loginHeader: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  brandSection: {
    alignItems: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a202c',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  // Login Form
  loginFormContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  loginCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardContent: {
    padding: 32,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  // Google Button
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'San Francisco' : 'Roboto',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Trust Indicators
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  trustIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  trustText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Dashboard Container
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  dashboardHeader: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
  },
  menuButton: {
    padding: 8,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748b',
    marginVertical: 2,
  },

  // User Section
  userSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  userCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  userAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Network Status Bar
  networkStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 8,
  },
  networkStatusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  userStatus: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Navigation Elements
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  orText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    fontSize: 14,
    color: '#6b7280',
  },
  switchLink: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
});

export default App;
