import React, { useState } from 'react';
import BusinessTypeCard from '@/components/auth/BusinessTypeCard';

export default function Step1({ onNext, data }){
  const [type, setType] = useState(data.type || 'individual');

  return (
    <div>
      <h3 className="text-xl font-semibold">What type of business are you?</h3>
      <p className="text-sm text-slate-300">This determines your compliance requirements</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <BusinessTypeCard title="Sole Proprietor / Individual" sub="Freelancers, hawkers, small traders" badge="Tier 1 KYC" selected={type==='individual'} onSelect={()=>setType('individual')} />
        <BusinessTypeCard title="Registered Company" sub="LTDs, partnerships, NGOs, SACCOs" badge="Tier 2 KYC" selected={type==='company'} onSelect={()=>setType('company')} />
      </div>
      <div className="mt-6 flex justify-end"><button onClick={()=>onNext({ type })} className="px-4 py-2 rounded-xl bg-emerald-600">Continue</button></div>
    </div>
  );
}
