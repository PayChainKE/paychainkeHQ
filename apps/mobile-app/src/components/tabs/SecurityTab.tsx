import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ValidatedTextInput } from '../../components/ValidatedTextInput';
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

export default function SecurityTab() {
  const { merchant, updateToken } = useAuth();
  const navigation = useNavigation<any>();

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
        <View className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-6 shadow-xl relative overflow-hidden">
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
        </View>

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
            {/* Bulk Pay PIN */}
            <View className="bg-black/20 p-5 rounded-2xl border border-white/5">
              <Text className="text-[14px] font-jakarta-extrabold text-white mb-4">Reset Bulk Pay PIN</Text>
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
            </View>

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
            <View className="w-full flex-row items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5">
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
            </View>

          </View>
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
