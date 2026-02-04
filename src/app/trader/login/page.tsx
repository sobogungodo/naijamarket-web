'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// ALLOWED COUNTRY CODES - EU + WEST AFRICA
// ============================================================================
const ALLOWED_COUNTRIES = [
  // West Africa
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+225', country: 'Ivory Coast', flag: '🇨🇮' },
  { code: '+221', country: 'Senegal', flag: '🇸🇳' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Benin', flag: '🇧🇯' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+224', country: 'Guinea', flag: '🇬🇳' },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱' },
  { code: '+231', country: 'Liberia', flag: '🇱🇷' },
  { code: '+220', country: 'Gambia', flag: '🇬🇲' },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: '+238', country: 'Cape Verde', flag: '🇨🇻' },
  { code: '+222', country: 'Mauritania', flag: '🇲🇷' },
  // European Union
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺' },
  { code: '+40', country: 'Romania', flag: '🇷🇴' },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬' },
  { code: '+385', country: 'Croatia', flag: '🇭🇷' },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮' },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
  { code: '+356', country: 'Malta', flag: '🇲🇹' },
  { code: '+357', country: 'Cyprus', flag: '🇨🇾' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
];

export default function TraderLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [selectedCountry, setSelectedCountry] = useState(ALLOWED_COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [traderName, setTraderName] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Get full phone number (normalized without +)
  const getFullPhone = () => {
    const code = selectedCountry.code.replace('+', '');
    const number = phoneNumber.replace(/\D/g, '');
    return code + number;
  };

  // Send OTP
  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/trader/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getFullPhone() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setTraderName(data.traderName || '');
      setStep('otp');
      setCountdown(60);
      
      // Focus first OTP input
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOTP(fullOtp);
      }
    }
  };

  // Handle backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // Handle paste
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      handleVerifyOTP(pastedData);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/trader/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getFullPhone(), otp: code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // Store token and phone
      localStorage.setItem('trader_token', data.token);
      localStorage.setItem('trader_phone', getFullPhone());

      // Redirect to dashboard
      router.push('/trader');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = () => {
    if (countdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    handleSendOTP();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-900 flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-4xl">🏪</span>
        </div>
        <h1 className="text-2xl font-bold text-white">NaijaMarket Intel</h1>
        <p className="text-green-200 mt-1">Trader Portal</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 py-8">
        {step === 'phone' ? (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome back!</h2>
            <p className="text-gray-500 mb-6">Enter your phone number to login</p>

            {/* Country Picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <button
                type="button"
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl bg-white"
              >
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{selectedCountry.flag}</span>
                  <span className="text-gray-800">{selectedCountry.country}</span>
                  <span className="text-gray-500">({selectedCountry.code})</span>
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {/* Country Dropdown */}
              {showCountryPicker && (
                <div className="absolute z-50 mt-1 w-[calc(100%-3rem)] max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                  {ALLOWED_COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => {
                        setSelectedCountry(country);
                        setShowCountryPicker(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-2xl">{country.flag}</span>
                      <span className="text-gray-800">{country.country}</span>
                      <span className="text-gray-500 ml-auto">{country.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="flex">
                <div className="flex items-center px-4 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl">
                  <span className="text-lg mr-1">{selectedCountry.flag}</span>
                  <span className="text-gray-600 font-medium">{selectedCountry.code}</span>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter phone number"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-r-xl text-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  maxLength={15}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Send OTP Button */}
            <button
              onClick={handleSendOTP}
              disabled={loading || !phoneNumber}
              className="w-full py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send OTP via WhatsApp'
              )}
            </button>

            {/* Info */}
            <p className="mt-4 text-center text-sm text-gray-500">
              You'll receive a 6-digit code on WhatsApp
            </p>

            {/* Registration Note */}
            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 text-sm">
                <strong>Not registered yet?</strong><br />
                Send "Hi" to our WhatsApp number to register as a trader first.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Enter verification code
            </h2>
            <p className="text-gray-500 mb-6">
              {traderName && `Hi ${traderName}! `}
              We sent a code to your WhatsApp
              <br />
              <span className="font-medium text-gray-700">
                {selectedCountry.code} {phoneNumber}
              </span>
            </p>

            {/* OTP Input */}
            <div className="flex justify-center gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={otpRefs[index]}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  maxLength={1}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {/* Verify Button */}
            <button
              onClick={() => handleVerifyOTP()}
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify & Login'
              )}
            </button>

            {/* Resend */}
            <div className="mt-4 text-center">
              {countdown > 0 ? (
                <p className="text-gray-500 text-sm">
                  Resend code in <span className="font-medium text-green-600">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  className="text-green-600 font-medium text-sm hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>

            {/* Back */}
            <button
              onClick={() => {
                setStep('phone');
                setOtp(['', '', '', '', '', '']);
                setError('');
              }}
              className="w-full mt-4 py-3 text-gray-600 font-medium hover:text-gray-800"
            >
              ← Change phone number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
