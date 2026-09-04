import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList, Image, Linking } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useBiometrics } from '../hooks/useBiometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import { validators } from '../utils/validators';

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", 
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", 
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", 
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", 
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", 
  "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", 
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

export default function Login({ route }: any) {
  const { login, biometricLogin, signup, verifyOTP, forgotPassword, resetPassword,
          isBiometricsEnabled, hasBiometricToken, logoutReason, clearLogoutReason } = useAuth();
  const { authenticate: authenticateBiometric } = useBiometrics();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Idle/background auto-logout (AuthContext) sets logoutReason instead of
  // silently dropping the merchant back here — surface it once, the same
  // way biometricLogin's own "Session expired" message already renders.
  useEffect(() => {
    const REASON_MESSAGES: Record<string, string> = {
      'session-invalid': 'Your session is no longer valid. Please sign in again.',
    };
    if (logoutReason && REASON_MESSAGES[logoutReason]) {
      setErr(REASON_MESSAGES[logoutReason]);
      clearLogoutReason();
    }
  }, [logoutReason]);

  // Signup Flow States
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupBusinessName, setSignupBusinessName] = useState('');
  const [signupEcommerce, setSignupEcommerce] = useState('yes');
  const [signupCounty, setSignupCounty] = useState('');
  const [countySearch, setCountySearch] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [area, setArea] = useState('');
  const [employees, setEmployees] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Flipped true the first time Continue is pressed with an invalid field —
  // forces every ValidatedTextInput on this step to show its own inline
  // error immediately (via forceTouched), not just the ones the user
  // happened to already blur, so a failed Continue attempt points at every
  // problem field at once instead of only the generic banner error.
  const [signupStepTouched, setSignupStepTouched] = useState(false);

  // Modals for Selection
  const [showCountyModal, setShowCountyModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);

  // Reset Flow States
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strength, setStrength] = useState({ length: false, upper: false, number: false, symbol: false });

  // OTP Flow States
  const [isOTPMode, setIsOTPMode] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'login');
  const [isSignupPasswordStep, setIsSignupPasswordStep] = useState(false);
  const [otpFlowType, setOtpFlowType] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' or 'sms' — which channel the current OTP went out on
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('');
  const [resendTimer, setResendTimer] = useState(59);

  const [hasAccount, setHasAccount] = useState(false);

  // isBiometricsEnabled = server flag (set by web or native app, unified).
  // hasBiometricToken = there is a JWT stored in SecureStore to unlock.
  // Both must be true to show the biometric quick-login button.
  const showBiometricButton = isBiometricsEnabled && hasBiometricToken;

  useEffect(() => {
    AsyncStorage.getItem('hasAccount').then(val => {
      if (val === 'true') setHasAccount(true);
    });
  }, []);

  useEffect(() => {
    setStrength({
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword)
    });
  }, [newPassword]);

  useEffect(() => {
    if (isOTPMode && resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOTPMode, resendTimer]);

  const handleLogin = async () => {
    if (!phone || !password) {
      setErr('Please enter both email and password');
      return;
    }
    setLoading(true);
    setErr('');
    const res = await login(phone, password);
    setLoading(false);
    if (res.success) {
      setAuthEmail(res.email);
      if (res.mfaRequired) {
        setOtpFlowType('login');
        setIsOTPMode(true);
        setResendTimer(59);
        setOtpChannel(res.channel || 'email');
        setOtpMaskedPhone(res.maskedPhone || '');
      }
    } else {
      setErr(res.error);
    }
  };

  const handleBiometricSignIn = async () => {
    setErr('');
    // Step 1: verify identity locally on the device
    const auth = await authenticateBiometric('Sign in to PayChain');
    if (!auth.success) {
      if (!auth.cancelled) setErr(auth.error);
      return;
    }
    // Step 2: retrieve the JWT from the OS Keychain/Keystore and rehydrate session
    setLoading(true);
    const res = await biometricLogin();
    setLoading(false);
    if (!res.success) setErr(res.error || 'Session expired. Please sign in with your password.');
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    
    setLoading(true);
    const res = await verifyOTP(authEmail, code);
    setLoading(false);
    
    if (res.success) {
      setIsOTPMode(false);
      if (otpFlowType === 'reset') {
        setIsResetMode(true);
      } else if (otpFlowType === 'signup' || otpFlowType === 'login') {
        await AsyncStorage.setItem('hasAccount', 'true');
        setHasAccount(true);
      }
      // If otpFlowType === 'signup' or 'login', verifyOTP successfully sets the session context,
      // which will instantly unmount the Login screen and move to PinSetup or Dashboard.
      setErr('');
    } else {
      setErr(res.error);
    }
  };

  const handleForgotPassword = async () => {
    if (!phone) {
      setErr('Please enter email or phone number');
      return;
    }
    setLoading(true);
    const res = await forgotPassword(phone);
    setLoading(false);
    if (res.success) {
      setAuthEmail(phone);
      setOtpFlowType('reset');
      setIsOTPMode(true);
      setResendTimer(59);
      setActiveTab('login');
    } else {
      setErr(res.error);
    }
  };

  const handleResetPassword = async () => {
    if (!Object.values(strength).every(v => v)) {
      setErr('Please meet all security requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    setLoading(true);
    const code = otp.join('');
    const res = await resetPassword(authEmail, code, newPassword);
    setLoading(false);
    
    if (res.success) {
      setIsResetMode(false);
      setActiveTab('login');
      setPassword('');
      setNewPasswordInput('');
      setConfirmPassword('');
    } else {
      setErr(res.error);
    }
  };

  const handleSignupContinue = () => {
    // Real validators, not the previous name/phone presence-or-length-only
    // checks — those were weaker than what ValidatedTextInput itself uses to
    // show the inline error on this exact screen (e.g. phone only checked
    // `.length < 9`, so a 9+ digit but not-actually-Kenyan number displayed
    // an error yet still passed this gate and reached the password step).
    // Marks the whole step touched first so every field's own inline error
    // renders immediately (forceTouched), pointing at each specific problem
    // rather than only a generic banner.
    setSignupStepTouched(true);

    if (!validators.personName(signupName).valid) {
      setErr('Please enter a valid name before continuing.');
      return;
    }
    if (!validators.email(signupEmail).valid) {
      setErr('Please enter a valid email address before continuing.');
      return;
    }
    if (!validators.phoneKE(signupPhone).valid) {
      setErr('Please enter a valid Kenyan phone number before continuing.');
      return;
    }
    if (!validators.businessName(signupBusinessName).valid) {
      setErr('Please enter a valid business name before continuing.');
      return;
    }
    if (!businessType) {
      setErr('Please select a business type.');
      return;
    }
    if (!signupCounty) {
      setErr('Please select your county.');
      return;
    }
    if (!area.trim()) {
      setErr('Please enter your area/location.');
      return;
    }
    if (!employees) {
      setErr('Please select the number of employees.');
      return;
    }
    if (!signupEcommerce) {
      setErr('Please let us know whether this is an eCommerce business.');
      return;
    }
    setErr('');
    setSignupStepTouched(false);
    setIsSignupPasswordStep(true);
  };

  const handleSignupCreateAccount = async () => {
    if (!Object.values(strength).every(v => v)) {
      setErr('Please meet all security requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    const payload = {
      name: signupName,
      email: signupEmail,
      phone: signupPhone,
      businessName: signupBusinessName,
      password: newPassword,
      ecommerce: signupEcommerce,
      businessType,
      county: signupCounty,
      area,
      employees,
      agreedToTerms,
    };

    setLoading(true);
    const res = await signup(payload);
    setLoading(false);
    
    if (res.success) {
      setIsSignupPasswordStep(false);
      setAuthEmail(signupEmail);
      setOtpFlowType('signup');
      setIsOTPMode(true);
      setResendTimer(59);
    } else {
      setErr(res.error);
    }
  };

  const renderTabs = () => (
    <View className="flex-row bg-[#f0f2f1] p-1.5 rounded-2xl mb-8">
      {['signup', 'login', 'reset'].filter(t => t !== 'signup' || !hasAccount).map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => {
            setActiveTab(tab);
            setIsOTPMode(false);
            setIsResetMode(false);
            setIsSignupPasswordStep(false);
            setNewPasswordInput('');
            setConfirmPassword('');
            setAgreedToTerms(false);
            setOtpChannel('email');
            setOtpMaskedPhone('');
            setErr('');
          }}
          className={`flex-1 py-3 px-2 rounded-xl items-center justify-center ${
            activeTab === tab ? 'bg-white shadow-sm' : 'bg-transparent'
          }`}
        >
          <Text className={`text-[11px] font-jakarta-bold uppercase tracking-widest ${
            activeTab === tab ? 'text-[#06201b]' : 'text-[#707971]'
          }`}>
            {tab === 'signup' ? 'Sign Up' : tab === 'login' ? 'Login' : 'Reset'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const SecurityRequirement = ({ met, label }: { met: boolean, label: string }) => (
    <View className="flex-row items-center mb-1">
      <Feather name={met ? "check-circle" : "circle"} size={12} color={met ? "#10b981" : "#bfc9bf"} />
      <Text className={`ml-2 text-[10px] font-jakarta-bold uppercase tracking-widest ${met ? 'text-[#10b981]' : 'text-[#707971]'}`}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
          <View className="px-8 pt-10 pb-8 justify-end">
            <Text className="text-white text-[28px] font-jakarta-bold tracking-tight">PayChain</Text>
            <Text className="text-[#68dbae] text-[12px] font-jakarta-bold tracking-[0.15em] uppercase mt-1">Merchant Portal</Text>
            <Text className="text-white text-[28px] font-jakarta-bold mt-6 mb-2 leading-[34px]">
              Collect.{'\n'}Pay.{'\n'}Grow.
            </Text>
          </View>

          <View className="bg-white w-full flex-1 rounded-t-[32px] px-6 pt-10 pb-16 shadow-lg">
            {!isSignupPasswordStep && !isOTPMode && !isResetMode && renderTabs()}

            {err ? (
              <View className="bg-red-50 border border-red-200 p-4 rounded-xl flex-row items-center mb-6">
                <Feather name="alert-circle" size={18} color="#b91c1c" />
                <Text className="text-red-700 text-[12px] font-jakarta-bold ml-3 flex-1">{err}</Text>
              </View>
            ) : null}

            {activeTab === 'login' && !isOTPMode && !isResetMode && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Sign in</Text>
                <Text className="text-[#707971] text-[14px] font-jakarta-bold mb-6">Enter credentials provided during onboarding.</Text>

                {showBiometricButton && (
                  <TouchableOpacity onPress={handleBiometricSignIn} className="bg-[#ecfdf5] border border-[#a7f3d0] py-4 rounded-2xl flex-row justify-center items-center mb-6">
                    <Feather name="target" size={20} color="#047857" />
                    <Text className="text-[#047857] font-jakarta-bold text-[14px] ml-3">Sign in with Passkey / Biometrics</Text>
                  </TouchableOpacity>
                )}

                <View className="mb-6">
                  <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Phone Number or Email</Text>
                  <TextInput
                    className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]"
                    placeholder="0712345678 or john@example.com"
                    placeholderTextColor="#9ca3af"
                    value={phone}
                    onChangeText={setPhone}
                    autoCapitalize="none"
                  />
                </View>

                <View className="mb-8">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest">Password</Text>
                    <TouchableOpacity onPress={() => setActiveTab('reset')}><Text className="text-[#059669] text-[11px] font-jakarta-bold uppercase tracking-widest">Forgot?</Text></TouchableOpacity>
                  </View>
                  <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                    <TextInput 
                      className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]"
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleLogin} disabled={loading}
                  className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mb-8"
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Sign In</Text>}
                </TouchableOpacity>

                <View className="flex-row items-center justify-center opacity-50 pt-4 gap-2">
                  <Text className="text-[#00351d] opacity-60 text-[9px] font-jakarta-bold uppercase tracking-[2px]">
                    Powered by
                  </Text>
                  <Image source={require('../../assets/poweredby-logo.png')} style={{ height: 16, width: 80, resizeMode: 'contain' }} />
                </View>
              </View>
            )}

            {activeTab === 'reset' && !isOTPMode && !isResetMode && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Reset Password</Text>
                <Text className="text-[#707971] text-[14px] font-jakarta-bold mb-6">Enter your registered phone number or email address to receive a recovery code.</Text>

                <View className="mb-6">
                  <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Phone Number or Email</Text>
                  <TextInput
                    className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]"
                    placeholder="0712345678 or john@example.com"
                    placeholderTextColor="#9ca3af"
                    value={phone}
                    onChangeText={setPhone}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleForgotPassword} disabled={loading}
                  className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center"
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Send Recovery Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {isOTPMode && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Enter OTP</Text>
                <Text className="text-[#707971] text-[14px] font-jakarta-bold mb-6">
                  {otpChannel === 'sms'
                    ? `Enter the code sent via SMS to ${otpMaskedPhone || 'your phone'}`
                    : `Enter the code sent to ${authEmail}`}
                </Text>
                
                <View className="flex-row justify-between mb-8">
                  {otp.map((digit, index) => (
                    <TextInput 
                      key={index}
                      className="w-[45px] h-[55px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl text-center text-[20px] font-jakarta-bold text-[#0c2010]"
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(val) => {
                        const newOtp = [...otp];
                        newOtp[index] = val;
                        setOtp(newOtp);
                      }}
                    />
                  ))}
                </View>
                
                <TouchableOpacity onPress={handleVerifyOTP} disabled={loading || otp.join('').length < 6} className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mb-4 opacity-100">
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Verify Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {isResetMode && (
              <View>
                 <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-6">Create New Password</Text>
                 <View className="mb-6">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">New Password</Text>
                    <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                      <TextInput className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]" placeholder="••••••••" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPasswordInput} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2"><Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" /></TouchableOpacity>
                    </View>
                 </View>
                 <View className="mb-8">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Confirm Password</Text>
                    <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                      <TextInput className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]" placeholder="••••••••" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="p-2"><Feather name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" /></TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                      <Text className="text-red-500 text-[11px] font-jakarta-bold mt-1.5">Passwords do not match</Text>
                    ) : null}
                 </View>
                 <TouchableOpacity
                   onPress={handleResetPassword}
                   disabled={loading || !confirmPassword || newPassword !== confirmPassword}
                   style={{ opacity: (!confirmPassword || newPassword !== confirmPassword) ? 0.4 : 1 }}
                   className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center"
                 >
                    {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Set Password</Text>}
                 </TouchableOpacity>
              </View>
            )}

            {activeTab === 'signup' && !isSignupPasswordStep && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Get started with us</Text>
                <Text className="text-[#707971] text-[14px] font-jakarta-bold mb-6">Fill out the form below to create your merchant account and start accepting payments.</Text>

                <View className="space-y-4">
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Your Name *</Text>
                    <ValidatedTextInput kind="personName" value={signupName} onChangeText={setSignupName} placeholder="John Doe" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Your Email *</Text>
                    <ValidatedTextInput kind="email" value={signupEmail} onChangeText={setSignupEmail} placeholder="john@example.com" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Your Phone *</Text>
                    <ValidatedTextInput kind="phoneKE" value={signupPhone} onChangeText={setSignupPhone} placeholder="0712 345 678" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Business Name *</Text>
                    <ValidatedTextInput kind="businessName" value={signupBusinessName} onChangeText={setSignupBusinessName} placeholder="Acme Corp" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Business Type *</Text>
                    <TouchableOpacity onPress={() => setShowBusinessModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                      <Text className={`text-[14px] font-jakarta-bold ${businessType ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`}>{businessType || '—Please choose an option—'}</Text>
                      <Feather name="chevron-down" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">County *</Text>
                    <TouchableOpacity onPress={() => setShowCountyModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                      <Text className={`text-[14px] font-jakarta-bold ${signupCounty ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`}>{signupCounty || 'Search your county...'}</Text>
                      <Feather name="search" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Area/Location *</Text>
                    <ValidatedTextInput kind="personName" value={area} onChangeText={setArea} placeholder="Westlands"
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Employees *</Text>
                    <TouchableOpacity onPress={() => setShowEmployeesModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                      <Text className={`text-[14px] font-jakarta-bold ${employees ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`}>{employees || '—Please choose an option—'}</Text>
                      <Feather name="chevron-down" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  <View className="mb-4">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Is this an eCommerce business?</Text>
                    <View className="flex-row space-x-4">
                      <TouchableOpacity onPress={() => setSignupEcommerce('yes')} className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${signupEcommerce === 'yes' ? 'bg-[#06201b] border-[#06201b]' : 'bg-white border-[#e5e7eb]'}`}>
                        <Text className={`font-jakarta-bold text-[14px] ${signupEcommerce === 'yes' ? 'text-white' : 'text-[#0c2010]'}`}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setSignupEcommerce('no')} className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${signupEcommerce === 'no' ? 'bg-[#06201b] border-[#06201b]' : 'bg-white border-[#e5e7eb]'}`}>
                        <Text className={`font-jakarta-bold text-[14px] ${signupEcommerce === 'no' ? 'text-white' : 'text-[#0c2010]'}`}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleSignupContinue} className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mt-4">
                    <Text className="text-white font-jakarta-bold text-[16px]">Submit Application</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isSignupPasswordStep && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-6">Set Custom Access</Text>
                 <View className="mb-4">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">New Password</Text>
                    <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                      <TextInput className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]" placeholder="••••••••" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPasswordInput} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2"><Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" /></TouchableOpacity>
                    </View>
                 </View>
                 
                 <View className="bg-[#f0fdf4] p-4 rounded-2xl mb-6 border border-[#a7f3d0]">
                   <SecurityRequirement met={strength.length} label="Minimum 8 Characters" />
                   <SecurityRequirement met={strength.upper} label="Uppercase letters (A, B, C)" />
                   <SecurityRequirement met={strength.number} label="Numerical digits (1, 2, 3)" />
                   <SecurityRequirement met={strength.symbol} label="Special Symbols (@, #, $)" />
                 </View>

                 <View className="mb-8">
                    <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Confirm Password</Text>
                    <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                      <TextInput className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]" placeholder="••••••••" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="p-2"><Feather name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" /></TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                      <Text className="text-red-500 text-[11px] font-jakarta-bold mt-1.5">Passwords do not match</Text>
                    ) : null}
                 </View>

                 <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7} className="flex-row items-start mb-6">
                   <View className="mr-3 mt-0.5">
                     <Feather name={agreedToTerms ? "check-square" : "square"} size={20} color={agreedToTerms ? "#047857" : "#9ca3af"} />
                   </View>
                   <Text className="flex-1 text-[12px] font-jakarta-bold text-[#707971] leading-[18px]">
                     I confirm that I have read and agree to PayChain's{' '}
                     <Text className="text-[#047857] font-jakarta-bold" onPress={() => Linking.openURL('https://www.paychain.co.ke/privacy-policy')}>
                       Privacy Policy
                     </Text>
                     {' '}and{' '}
                     <Text className="text-[#047857] font-jakarta-bold" onPress={() => Linking.openURL('https://www.paychain.co.ke/terms-of-service')}>
                       Terms of Service
                     </Text>.
                   </Text>
                 </TouchableOpacity>

                 <TouchableOpacity
                   onPress={handleSignupCreateAccount}
                   disabled={loading || !Object.values(strength).every(v => v) || !confirmPassword || newPassword !== confirmPassword || !agreedToTerms}
                   style={{ opacity: (!Object.values(strength).every(v => v) || !confirmPassword || newPassword !== confirmPassword || !agreedToTerms) ? 0.4 : 1 }}
                   className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center"
                 >
                    {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Create Account</Text>}
                 </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals for Dropdowns */}
      <Modal visible={showCountyModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Select County</Text>
              <TouchableOpacity onPress={() => setShowCountyModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            <TextInput 
              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl py-3 px-4 mb-4 text-[14px] font-jakarta-bold"
              placeholder="Search county..."
              value={countySearch}
              onChangeText={setCountySearch}
            />
            <FlatList 
              data={KENYAN_COUNTIES.filter(c => c.toLowerCase().includes(countySearch.toLowerCase()))}
              keyExtractor={item => item}
              renderItem={({item}) => (
                <TouchableOpacity className="py-4 border-b border-[#e5e7eb]" onPress={() => { setSignupCounty(item); setShowCountyModal(false); }}>
                  <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showBusinessModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Business Type</Text>
              <TouchableOpacity onPress={() => setShowBusinessModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            {['Sole Proprietorship', 'Partnership', 'Limited Liability Company (LLC)', 'Public Limited Company (PLC)', 'SACCO', 'NGO/Non-Profit', 'Cooperative Society', 'Other'].map(type => (
              <TouchableOpacity key={type} className="py-4 border-b border-[#e5e7eb]" onPress={() => { setBusinessType(type); setShowBusinessModal(false); }}>
                <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showEmployeesModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Number of Employees</Text>
              <TouchableOpacity onPress={() => setShowEmployeesModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            {['1-10', '11-50', '51-200', '201-500', '501+'].map(type => (
              <TouchableOpacity key={type} className="py-4 border-b border-[#e5e7eb]" onPress={() => { setEmployees(type); setShowEmployeesModal(false); }}>
                <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
