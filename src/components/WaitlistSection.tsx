'use client'
import { useState } from 'react'

type Step = 'idle' | 'loading' | 'success' | 'error'
const MARKETS = ['Lagos', 'Anambra (Onitsha)', 'Kano', 'Rivers (Port Harcourt)', 'Other']

export default function WaitlistSection() {
  const [phone, setPhone]         = useState('')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [interest, setInterest]   = useState<'CONSUMER' | 'TRADER'>('CONSUMER')
  const [market, setMarket]       = useState('')
  const [step, setStep]           = useState<Step>('idle')
  const [message, setMessage]     = useState('')
  const [phoneErr, setPhoneErr]   = useState('')
  const [emailErr, setEmailErr]   = useState('')

  function validatePhone(val: string) {
    setPhone(val); setPhoneErr('')
    if (!val) return
    const c = val.replace(/[\s\-().]/g, '')
    const ok = /^0[789]\d{9}$/.test(c) || /^234[789]\d{9}$/.test(c) || /^\+234[789]\d{9}$/.test(c)
    if (val.length > 6 && !ok) setPhoneErr('Enter a valid Nigerian number, e.g. 08012345678')
  }

  function validateEmail(val: string) {
    setEmail(val); setEmailErr('')
    if (!val) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) setEmailErr('Enter a valid email address')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone || phoneErr) return
    if (!email || emailErr) { setEmailErr('Email is required'); return }
    setStep('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, name: name || undefined, email,
          interest, market_area: market || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data.error || 'Something went wrong.'
        if (errMsg.toLowerCase().includes('phone')) setPhoneErr(errMsg)
        else if (errMsg.toLowerCase().includes('email')) setEmailErr(errMsg)
        else setMessage(errMsg)
        setStep('idle'); return
      }
      setMessage(data.message); setStep('success')
    } catch { setStep('error'); setMessage('Network error — please try again.') }
  }

  const canSubmit = !!phone && !phoneErr && !!email && !emailErr && step !== 'loading'

  return (
    <section id="waitlist" className="relative py-24 px-4 overflow-hidden" style={{ background: 'linear-gradient(180deg,#050505 0%,#0a0a0a 50%,#050505 100%)' }}>
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#00a651 1px,transparent 1px),linear-gradient(90deg,#00a651 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="relative container mx-auto max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
            Get First Access to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">Real Market Prices</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Join traders and buyers from Mile 12 and Onitsha who will have live commodity price data before anyone else.</p>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500 flex-wrap">
            <span>📍 Mile 12, Lagos</span><span className="w-px h-4 bg-gray-700" />
            <span>📍 Onitsha, Anambra</span><span className="w-px h-4 bg-gray-700" />
            <span>610 commodities</span><span className="w-px h-4 bg-gray-700" />
            <span>282 markets</span>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-8 shadow-2xl">
          {step === 'success' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-white text-2xl font-bold mb-3">You're on the list!</h3>
              <p className="text-gray-400 mb-6">{message}</p>
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1a1a1a] text-left space-y-2">
                <p className="text-gray-500 text-sm font-mono"><span className="text-green-400">✓</span> Spot reserved</p>
                <p className="text-gray-500 text-sm font-mono"><span className="text-green-400">✓</span> Welcome email sent — check your inbox</p>
                <p className="text-gray-500 text-sm font-mono"><span className="text-green-400">✓</span> Weekly market brief every Monday</p>
                <p className="text-gray-500 text-sm font-mono"><span className="text-green-400">✓</span> WhatsApp invite coming at launch</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-sm mb-2">I am a</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['CONSUMER', 'TRADER'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setInterest(r)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${interest === r ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-[#0a0a0a] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'}`}>
                      {r === 'CONSUMER' ? '🛒 Buyer / Business' : '📦 Market Trader'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Phone Number <span className="text-green-500">*</span></label>
                <div className="flex">
                  <span className="flex items-center px-3 bg-[#0a0a0a] border border-r-0 border-[#2a2a2a] rounded-l-xl text-gray-500 text-sm font-mono select-none">🇳🇬 +234</span>
                  <input type="tel" value={phone} onChange={e => validatePhone(e.target.value)} placeholder="08012345678" required
                    className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-r-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/60 transition-colors" />
                </div>
                {phoneErr && <p className="text-red-400 text-xs mt-1">{phoneErr}</p>}
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Email Address <span className="text-green-500">*</span></label>
                <input type="email" value={email} onChange={e => validateEmail(e.target.value)} placeholder="you@example.com" required
                  className={`w-full bg-[#0a0a0a] border rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none transition-colors ${emailErr ? 'border-red-500/60' : 'border-[#2a2a2a] focus:border-green-500/60'}`} />
                {emailErr && <p className="text-red-400 text-xs mt-1">{emailErr}</p>}
                <p className="text-gray-600 text-xs mt-1">Weekly market brief sent every Monday</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Name <span className="text-gray-600">(optional)</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/60 transition-colors" />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Your Market Area <span className="text-gray-600">(optional)</span></label>
                <select value={market} onChange={e => setMarket(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500/60 transition-colors appearance-none"
                  style={{ color: market ? '#fff' : '#4b5563' }}>
                  <option value="">Select area...</option>
                  {MARKETS.map(a => <option key={a} value={a} className="bg-[#111] text-white">{a}</option>)}
                </select>
              </div>

              {message && <p className="text-red-400 text-sm text-center">{message}</p>}

              <button type="submit" disabled={!canSubmit}
                className="w-full py-4 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: canSubmit ? 'linear-gradient(135deg,#00a651,#00c563)' : '#1a3a2a', color: '#fff' }}>
                {step === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Reserving your spot...
                  </span>
                ) : '🚀 Join the Waitlist'}
              </button>

              <p className="text-gray-600 text-xs text-center">No spam. Weekly market brief + WhatsApp invite when we go live.</p>
            </form>
          )}
        </div>

        <div className="flex justify-center mt-8">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-8 py-4 text-center">
            <div className="text-green-400 font-bold text-lg">₦0</div>
            <div className="text-gray-600 text-xs mt-1">Free to join</div>
          </div>
        </div>
          ))}
        </div>
      </div>
    </section>
  )
}
