import React from 'react';
import FileUploadCard from '@/components/auth/FileUploadCard';

export default function Step3({ onNext, onBack }){
  return (
    <div>
      <h3 className="text-xl font-semibold">Corporate Documents</h3>
      <p className="text-sm text-slate-300">Required for Tier 2 merchant registration</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <FileUploadCard label="Certificate of Incorporation" />
        <FileUploadCard label="CR12 Form" />
        <FileUploadCard label="Business Permit" />
        <FileUploadCard label="Board Resolution (PDF)" />
      </div>
      <div className="mt-6 flex justify-between"><button onClick={onBack} className="px-4 py-2 rounded-xl border">Back</button><button onClick={onNext} className="px-4 py-2 rounded-xl bg-emerald-600">Continue</button></div>
    </div>
  );
}
