import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ValidatedTextInput } from '../../components/ValidatedTextInput';
import SecurityWalkthrough from '../SecurityWalkthrough';
import TourTarget from '../TourTarget';
import api from '../../api/config';

// Fixed set — same three questions the merchant-dashboard's Profile.jsx
// offers (backend just stores {question, answer} pairs, not a picker of
// arbitrary questions), kept identical so a merchant's answers mean the
// same thing regardless of which app they configured them from.
const DEFAULT_SECURITY_QUESTIONS = [
  'What is the name of the first school you attended?',
  'What is the name of your favorite musician or band?',
  'What was the make and model of your first car?',
];

type Passkey = {
  credentialID: string;
  label: string | null;
  platform?: string;
  userAgent?: string;
  createdAt?: string;
  lastUsed?: string;
};

// Mirrors Profile.jsx's identical helpers — a passkey registered from this
// mobile app itself would come back with platform 'mobile', everything
// else is a browser's WebAuthn registration (Face ID/Touch ID/Windows
// Hello) — mobile can't register a new passkey itself (no WebAuthn), but
// it can view/rename/remove ones registered from any device.
function deviceLabel(platform?: string, userAgent = ''): string {
  if (platform === 'mobile') return 'PayChain mobile app';
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iPhone / iPad browser';
  if (ua.includes('android')) return 'Android browser';
  if (ua.includes('mac os')) return 'Mac browser';
  if (ua.includes('windows')) return 'Windows browser';
  return 'Web browser';
}

function deviceIcon(platform?: string, userAgent = ''): keyof typeof MaterialIcons.glyphMap {
  if (platform === 'mobile') return 'smartphone';
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('android')) return 'smartphone';
  if (ua.includes('ipad')) return 'tablet-mac';
  return 'laptop-mac';
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SecurityTab() {
  const { merchant, updateToken, logout } = useAuth();
  const navigation = useNavigation<any>();

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true);
    try {
      const res = await api.get('/api/auth/merchant/webauthn/passkeys');
      if (res.data.success) setPasskeys(res.data.passkeys);
    } catch (err) {
      // Non-fatal — the card just shows its empty state
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, []);

  useEffect(() => { fetchPasskeys(); }, [fetchPasskeys]);

  const handleRemovePasskey = (pk: Passkey) => {
    Alert.alert(
      'Remove Device',
      `Remove "${pk.label || deviceLabel(pk.platform, pk.userAgent)}"? It will no longer be able to sign in with a passkey.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(pk.credentialID);
            try {
              await api.delete(`/api/auth/merchant/webauthn/passkeys/${pk.credentialID}`);
              setPasskeys((prev) => prev.filter((p) => p.credentialID !== pk.credentialID));
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Failed to remove device.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  const startRenamePasskey = (pk: Passkey) => {
    setRenamingId(pk.credentialID);
    setRenameValue(pk.label || deviceLabel(pk.platform, pk.userAgent));
  };

  const handleRenamePasskey = async (credentialID: string) => {
    const label = renameValue.trim();
    if (!label) { setRenamingId(null); return; }
    setSavingRenameId(credentialID);
    try {
      await api.patch(`/api/auth/merchant/webauthn/passkeys/${credentialID}`, { label });
      setPasskeys((prev) => prev.map((p) => (p.credentialID === credentialID ? { ...p, label } : p)));
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Failed to rename device.');
    } finally {
      setSavingRenameId(null);
      setRenamingId(null);
    }
  };

  const handleSignOutAllDevices = () => {
    Alert.alert(
      'Sign Out All Devices',
      "This signs you out everywhere, including this device. You'll need to log in again right after.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Everywhere',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOutAll(true);
            try {
              await api.post('/api/auth/merchant/sign-out-all-devices');
              await logout();
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Failed to sign out all devices.');
              setIsSigningOutAll(false);
            }
          },
        },
      ]
    );
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Security questions — configured state fetched on mount (mirrors
  // Profile.jsx's fetchSecurityQuestions) purely to show "N questions
  // configured" without a network round-trip on every tap.
  const [questionsConfigured, setQuestionsConfigured] = useState(false);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState(['', '', '']);
  const [questionsPassword, setQuestionsPassword] = useState('');
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  const fetchSecurityQuestions = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/merchant/security-questions');
      if (res.data.success) {
        setQuestionsConfigured(!!res.data.configured);
        setQuestionsCount(res.data.count || 0);
      }
    } catch (err) {
      // Non-fatal — falls back to "Not configured yet"
    }
  }, []);

  useEffect(() => { fetchSecurityQuestions(); }, [fetchSecurityQuestions]);

  async function handlePasswordSave() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'New password and confirm password must match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'New password must be at least 8 characters long.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await api.put('/api/auth/merchant/change-password', { currentPassword, newPassword });
      if (res.data.success) {
        // Changing the password rotates the server-side token version,
        // invalidating the token this very request used — swap in the
        // fresh one the backend returns so the session keeps working
        // (same reasoning as Profile.jsx's web equivalent).
        if (res.data.token) await updateToken(res.data.token);
        Alert.alert('Success', 'Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      Alert.alert('Failed to update password', err.response?.data?.error || 'Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handlePinReset() {
    if (!currentPin || !newPin || !confirmNewPin) {
      Alert.alert('Missing fields', 'Please fill out all PIN fields.');
      return;
    }
    if (newPin !== confirmNewPin) {
      Alert.alert('PINs do not match', 'New PIN and confirm PIN must match.');
      return;
    }
    if (newPin.length !== 4) {
      Alert.alert('Invalid PIN', 'New PIN must be exactly 4 digits.');
      return;
    }

    setIsSavingPin(true);
    try {
      const res = await api.put('/api/auth/merchant/reset-app-pin', { currentPin, newPin });
      if (res.status === 200) {
        Alert.alert('Success', 'Payment PIN updated successfully.');
        setCurrentPin('');
        setNewPin('');
        setConfirmNewPin('');
      }
    } catch (err: any) {
      Alert.alert('Failed to reset PIN', err.response?.data?.message || err.response?.data?.error || 'Please try again.');
    } finally {
      setIsSavingPin(false);
    }
  }

  function openQuestionsModal() {
    setQuestionAnswers(['', '', '']);
    setQuestionsPassword('');
    setShowQuestionsModal(true);
  }

  async function handleQuestionsSave() {
    if (questionAnswers.some((a) => !a.trim())) {
      Alert.alert('Missing answers', 'Please answer all 3 security questions.');
      return;
    }
    if (!questionsPassword) {
      Alert.alert('Password required', 'Please confirm your current password.');
      return;
    }

    setIsSavingQuestions(true);
    try {
      const res = await api.put('/api/auth/merchant/security-questions', {
        questions: DEFAULT_SECURITY_QUESTIONS.map((question, i) => ({ question, answer: questionAnswers[i] })),
        currentPassword: questionsPassword,
      });
      if (res.data.success) {
        Alert.alert('Success', 'Security questions synchronized.');
        setShowQuestionsModal(false);
        fetchSecurityQuestions();
      }
    } catch (err: any) {
      Alert.alert('Failed to update security questions', err.response?.data?.error || 'Please try again.');
    } finally {
      setIsSavingQuestions(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-[#022415]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <SecurityWalkthrough />
      <LinearGradient colors={['#00351d', '#022415']} className="absolute inset-0" />

      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12 relative z-10">

        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="font-jakarta-extrabold text-[28px] text-white tracking-tight leading-tight">Security Vault</Text>
            <Text className="text-[#5efeb3] text-[11px] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-80">Encryption & Access Rules</Text>
          </View>
          <View className="w-12 h-12 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
            <MaterialIcons name="security" size={24} color="#5efeb3" />
          </View>
        </View>

        {/* Change Password */}
        <TourTarget id="change-password-section" className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-6 shadow-xl relative overflow-hidden">
          <View className="absolute top-0 right-0 w-32 h-32 bg-[#5efeb3]/10 rounded-full -mr-16 -mt-16 blur-xl" />

          <View className="flex-row items-center gap-3 mb-6 relative z-10">
            <View className="w-10 h-10 rounded-xl bg-[#006c4e] flex items-center justify-center shadow-md shadow-[#006c4e]/50">
              <Feather name="lock" size={20} color="white" />
            </View>
            <View>
              <Text className="text-[16px] font-jakarta-extrabold text-white tracking-tight">Password</Text>
              <Text className="text-[10px] text-white/50 font-jakarta-medium mt-0.5">Change your access credentials</Text>
            </View>
          </View>

          <View className="gap-4 relative z-10">
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">Current password</Text>
              <TextInput
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#5efeb3]/30"
              />
            </View>
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">New password</Text>
              <TextInput
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={newPassword}
                onChangeText={setNewPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#5efeb3]/30"
              />
            </View>
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">Confirm new password</Text>
              <TextInput
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#5efeb3]/30"
              />
            </View>
          </View>
        </TourTarget>

        {/* Advanced Auth */}
        <View className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-8 shadow-xl relative overflow-hidden">
          <View className="absolute bottom-0 left-0 w-40 h-40 bg-[#f59e0b]/10 rounded-full -ml-20 -mb-20 blur-2xl" />

          <View className="flex-row items-center gap-3 mb-6 relative z-10">
            <View className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center border border-[#f59e0b]/30">
              <MaterialIcons name="admin-panel-settings" size={22} color="#fcd34d" />
            </View>
            <View>
              <Text className="text-[16px] font-jakarta-extrabold text-white tracking-tight">Advanced Methods</Text>
              <Text className="text-[10px] text-white/50 font-jakarta-medium mt-0.5">Biometrics & Bulk Pay authorization</Text>
            </View>
          </View>

          <View className="space-y-6 gap-6 relative z-10">
            {/* Payment PIN — the single PIN used to authorize every
                payment, including bulk pay batches. Only shown once a PIN
                actually exists; otherwise reset-app-pin 400s with "No
                existing PIN found to reset." (merchant sets one for the
                first time from the Bulk Pay flow instead). */}
            {merchant?.hasAppPin && (
              <TourTarget id="change-pin-section" className="bg-black/20 p-5 rounded-2xl border border-white/5">
                <Text className="text-[14px] font-jakarta-extrabold text-white mb-4">Reset Payment PIN</Text>
                <View className="gap-3">
                  <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Current PIN (4 digits)" placeholderTextColor="rgba(255,255,255,0.2)"
                    value={currentPin} onChangeText={setCurrentPin}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                  <View className="flex-row gap-3">
                    <ValidatedTextInput kind="pin4" secureTextEntry placeholder="New" placeholderTextColor="rgba(255,255,255,0.2)"
                      value={newPin} onChangeText={setNewPin} containerClassName="flex-1"
                      className="bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                    <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Confirm" placeholderTextColor="rgba(255,255,255,0.2)"
                      value={confirmNewPin} onChangeText={setConfirmNewPin} containerClassName="flex-1"
                      className="bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                  </View>
                  <TouchableOpacity
                    onPress={handlePinReset}
                    disabled={isSavingPin}
                    className="w-full py-3.5 rounded-xl bg-[#f59e0b] items-center mt-2 shadow-lg shadow-[#f59e0b]/20 active:bg-[#d97706]"
                    style={isSavingPin ? { opacity: 0.6 } : undefined}
                  >
                    {isSavingPin ? (
                      <ActivityIndicator size="small" color="#022415" />
                    ) : (
                      <Text className="text-[#022415] font-jakarta-extrabold text-[11px] uppercase tracking-widest">Update Authorization PIN</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TourTarget>
            )}

            {/* Developer API payouts — a SEPARATE PIN from the payment PIN
                above, only relevant once a Developer account has linked to
                this merchant. See backend/controllers/merchantApiPayoutController.js. */}
            {merchant?.hasAppPin && <ApiPayoutPanel />}

            {/* Security Questions */}
            <TouchableOpacity
              onPress={openQuestionsModal}
              className="w-full flex-row items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5 active:bg-white/5"
            >
              <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MaterialIcons name="help-outline" size={22} color="#9ca3af" />
                </View>
                <View>
                  <Text className="text-[15px] font-jakarta-extrabold text-white">Security Questions</Text>
                  <Text className="text-[11px] text-white/50 font-jakarta-medium mt-0.5">
                    {questionsConfigured ? `${questionsCount} questions configured` : 'Not configured yet'}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            {/* Biometric Login */}
            <TourTarget id="biometrics-register" className="w-full flex-row items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5">
              <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MaterialIcons name="fingerprint" size={22} color={merchant?.mobileBiometricUnlockEnabled ? "#5efeb3" : "#9ca3af"} />
                </View>
                <View>
                  <Text className="text-[15px] font-jakarta-extrabold text-white">Biometric Login</Text>
                  <Text className="text-[11px] text-white/50 font-jakarta-medium mt-0.5">
                    {merchant?.mobileBiometricUnlockEnabled ? 'Active on this device' : 'Use Touch ID or Face ID'}
                  </Text>
                </View>
              </View>
              {merchant?.mobileBiometricUnlockEnabled ? (
                <View className="bg-[#5efeb3]/20 p-2 rounded-full">
                  <MaterialIcons name="check" size={16} color="#5efeb3" />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => navigation.navigate('BiometricSetup')}
                  className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl active:bg-white/20"
                >
                  <Text className="text-[10px] text-white font-jakarta-extrabold uppercase tracking-widest">Setup</Text>
                </TouchableOpacity>
              )}
            </TourTarget>

          </View>
        </View>

        {/* Active Sessions & Devices */}
        <View className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-8 shadow-xl relative overflow-hidden">
          <View className="absolute top-0 left-0 w-32 h-32 bg-[#5efeb3]/10 rounded-full -ml-16 -mt-16 blur-xl" />

          <View className="flex-row items-center gap-3 mb-6 relative z-10">
            <View className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <MaterialIcons name="devices" size={22} color="#9ca3af" />
            </View>
            <View>
              <Text className="text-[16px] font-jakarta-extrabold text-white tracking-tight">Active Sessions & Devices</Text>
              <Text className="text-[10px] text-white/50 font-jakarta-medium mt-0.5">Biometric devices with access to your account</Text>
            </View>
          </View>

          {isLoadingPasskeys ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#5efeb3" size="small" />
            </View>
          ) : passkeys.length === 0 ? (
            <View className="items-center py-6">
              <View className="w-12 h-12 rounded-2xl bg-black/20 items-center justify-center mb-3">
                <MaterialIcons name="fingerprint" size={22} color="rgba(255,255,255,0.4)" />
              </View>
              <Text className="text-white text-[13px] font-jakarta-bold">No devices registered yet</Text>
              <Text className="text-white/40 text-[11px] font-jakarta-medium mt-1 text-center max-w-[220px]">
                Add Face ID, Touch ID, or Windows Hello from the web dashboard for passwordless sign-in.
              </Text>
            </View>
          ) : (
            <View className="gap-1">
              {passkeys.map((pk, idx) => (
                <View
                  key={pk.credentialID}
                  className={`flex-row items-center gap-3 py-3.5 ${idx !== passkeys.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <View className="w-10 h-10 rounded-xl bg-black/20 items-center justify-center">
                    <MaterialIcons name={deviceIcon(pk.platform, pk.userAgent)} size={18} color="#9ca3af" />
                  </View>
                  <View className="flex-1 min-w-0">
                    {renamingId === pk.credentialID ? (
                      <View className="flex-row items-center gap-1.5">
                        <TextInput
                          autoFocus
                          value={renameValue}
                          onChangeText={setRenameValue}
                          maxLength={60}
                          className="flex-1 text-[12px] font-jakarta-bold text-white bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5"
                        />
                        <TouchableOpacity
                          onPress={() => handleRenamePasskey(pk.credentialID)}
                          disabled={savingRenameId === pk.credentialID}
                          className="w-7 h-7 rounded-lg bg-[#5efeb3]/20 items-center justify-center"
                        >
                          {savingRenameId === pk.credentialID ? (
                            <ActivityIndicator size="small" color="#5efeb3" />
                          ) : (
                            <Feather name="check" size={13} color="#5efeb3" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRenamingId(null)}
                          disabled={savingRenameId === pk.credentialID}
                          className="w-7 h-7 rounded-lg bg-white/10 items-center justify-center"
                        >
                          <Feather name="x" size={13} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => startRenamePasskey(pk)} activeOpacity={0.7}>
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-[13px] font-jakarta-bold text-white" numberOfLines={1}>
                            {pk.label || deviceLabel(pk.platform, pk.userAgent)}
                          </Text>
                          <Feather name="edit-2" size={10} color="rgba(255,255,255,0.3)" />
                        </View>
                      </TouchableOpacity>
                    )}
                    <Text className="text-white/40 text-[10px] font-jakarta-medium mt-0.5">
                      Registered {relativeTime(pk.createdAt)}
                      {pk.lastUsed ? ` · Last signed in ${relativeTime(pk.lastUsed)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemovePasskey(pk)}
                    disabled={removingId === pk.credentialID}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    {removingId === pk.credentialID ? (
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
                    ) : (
                      <Feather name="trash-2" size={15} color="rgba(255,255,255,0.4)" />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={handleSignOutAllDevices}
            disabled={isSigningOutAll}
            className="w-full mt-6 py-3.5 rounded-xl bg-red-600/90 flex-row items-center justify-center gap-2"
            style={isSigningOutAll ? { opacity: 0.6 } : undefined}
          >
            {isSigningOutAll ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="phonelink-erase" size={16} color="#fff" />
                <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Sign Out All Devices</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handlePasswordSave}
          disabled={isSavingPassword}
          className="bg-[#006c4e] w-full py-4.5 rounded-2xl flex-row items-center justify-center gap-2 shadow-xl shadow-[#006c4e]/40 active:opacity-80"
          style={isSavingPassword ? { opacity: 0.6 } : undefined}
        >
          {isSavingPassword ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Feather name="shield" size={18} color="white" />
              <Text className="text-white font-jakarta-extrabold text-[13px] uppercase tracking-widest py-1">Save Vault Changes</Text>
            </>
          )}
        </TouchableOpacity>

      </View>

      {/* Security Questions Modal */}
      <Modal visible={showQuestionsModal} transparent animationType="slide" onRequestClose={() => setShowQuestionsModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-lg bg-[#0B2818] rounded-[32px] p-7 border border-white/10 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-[18px] font-jakarta-extrabold text-white tracking-tight">Security Questions</Text>
              <TouchableOpacity onPress={() => setShowQuestionsModal(false)} className="w-9 h-9 rounded-full bg-white/10 items-center justify-center">
                <Feather name="x" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {questionsConfigured && (
              <Text className="text-[11px] text-white/50 font-jakarta-medium mb-5 italic">
                You already have {questionsCount} questions on file. Submitting below replaces all of them — for your security, previous answers are never shown back to you.
              </Text>
            )}

            <ScrollView className="max-h-[380px]" showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                {DEFAULT_SECURITY_QUESTIONS.map((question, i) => (
                  <View key={i}>
                    <Text className="text-[11px] text-white/70 font-jakarta-bold mb-2">{question}</Text>
                    <TextInput
                      placeholder="Your answer"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={questionAnswers[i]}
                      onChangeText={(v) => setQuestionAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)))}
                      className="w-full bg-black/20 border border-white/5 rounded-2xl py-3.5 px-5 text-[14px] font-jakarta-medium text-white"
                    />
                  </View>
                ))}
                <View>
                  <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">Confirm current password</Text>
                  <TextInput
                    secureTextEntry
                    placeholder="••••••••••••"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={questionsPassword}
                    onChangeText={setQuestionsPassword}
                    className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleQuestionsSave}
              disabled={isSavingQuestions}
              className="w-full py-4 rounded-2xl bg-[#5efeb3] items-center justify-center mt-6"
              style={isSavingQuestions ? { opacity: 0.6 } : undefined}
            >
              {isSavingQuestions ? (
                <ActivityIndicator size="small" color="#022415" />
              ) : (
                <Text className="text-[#022415] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Save Questions</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

type ApiPayoutStatus = {
  apiPayoutEnabled: boolean;
  hasApiPayoutPin: boolean;
  caps: { perTransactionKes: number; dailyKes: number };
};

// Developer API payout authorization — mirrors merchant-dashboard's
// ApiPayoutPanel (apps/merchant-dashboard/src/pages/Profile.jsx). A NEW,
// separate PIN from the payment PIN above, letting a linked Developer
// account's own backend trigger real payouts through the API unattended,
// bounded by per-transaction and daily caps chosen here.
function ApiPayoutPanel() {
  const [status, setStatus] = useState<ApiPayoutStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [currentPin, setCurrentPin] = useState('');
  const [apiPayoutPin, setApiPayoutPin] = useState('');
  const [confirmApiPayoutPin, setConfirmApiPayoutPin] = useState('');
  const [perTransactionCapKes, setPerTransactionCapKes] = useState('');
  const [dailyCapKes, setDailyCapKes] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get('/api/auth/merchant/api-payout/status');
      setStatus(res.data);
    } catch (e) {
      // Non-fatal — panel just stays in its loading state's fallback below.
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleEnable() {
    if (!currentPin || !apiPayoutPin || !confirmApiPayoutPin || !perTransactionCapKes || !dailyCapKes) {
      Alert.alert('Missing fields', 'Fill out all fields.');
      return;
    }
    if (apiPayoutPin !== confirmApiPayoutPin) {
      Alert.alert('Mismatch', 'API payout PIN and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/merchant/api-payout/enable', {
        currentPin, apiPayoutPin, confirmApiPayoutPin,
        perTransactionCapKes: Number(perTransactionCapKes),
        dailyCapKes: Number(dailyCapKes),
      });
      Alert.alert('Enabled', 'API payouts enabled.');
      setCurrentPin(''); setApiPayoutPin(''); setConfirmApiPayoutPin(''); setPerTransactionCapKes(''); setDailyCapKes('');
      fetchStatus();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not enable API payouts.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!currentPin) {
      Alert.alert('PIN required', 'Enter your current payment PIN.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/merchant/api-payout/disable', { currentPin });
      Alert.alert('Disabled', 'API payouts disabled.');
      setCurrentPin('');
      fetchStatus();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not disable API payouts.');
    } finally {
      setBusy(false);
    }
  }

  if (loadingStatus) {
    return <View className="bg-black/20 p-5 rounded-2xl border border-white/5 h-24" />;
  }

  return (
    <View className="bg-black/20 p-5 rounded-2xl border border-white/5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[14px] font-jakarta-extrabold text-white">Developer API Payouts</Text>
        <View className={`px-2 py-1 rounded-lg ${status?.apiPayoutEnabled ? 'bg-[#5efeb3]/20' : 'bg-white/10'}`}>
          <Text className={`text-[9px] font-jakarta-extrabold uppercase tracking-widest ${status?.apiPayoutEnabled ? 'text-[#5efeb3]' : 'text-white/40'}`}>
            {status?.apiPayoutEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>
      <Text className="text-[11px] text-white/50 font-jakarta-medium mb-4">
        Lets a linked Developer account's own backend trigger real payouts through the API, unattended — guarded by a separate PIN from your payment PIN, with hard per-transaction and daily limits.
      </Text>

      {status?.apiPayoutEnabled ? (
        <View className="gap-3">
          <Text className="text-[11px] text-white/60">
            Per-transaction cap: Ksh {Number(status.caps?.perTransactionKes ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Daily cap: Ksh {Number(status.caps?.dailyKes ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Current payment PIN (4 digits)" placeholderTextColor="rgba(255,255,255,0.2)"
            value={currentPin} onChangeText={setCurrentPin}
            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
          <TouchableOpacity
            onPress={handleDisable}
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-red-500/20 border border-red-500/30 items-center"
            style={busy ? { opacity: 0.6 } : undefined}
          >
            {busy ? <ActivityIndicator size="small" color="#f87171" /> : (
              <Text className="text-red-300 font-jakarta-extrabold text-[11px] uppercase tracking-widest">Disable API Payouts</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View className="gap-3">
          <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Current payment PIN (4 digits)" placeholderTextColor="rgba(255,255,255,0.2)"
            value={currentPin} onChangeText={setCurrentPin}
            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
          <TextInput
            secureTextEntry
            placeholder="New API payout PIN (6+ characters, not your app PIN)"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={apiPayoutPin}
            onChangeText={setApiPayoutPin}
            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[13px] text-white"
          />
          <TextInput
            secureTextEntry
            placeholder="Confirm API payout PIN"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={confirmApiPayoutPin}
            onChangeText={setConfirmApiPayoutPin}
            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[13px] text-white"
          />
          <View className="flex-row gap-3">
            <TextInput
              keyboardType="numeric"
              placeholder="Per-tx cap (KES)"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={perTransactionCapKes}
              onChangeText={setPerTransactionCapKes}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[13px] text-white"
            />
            <TextInput
              keyboardType="numeric"
              placeholder="Daily cap (KES)"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={dailyCapKes}
              onChangeText={setDailyCapKes}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[13px] text-white"
            />
          </View>
          <TouchableOpacity
            onPress={handleEnable}
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-indigo-500 items-center mt-1"
            style={busy ? { opacity: 0.6 } : undefined}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Enable API Payouts</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
