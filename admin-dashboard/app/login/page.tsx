'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Alert } from '@/components/ui';
import { 
  TrendingUp, 
  Mail, 
  Lock, 
  AlertCircle,
  Shield,
  Activity,
  BarChart3,
  Users,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(error);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setLoginError(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-dash-bg via-dash-card to-naija-green-900/20 relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-naija-green-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-naija-gold-500/10 rounded-full blur-3xl animate-pulse-slow animation-delay-500" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-naija-green-500 to-naija-gold-500 flex items-center justify-center shadow-lg glow-green">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">NaijaMarket Intel</h1>
              <p className="text-naija-green-400 text-sm font-medium tracking-wider">ADMIN DASHBOARD</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            The Bloomberg of<br />
            <span className="text-gradient-naija">Nigerian Commodities</span>
          </h2>
          <p className="text-dash-muted text-lg mb-12 max-w-md">
            Real-time commodity price intelligence powered by crowdsourced data from 226+ markets across Nigeria.
          </p>

          {/* Stats preview */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 rounded-xl bg-dash-card/50 backdrop-blur border border-dash-border">
              <Users className="w-6 h-6 text-naija-green-500 mb-2" />
              <p className="text-2xl font-bold text-white font-mono">10,000+</p>
              <p className="text-sm text-dash-muted">Active Traders</p>
            </div>
            <div className="p-4 rounded-xl bg-dash-card/50 backdrop-blur border border-dash-border">
              <BarChart3 className="w-6 h-6 text-naija-gold-400 mb-2" />
              <p className="text-2xl font-bold text-white font-mono">524+</p>
              <p className="text-sm text-dash-muted">Commodities Tracked</p>
            </div>
            <div className="p-4 rounded-xl bg-dash-card/50 backdrop-blur border border-dash-border">
              <Activity className="w-6 h-6 text-status-info mb-2" />
              <p className="text-2xl font-bold text-white font-mono">50K</p>
              <p className="text-sm text-dash-muted">Daily Submissions</p>
            </div>
            <div className="p-4 rounded-xl bg-dash-card/50 backdrop-blur border border-dash-border">
              <Shield className="w-6 h-6 text-status-success mb-2" />
              <p className="text-2xl font-bold text-white font-mono">99.9%</p>
              <p className="text-sm text-dash-muted">Data Accuracy</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-12 text-sm text-dash-muted">
          © 2024 Giggababytes Oy. All rights reserved.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dash-bg">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-naija-green-500 to-naija-gold-500 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NaijaMarket Intel</h1>
              <p className="text-naija-green-400 text-xs font-medium">ADMIN DASHBOARD</p>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-dash-card border border-dash-border rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-dash-muted">Sign in to access the control center</p>
            </div>

            {/* Error alert */}
            {loginError && (
              <Alert variant="danger" icon={AlertCircle} className="mb-6">
                {loginError}
              </Alert>
            )}

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                placeholder="admin@naijamarket.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={Mail}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={Lock}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                className="w-full h-12 text-base"
                isLoading={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 p-4 rounded-lg bg-dash-bg border border-dash-border">
              <p className="text-xs text-dash-muted text-center mb-2">Demo Credentials</p>
              <div className="text-xs text-center space-y-1">
                <p className="text-dash-text font-mono">olawale.sobogungod@giggabytes.eu</p>
                <p className="text-dash-muted">Password: NaijaAdmin2024!</p>
              </div>
            </div>

            {/* Security notice */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-dash-muted">
              <Shield className="w-4 h-4" />
              <span>Protected by enterprise-grade security</span>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center text-sm text-dash-muted">
            <a href="#" className="hover:text-naija-green-400 transition-colors">
              Need help?
            </a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-naija-green-400 transition-colors">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
