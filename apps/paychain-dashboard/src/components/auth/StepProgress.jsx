import React from 'react';

export default function StepProgress({ step = 1 }) {
  const steps = [1,2,3,4,5];
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2">
        {steps.map((s) => (
          <div key={s} className="flex-1 text-center">
            <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full ${s<=step ? 'bg-emerald-text text-black' : 'bg-white/6 text-slate-300'}`}>
              {s < step ? '✓' : s}
            </div>
            <div className="text-xs mt-2 hidden md:block">{s===1?'Business':s===2?'Personal':s===3?'Corporate':s===4?'Technical':'Verified'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
import React from 'react';

export default function StepProgress({ step = 1 }) {
  const steps = [1,2,3,4,5];
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        {steps.map(s => (
          <div key={s} className="flex-1 text-center">
            <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${s<step ? 'bg-emerald-500' : s===step ? 'bg-emerald-500' : 'bg-white/10'}`}>
              {s<step? '✓' : s}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
