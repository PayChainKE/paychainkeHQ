import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_OTP } from '@/data/authData';

const phoneRegex = /^(?:\+?254|0)?7\d{8}$|^(?:0)?1\d{2,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kraRegex = /^[AP]\d{9}[A-Z]$/i;

export function validateKenyanPhone(v) {
  if (!v) return false;
  const clean = v.replace(/\s|-/g, '');
  return phoneRegex.test(clean);
}

export function validateEmail(v) {
  return !!v && emailRegex.test(v);
}

export function getPasswordStrength(pw) {
  if (!pw) return 'weak';
  const score = (pw.length >= 8) + /[A-Z]/.test(pw) + /[0-9]/.test(pw) + /[^A-Za-z0-9]/.test(pw);
  if (score >= 3) return 'strong';
  if (score === 2) return 'fair';
  return 'weak';
}

export function validateKRAPin(v) {
  if (!v) return false;
  return kraRegex.test(v);
}

export function useSignInForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ identifier: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues((s) => ({ ...s, [name]: type === 'checkbox' ? checked : value }));
  }

  function validate() {
    const errs = {};
    const id = values.identifier || '';
    if (!id) errs.identifier = 'Enter phone or email.';
    if (id.includes('@') && !validateEmail(id)) errs.identifier = 'Invalid email.';
    if (!values.password || values.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e && e.preventDefault && e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    const kyc = localStorage.getItem('kyc_complete');
    if (kyc === 'true') navigate('/overview');
    else navigate('/kyc');
  }

  return { values, errors, handleChange, handleSubmit, loading };
}

export function useSignUpForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', businessName: '', mpesa: '', email: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues((s) => ({ ...s, [name]: type === 'checkbox' ? checked : value }));
  }

  function validate() {
    const errs = {};
    if (!values.name) errs.name = 'Required';
    if (!values.businessName) errs.businessName = 'Required';
    if (!validateKenyanPhone(values.mpesa)) errs.mpesa = 'Invalid Kenyan phone';
    if (!values.password || values.password.length < 8) errs.password = 'Password must be 8+ chars';
    if (values.password !== values.confirm) errs.confirm = 'Passwords do not match';
    if (!values.agree) errs.agree = 'You must agree to terms';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e && e.preventDefault && e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    localStorage.setItem('mock_user', JSON.stringify({ name: values.name, businessName: values.businessName, mpesa: values.mpesa, email: values.email }));
    navigate('/kyc/step-1');
  }

  return { values, errors, handleChange, handleSubmit, loading };
}

export function useKYCWizard(initial = {}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(initial);

  function next(payload) {
    if (payload) setData((d) => ({ ...d, ...payload }));
    setStep((s) => Math.min(5, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function canProceed() {
    return true;
  }

  return { step, next, back, data, setData, canProceed };
}

export function validateOTP(input) {
  return String(input) === MOCK_OTP;
}
