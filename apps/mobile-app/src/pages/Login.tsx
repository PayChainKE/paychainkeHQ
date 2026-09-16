import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList, Image, Linking } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useBiometrics } from '../hooks/useBiometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import { validators } from '../utils/validators';
import { KENYA_COUNTY_AREAS } from '../utils/kenyaCountyAreas';
import { fetchSignupWards, searchSignupPlaces, StreetSearchResult } from '../utils/kenyaLocations';
import { KYB_REQUIREMENTS_BY_BUSINESS_TYPE, KYB_DOC_LABELS, isDocSelected, resolveDocTypes } from '../utils/kybRequirements';

type PickedFile = { uri: string; name?: string; mimeType?: string; size?: number };

// The exact set the backend's own Multer fileFilter accepts
// (backend/utils/cloudinary.js's uploadMemory) — anything else (most
// commonly an iPhone Photos-library picker returning HEIC, the device's
// default camera format) is silently DROPPED by the server rather than
// erroring: Multer's fileFilter just excludes the file from req.files with
// no error at all, so signup would previously fail later with a confusing
// "upload your document" message even though a file was picked. Mirrors
// apps/merchant-dashboard/src/utils/imageBlurCheck.js's
// unsupportedDocumentTypeReason — keep both in sync if this ever changes.
// Only blocks when a mimeType was actually reported; if the picker can't
// tell us (some Android providers omit it), we let the server decide
// rather than block a possibly-fine file on missing information.
function unsupportedDocumentTypeReason(file: { mimeType?: string; name?: string }): string | null {
  if (!file.mimeType) return null;
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowed.includes(file.mimeType)) return null;
  if (/heic|heif/i.test(file.mimeType) || /\.(heic|heif)$/i.test(file.name || '')) {
    return "iPhone photos in HEIC format aren't supported. Go to Settings > Camera > Formats and choose \"Most Compatible\", then try again.";
  }
  return 'That file type is not supported — please choose a JPG, PNG or PDF.';
}

// The camera-capture option below needs the native CAMERA permission
// declared in app.json's expo-image-picker plugin config — but that only
// takes effect once compiled into an actual native build (OTA updates
// never touch permissions). Until that build has gone through its own
// Play Store review and is what's actually installed on devices, showing
// "Take Photo" here is a dead end: requestCameraPermissionsAsync() comes
// back denied on every currently-live install, since the permission was
// never declared for it in the first place. Flip this to true (and this
// file ships instantly via the OTA pipeline) once that build is live —
// no other code change needed, captureIdPhoto/renderNationalIdSlot below
// are already written to support both modes.
const NATIONAL_ID_CAMERA_CAPTURE_ENABLED = false;

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", 
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", 
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", 
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", 
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", 
  "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", 
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

// Groups the signup form into labeled sections (Personal/Business/Location/
// Documents) instead of one long list of fields — mirrors the same pattern
// on the web signup form (apps/merchant-dashboard/src/pages/Login.jsx's
// SignupSectionHeader): an icon, a caps label, and a hairline rule
// extending to the edge, the way bank account-opening forms are sectioned.
function SignupSectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View className="flex-row items-center gap-2 mt-1 mb-1">
      <MaterialIcons name={icon} size={16} color="#0c2010" style={{ opacity: 0.4 }} />
      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest">{title}</Text>
      <View className="flex-1 h-px bg-[#e5e7eb]" />
    </View>
  );
}

export default function Login({ route }: any) {
  const { login, biometricLogin, signup, sendSignupPhoneOtp, verifySignupPhoneOtp, verifyOTP, resendOTP, forgotPassword, resetPassword,
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
      'session-invalid': 'Your session is no longer valid. Please log in again.',
    };
    if (logoutReason && REASON_MESSAGES[logoutReason]) {
      setErr(REASON_MESSAGES[logoutReason]);
      clearLogoutReason();
    }
  }, [logoutReason]);

  // Signup Flow States
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupSurname, setSignupSurname] = useState('');
  const [signupOtherNames, setSignupOtherNames] = useState('');
  const [signupNationalId, setSignupNationalId] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupBusinessName, setSignupBusinessName] = useState('');
  const [signupEcommerce, setSignupEcommerce] = useState('yes');
  const [signupCounty, setSignupCounty] = useState('');
  const [countySearch, setCountySearch] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [signupArea, setSignupArea] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [countyWards, setCountyWards] = useState<Record<string, Record<string, string[]>>>({});
  const [signupWard, setSignupWard] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [signupStreet, setSignupStreet] = useState('');
  const [streetResults, setStreetResults] = useState<StreetSearchResult[]>([]);
  const [streetSearching, setStreetSearching] = useState(false);
  const [streetResultsOpen, setStreetResultsOpen] = useState(false);
  const [employees, setEmployees] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // signupDocType: which option was picked, 'choice'-mode business types
  // only (e.g. Sole Proprietorship choosing National ID vs Business
  // Permit/License) or the extra choiceAlso slot (LLC) — irrelevant for a
  // fixed 'all'-mode slot. signupDocs/docErrors are keyed by doc type so
  // every slot, whether one or several, shares the same file-handling code.
  const [signupDocType, setSignupDocType] = useState('');
  const [docTypeModalOptions, setDocTypeModalOptions] = useState<string[]>([]);
  // Common shape for a picked file regardless of source (expo-document-picker's
  // upload path vs expo-image-picker's camera path use differently-named
  // asset fields — normalized to this on the way in, see pickDoc/captureIdPhoto).
  const [signupDocs, setSignupDocs] = useState<Record<string, PickedFile | null>>({});
  // Which path the merchant chose for National ID — 'upload' or 'camera'.
  // Both now collect front+back separately (see renderNationalIdSlot);
  // this just tracks which one so the right picker (pickDoc vs
  // captureIdPhoto) is wired to the same two boxes.
  const [nationalIdMode, setNationalIdMode] = useState<'upload' | 'camera' | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  // Flipped true the first time Continue is pressed with an invalid field —
  // forces every ValidatedTextInput on this step to show its own inline
  // error immediately (via forceTouched), not just the ones the user
  // happened to already blur, so a failed Continue attempt points at every
  // problem field at once instead of only the generic banner error.
  const [signupStepTouched, setSignupStepTouched] = useState(false);

  // Modals for Selection
  const [showCountyModal, setShowCountyModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
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
  // Shown after a successful application submission, replacing the signup
  // form — the account is pending admin/officer approval and has no
  // working login yet, so there's nothing to auto-sign-in into (see
  // handleSignupCreateAccount above).
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  // Phone verification — inserted between the main signup form and the
  // Review & Submit step. Deliberately its own state, not folded into the
  // isOTPMode/otp machinery above: that one is coupled to an existing
  // merchant's email (verifyOTP/resendOTP key off authEmail), and this step
  // runs before any Merchant document exists at all.
  const [isPhoneVerifyStep, setIsPhoneVerifyStep] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const [phoneOtpMaskedPhone, setPhoneOtpMaskedPhone] = useState('');
  const [phoneOtpResendTimer, setPhoneOtpResendTimer] = useState(0);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  // Proof of verification handed back with the final registerMerchant
  // submission. verifiedPhoneNumber records exactly which number it's for,
  // so editing the phone after verifying can't silently carry a stale
  // token forward — see handleSignupCreateAccount.
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState('');
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

  useEffect(() => {
    if (isPhoneVerifyStep && phoneOtpResendTimer > 0) {
      const interval = setInterval(() => {
        setPhoneOtpResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPhoneVerifyStep, phoneOtpResendTimer]);

  // Ward taxonomy for the (optional) ward picker below Area — fetched once
  // rather than duplicated as another multi-hundred-entry literal (see
  // kenyaLocations.ts). Non-critical: a failure just means the ward step
  // never appears — county/area picking still works fully offline of this.
  useEffect(() => {
    fetchSignupWards().then(setCountyWards);
  }, []);

  // Optional street/estate/landmark search — live suggestions from the
  // public Nominatim proxy, biased toward the county already picked above.
  // Debounced so normal typing stays well under that endpoint's rate limit.
  useEffect(() => {
    const q = signupStreet.trim();
    if (q.length < 3) {
      setStreetResults([]);
      setStreetSearching(false);
      return;
    }
    setStreetSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchSignupPlaces(q, signupCounty);
      setStreetResults(results);
      setStreetResultsOpen(true);
      setStreetSearching(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [signupStreet, signupCounty]);

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
    const auth = await authenticateBiometric('Log in to PayChain');
    if (!auth.success) {
      if (!auth.cancelled) setErr(auth.error);
      return;
    }
    // Step 2: retrieve the JWT from the OS Keychain/Keystore and rehydrate session
    setLoading(true);
    const res = await biometricLogin();
    setLoading(false);
    if (!res.success) setErr(res.error || 'Session expired. Please log in with your password.');
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
      } else if (otpFlowType === 'login') {
        await AsyncStorage.setItem('hasAccount', 'true');
        setHasAccount(true);
      }
      // If otpFlowType === 'login', verifyOTP successfully sets the session
      // context, which will instantly unmount the Login screen and move to
      // PinSetup or Dashboard. Signup no longer goes through OTP at all —
      // a submitted application is pending approval, not auto-logged in
      // (see handleSignupCreateAccount's signupSubmitted screen instead).
      setErr('');
    } else {
      setErr(res.error);
    }
  };

  // Mirrors web Login.jsx's handleResendOTP exactly — same resendOTP(authEmail)
  // call, flow-agnostic (works for both otpFlowType 'login' and 'reset'
  // since it's keyed only on authEmail, not which flow started it). This
  // was previously missing here entirely: resendTimer counted down with
  // nothing wired to trigger a resend once it hit zero.
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    const res = await resendOTP(authEmail);
    setLoading(false);
    if (res.success) {
      setResendTimer(59);
      setOtpChannel(res.channel || otpChannel);
      setOtpMaskedPhone(res.maskedPhone || otpMaskedPhone);
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

  // Shared picker for every KYB document slot — one per doc type
  // (business_registration, national_id, kra_pin, etc.), keyed the same
  // way signupDocs/docErrors are. Blur detection is deliberately not done
  // here (no canvas API in React Native) — the backend independently
  // re-checks sharpness on every upload and is the real enforcement gate
  // even on web; a blurry photo surfaces as a server error after submit,
  // prompting retake.
  const pickDoc = async (type: string) => {
    setDocErrors(prev => ({ ...prev, [type]: '' }));
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const typeError = unsupportedDocumentTypeReason(asset);
      if (typeError) {
        setDocErrors(prev => ({ ...prev, [type]: typeError }));
        return;
      }
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setDocErrors(prev => ({ ...prev, [type]: 'File is too large — the limit is 10MB.' }));
        return;
      }
      setSignupDocs(prev => ({ ...prev, [type]: asset }));
    } catch {
      setDocErrors(prev => ({ ...prev, [type]: 'Could not open the file picker. Please try again.' }));
    }
  };

  // Camera-only capture for the National ID front/back slots — separate
  // from pickDoc (which opens a file/gallery picker) since this always
  // opens the device camera directly, never the gallery (the app.json
  // plugin config also disables the library/microphone permissions
  // launchCameraAsync doesn't need). No client-side blur check — no
  // canvas API in React Native, and the backend already independently
  // re-checks sharpness on every upload (the real gate even on web); a
  // blurry shot surfaces as a server error after submit, prompting retake.
  const captureIdPhoto = async (side: 'national_id_front' | 'national_id_back') => {
    setDocErrors(prev => ({ ...prev, [side]: '' }));
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setDocErrors(prev => ({ ...prev, [side]: 'Camera permission is required to take this photo.' }));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSignupDocs(prev => ({
        ...prev,
        [side]: { uri: asset.uri, name: asset.fileName || `${side}.jpg`, mimeType: asset.mimeType || 'image/jpeg', size: asset.fileSize },
      }));
    } catch {
      setDocErrors(prev => ({ ...prev, [side]: 'Could not open the camera. Please try again.' }));
    }
  };

  // Resets both National ID slots, so switching between "Upload Files" and
  // "Take Photos" (or retaking after a mistake) never leaves a stale file
  // from the other mode behind.
  const resetNationalId = () => {
    setSignupDocs(prev => ({ ...prev, national_id_front: null, national_id_back: null }));
    setDocErrors(prev => ({ ...prev, national_id_front: '', national_id_back: '' }));
    setNationalIdMode(null);
  };

  const handleSignupContinue = async () => {
    // Real validators, not the previous name/phone presence-or-length-only
    // checks — those were weaker than what ValidatedTextInput itself uses to
    // show the inline error on this exact screen (e.g. phone only checked
    // `.length < 9`, so a 9+ digit but not-actually-Kenyan number displayed
    // an error yet still passed this gate and reached the password step).
    // Marks the whole step touched first so every field's own inline error
    // renders immediately (forceTouched), pointing at each specific problem
    // rather than only a generic banner.
    setSignupStepTouched(true);

    if (!validators.personName(signupFirstName).valid) {
      setErr('Please enter a valid first name before continuing.');
      return;
    }
    if (!validators.personName(signupSurname).valid) {
      setErr('Please enter a valid surname before continuing.');
      return;
    }
    if (signupOtherNames.trim() && !validators.personName(signupOtherNames).valid) {
      setErr('Please enter valid other names, or leave the field blank.');
      return;
    }
    if (!validators.nationalId(signupNationalId).valid) {
      setErr('Please enter a valid National ID number before continuing.');
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
    if (!signupArea) {
      setErr('Please select your area/location.');
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
    {
      const requirement = KYB_REQUIREMENTS_BY_BUSINESS_TYPE[businessType];
      if (requirement?.mode === 'choice') {
        if (!signupDocType) {
          setErr('Select which document you are uploading.');
          return;
        }
        if (!isDocSelected(signupDocType, signupDocs)) {
          setErr(docErrors[signupDocType] || 'Upload your document to continue.');
          return;
        }
      } else if (requirement?.mode === 'all') {
        for (const type of requirement.required) {
          if (!isDocSelected(type, signupDocs)) {
            setErr(docErrors[type] || `Upload your ${KYB_DOC_LABELS[type]} to continue.`);
            return;
          }
        }
        if (requirement.choiceAlso) {
          if (!signupDocType) {
            setErr('Select which document you are uploading.');
            return;
          }
          if (!isDocSelected(signupDocType, signupDocs)) {
            setErr(docErrors[signupDocType] || 'Upload your document to continue.');
            return;
          }
        }
      }
    }
    if (!agreedToTerms) {
      setErr('Please agree to the Privacy Policy and Terms of Service to continue.');
      return;
    }
    setErr('');
    setSignupStepTouched(false);

    // Already verified this exact number (e.g. came back from Review &
    // Submit without touching the phone field) — no need to make them
    // re-enter a code for a number that hasn't changed.
    if (phoneVerificationToken && verifiedPhoneNumber === signupPhone.trim()) {
      setIsSignupPasswordStep(true);
      return;
    }
    setPhoneVerificationToken('');
    setVerifiedPhoneNumber('');
    setPhoneOtp(['', '', '', '', '', '']);
    setIsPhoneVerifyStep(true);
    await requestPhoneOtp();
  };

  const requestPhoneOtp = async () => {
    setErr('');
    setPhoneOtpSending(true);
    const res = await sendSignupPhoneOtp(signupPhone.trim());
    setPhoneOtpSending(false);
    if (res.success) {
      setPhoneOtpMaskedPhone(res.maskedPhone || '');
      setPhoneOtpResendTimer(59);
    } else {
      setErr(res.error);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (phoneOtpResendTimer > 0 || phoneOtpSending) return;
    setPhoneOtp(['', '', '', '', '', '']);
    await requestPhoneOtp();
  };

  const handleVerifyPhoneOtp = async () => {
    setErr('');
    const code = phoneOtp.join('');
    if (code.length < 6) return;

    setLoading(true);
    const res = await verifySignupPhoneOtp(signupPhone.trim(), code);
    setLoading(false);

    if (res.success) {
      setPhoneVerificationToken(res.phoneVerificationToken);
      setVerifiedPhoneNumber(signupPhone.trim());
      setIsPhoneVerifyStep(false);
      setIsSignupPasswordStep(true);
    } else {
      setErr(res.error);
    }
  };

  const handleChangePhoneNumber = () => {
    setIsPhoneVerifyStep(false);
    setErr('');
    setPhoneOtp(['', '', '', '', '', '']);
  };

  const handleSignupCreateAccount = async () => {
    if (!agreedToTerms) {
      setErr('Please agree to the Privacy Policy and Terms of Service to continue.');
      return;
    }
    // Defense in depth — the backend independently re-checks the token
    // against whatever phone number is actually in the submission, so this
    // can't be bypassed, but catching it here gives a clear "go re-verify"
    // message instead of a confusing error after the whole form (with file
    // uploads) has already been sent.
    if (!phoneVerificationToken || verifiedPhoneNumber !== signupPhone.trim()) {
      setErr('Please verify your phone number again before submitting.');
      setPhoneVerificationToken('');
      setVerifiedPhoneNumber('');
      setPhoneOtp(['', '', '', '', '', '']);
      setIsSignupPasswordStep(false);
      setIsPhoneVerifyStep(true);
      await requestPhoneOtp();
      return;
    }

    const payload = new FormData();
    payload.append('firstName', signupFirstName.trim());
    payload.append('surname', signupSurname.trim());
    if (signupOtherNames.trim()) payload.append('otherNames', signupOtherNames.trim());
    payload.append('nationalId', signupNationalId.trim());
    payload.append('email', signupEmail);
    payload.append('phone', signupPhone);
    payload.append('businessName', signupBusinessName);
    payload.append('ecommerce', signupEcommerce);
    payload.append('businessType', businessType);
    payload.append('county', signupCounty);
    payload.append('area', signupArea);
    if (signupWard.trim()) payload.append('ward', signupWard.trim());
    if (signupStreet.trim()) payload.append('street', signupStreet.trim());
    payload.append('employees', employees);
    payload.append('agreedToTerms', String(agreedToTerms));
    payload.append('phoneVerificationToken', phoneVerificationToken);
    {
      const requirement = KYB_REQUIREMENTS_BY_BUSINESS_TYPE[businessType];
      const types = requirement?.mode === 'choice' ? [signupDocType]
        : requirement?.choiceAlso ? [...requirement.required, signupDocType]
        : (requirement?.required || []);
      // Optional docs (e.g. business_permit_or_license) ride along too, but
      // only the ones actually provided — an unfilled optional slot is
      // never in `types` above, so it's never required to submit.
      const optionalTypes = (requirement?.mode === 'all' ? requirement.optional : undefined)?.filter(t => isDocSelected(t, signupDocs)) || [];
      for (const type of [...types, ...optionalTypes].flatMap(t => resolveDocTypes(t, signupDocs))) {
        const file = signupDocs[type];
        if (file) {
          payload.append(`doc_${type}`, {
            uri: file.uri,
            name: file.name || `${type}.jpg`,
            type: file.mimeType || 'image/jpeg',
          } as any);
        }
      }
    }

    setLoading(true);
    const res = await signup(payload);
    setLoading(false);

    if (res.success) {
      setIsSignupPasswordStep(false);
      setAgreedToTerms(false);
      setPhoneVerificationToken('');
      setVerifiedPhoneNumber('');
      setPhoneOtp(['', '', '', '', '', '']);
      setSignupSubmitted(true);
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
            setIsPhoneVerifyStep(false);
            setPhoneVerificationToken('');
            setVerifiedPhoneNumber('');
            setPhoneOtp(['', '', '', '', '', '']);
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
            activeTab === tab ? 'text-[#06201b]' : 'text-[#5b645c]'
          }`}>
            {tab === 'signup' ? 'Register' : tab === 'login' ? 'Log In' : 'Reset'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const SecurityRequirement = ({ met, label }: { met: boolean, label: string }) => (
    <View className="flex-row items-center mb-1">
      <Feather name={met ? "check-circle" : "circle"} size={12} color={met ? "#10b981" : "#bfc9bf"} />
      <Text className={`ml-2 text-[10px] font-jakarta-bold uppercase tracking-widest ${met ? 'text-[#10b981]' : 'text-[#5b645c]'}`}>
        {label}
      </Text>
    </View>
  );

  // One upload box per required document type — reused for a 'choice'-mode
  // business type's single selected slot, every fixed slot of an 'all'-mode
  // one, and the LLC-only choiceAlso slot. `onPick` defaults to the
  // file/gallery picker (pickDoc); renderNationalIdSlot below overrides it
  // with the camera capture function for the front/back camera-mode tiles,
  // reusing this same box markup rather than duplicating it. `optional`
  // just appends "(Optional)" to the label — an optional slot never blocks
  // submission if left empty (see handleSignupContinue/KYB_REQUIREMENTS_
  // BY_BUSINESS_TYPE's `optional` array), this is purely a visual cue.
  const renderDocBox = (type: string, onPick: () => void = () => pickDoc(type), optional = false) => {
    const file = signupDocs[type];
    const error = docErrors[type];
    return (
      <View key={type} className="mb-3">
        <TouchableOpacity
          onPress={onPick}
          className={`w-full border-2 border-dashed rounded-2xl px-4 py-4 flex-row items-center ${
            error ? 'border-red-300 bg-red-50' : file ? 'border-emerald-400 bg-[#ecfdf5]' : 'border-[#d1d5db] bg-[#f9fafb]'
          }`}
        >
          {file && file.mimeType?.startsWith('image/') ? (
            <Image source={{ uri: file.uri }} style={{ width: 48, height: 48, borderRadius: 10 }} />
          ) : (
            <Feather name={file ? 'file-text' : 'upload'} size={22} color={file ? '#047857' : '#9ca3af'} />
          )}
          <View className="ml-3 flex-1 min-w-0">
            <Text className="text-[13px] font-jakarta-bold text-[#0c2010]" numberOfLines={1} ellipsizeMode="middle">
              {file ? (file.name || 'Document selected') : `${KYB_DOC_LABELS[type] || 'Choose a file'}${optional ? ' (Optional)' : ''}`}
            </Text>
            <Text className="text-[10px] font-jakarta-bold text-[#9ca3af] mt-0.5">JPG, PNG or PDF, up to 10MB. Must be clear and in focus.</Text>
          </View>
        </TouchableOpacity>
        {error ? (
          <Text className="text-red-500 text-[11px] font-jakarta-bold mt-1.5">{error}</Text>
        ) : null}
      </View>
    );
  };

  // National ID always requires both sides, front and back, whether the
  // merchant uploads existing files or takes photos — an ID's back
  // (address, signature, sometimes date of birth) is as much a KYC
  // requirement as its front, and there's no reason to accept it for one
  // path and not the other. nationalIdMode just tracks which path was
  // chosen so the same two boxes render with pickDoc (upload) or
  // captureIdPhoto (camera) wired to them.
  const renderNationalIdSlot = () => {
    const front = signupDocs.national_id_front;
    const frontOk = !!front && !docErrors.national_id_front;

    if (nationalIdMode === null) {
      return (
        <View key="national_id" className="mb-3">
          <Text className="text-[11px] font-jakarta-bold text-[#5b645c] mb-2 opacity-70">{KYB_DOC_LABELS.national_id}</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity onPress={() => setNationalIdMode('upload')} className="flex-1 border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] rounded-2xl py-5 items-center">
              <Feather name="upload" size={20} color="#9ca3af" />
              <Text className="text-[12px] font-jakarta-bold text-[#0c2010] mt-2">Upload Files</Text>
            </TouchableOpacity>
            {NATIONAL_ID_CAMERA_CAPTURE_ENABLED && (
              <TouchableOpacity onPress={() => setNationalIdMode('camera')} className="flex-1 border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] rounded-2xl py-5 items-center">
                <Feather name="camera" size={20} color="#9ca3af" />
                <Text className="text-[12px] font-jakarta-bold text-[#0c2010] mt-2">Take Photos</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    const onPick = (side: 'national_id_front' | 'national_id_back') =>
      nationalIdMode === 'camera' ? () => captureIdPhoto(side) : () => pickDoc(side);

    return (
      <View key="national_id">
        {renderDocBox('national_id_front', onPick('national_id_front'))}
        {frontOk && renderDocBox('national_id_back', onPick('national_id_back'))}
        <TouchableOpacity onPress={resetNationalId} className="mb-3 -mt-1">
          <Text className="text-[11px] font-jakarta-bold text-[#5b645c] underline">Start over</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
            {!isSignupPasswordStep && !isPhoneVerifyStep && !isOTPMode && !isResetMode && !signupSubmitted && renderTabs()}

            {err ? (
              <View className="bg-red-50 border border-red-200 p-4 rounded-xl flex-row items-center mb-6">
                <Feather name="alert-circle" size={18} color="#b91c1c" />
                <Text className="text-red-700 text-[12px] font-jakarta-bold ml-3 flex-1">{err}</Text>
              </View>
            ) : null}

            {activeTab === 'login' && !isOTPMode && !isResetMode && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Log in</Text>
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-6">Enter credentials provided during onboarding.</Text>

                {showBiometricButton && (
                  <TouchableOpacity onPress={handleBiometricSignIn} className="bg-[#ecfdf5] border border-[#a7f3d0] py-4 rounded-2xl flex-row justify-center items-center mb-6">
                    <Feather name="target" size={20} color="#047857" />
                    <Text className="text-[#047857] font-jakarta-bold text-[14px] ml-3">Log in with Passkey / Biometrics</Text>
                  </TouchableOpacity>
                )}

                <View className="mb-6">
                  <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Phone Number or Email</Text>
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
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest">Password</Text>
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
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Log In</Text>}
                </TouchableOpacity>

                <View className="flex-row items-center justify-center opacity-50 pt-4 gap-2">
                  <Text className="text-[#00351d] opacity-60 text-[10px] font-jakarta-bold uppercase tracking-[2px]">
                    Powered by
                  </Text>
                  <Image source={require('../../assets/poweredby-logo.png')} style={{ height: 16, width: 80, resizeMode: 'contain' }} />
                </View>
              </View>
            )}

            {activeTab === 'reset' && !isOTPMode && !isResetMode && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Reset Password</Text>
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-6">Enter your registered phone number or email address to receive a recovery code.</Text>

                <View className="mb-6">
                  <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Phone Number or Email</Text>
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
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-6">
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

                <View className="flex-row justify-center items-center gap-1 mb-2">
                  <Text className="text-[#9ca3af] text-[12px] font-jakarta-bold">Didn't receive it? </Text>
                  <TouchableOpacity onPress={handleResendOTP} disabled={resendTimer > 0 || loading}>
                    <Text className={`text-[12px] font-jakarta-bold ${(resendTimer > 0 || loading) ? 'text-[#9ca3af]' : 'text-[#047857]'}`}>
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isResetMode && (
              <View>
                 <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-6">Create New Password</Text>
                 <View className="mb-6">
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">New Password</Text>
                    <View className="flex-row items-center w-full bg-white border border-[#e5e7eb] rounded-2xl pr-4">
                      <TextInput className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-[#0c2010]" placeholder="••••••••" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPasswordInput} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2"><Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9ca3af" /></TouchableOpacity>
                    </View>
                 </View>
                 <View className="mb-8">
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Confirm Password</Text>
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

            {activeTab === 'signup' && !isSignupPasswordStep && !isPhoneVerifyStep && !signupSubmitted && (
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Get started with us</Text>
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-6">Fill out the form below to create your merchant account and start accepting payments.</Text>

                <View className="space-y-4">
                  <SignupSectionHeader icon="person" title="Personal Details" />

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">First Name *</Text>
                      <ValidatedTextInput kind="personName" value={signupFirstName} onChangeText={setSignupFirstName} placeholder="John" forceTouched={signupStepTouched}
                        className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Surname *</Text>
                      <ValidatedTextInput kind="personName" value={signupSurname} onChangeText={setSignupSurname} placeholder="Doe" forceTouched={signupStepTouched}
                        className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Other Names</Text>
                    <ValidatedTextInput kind="personName" optional value={signupOtherNames} onChangeText={setSignupOtherNames} placeholder="e.g. a middle name" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">National ID Number *</Text>
                    <ValidatedTextInput kind="nationalId" value={signupNationalId} onChangeText={setSignupNationalId} placeholder="12345678" forceTouched={signupStepTouched}
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                  </View>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Your Email *</Text>
                      <ValidatedTextInput kind="email" value={signupEmail} onChangeText={setSignupEmail} placeholder="john@example.com" forceTouched={signupStepTouched}
                        className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Your Phone *</Text>
                      <ValidatedTextInput kind="phoneKE" value={signupPhone} onChangeText={setSignupPhone} placeholder="0712 345 678" forceTouched={signupStepTouched}
                        className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                    </View>
                  </View>

                  <SignupSectionHeader icon="storefront" title="Business Details" />

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Business Name *</Text>
                      <ValidatedTextInput kind="businessName" value={signupBusinessName} onChangeText={setSignupBusinessName} placeholder="Acme Corp" forceTouched={signupStepTouched}
                        className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Business Type *</Text>
                      <TouchableOpacity onPress={() => setShowBusinessModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                        <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${businessType ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">{businessType || '—Please choose an option—'}</Text>
                        <Feather name="chevron-down" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Employees *</Text>
                    <TouchableOpacity onPress={() => setShowEmployeesModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                      <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${employees ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">{employees || '—Please choose an option—'}</Text>
                      <Feather name="chevron-down" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Is this an eCommerce business?</Text>
                    <View className="flex-row space-x-4">
                      <TouchableOpacity onPress={() => setSignupEcommerce('yes')} className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${signupEcommerce === 'yes' ? 'bg-[#06201b] border-[#06201b]' : 'bg-white border-[#e5e7eb]'}`}>
                        <Text className={`font-jakarta-bold text-[14px] ${signupEcommerce === 'yes' ? 'text-white' : 'text-[#0c2010]'}`}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setSignupEcommerce('no')} className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${signupEcommerce === 'no' ? 'bg-[#06201b] border-[#06201b]' : 'bg-white border-[#e5e7eb]'}`}>
                        <Text className={`font-jakarta-bold text-[14px] ${signupEcommerce === 'no' ? 'text-white' : 'text-[#0c2010]'}`}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <SignupSectionHeader icon="location-on" title="Business Location" />

                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">County *</Text>
                    <TouchableOpacity onPress={() => setShowCountyModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                      <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${signupCounty ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">{signupCounty || 'Search your county...'}</Text>
                      <Feather name="search" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Area/Location *</Text>
                    <TouchableOpacity
                      disabled={!signupCounty}
                      onPress={() => setShowAreaModal(true)}
                      className={`w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center ${!signupCounty ? 'opacity-50' : ''}`}
                    >
                      <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${signupArea ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">
                        {signupArea || (signupCounty ? `Search areas in ${signupCounty}...` : 'Select a county first')}
                      </Text>
                      <Feather name="search" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                    </TouchableOpacity>
                  </View>
                  {signupArea && (countyWards[signupCounty]?.[signupArea]?.length || 0) > 0 && (
                    <View>
                      <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Ward (optional)</Text>
                      <TouchableOpacity onPress={() => setShowWardModal(true)} className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center">
                        <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${signupWard ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">
                          {signupWard || `Search wards in ${signupArea}...`}
                        </Text>
                        <Feather name="search" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View>
                    <Text className="text-[#5b645c] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Street / Estate / Landmark (optional)</Text>
                    <TextInput
                      value={signupStreet}
                      onChangeText={setSignupStreet}
                      onFocus={() => streetResults.length > 0 && setStreetResultsOpen(true)}
                      onBlur={() => setTimeout(() => setStreetResultsOpen(false), 150)}
                      placeholder={signupCounty ? `Type your street/estate/landmark, or search ${signupCounty}...` : 'Type your street/estate/landmark...'}
                      placeholderTextColor="#9ca3af"
                      className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 text-[14px] font-jakarta-bold text-[#0c2010]"
                    />
                    {streetResultsOpen && streetResults.length > 0 && (
                      <View className="mt-1 bg-white rounded-2xl border border-[#e5e7eb] max-h-48">
                        <ScrollView keyboardShouldPersistTaps="handled">
                          {streetResults.map(r => (
                            <TouchableOpacity
                              key={r.place_id}
                              onPress={() => { setSignupStreet(r.display_name.split(',').slice(0, 2).join(',').trim()); setStreetResultsOpen(false); setStreetResults([]); }}
                              className="px-3 py-2.5 border-b border-[#e5e7eb]"
                            >
                              <Text className="text-[12px] font-jakarta-bold text-[#0c2010]" numberOfLines={1}>{r.display_name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  {(() => {
                    const requirement = KYB_REQUIREMENTS_BY_BUSINESS_TYPE[businessType];
                    return (
                      <View>
                        <SignupSectionHeader
                          icon="verified-user"
                          title={`Verification Document${(requirement?.mode === 'all' && (requirement.required.length + (requirement.optional?.length || 0) > 1 || requirement.choiceAlso)) ? 's' : ''}`}
                        />
                        <Text className="text-[#5b645c] text-[11px] font-jakarta-bold mb-3 opacity-70">
                          {!requirement
                            ? 'Select a business type above to see which document(s) are required.'
                            : requirement.mode === 'choice'
                              ? 'Upload one of the documents below. Required to create an account.'
                              : requirement.choiceAlso
                                ? `Required for a ${businessType}: ${requirement.required.map(t => KYB_DOC_LABELS[t]).join(', ')}, plus either ${requirement.choiceAlso.map(t => KYB_DOC_LABELS[t]).join(' or ')}.`
                                : `Required for a ${businessType}: ${requirement.required.map(t => KYB_DOC_LABELS[t]).join(', ')}.${requirement.optional?.length ? ` ${requirement.optional.map(t => KYB_DOC_LABELS[t]).join(', ')} ${requirement.optional.length > 1 ? 'are' : 'is'} optional.` : ''}`}
                        </Text>

                        {requirement?.mode === 'choice' && (
                          <>
                            <TouchableOpacity
                              onPress={() => { setDocTypeModalOptions(requirement.options); setShowDocTypeModal(true); }}
                              className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center mb-3"
                            >
                              <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${signupDocType ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">
                                {KYB_DOC_LABELS[signupDocType] || '—Which document is this?—'}
                              </Text>
                              <Feather name="chevron-down" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                            </TouchableOpacity>
                            {signupDocType && (signupDocType === 'national_id' ? renderNationalIdSlot() : renderDocBox(signupDocType))}
                          </>
                        )}

                        {requirement?.mode === 'all' && requirement.required.map(type => type === 'national_id' ? renderNationalIdSlot() : renderDocBox(type))}
                        {requirement?.mode === 'all' && requirement.optional?.map(type => renderDocBox(type, undefined, true))}

                        {requirement?.mode === 'all' && requirement.choiceAlso && (
                          <>
                            <TouchableOpacity
                              onPress={() => { setDocTypeModalOptions(requirement.choiceAlso!); setShowDocTypeModal(true); }}
                              className="w-full bg-white border border-[#e5e7eb] rounded-2xl py-3 px-4 flex-row justify-between items-center mb-3"
                            >
                              <Text className={`text-[14px] font-jakarta-bold flex-1 min-w-0 pr-2 ${signupDocType ? 'text-[#0c2010]' : 'text-[#9ca3af]'}`} numberOfLines={1} ellipsizeMode="tail">
                                {KYB_DOC_LABELS[signupDocType] || "—Also upload: Director's ID or KRA PIN Certificate?—"}
                              </Text>
                              <Feather name="chevron-down" size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                            </TouchableOpacity>
                            {signupDocType && (signupDocType === 'national_id' ? renderNationalIdSlot() : renderDocBox(signupDocType))}
                          </>
                        )}
                      </View>
                    );
                  })()}

                  <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7} className="flex-row items-start mt-4 mb-1">
                    <View className="mr-3 mt-0.5">
                      <Feather name={agreedToTerms ? "check-square" : "square"} size={20} color={agreedToTerms ? "#047857" : "#9ca3af"} />
                    </View>
                    <Text className="flex-1 text-[12px] font-jakarta-bold text-[#5b645c] leading-[18px]">
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
                    onPress={handleSignupContinue}
                    disabled={!agreedToTerms}
                    style={{ opacity: (!agreedToTerms) ? 0.4 : 1 }}
                    className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mt-4"
                  >
                    <Text className="text-white font-jakarta-bold text-[16px]">Submit Application</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isPhoneVerifyStep && (
              /* PHONE VERIFICATION STEP — proves the applicant controls this
                 number before the wizard lets them reach Review & Submit.
                 Deliberately its own state/handlers, not the isOTPMode/otp
                 machinery above — see isPhoneVerifyStep's own comment. */
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Verify Your Phone</Text>
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-6">
                  Enter the 6-digit code sent via SMS to {phoneOtpMaskedPhone || 'your phone'}
                </Text>

                <View className="flex-row justify-between mb-6">
                  {phoneOtp.map((digit, index) => (
                    <TextInput
                      key={index}
                      className="w-[45px] h-[55px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl text-center text-[20px] font-jakarta-bold text-[#0c2010]"
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(val) => {
                        const newOtp = [...phoneOtp];
                        newOtp[index] = val.replace(/\D/g, '');
                        setPhoneOtp(newOtp);
                      }}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  onPress={handleVerifyPhoneOtp}
                  disabled={loading || phoneOtp.join('').length < 6}
                  style={{ opacity: (loading || phoneOtp.join('').length < 6) ? 0.4 : 1 }}
                  className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mb-4"
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Verify Phone Number</Text>}
                </TouchableOpacity>

                <View className="flex-row justify-center items-center gap-1 mb-2">
                  <Text className="text-[#9ca3af] text-[12px] font-jakarta-bold">Didn't receive it? </Text>
                  <TouchableOpacity onPress={handleResendPhoneOtp} disabled={phoneOtpResendTimer > 0 || phoneOtpSending}>
                    <Text className={`text-[12px] font-jakarta-bold ${(phoneOtpResendTimer > 0 || phoneOtpSending) ? 'text-[#9ca3af]' : 'text-[#047857]'}`}>
                      {phoneOtpSending ? 'Sending…' : phoneOtpResendTimer > 0 ? `Resend in ${phoneOtpResendTimer}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleChangePhoneNumber} className="items-center">
                  <Text className="text-[#5b645c] text-[12px] font-jakarta-bold underline">Use a different number</Text>
                </TouchableOpacity>
              </View>
            )}

            {isSignupPasswordStep && (
              /* REVIEW & SUBMIT — password is no longer collected here; the
                 account is created pending admin/officer approval and a
                 merchant sets their own password later via the secure link
                 sent once approved (see the Application Submitted screen
                 below). The Terms/Privacy checkbox now lives on the main
                 form, directly after the document upload section — already
                 agreed to by the time a merchant reaches this step, so it
                 isn't repeated here. */
              <View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold mb-2">Review & Submit</Text>
                <Text className="text-[#5b645c] text-[13px] font-jakarta-bold mb-6">Everything looks ready. Submit your application for review.</Text>

                 <TouchableOpacity
                   onPress={handleSignupCreateAccount}
                   disabled={loading || !agreedToTerms}
                   style={{ opacity: (!agreedToTerms) ? 0.4 : 1 }}
                   className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center"
                 >
                    {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Submit Application</Text>}
                 </TouchableOpacity>
              </View>
            )}

            {signupSubmitted && (
              /* APPLICATION SUBMITTED — pending admin/officer approval, no
                 account access yet. */
              <View className="items-center">
                <View className="w-20 h-20 rounded-full bg-emerald-100 items-center justify-center mb-6 border-4 border-emerald-200">
                  <Feather name="clock" size={36} color="#047857" />
                </View>
                <Text className="text-[#0c2010] text-[24px] font-jakarta-bold text-center mb-3">Application Submitted</Text>
                <Text className="text-[#5b645c] text-[14px] font-jakarta-bold text-center leading-[21px] mb-8">
                  Your account will now be activated in a few minutes. An SMS will be sent to you with your credentials upon successful Paybill account opening.
                </Text>
                <TouchableOpacity
                  onPress={() => { setSignupSubmitted(false); setActiveTab('login'); }}
                  className="w-full bg-[#06201b] py-4 rounded-2xl flex-row justify-center items-center mb-4"
                >
                  <Text className="text-white font-jakarta-bold text-[16px]">Back to Log In</Text>
                </TouchableOpacity>
                <Text className="text-[#5b645c] text-[12px] font-jakarta-bold text-center leading-[18px]">
                  For more information, or to follow up on your application, contact us on{' '}
                  <Text className="text-[#047857] font-jakarta-bold" onPress={() => Linking.openURL('mailto:support@paychain.co.ke')}>support@paychain.co.ke</Text>
                  {' '}or{' '}
                  <Text className="text-[#047857] font-jakarta-bold" onPress={() => Linking.openURL('tel:+254743283782')}>0743 283 782</Text>.
                </Text>
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
                <TouchableOpacity className="py-4 border-b border-[#e5e7eb]" onPress={() => {
                  if (item !== signupCounty) { setSignupArea(''); setAreaSearch(''); setSignupWard(''); setWardSearch(''); }
                  setSignupCounty(item);
                  setShowCountyModal(false);
                }}>
                  <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAreaModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Select Area</Text>
              <TouchableOpacity onPress={() => setShowAreaModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            <TextInput
              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl py-3 px-4 mb-4 text-[14px] font-jakarta-bold"
              placeholder={`Search areas in ${signupCounty}...`}
              value={areaSearch}
              onChangeText={setAreaSearch}
            />
            <FlatList
              data={(KENYA_COUNTY_AREAS[signupCounty] || []).filter(a => a.toLowerCase().includes(areaSearch.toLowerCase()))}
              keyExtractor={item => item}
              renderItem={({item}) => (
                <TouchableOpacity className="py-4 border-b border-[#e5e7eb]" onPress={() => {
                  if (item !== signupArea) { setSignupWard(''); setWardSearch(''); }
                  setSignupArea(item);
                  setShowAreaModal(false);
                }}>
                  <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showWardModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Select Ward</Text>
              <TouchableOpacity onPress={() => setShowWardModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            <TextInput
              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-xl py-3 px-4 mb-4 text-[14px] font-jakarta-bold"
              placeholder={`Search wards in ${signupArea}...`}
              value={wardSearch}
              onChangeText={setWardSearch}
            />
            <FlatList
              data={(countyWards[signupCounty]?.[signupArea] || []).filter(w => w.toLowerCase().includes(wardSearch.toLowerCase()))}
              keyExtractor={item => item}
              renderItem={({item}) => (
                <TouchableOpacity className="py-4 border-b border-[#e5e7eb]" onPress={() => { setSignupWard(item); setShowWardModal(false); }}>
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
              <TouchableOpacity key={type} className="py-4 border-b border-[#e5e7eb]" onPress={() => {
                setBusinessType(type);
                setSignupDocType('');
                setShowBusinessModal(false);
              }}>
                <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showDocTypeModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[#0c2010] text-[18px] font-jakarta-bold">Document Type</Text>
              <TouchableOpacity onPress={() => setShowDocTypeModal(false)}><Feather name="x" size={24} color="#0c2010" /></TouchableOpacity>
            </View>
            {docTypeModalOptions.map(type => (
              <TouchableOpacity key={type} className="py-4 border-b border-[#e5e7eb]" onPress={() => { setSignupDocType(type); setShowDocTypeModal(false); }}>
                <Text className="text-[16px] font-jakarta-bold text-[#0c2010]">{KYB_DOC_LABELS[type]}</Text>
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
