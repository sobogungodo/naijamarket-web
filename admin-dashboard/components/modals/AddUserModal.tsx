'use client';

import { useState } from 'react';
import { X, User, Phone, MapPin, Building2, CreditCard, Loader2, CheckCircle } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'trader' | 'validator';
  onSuccess?: (user: any) => void;
}

interface BankInfo {
  bankCode: string;
  bankName: string;
}

const NIGERIAN_BANKS: BankInfo[] = [
  { bankCode: '044', bankName: 'Access Bank' },
  { bankCode: '023', bankName: 'Citibank Nigeria' },
  { bankCode: '050', bankName: 'Ecobank Nigeria' },
  { bankCode: '084', bankName: 'Enterprise Bank' },
  { bankCode: '070', bankName: 'Fidelity Bank' },
  { bankCode: '011', bankName: 'First Bank of Nigeria' },
  { bankCode: '214', bankName: 'First City Monument Bank' },
  { bankCode: '058', bankName: 'Guaranty Trust Bank' },
  { bankCode: '030', bankName: 'Heritage Bank' },
  { bankCode: '301', bankName: 'Jaiz Bank' },
  { bankCode: '082', bankName: 'Keystone Bank' },
  { bankCode: '526', bankName: 'Parallex Bank' },
  { bankCode: '076', bankName: 'Polaris Bank' },
  { bankCode: '101', bankName: 'Providus Bank' },
  { bankCode: '221', bankName: 'Stanbic IBTC Bank' },
  { bankCode: '068', bankName: 'Standard Chartered Bank' },
  { bankCode: '232', bankName: 'Sterling Bank' },
  { bankCode: '100', bankName: 'Suntrust Bank' },
  { bankCode: '032', bankName: 'Union Bank of Nigeria' },
  { bankCode: '033', bankName: 'United Bank for Africa' },
  { bankCode: '215', bankName: 'Unity Bank' },
  { bankCode: '035', bankName: 'Wema Bank' },
  { bankCode: '057', bankName: 'Zenith Bank' },
  { bankCode: '999', bankName: 'OPay' },
  { bankCode: '998', bankName: 'PalmPay' },
  { bankCode: '997', bankName: 'Kuda Bank' },
];

const MARKETS = [
  { id: 'mile12', name: 'Mile 12 Market', state: 'Lagos' },
  { id: 'onitsha', name: 'Onitsha Main Market', state: 'Anambra' },
  { id: 'iddo', name: 'Iddo Market', state: 'Lagos' },
  { id: 'ariaria', name: 'Ariaria Market', state: 'Abia' },
  { id: 'alaba', name: 'Alaba International', state: 'Lagos' },
  { id: 'wuse', name: 'Wuse Market', state: 'Abuja' },
  { id: 'kano', name: 'Kano Main Market', state: 'Kano' },
  { id: 'jos', name: 'Jos Main Market', state: 'Plateau' },
];

export default function AddUserModal({ isOpen, onClose, userType, onSuccess }: AddUserModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    // Market Info (for traders)
    marketId: '',
    // Bank Info
    bankCode: '',
    accountNumber: '',
    accountName: '',
    // Validator specific
    validatorType: 'community', // community, expert, official
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^0[789][01]\d{8}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Enter a valid Nigerian phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (userType === 'trader' && !formData.marketId) {
      newErrors.marketId = 'Please select a market';
    }
    
    if (userType === 'validator' && !formData.validatorType) {
      newErrors.validatorType = 'Please select validator type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.bankCode) newErrors.bankCode = 'Please select a bank';
    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d{10}$/.test(formData.accountNumber)) {
      newErrors.accountNumber = 'Enter a valid 10-digit account number';
    }
    if (!formData.accountName.trim()) newErrors.accountName = 'Account name is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newUser = {
        id: `${userType}_${Date.now()}`,
        ...formData,
        type: userType,
        status: 'active',
        reputation: userType === 'trader' ? 50 : undefined,
        accuracy: userType === 'validator' ? 100 : undefined,
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      
      setIsSuccess(true);
      
      setTimeout(() => {
        onSuccess?.(newUser);
        handleClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error adding user:', error);
      setErrors({ submit: 'Failed to add user. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      marketId: '',
      bankCode: '',
      accountNumber: '',
      accountName: '',
      validatorType: 'community',
    });
    setErrors({});
    setIsSuccess(false);
    onClose();
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Verify account name (simulated)
  const verifyAccountName = async () => {
    if (formData.accountNumber.length === 10 && formData.bankCode) {
      // Simulate bank verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      const names = ['Chidi Okonkwo', 'Ngozi Adeyemi', 'Emeka Nwosu', 'Funke Ibrahim'];
      handleChange('accountName', names[Math.floor(Math.random() * names.length)]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">
              Add New {userType === 'trader' ? 'Trader' : 'Validator'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Step {step} of 3</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-green-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {userType === 'trader' ? 'Trader' : 'Validator'} Added Successfully!
            </h3>
            <p className="text-gray-400">
              {formData.firstName} {formData.lastName} has been added to the system.
            </p>
          </div>
        ) : (
          <>
            {/* Form Content */}
            <div className="p-6 space-y-4">
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-green-500" />
                    <span className="text-white font-medium">Personal Information</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleChange('firstName', e.target.value)}
                        className={`w-full bg-[#0d1117] border ${errors.firstName ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                        placeholder="Enter first name"
                      />
                      {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleChange('lastName', e.target.value)}
                        className={`w-full bg-[#0d1117] border ${errors.lastName ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                        placeholder="Enter last name"
                      />
                      {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className={`w-full bg-[#0d1117] border ${errors.phone ? 'border-red-500' : 'border-gray-700'} rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                        placeholder="08012345678"
                      />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                      placeholder="email@example.com"
                    />
                  </div>
                </>
              )}

              {/* Step 2: Role-specific Info */}
              {step === 2 && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    {userType === 'trader' ? (
                      <MapPin className="w-5 h-5 text-green-500" />
                    ) : (
                      <Building2 className="w-5 h-5 text-green-500" />
                    )}
                    <span className="text-white font-medium">
                      {userType === 'trader' ? 'Market Assignment' : 'Validator Type'}
                    </span>
                  </div>

                  {userType === 'trader' ? (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Select Market</label>
                      <div className="grid grid-cols-2 gap-2">
                        {MARKETS.map((market) => (
                          <button
                            key={market.id}
                            onClick={() => handleChange('marketId', market.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              formData.marketId === market.id
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-gray-700 bg-[#0d1117] hover:border-gray-600'
                            }`}
                          >
                            <p className="text-white font-medium text-sm">{market.name}</p>
                            <p className="text-gray-500 text-xs">{market.state}</p>
                          </button>
                        ))}
                      </div>
                      {errors.marketId && <p className="text-red-500 text-xs mt-2">{errors.marketId}</p>}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Select Validator Type</label>
                      <div className="space-y-2">
                        {[
                          { id: 'community', name: 'Community Validator', desc: 'Regular market participant' },
                          { id: 'expert', name: 'Expert Validator', desc: 'Experienced trader with high accuracy' },
                          { id: 'official', name: 'Official Validator', desc: 'Market association representative' },
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => handleChange('validatorType', type.id)}
                            className={`w-full p-4 rounded-lg border text-left transition-all ${
                              formData.validatorType === type.id
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-gray-700 bg-[#0d1117] hover:border-gray-600'
                            }`}
                          >
                            <p className="text-white font-medium">{type.name}</p>
                            <p className="text-gray-500 text-sm">{type.desc}</p>
                          </button>
                        ))}
                      </div>
                      {errors.validatorType && <p className="text-red-500 text-xs mt-2">{errors.validatorType}</p>}
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Bank Info */}
              {step === 3 && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-green-500" />
                    <span className="text-white font-medium">Bank Account Details</span>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Select Bank</label>
                    <select
                      value={formData.bankCode}
                      onChange={(e) => handleChange('bankCode', e.target.value)}
                      className={`w-full bg-[#0d1117] border ${errors.bankCode ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                    >
                      <option value="">Select a bank</option>
                      {NIGERIAN_BANKS.map((bank) => (
                        <option key={bank.bankCode} value={bank.bankCode}>
                          {bank.bankName}
                        </option>
                      ))}
                    </select>
                    {errors.bankCode && <p className="text-red-500 text-xs mt-1">{errors.bankCode}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        handleChange('accountNumber', value);
                      }}
                      onBlur={verifyAccountName}
                      className={`w-full bg-[#0d1117] border ${errors.accountNumber ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                      placeholder="0123456789"
                    />
                    {errors.accountNumber && <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Account Name</label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => handleChange('accountName', e.target.value)}
                      className={`w-full bg-[#0d1117] border ${errors.accountName ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500`}
                      placeholder="Account holder name"
                    />
                    {errors.accountName && <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>}
                    <p className="text-gray-500 text-xs mt-1">This will be verified automatically</p>
                  </div>

                  {errors.submit && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-500 text-sm">{errors.submit}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between p-6 border-t border-gray-800">
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : step === 3 ? (
                  `Add ${userType === 'trader' ? 'Trader' : 'Validator'}`
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
