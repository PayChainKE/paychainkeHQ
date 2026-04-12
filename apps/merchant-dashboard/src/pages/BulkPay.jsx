import React, { useState } from 'react'
import { jsPDF } from 'jspdf'
import domtoimage from 'dom-to-image'
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

  // Fund Account Modal State
  const [showFundModal, setShowFundModal] = useState(false)
  const [fundStep, setFundStep] = useState(1)
  const [fundDetails, setFundDetails] = useState({
    amount: '',
    method: 'Mobile Money',
    phone: ''
  })
  const [selectedTill, setSelectedTill] = useState(null)

  // Security Verification Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [securityStep, setSecurityStep] = useState(1) // 1: OTP, 2: PIN
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')

  const handleSecurityVerification = () => {
    setShowSecurityModal(false)
    setSecurityStep(1)
    setOtp('')
    setPin('')
    handleAuthorize()
  }

  const handleFundAccount = () => {
    addNotification({
      title: 'Funding Initiated',
      message: `Your deposit of KES ${fundDetails.amount} via ${fundDetails.method} is being processed.`,
      type: 'success'
    });
    setShowFundModal(false);
    setFundStep(1);
    setFundDetails({ amount: '', method: 'Mobile Money', phone: '' });
  }

  const batchTotal = Object.keys(selectedPayees)
    .filter((id) => selectedPayees[id])
    .reduce((sum, id) => sum + (payoutAmounts[id] || 0), 0)

  const balance = 184250
  const isLiquidityLow = batchTotal > balance

  const [authorizedReceipts, setAuthorizedReceipts] = useState([])

  const handleAuthorize = () => {
    // Generate unique receipts for all selected payees
    const newReceipts = payeesList
      .filter(p => selectedPayees[p.id])
      .map(p => ({
        id: `TX${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        name: p.name,
        amount: payoutAmounts[p.id],
        method: p.paymentMethod,
        phone: p.phone || p.paybillNumber || p.accountNumber || '...',
        reference: `MAY_PAYOUT_24_${p.id.split('_')[1] || '001'}`,
        timestamp: new Date().toLocaleString('en-KE', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }));
    
    setAuthorizedReceipts(newReceipts);
    setStep(4);
    addNotification({
      title: 'Batch Processed',
      message: `Successfully disbursed KES ${batchTotal.toLocaleString()} to ${newReceipts.length} recipients.`,
      type: 'success'
    });
  }

  const downloadReceipt = async (receipt) => {
    addNotification({ title: 'Generating PDF', message: `Preparing receipt for ${receipt.name}.`, type: 'info' });
    const element = document.getElementById(`receipt-${receipt.id}`);
    if (element) {
      try {
        const dataUrl = await domtoimage.toPng(element, { bgcolor: '#ffffff' });
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [element.clientWidth, element.clientHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, element.clientWidth, element.clientHeight);
        pdf.save(`Receipt_${receipt.id}.pdf`);
        addNotification({ title: 'Download Complete', message: `Receipt ${receipt.id}.pdf has been saved.`, type: 'success' });
      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to generate PDF: ' + err.message, type: 'error' });
      }
    }
  };

  const downloadAllReceipts = () => {
    addNotification({ title: 'Processing', message: 'Generating batch receipts...', type: 'info' });
    setTimeout(() => {
      try {
        const pdf = new jsPDF();
        let y = 20;
        const reportDate = new Date().toLocaleString('en-KE', { 
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        // Header
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text('PAYCHAIN FINANCE - BATCH DISBURSEMENT REPORT', 20, y);
        y += 10;
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Date: ${reportDate}`, 20, y);
        y += 8;
        pdf.text(`Total Recipients: ${authorizedReceipts.length}`, 20, y);
        y += 8;
        pdf.text(`Total Payout: KES ${batchTotal.toLocaleString()}`, 20, y);
        y += 15;
        
        pdf.setDrawColor(150);
        pdf.line(20, y, 190, y);
        y += 15;

        // Receipts Iteration
        authorizedReceipts.forEach((r, idx) => {
          if (y > 270) {
            pdf.addPage();
            y = 20;
          }
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text(`Receipt No: ${r.id}`, 20, y);
          y += 8;
          pdf.setFont("helvetica", "normal");
          pdf.text(`Recipient: ${r.name}`, 20, y);
          y += 8;
          pdf.text(`Account/Phone: ${r.phone}`, 20, y);
          y += 8;
          pdf.text(`Amount: KES ${r.amount.toLocaleString()}`, 20, y);
          y += 8;
          pdf.text(`Reference: ${r.reference}`, 20, y);
          y += 8;
          pdf.text(`Method: ${r.method}`, 20, y);
          y += 15;
          pdf.setDrawColor(220);
          pdf.line(20, y, 190, y);
          y += 10;
        });

        pdf.save(`Batch_Receipts_${new Date().getTime()}.pdf`);
        addNotification({ title: 'Download Complete', message: 'Batch receipts downloaded successfully as PDF.', type: 'success' });
      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to generate Batch PDF: ' + (err.message || err.toString()), type: 'error' });
      }
    }, 1000);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedPayees({});
    setAuthorizedReceipts([]);
    // Optionally keep payoutAmounts or reset them
  }

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
          <div className="bg-surface-container-low px-4 py-3 md:px-5 md:py-3.5 rounded-2xl flex items-center justify-between relative overflow-hidden editorial-shadow border border-outline-variant/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
            <div className="flex items-center gap-3 md:gap-8 relative z-10 overflow-x-auto no-scrollbar">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-3 md:gap-4 shrink-0">
                  <div className={`flex items-center gap-2 md:gap-2.5 ${step < s ? 'opacity-40' : ''}`}>
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold text-[8px] md:text-[10px] ${
                      step === s ? 'bg-primary text-white shadow-md' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {s}
                    </div>
                    <span className={`text-[10px] md:text-xs ${step === s ? 'font-bold text-primary tracking-wide' : 'font-semibold text-on-surface-variant'} ${s === 2 && 'sm:block'} ${step !== s && 'hidden md:block'}`}>
                      {s === 1 ? 'Select' : s === 2 ? 'Review' : s === 3 ? 'Settle' : 'Done'}
                    </span>
                  </div>
                  {s < 4 && <div className="h-[1px] w-4 md:w-6 bg-outline-variant/30"></div>}
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-4 md:gap-6 relative z-10 shrink-0">
              <div className="w-[1px] h-8 bg-outline-variant/20 hidden md:block"></div>
              <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2 text-right md:text-left">
                <p className="text-[7px] md:text-[9px] text-on-surface-variant uppercase font-black tracking-widest leading-none opacity-50">Liquidity</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[8px] md:text-[10px] font-bold text-emerald-600">KES</span>
                  <p className={`font-headline text-xs md:text-base text-primary leading-none transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{balance.toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFundModal(true)}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-white border border-outline-variant/10 text-primary flex items-center justify-center gap-1.5 hover:border-emerald-500/30 hover:bg-emerald-50 transition-all shadow-sm active:scale-95 group"
              >
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em]">Fund</span>
              </button>
            </div>
          </div>

          {/* Batch Selection View */}
          <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-outline-variant/10">
            <div className="p-6 md:p-10 border-b border-outline-variant/5">
              <h3 className="font-headline text-xl md:text-3xl text-primary tracking-tight font-bold">Create Payment Batch</h3>
              <p className="text-[10px] md:text-sm text-on-surface-variant font-medium mt-1 md:mt-1.5 opacity-60 italic">Define specific liquidity distribution for this cycle.</p>
            </div>
            <div className="p-0">
              {/* Desktop Table */}
              {step < 3 && (
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 border border-outline-variant/10 rounded-2xl overflow-hidden">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10 w-12 text-center">#</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Recipient</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Settlement Account</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Reference</th>
                        <th className="px-6 py-4 text-right text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-outline-variant/10">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 bg-white">
                      {payeesList.filter(p => selectedPayees[p.id]).map((p, idx) => (
                        <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors group">
                          <td className="px-6 py-4 text-center text-[10px] font-bold text-on-surface-variant/40 border-r border-outline-variant/5">{idx + 1}</td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[8px] font-black text-[#5EFEB3]">
                                {p.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <span className="text-xs font-bold text-primary">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-primary/80 uppercase tracking-wider">{p.paymentMethod}</span>
                              <span className="text-[10px] font-medium text-on-surface-variant opacity-60 tabular-nums">{p.phone || p.paybillNumber || p.accountNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            {step === 2 ? (
                              <input 
                                className="bg-surface-container-low/30 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-primary/60 w-full focus:ring-1 focus:ring-emerald-500/30 px-3 py-2 transition-all" 
                                placeholder="Ref..." 
                                defaultValue="MAY_PAYOUT_24"
                              />
                            ) : (
                              <span className="text-[10px] font-black text-primary/30 uppercase tracking-widest">Pending Review</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest opacity-20">KES</span>
                              {step === 2 ? (
                                <input 
                                  className="bg-transparent border-none text-right font-headline text-lg text-primary focus:ring-0 p-0 w-24 tabular-nums" 
                                  value={(payoutAmounts[p.id] || 0).toLocaleString()}
                                  onChange={(e) => updateAmount(p.id, e.target.value)}
                                />
                              ) : (
                                <span className="font-headline text-lg text-primary/40 tabular-nums">{(payoutAmounts[p.id] || 0).toLocaleString()}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Card List */}
              {step < 3 && (
                <div className="lg:hidden flex flex-col divide-y divide-outline-variant/10">
                  {payeesList.filter(p => selectedPayees[p.id]).map((p, idx) => (
                    <div key={p.id} className="p-4 flex flex-col gap-3 bg-white hover:bg-emerald-50/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-on-surface-variant/30 w-4">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[8px] font-black text-[#5EFEB3]">
                            {p.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-primary leading-none">{p.name}</p>
                            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-50">{p.paymentMethod}</p>
                          </div>
                        </div>
                        {step === 1 && (
                          <input 
                            type="checkbox" 
                            checked={!!selectedPayees[p.id]}
                            onChange={() => togglePayee(p.id)}
                            className="w-5 h-5 rounded-none border-outline-variant/30 text-[#00351D] focus:ring-[#00351D]" 
                          />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/5 pt-3">
                        <div className="space-y-1">
                          <label className="text-[7px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-30">Account / Ref</label>
                          <p className="text-[9px] font-medium text-on-surface-variant leading-none">{p.phone || p.paybillNumber || p.accountNumber}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <label className="text-[7px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-30">Amount (KES)</label>
                          {step === 2 ? (
                            <input 
                              className="w-full bg-surface-container-low/50 border-none text-right font-headline text-sm text-primary rounded-lg px-2 py-1 tabular-nums" 
                              value={(payoutAmounts[p.id] || 0).toLocaleString()}
                              onChange={(e) => updateAmount(p.id, e.target.value)}
                            />
                          ) : (
                            <p className="text-xs font-headline font-bold text-primary">{(payoutAmounts[p.id] || 0).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Settle Payments View */}
              {step === 3 && (
                <div className="p-6 md:p-10 animate-in fade-in zoom-in duration-500 bg-surface-container-low/20">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-6">Select Funding Source</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'TILL_1', name: 'Main Business Till', balance: 184250, number: '852300' },
                      { id: 'TILL_2', name: 'Nairobi Branch Till', balance: 45000, number: '852301' },
                    ].map(till => (
                      <div 
                        key={till.id}
                        onClick={() => setSelectedTill(till.id)}
                        className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${selectedTill === till.id ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10' : 'border-outline-variant/10 hover:border-emerald-500/30 bg-white shadow-sm hover:shadow-md'}`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedTill === till.id ? 'bg-emerald-500 text-white shadow-sm' : 'bg-surface-container-low text-primary'}`}>
                              <span className="material-symbols-outlined">{selectedTill === till.id ? 'check' : 'storefront'}</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-sm text-primary leading-tight">{till.name}</h5>
                              <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">Till No: {till.number}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-outline-variant/5">
                          <p className="text-[9px] text-on-surface-variant uppercase tracking-[0.2em] font-black opacity-40 mb-1.5">Available Balance</p>
                          <p className="font-headline text-xl text-primary font-bold">{formatKES(till.balance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Success & Receipts View */}
              {step === 4 && (
                <div className="p-6 md:p-12 animate-in fade-in zoom-in duration-700">
                  <div className="flex flex-col items-center text-center mb-12">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-emerald-500 rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl shadow-emerald-500/40 relative">
                      <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20 duration-[2000ms]"></div>
                      <span className="material-symbols-outlined text-4xl md:text-6xl text-[#00351D] font-black">check_circle</span>
                    </div>
                    <h2 className="font-headline text-3xl md:text-5xl text-primary font-bold tracking-tight mb-3">Batch Authorized</h2>
                    <p className="text-[10px] md:text-sm font-medium text-on-surface-variant opacity-60 max-w-md mx-auto italic">Disbursement workflow complete. Receipts generated for all recipients.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                    {authorizedReceipts.map((receipt) => (
                      <div key={receipt.id} id={`receipt-${receipt.id}`} className="bg-white border border-outline-variant/10 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.03)] group hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                        <div className="bg-[#00351D] p-5 md:p-6 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-emerald-400">payments</span>
                            </div>
                            <div>
                              <p className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">Receipt No.</p>
                              <p className="text-xs font-black text-white tracking-widest uppercase">{receipt.id}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => downloadReceipt(receipt)}
                            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-emerald-400 hover:bg-white/10 transition-all"
                          >
                            <span className="material-symbols-outlined text-lg">download</span>
                          </button>
                        </div>
                        <div className="p-5 md:p-8 space-y-5 md:space-y-6">
                          <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0">
                            <div className="flex items-center sm:items-start gap-4 sm:gap-0 sm:flex-col sm:mb-0 w-full justify-between sm:justify-start">
                              <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest sm:mb-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Confirmed
                              </p>
                              <p className="text-[11px] sm:text-xs font-bold text-primary opacity-60">{receipt.timestamp}</p>
                            </div>
                            <div className="text-left sm:text-right w-full sm:w-auto p-4 sm:p-0 bg-surface-container-low/30 sm:bg-transparent rounded-xl sm:rounded-none">
                              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1">Amount Paid</p>
                              <p className="font-headline text-2xl text-primary font-bold">{formatKES(receipt.amount)}</p>
                            </div>
                          </div>

                          <div className="h-[1px] bg-outline-variant/10 w-full"></div>

                          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-white p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-outline-variant/10">
                              <p className="text-[8px] sm:text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1.5">Recipient</p>
                              <p className="text-[12px] sm:text-[13px] font-bold text-primary mb-0.5">{receipt.name}</p>
                              <p className="text-[10px] sm:text-[11px] font-medium text-on-surface-variant opacity-60">{receipt.phone}</p>
                            </div>
                            <div className="bg-white p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-outline-variant/10 text-left sm:text-right">
                              <p className="text-[8px] sm:text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1.5">Reference</p>
                              <p className="text-[10px] sm:text-[11px] font-black text-primary uppercase tracking-wider">{receipt.reference}</p>
                              <p className="text-[9px] sm:text-[10px] text-on-surface-variant font-medium mt-1 opacity-50 italic">via {receipt.method}</p>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                             <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Settled</span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant font-bold opacity-30 italic">PayChainKE Finance</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table Footer / Action Bar */}
          <div className="px-4 md:px-6 pb-6 md:pb-8 flex justify-center w-full">
            <div className={`p-4 md:p-5 rounded-3xl bg-[#00351D] text-white flex flex-col sm:flex-row items-center transition-all duration-700 shadow-2xl relative overflow-hidden gap-4 sm:gap-6 w-full max-w-4xl mx-auto border border-emerald-900/30 ${step === 4 ? 'justify-center bg-transparent shadow-none border-0' : 'justify-between'}`}>
              {step !== 4 && (
                <>
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-2xl"></div>
                  <div className="flex items-center gap-4 md:gap-8 relative z-10 w-full sm:w-auto overflow-x-auto no-scrollbar justify-center sm:justify-start">
                    <div className="flex flex-col min-w-fit">
                      <span className="text-[8px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-0.5">Batch Load</span>
                      <span className="text-[11px] md:text-sm font-bold whitespace-nowrap">{Object.values(selectedPayees).filter(Boolean).length} Verified Payees</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>
                    <div className="flex flex-col min-w-fit">
                      <span className="text-[8px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-0.5">Total Payout</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[9px] md:text-xs font-bold text-emerald-400">KES</span>
                        <span className={`font-headline text-lg md:text-2xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{batchTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto justify-center sm:justify-end">
                    {isLiquidityLow && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[8px] text-amber-400 font-bold uppercase tracking-widest mb-0.5">Insufficient Liquidity</p>
                        <p className="text-[9px] text-white/60">Balance: {formatKES(balance)}</p>
                      </div>
                    )}
                    <button 
                      onClick={step === 1 ? () => setStep(2) : step === 2 ? () => setStep(3) : () => setShowSecurityModal(true)}
                      disabled={batchTotal === 0 || isLiquidityLow || (step === 3 && !selectedTill)}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#00351D] px-6 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 group disabled:opacity-20 disabled:grayscale text-xs md:text-sm"
                    >
                      {step === 1 ? 'Review Batch' : step === 2 ? 'Proceed to Settlement' : 'Authorize Batch'}
                      <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                        {step === 1 ? 'visibility' : step === 2 ? 'arrow_forward' : 'bolt'}
                      </span>
                    </button>
                  </div>
                </>
              )}
              {step === 4 && (
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto max-w-xl mx-auto animate-in slide-in-from-bottom duration-1000">
                  <button 
                    onClick={downloadAllReceipts}
                    className="flex-1 px-8 py-4 bg-surface-container-low text-primary font-black uppercase tracking-widest text-[11px] rounded-2xl border border-outline-variant/10 hover:bg-white transition-all flex items-center justify-center gap-3"
                  >
                    <span className="material-symbols-outlined text-xl">file_download</span>
                    Download All Receipts
                  </button>
                  <button onClick={handleReset} className="flex-1 px-10 py-4 bg-[#00351D] text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-2xl shadow-emerald-950/40 hover:bg-emerald-950 transition-all flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-xl">grid_view</span>
                    Return to Overview
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        {/* Fund Account Modal Overlay */}
        {showFundModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-headline text-2xl text-primary tracking-tight font-bold">Fund Account</h2>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">
                      {fundStep === 1 ? 'Select Funding Method' : fundStep === 2 ? 'Enter Details' : 'Confirm Funding'}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setShowFundModal(false); setFundStep(1); }}
                    className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {fundStep === 1 && (
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'Virtual Account Transfer', label: 'Virtual Account Transfer', icon: 'account_balance', desc: 'Transfer to your dedicated USD/KES account' },
                      { id: 'Mobile Money', label: 'Mobile Money', icon: 'smartphone', desc: 'M-Pesa, Airtel Money' },
                      { id: 'Card Top-up', label: 'Card Top-up', icon: 'credit_card', desc: 'Visa / Mastercard' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => { setFundDetails({...fundDetails, method: method.id}); setFundStep(2); }}
                        className="group flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01] transition-all"
                      >
                        <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-[#00351D] group-hover:text-white transition-all shrink-0">
                          <span className="material-symbols-outlined text-2xl">{method.icon}</span>
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-sm text-primary">{method.label}</h4>
                          <p className="text-[10px] text-on-surface-variant mt-0.5 opacity-60">{method.desc}</p>
                        </div>
                        <span className="material-symbols-outlined ml-auto text-primary/10 group-hover:text-emerald-500 transition-all">chevron_right</span>
                      </button>
                    ))}
                  </div>
                )}

                {fundStep === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Amount (KES)</label>
                      <input 
                        type="text"
                        value={fundDetails.amount}
                        onChange={(e) => setFundDetails({...fundDetails, amount: e.target.value})}
                        placeholder="e.g. 50,000"
                        className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                      />
                    </div>

                    {fundDetails.method === 'Mobile Money' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Phone Number</label>
                        <input 
                          type="text"
                          value={fundDetails.phone}
                          onChange={(e) => setFundDetails({...fundDetails, phone: e.target.value})}
                          placeholder="07XX XXX XXX"
                          className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                        />
                      </div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setFundStep(1)}
                        className="flex-1 py-3.5 rounded-2xl border border-outline-variant/10 text-primary font-bold text-sm"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setFundStep(3)}
                        className="flex-[2] py-3.5 rounded-2xl bg-[#00351D] text-white font-bold text-sm shadow-xl active:scale-[0.98]"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>
                )}

                {fundStep === 3 && (
                  <div className="animate-in zoom-in duration-500 text-center py-4">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="material-symbols-outlined text-4xl text-emerald-600">contactless</span>
                    </div>
                    <h3 className="font-headline text-xl text-primary font-bold mb-2">Confirm Funding</h3>
                    <p className="text-sm text-on-surface-variant opacity-60 px-6">You are about to deposit</p>
                    <div className="flex items-center justify-center gap-2 my-4">
                      <span className="text-sm font-bold text-emerald-600">KES</span>
                      <span className="font-headline text-4xl text-primary font-bold tracking-tighter">{fundDetails.amount || '0'}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-40">via {fundDetails.method}</p>

                    <div className="flex gap-4 pt-10">
                      <button 
                        onClick={() => setFundStep(2)}
                        className="flex-1 py-3.5 rounded-2xl border border-outline-variant/10 text-primary font-bold text-sm"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleFundAccount}
                        className="flex-[2] py-3.5 rounded-2xl bg-[#00351D] text-white font-bold text-sm shadow-xl animate-bounce-slow"
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Security Verification Modal */}
        {showSecurityModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-headline text-2xl text-primary tracking-tight font-bold">Verification</h2>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">Security Check required for Settlement</p>
                  </div>
                  <button 
                    onClick={() => { setShowSecurityModal(false); setSecurityStep(1); }}
                    className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {securityStep === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">sms</span>
                      </div>
                      <p className="text-sm text-primary font-bold">Enter OTP Sent to +254 7XX XXX XXX</p>
                    </div>
                    
                    <input 
                      type="text"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="• • • • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                    />

                    <button 
                      onClick={() => setSecurityStep(2)}
                      disabled={otp.length < 4}
                      className="w-full py-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-all disabled:opacity-50"
                    >
                      Verify OTP
                    </button>
                  </div>
                )}

                {securityStep === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-[#00351D] text-emerald-400 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">lock</span>
                      </div>
                      <p className="text-sm text-primary font-bold">Enter Account PIN to Authorize</p>
                    </div>

                    <input 
                      type="password"
                      maxLength="4"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="• • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-[#00351D]/50 transition-all outline-none"
                    />

                    <button 
                      onClick={handleSecurityVerification}
                      disabled={pin.length !== 4}
                      className="w-full py-4 rounded-2xl bg-[#00351D] text-white hover:bg-emerald-950 font-bold text-sm shadow-xl transition-all disabled:opacity-50"
                    >
                      Confirm & Pay
                    </button>

                    <div className="relative flex items-center justify-center py-2">
                       <div className="w-full h-px bg-outline-variant/10 absolute"></div>
                       <span className="relative z-10 bg-white px-4 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40">OR</span>
                    </div>

                    <button 
                      onClick={handleSecurityVerification}
                      className="w-full py-4 rounded-2xl border border-outline-variant/20 text-primary hover:bg-surface-container-low font-bold text-sm flex items-center justify-center gap-3 transition-all group"
                    >
                      <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">fingerprint</span>
                      Use Biometrics / Face ID
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MerchantLayout>
  )
}
