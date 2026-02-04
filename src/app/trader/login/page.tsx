'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type LoginStep = 'phone' | 'otp' | 'sending';

export default function TraderLogin() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [traderName, setTraderName] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('trader_token');
    if (token) {
      router.push('/trader');
    }
  }, [router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('234')) {
      return digits.slice(0, 13);
    } else if (digits.startsWith('0')) {
      return digits.slice(0, 11);
    }
    return digits.slice(0, 11);
  };

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return '234' + digits.slice(1);
    }
    if (digits.startsWith('234')) {
      return digits;
    }
    return '234' + digits;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const normalizedPhone = normalizePhone(phone);
    
    if (normalizedPhone.length !== 13) {
      setError('Please enter a valid Nigerian phone number');
      return;
    }

    setLoading(true);
    setStep('sending');

    try {
      const res = await fetch('/api/trader/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setTraderName(data.traderName || 'Trader');
      setStep('otp');
      setCountdown(60);
      
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
      setStep('phone');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        verifyOtp(fullOtp);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      verifyOtp(pastedData);
    }
  };

  const verifyOtp = async (otpCode: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/trader/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalizePhone(phone),
          otp: otpCode 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      localStorage.setItem('trader_token', data.token);
      localStorage.setItem('trader_phone', normalizePhone(phone));
      router.push('/trader');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/trader/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone) })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resend OTP');
      }

      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-900/50">
          <span className="text-white font-bold text-3xl">N</span>
        </div>
        <h1 className="text-white text-2xl font-bold">NaijaMarket Intel</h1>
        <p className="text-green-300 text-sm mt-1">Trader Portal</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          {step === 'phone' && (
            <div className="bg-green-900/40 backdrop-blur border border-green-600/30 rounded-3xl p-6">
              <h2 className="text-white text-xl font-bold text-center mb-2">Welcome Back!</h2>
              <p className="text-green-300 text-sm text-center mb-6">
                Enter your phone number to login
              </p>

              <form onSubmit={handlePhoneSubmit}>
                <div className="mb-4">
                  <label className="block text-green-200 text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 font-medium">
                      🇳🇬
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="0803 XXX XXXX"
                      className="w-full bg-green-950/50 border border-green-600/50 rounded-xl py-4 pl-12 pr-4 text-white text-lg placeholder:text-green-600 focus:outline-none focus:border-green-400 transition-colors"
                      autoFocus
                    />
                  </div>
                  <p className="text-green-400/60 text-xs mt-2">
                    We&apos;ll send a verification code to your WhatsApp
                  </p>
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-3 mb-4">
                    <p className="text-red-300 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || phone.replace(/\D/g, '').length < 10}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:from-green-700 disabled:to-green-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Sending...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-green-700/30 text-center">
                <p className="text-green-400/60 text-sm mb-3">Not a registered trader?</p>
                <a 
                  href="https://wa.me/14155238886?text=register" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Register on WhatsApp
                </a>
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="bg-green-900/40 backdrop-blur border border-green-600/30 rounded-3xl p-8 text-center">
              <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-white text-xl font-bold mb-2">Sending OTP</h2>
              <p className="text-green-300 text-sm">
                Please wait while we send a verification code to your WhatsApp...
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="bg-green-900/40 backdrop-blur border border-green-600/30 rounded-3xl p-6">
              <button
                onClick={() => {
                  setStep('phone');
                  setOtp(['', '', '', '', '', '']);
                  setError('');
                }}
                className="text-green-400 hover:text-green-300 text-sm mb-4 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Change number
              </button>

              <h2 className="text-white text-xl font-bold text-center mb-2">
                Hi {traderName}! 👋
              </h2>
              <p className="text-green-300 text-sm text-center mb-6">
                Enter the 6-digit code sent to your WhatsApp
              </p>

              <div className="flex justify-center gap-2 mb-4" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 bg-green-950/50 border border-green-600/50 rounded-xl text-white text-2xl text-center font-bold focus:outline-none focus:border-green-400 transition-colors"
                    disabled={loading}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-3 mb-4">
                  <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 text-green-300 mb-4">
                  <div className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                  <span>Verifying...</span>
                </div>
              )}

              <div className="text-center">
                <p className="text-green-400/60 text-sm mb-2">
                  Didn&apos;t receive the code?
                </p>
                {countdown > 0 ? (
                  <p className="text-green-400 text-sm">
                    Resend in {countdown}s
                  </p>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-green-700/30">
                <div className="bg-blue-900/30 border border-blue-600/30 rounded-xl p-3">
                  <p className="text-blue-300 text-xs text-center">
                    💡 Check your WhatsApp from <strong>+1 415 523 8886</strong> for the OTP code
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-green-600 text-xs">
          © 2026 NaijaMarket Intel. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
