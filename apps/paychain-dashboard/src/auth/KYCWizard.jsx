import React from 'react';
import StepProgress from '@/components/auth/StepProgress';
import Step1 from './steps/Step1_BusinessType';
import Step2 from './steps/Step2_PersonalKYC';
import Step3 from './steps/Step3_CorporateKYC';
import Step4 from './steps/Step4_TechnicalSetup';
import Step5 from './steps/Step5_Success';
import { useKYCWizard } from '@/hooks/useAuthForm';
import { useNavigate } from 'react-router-dom';

export default function KYCWizard(){
  const nav = useNavigate();
  const { step, next, back, data, setData } = useKYCWizard();

  function onComplete(){
    localStorage.setItem('kyc_complete', 'true');
    nav('/overview');
  }

  return (
    <div className="min-h-screen p-6 bg-[#0A1628] text-white">
      <div className="max-w-4xl mx-auto">
        <StepProgress step={step} />
        <div className="mt-6 bg-white/5 p-6 rounded-2xl border border-white/10">
          {step===1 && <Step1 onNext={(d)=>{ setData({...data,...d}); next(); }} data={data} />}
          {step===2 && <Step2 onNext={(d)=>{ setData({...data,...d}); next(); }} onBack={back} data={data} />}
          {step===3 && <Step3 onNext={(d)=>{ setData({...data,...d}); next(); }} onBack={back} data={data} />}
          {step===4 && <Step4 onNext={(d)=>{ setData({...data,...d}); next(); }} onBack={back} data={data} />}
          {step===5 && <Step5 data={data} onEnter={onComplete} />}
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={back} className="px-4 py-2 rounded-xl border border-white/10">Back</button>
          <button onClick={()=> step<5 ? next() : onComplete()} className="px-4 py-2 rounded-xl bg-emerald-600">{step<5? 'Continue':'Complete Setup'}</button>
        </div>
      </div>
    </div>
  );
}
