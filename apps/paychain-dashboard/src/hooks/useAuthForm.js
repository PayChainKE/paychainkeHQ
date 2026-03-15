import { useState } from 'react';
import { MOCK_OTP } from '@/data/authData';

const phoneRegex = /^(?:\+?254|0)?7\d{8}$|^(?:0)?1\d{2,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kraRegex = /^[AP]\d{9}[A-Z]$/i;

export function validateKenyanPhone(v) {
  if (!v) return false;
  const clean = v.replace(/\s|-/g, '');
  return phoneRegex.test(clean);
}

export function validateKRAPin(v) {
  if (!v) return false;
  return kraRegex.test(v);
}

export function getPasswordStrength(pw) {
  if (!pw) return 'weak';
  const score = (pw.length >= 8) + /[A-Z]/.test(pw) + /[0-9]/.test(pw) + /[^A-Za-z0-9]/.test(pw);
  if (score >= 3) return 'strong';
  if (score === 2) return 'fair';
  return 'weak';
}

export function useSignInForm() {
  const [values, setValues] = useState({ identity: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  }

  function validate() {
    const err = {};
    if (!values.identity) err.identity = 'Phone or email required';
    else if (!validateKenyanPhone(values.identity) && !emailRegex.test(values.identity)) err.identity = 'Enter a valid phone or email';
    if (!values.password || values.password.length < 8) err.password = 'Password must be at least 8 characters';
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function handleSubmit(onSuccess) {
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    // mock: treat first login as needing KYC if no flag
    onSuccess && onSuccess();
  }

  return { values, errors, handleChange, handleSubmit, loading };
}

export function useSignUpForm() {
  const [values, setValues] = useState({ name: '', businessName: '', mpesa: '', email: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  }

  function validate() {
    const err = {};
    if (!values.name) err.name = 'Full name required';
    if (!values.businessName) err.businessName = 'Business name required';
    if (!values.mpesa || !validateKenyanPhone(values.mpesa)) err.mpesa = 'Valid M-PESA number required';
    if (!values.password || values.password.length < 8) err.password = 'Password must be at least 8 chars';
    if (values.password !== values.confirm) err.confirm = 'Passwords do not match';
    if (!values.agree) err.agree = 'You must accept terms';
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function handleSubmit(onSuccess) {
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    onSuccess && onSuccess();
  }

  return { values, errors, handleChange, handleSubmit, loading };
}

export function useKYCWizard(initial = {}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(initial);

  const next = (payload) => {
    if (payload) setData(d => ({ ...d, ...payload }));
    setStep(s => Math.min(5, s + 1));
  };
  const back = () => setStep(s => Math.max(1, s - 1));

  const canProceed = () => true;

  return { step, next, back, data, setData, canProceed };
}

export function validateOTP(input) {
  return String(input) === MOCK_OTP;
}
