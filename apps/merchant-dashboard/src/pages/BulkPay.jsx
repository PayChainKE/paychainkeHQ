import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { payees, bulkPayHistory } from '../mockData/bulkPay'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useNotification } from '../context/NotificationContext'
export default function BulkPay() {
  const { showAmounts } = usePrivacyMode()
  const { addNotification } = useNotification()
  const [payeesList, setPayeesList] = useState(payees)
  const [activeFilter, setActiveFilter] = useState('All')
  const [step, setStep] = useState(1)
  
  // Add Payee Modal State
  // Add/Edit Payee Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStep, setAddStep] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [selectedPayees, setSelectedPayees] = useState(
    payees.slice(0, 3).reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  )

  const [payoutAmounts, setPayoutAmounts] = useState(
    payees.reduce((acc, p) => ({ ...acc, [p.id]: p.salary || p.amount || 0 }), {})
  )

  const [newPayee, setNewPayee] = useState({ 
    name: '', 
    type: 'Employee', 
    utilityType: 'Electricity',
    paymentMethod: 'Mobile Money',
    mobileMoneyType: 'Personal Number',
    amount: '',
    phone: '',
    accountNumber: '',
    bankName: '',
    paybillNumber: '',
    businessAccount: '',
    tillNumber: ''
  })

  // Filter payees based on active tab
  const filteredPayees = payeesList.filter(p => {
    if (activeFilter === 'All') return true;
    const filterMap = {
      'Employees': 'employee',
      'Suppliers': 'supplier',
      'Utilities': 'utility'
    };
    return (p.type?.toLowerCase() || '') === filterMap[activeFilter].toLowerCase();
  });

  const togglePayee = (id) => {
    setSelectedPayees((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const updateAmount = (id, val) => {
    const num = parseFloat(val.replace(/,/g, ''))
    if (!isNaN(num)) {
      setPayoutAmounts((prev) => ({ ...prev, [id]: num }))
    }
  }

  const handleOpenEdit = (p) => {
    setNewPayee({
      name: p.name,
      type: p.type.charAt(0).toUpperCase() + p.type.slice(1),
      paymentMethod: p.paymentMethod || 'Mobile Money',
      mobileMoneyType: p.mobileMoneyType || 'Personal Number',
      amount: (p.salary || p.amount || 0).toString(),
      phone: p.phone || '',
      accountNumber: p.accountNumber || '',
      bankName: p.bankName || '',
      paybillNumber: p.paybillNumber || '',
      businessAccount: p.businessAccount || '',
      tillNumber: p.tillNumber || ''
    });
    setEditingId(p.id);
    setIsEditing(true);
    setAddStep(2);
    setShowAddModal(true);
  }

  const handleSavePayee = () => {
    if (!newPayee.name) return;
    const numericAmount = parseFloat(newPayee.amount.replace(/,/g, '')) || 0;

    if (isEditing) {
      setPayeesList(prev => prev.map(p => p.id === editingId ? { 
        ...p, 
        ...newPayee, 
        type: newPayee.type.toLowerCase(),
        utilityType: newPayee.utilityType,
        salary: numericAmount,
        amount: numericAmount
      } : p));
      setPayoutAmounts(prev => ({ ...prev, [editingId]: numericAmount }));
      addNotification({
        title: 'Payee Updated',
        message: `${newPayee.name}'s details have been saved.`,
        type: 'success'
      });
    } else {
      const id = `payee_${Date.now()}`;
      const entry = {
        id,
        ...newPayee,
        type: newPayee.type.toLowerCase(),
        utilityType: newPayee.utilityType,
        salary: numericAmount,
        amount: numericAmount,
        isActive: true
      };
      setPayeesList(prev => [...prev, entry]);
      setPayoutAmounts(prev => ({ ...prev, [id]: numericAmount }));
      addNotification({
        title: 'Payee Added',
        message: `${newPayee.name} has been added to your ${newPayee.type} list.`,
        type: 'success'
      });
    }

    setShowAddModal(false);
    setIsEditing(false);
    setEditingId(null);
    setAddStep(1);
    setNewPayee({ 
      name: '', 
      type: 'Employee', 
      utilityType: 'Electricity',
      paymentMethod: 'Mobile Money',
      mobileMoneyType: 'Personal Number',
      amount: '',
      phone: '',
      accountNumber: '',
      bankName: '',
      paybillNumber: '',
      businessAccount: '',
      tillNumber: ''
    });
  }

  const batchTotal = Object.keys(selectedPayees)
    .filter((id) => selectedPayees[id])
    .reduce((sum, id) => sum + (payoutAmounts[id] || 0), 0)

  const balance = 184250
  const isLiquidityLow = batchTotal > balance

  return (
    <MerchantLayout title="Bulk Payments">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8 relative">
        
        {/* Add/Edit Payee Modal Overlay */}
        {showAddModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
              <div className="p-6 md:p-10">
                <div className="flex items-center justify-between mb-6 md:mb-10">
                  <div>
                    <h2 className="font-headline text-2xl md:text-3xl text-primary tracking-tight font-bold">{isEditing ? 'Edit Recipient' : 'Add New Recipient'}</h2>
                    <p className="text-[10px] md:text-xs text-on-surface-variant font-medium mt-1 opacity-60 italic">Step {addStep} of 2: {addStep === 1 ? 'Category Selection' : 'Payment Details'}</p>
                  </div>
                  <button 
                    onClick={() => { setShowAddModal(false); setAddStep(1); setIsEditing(false); }}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {addStep === 1 ? (
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'employee', label: 'Employee', icon: 'badge', desc: 'Payroll & Salaries' },
                      { id: 'supplier', label: 'Supplier', icon: 'inventory_2', desc: 'Logistics & Stock' },
                      { id: 'utility', label: 'Utility', icon: 'account_balance', desc: 'Rent, Power, Water' },
                      { id: 'contractor', label: 'Contractor', icon: 'engineering', desc: 'One-off Services' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setNewPayee({...newPayee, type: cat.label}); setAddStep(2); }}
                        className={`group relative flex items-center justify-between py-3 px-4 rounded-xl border transition-all duration-300 ${
                          newPayee.type === cat.label 
                            ? 'border-emerald-500 bg-emerald-500/[0.02] shadow-sm scale-[1.005]' 
                            : 'border-outline-variant/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01]'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {/* Selection Tick (Before Icon) */}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${
                            newPayee.type === cat.label 
                              ? 'bg-[#00351D] border-[#00351D] text-white' 
                              : 'border-outline-variant/20 group-hover:border-emerald-500/50'
                          }`}>
                            {newPayee.type === cat.label && <span className="material-symbols-outlined text-[8px] font-black">check</span>}
                          </div>

                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            newPayee.type === cat.label ? 'bg-[#00351D] text-white' : 'bg-surface-container-low text-primary group-hover:bg-[#00351D] group-hover:text-white'
                          }`}>
                            <span className="material-symbols-outlined text-lg" style={{fontVariationSettings: "'FILL' 1"}}>{cat.icon}</span>
                          </div>

                          <div>
                            <h4 className="font-bold text-sm text-primary group-hover:text-emerald-700 transition-colors leading-none">{cat.label}</h4>
                            <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-50 tracking-tight">{cat.desc}</p>
                          </div>
                        </div>

                        <span className="material-symbols-outlined text-primary/10 group-hover:text-emerald-500/30 transition-all">chevron_right</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 animate-in slide-in-from-right duration-500">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">
                          {newPayee.type === 'Utility' ? 'Utility Name' : 'Recipient Name'}
                        </label>
                        <input 
                          type="text"
                          value={newPayee.name}
                          onChange={(e) => setNewPayee({...newPayee, name: e.target.value})}
                          placeholder={newPayee.type === 'Utility' ? 'e.g. Kenya Power' : 'e.g. John Kamau'}
                          className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                        />
                      </div>

                      {newPayee.type === 'Utility' && (
                        <div className="space-y-4 pt-4 animate-in fade-in duration-500">
                          <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Utility Type</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Water', 'Electricity', 'Rent', 'Internet'].map((u) => (
                              <button
                                key={u}
                                onClick={() => setNewPayee({...newPayee, utilityType: u})}
                                className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                  newPayee.utilityType === u 
                                    ? 'bg-[#00351D] text-white border-[#00351D]' 
                                    : 'bg-surface-container-low/50 text-on-surface-variant/40 border-outline-variant/5 hover:border-emerald-500/30'
                                }`}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 pt-4">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Amount to be paid (KES)</label>
                        <input 
                          type="text"
                          value={newPayee.amount}
                          onChange={(e) => setNewPayee({...newPayee, amount: e.target.value})}
                          placeholder="e.g. 50,000"
                          className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                        />
                      </div>

                      <div className="space-y-4 pt-4">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Settlement Method</label>
                        <div className="flex gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl border border-outline-variant/5">
                          {['Mobile Money', 'Bank'].map((method) => (
                            <button
                              key={method}
                              onClick={() => setNewPayee({...newPayee, paymentMethod: method})}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                newPayee.paymentMethod === method ? 'bg-white text-primary shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'
                              }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 transition-all">
                        {newPayee.paymentMethod === 'Mobile Money' && (
                          <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-3">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Mobile Money Type</label>
                              <div className="grid grid-cols-3 gap-2">
                                {['Personal Number', 'Paybill', 'Buy Goods'].map((mType) => (
                                  <button
                                    key={mType}
                                    onClick={() => setNewPayee({...newPayee, mobileMoneyType: mType})}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                      newPayee.mobileMoneyType === mType 
                                        ? 'bg-[#00351D] text-white border-[#00351D]' 
                                        : 'bg-white text-on-surface-variant/40 border-outline-variant/20 hover:border-emerald-500/30'
                                    }`}
                                  >
                                    {mType}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {newPayee.mobileMoneyType === 'Personal Number' && (
                              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">M-PESA Number</label>
                                <input 
                                  type="text"
                                  value={newPayee.phone}
                                  onChange={(e) => setNewPayee({...newPayee, phone: e.target.value})}
                                  placeholder="07XX XXX XXX"
                                  className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                />
                              </div>
                            )}

                            {newPayee.mobileMoneyType === 'Paybill' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Paybill Number</label>
                                  <input 
                                    type="text"
                                    value={newPayee.paybillNumber}
                                    onChange={(e) => setNewPayee({...newPayee, paybillNumber: e.target.value})}
                                    placeholder="e.g. 290290"
                                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Account Number</label>
                                  <input 
                                    type="text"
                                    value={newPayee.businessAccount}
                                    onChange={(e) => setNewPayee({...newPayee, businessAccount: e.target.value})}
                                    placeholder="e.g. 123456"
                                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {newPayee.mobileMoneyType === 'Buy Goods' && (
                              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Till Number</label>
                                <input 
                                  type="text"
                                  value={newPayee.tillNumber}
                                  onChange={(e) => setNewPayee({...newPayee, tillNumber: e.target.value})}
                                  placeholder="e.g. 567890"
                                  className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                />
                              </div>
                            )}
                          </div>
                        )}
                         {newPayee.paymentMethod === 'Bank' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Bank Name</label>
                              <input 
                                type="text"
                                value={newPayee.bankName}
                                onChange={(e) => setNewPayee({...newPayee, bankName: e.target.value})}
                                placeholder="e.g. Equity"
                                className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Account No.</label>
                              <input 
                                type="text"
                                value={newPayee.accountNumber}
                                onChange={(e) => setNewPayee({...newPayee, accountNumber: e.target.value})}
                                placeholder="0123 XXX XXX"
                                className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => isEditing ? setShowAddModal(false) : setAddStep(1)}
                        className="flex-1 py-3.5 rounded-2xl border border-outline-variant/10 text-primary font-bold text-sm hover:bg-surface-container-low transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleSavePayee}
                        className="flex-[2] py-3.5 rounded-2xl bg-[#00351D] text-white font-bold text-sm hover:bg-emerald-950 transition-all shadow-xl active:scale-[0.98]"
                      >
                        {isEditing ? 'Save Changes' : 'Save Recipient'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Left Column: Saved Payees (380px) */}
        <section className="w-full lg:w-[380px] flex flex-col gap-6 lg:gap-8">
          <div className="flex items-center justify-between px-3 md:px-2">
            <div>
              <h2 className="font-headline text-2xl md:text-3xl text-primary tracking-tight font-bold">Saved Payees</h2>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] mt-1 opacity-40">Frequency: Monthly</p>
            </div>
            <button 
              onClick={() => { setShowAddModal(true); setIsEditing(false); setNewPayee({ name: '', type: 'Employee', paymentMethod: 'Mobile Money', phone: '', accountNumber: '', bankName: '', walletAddress: '', network: 'Polygon' }); }}
              className="bg-[#00351D] text-white w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-emerald-950 active:scale-95 transition-all shadow-xl"
            >
              <span className="material-symbols-outlined text-lg md:text-xl">add</span>
            </button>
          </div>

          {/* Tabs - Scrollable on mobile */}
          <div className="flex gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl mx-3 md:mx-2 border border-outline-variant/5 overflow-x-auto no-scrollbar">
            {['All', 'Employees', 'Suppliers', 'Utilities'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`flex-none lg:flex-1 px-5 lg:px-0 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeFilter === tab ? 'bg-white text-primary shadow-lg' : 'text-on-surface-variant/40 hover:text-primary hover:bg-white/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Payee List */}
          <div className="flex flex-col gap-3 md:gap-4 px-3 md:px-2">
            {filteredPayees.map((p) => (
              <div
                key={p.id}
                className={`bg-white py-2 px-3 md:py-2.5 md:px-3.5 rounded-xl flex flex-col group relative transition-all duration-500 cursor-pointer border shadow-[0_2px_10px_rgb(0,0,0,0.01)] ${
                  selectedPayees[p.id] 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.01] shadow-[0_10px_30px_rgba(22,163,74,0.04)] scale-[1.005]' 
                    : 'border-outline-variant/5 hover:border-primary/10 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0" onClick={() => togglePayee(p.id)}>
                    {/* Left side: Tick + Avatar */}
                    <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                      {/* Selection Tick (Before Avatar) */}
                      <div className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${
                        selectedPayees[p.id] 
                          ? 'bg-[#00351D] border-[#00351D] text-white' 
                          : 'border-outline-variant/20 group-hover:border-emerald-500/50'
                      }`}>
                        {selectedPayees[p.id] && <span className="material-symbols-outlined text-[7px] md:text-[9px] font-black">check</span>}
                      </div>

                      <div className="w-8 h-8 md:w-9 md:h-9 shrink-0">
                        <div className="w-full h-full rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[#5EFEB3] font-black text-[9px] md:text-[11px] shadow-inner group-hover:bg-[#124B3A] transition-all duration-500">
                          {p.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-[10px] md:text-[12px] font-bold text-primary group-hover:text-[#00351D] transition-colors leading-tight truncate">{p.name}</h4>
                        {selectedPayees[p.id] && <span className="text-[6px] md:text-[7px] text-emerald-600 font-extrabold uppercase tracking-wider bg-emerald-50 px-1 py-0.5 rounded-sm">Selected</span>}
                      </div>
                      <p className="text-[7px] md:text-[8px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40">{p.type}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1" onClick={() => togglePayee(p.id)}>
                      <p className={`text-[10px] md:text-sm font-headline text-primary transition-all duration-300 ${!showAmounts && 'blur-md'}`}>
                        {formatKES(p.salary || p.amount || 0)}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                      className="p-1 md:p-1.5 rounded-lg bg-surface-container-low text-primary/40 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-90"
                    >
                      <span className="material-symbols-outlined text-xs md:text-sm">edit</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Create Payment Batch */}
        <section className="flex-1 flex flex-col gap-6">
          {/* Step Indicator */}
          <div className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between relative overflow-hidden editorial-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-6 md:gap-12 relative z-10">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-6">
                  <div className={`flex items-center gap-3 ${step < s ? 'opacity-40' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      step === s ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {s}
                    </div>
                    <span className={`text-sm ${step === s ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}`}>
                      {s === 1 ? 'Select' : s === 2 ? 'Review' : 'Done'}
                    </span>
                  </div>
                  {s < 3 && <div className="hidden md:block h-[2px] w-12 bg-outline-variant/30"></div>}
                </div>
              ))}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest leading-none mb-1">Available liquidity</p>
              <p className={`font-headline text-lg lg:text-xl text-primary leading-tight transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(balance)}</p>
            </div>
          </div>

          {/* Batch Selection View */}
          <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-outline-variant/10">
            <div className="p-8 lg:p-10 border-b border-outline-variant/5">
              <h3 className="font-headline text-2xl lg:text-3xl text-primary tracking-tight font-bold">Create Payment Batch</h3>
              <p className="text-[11px] lg:text-sm text-on-surface-variant font-medium mt-1.5 opacity-60 italic">Define specific liquidity distribution for this cycle.</p>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-on-surface-variant uppercase font-black tracking-[0.2em] bg-white border-b border-outline-variant/5">
                    <th className="px-10 py-8 w-12">
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={Object.values(selectedPayees).every(v=>v)}
                          onChange={() => {
                            const allSelected = Object.values(selectedPayees).every(v=>v);
                            const newSelection = {};
                            payeesList.forEach(p => newSelection[p.id] = !allSelected);
                            setSelectedPayees(newSelection);
                          }}
                          className="w-5 h-5 rounded-none border-outline-variant/30 text-[#00351D] focus:ring-[#00351D]" 
                        />
                      </div>
                    </th>
                    <th className="px-6 py-8">Recipient</th>
                    <th className="px-6 py-8">Reference</th>
                    <th className="px-10 py-8 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {payeesList.filter(p => selectedPayees[p.id]).map((p) => (
                    <tr key={p.id} className="group hover:bg-surface-container-low/20 transition-all duration-300">
                      <td className="px-10 py-8">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={!!selectedPayees[p.id]}
                            onChange={() => togglePayee(p.id)}
                            className="w-5 h-5 rounded-none border-outline-variant/30 text-[#00351D] focus:ring-[#00351D]" 
                          />
                        </div>
                      </td>
                      <td className="px-6 py-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#0E3D2E] flex items-center justify-center text-[10px] font-black text-[#5EFEB3] transition-transform group-hover:scale-105">
                            {p.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary group-hover:text-emerald-700 transition-colors">{p.name}</p>
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-60">{p.type} • May 2024</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-8">
                        <input 
                          className="bg-surface-container-low/50 border-none rounded-none text-[11px] font-black uppercase tracking-widest text-primary/60 w-44 focus:ring-1 focus:ring-emerald-500/30 px-4 py-3 transition-all" 
                          placeholder="Reference..." 
                          defaultValue="MAY_PAYOUT_24"
                        />
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-40">KES</span>
                          <input 
                            className="bg-transparent border-none text-right font-headline text-xl lg:text-2xl text-primary focus:ring-0 p-0 w-32 tabular-nums" 
                            value={(payoutAmounts[p.id] || 0).toLocaleString()}
                            onChange={(e) => updateAmount(p.id, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Action Bar */}
            <div className="p-10 bg-[#00351D] text-white flex items-center justify-between border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
              <div className="flex items-center gap-10 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-1">Batch Load</span>
                  <span className="text-sm font-bold">{Object.values(selectedPayees).filter(Boolean).length} Verified Recipients</span>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-1">Total Payout</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-emerald-400">KES</span>
                    <span className={`font-headline text-2xl lg:text-4xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-lg'}`}>{batchTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 relative z-10">
                {isLiquidityLow && (
                  <div className="text-right">
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1">Insufficient Liquidity</p>
                    <p className="text-[10px] text-white/60">Balance: {formatKES(balance)}</p>
                  </div>
                )}
                <button 
                  disabled={batchTotal === 0 || isLiquidityLow}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#00351D] px-10 py-5 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-2xl active:scale-95 group disabled:opacity-20 disabled:grayscale disabled:active:scale-100"
                >
                  Authorize Batch
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">bolt</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MerchantLayout>
  )
}
