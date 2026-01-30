import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Mail, User, Building, CreditCard } from 'lucide-react';

interface WaitlistFormData {
  fullName: string;
  businessName: string;
  email: string;
  paymentRail: string;
  notifyLaunch: boolean;
}

const WaitlistForm: React.FC = () => {
  const [formData, setFormData] = useState<WaitlistFormData>({
    fullName: '',
    businessName: '',
    email: '',
    paymentRail: '',
    notifyLaunch: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentRails = [
    'M-Pesa Till',
    'Paybill',
    'Pochi la Biashara',
    'Bank',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Redirect to Google Form
    window.open('https://forms.gle/eJQVeiSGioHN4t6s7', '_blank');

    setIsSubmitting(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Full Name */}
      <div className="relative">
        <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-2">
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            required
            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
            placeholder="Enter your full name"
          />
        </div>
      </div>

      {/* Business Name */}
      <div className="relative">
        <label htmlFor="businessName" className="block text-sm font-medium text-slate-300 mb-2">
          Business Name
        </label>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleInputChange}
            required
            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
            placeholder="Enter your business name"
          />
        </div>
      </div>

      {/* Email */}
      <div className="relative">
        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Shield className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#10B981]" />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full pl-10 pr-12 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
            placeholder="Enter your email"
          />
        </div>
      </div>

      {/* Payment Rail */}
      <div className="relative">
        <label htmlFor="paymentRail" className="block text-sm font-medium text-slate-300 mb-2">
          Select Your Payment Rail
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
          <select
            id="paymentRail"
            name="paymentRail"
            value={formData.paymentRail}
            onChange={handleInputChange}
            required
            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all appearance-none"
          >
            <option value="" className="bg-[#0A0F1E]">Choose your payment rail</option>
            {paymentRails.map((rail) => (
              <option key={rail} value={rail} className="bg-[#0A0F1E]">
                {rail}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification Checkbox */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="notifyLaunch"
          name="notifyLaunch"
          checked={formData.notifyLaunch}
          onChange={handleInputChange}
          className="w-4 h-4 text-[#10B981] bg-white/10 border-white/20 rounded focus:ring-[#10B981] focus:ring-2"
        />
        <label htmlFor="notifyLaunch" className="text-sm text-slate-300">
          Notify me of the Q3 2026 Launch
        </label>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 px-6 bg-[#10B981] text-white font-semibold rounded-lg hover:bg-[#0f8c6d] focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2 focus:ring-offset-[#0A0F1E] transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Securing Your Spot...
          </div>
        ) : (
          <motion.span
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Secure My Spot in the Truth Layer
          </motion.span>
        )}
      </motion.button>
    </motion.form>
  );
};

export default WaitlistForm;