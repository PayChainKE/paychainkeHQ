import React, { useState } from 'react';
import FileUploadCard from '@/components/auth/FileUploadCard';
import { validateKRAPin } from '@/hooks/useAuthForm';

export default function Step2({ data, setData, next, back }){
  const [local, setLocal] = useState({ id: data.id || '', name: data.name || '', dob: data.dob || '', kra: data.kra || '' });

  function handleChange(e){
    const { name, value } = e.target;
    setLocal(s=>({ ...s, [name]: value }));
    setData(d=>({ ...d, [name]: value }));
  }

  return (
    <div>
      <h2 className="text-lg font-bold">Personal & Business Verification</h2>
      <p className="text-sm text-slate-300">Required by CBK regulations for all merchants</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="card p-4">
          <div className="text-sm font-medium">Identity Verification</div>
          <input name="id" value={local.id} onChange={handleChange} placeholder="National ID Number" className="input-custom w-full mt-2" />
          <input name="name" value={local.name} onChange={handleChange} placeholder="Full Legal Name" className="input-custom w-full mt-2" />
          <input name="dob" value={local.dob} onChange={handleChange} placeholder="Date of Birth" className="input-custom w-full mt-2" />
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium">Tax Compliance</div>
          <input name="kra" value={local.kra} onChange={handleChange} placeholder="KRA PIN" className="input-custom w-full mt-2" />
          {!validateKRAPin(local.kra) && local.kra && <div className="text-sm text-amber-400 mt-2">KRA PIN looks invalid</div>}
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium">M-PESA Statement Upload</div>
          <FileUploadCard label="3-Month M-PESA Statement (PDF or screenshot)" onFile={(f)=>setData(d=>({ ...d, mpesaStatement: f?.name }))} />
          <div className="text-xs text-slate-400 mt-2">Dial *234# → Statements → Last 3 months to download</div>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={back} className="btn-outline">Back</button>
        <button onClick={next} className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import FileUploadCard from '@/components/auth/FileUploadCard';

export default function Step2({ onNext, onBack, data }){
  const [id, setId] = useState(data.idNumber||'');
  const [name, setName] = useState(data.name||'');
  const [dob, setDob] = useState(data.dob||'');
  const [kra, setKra] = useState(data.kra||'');
  const [fileOk, setFileOk] = useState(false);

  return (
    <div>
      <h3 className="text-xl font-semibold">Personal & Business Verification</h3>
      <p className="text-sm text-slate-300">Required by CBK regulations for all merchants</p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white/5 rounded-2xl">
          <h4 className="font-medium">Identity Verification</h4>
          <input placeholder="National ID Number" value={id} onChange={e=>setId(e.target.value)} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <input placeholder="Full Legal Name" value={name} onChange={e=>setName(e.target.value)} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
        </div>
        <div className="p-4 bg-white/5 rounded-2xl">
          <h4 className="font-medium">Tax Compliance</h4>
          <input placeholder="KRA PIN" value={kra} onChange={e=>setKra(e.target.value)} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
        </div>
        <div className="p-4 bg-white/5 rounded-2xl">
          <h4 className="font-medium">M-PESA Statement Upload</h4>
          <FileUploadCard label="3-Month M-PESA Statement" onFile={()=>setFileOk(true)} />
        </div>
      </div>
      <div className="mt-6 flex justify-between"><button onClick={onBack} className="px-4 py-2 rounded-xl border">Back</button><button onClick={()=>onNext({ idNumber:id, name, dob, kra })} className="px-4 py-2 rounded-xl bg-emerald-600">Continue</button></div>
    </div>
  );
}
