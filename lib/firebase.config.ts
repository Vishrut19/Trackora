import auth from '@react-native-firebase/auth';

// Firebase is auto-initialized via google-services.json (Android)
// and GoogleService-Info.plist (iOS)

// Export auth instance
export const firebaseAuth = auth();

// Helper function to get current user
export const getCurrentUser = () => {
  return firebaseAuth.currentUser;
};

// Helper function to get ID token for Supabase
export const getFirebaseIdToken = async () => {
  const user = getCurrentUser();
  if (!user) return null;
  return await user.getIdToken();
};
