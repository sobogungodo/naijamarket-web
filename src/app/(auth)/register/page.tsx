"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Building2,
  Phone,
  ArrowRight, 
  Check 
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, FormField } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ============================================================================
// REGISTER PAGE
// ============================================================================

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    email: "",
    password: "",
    confirmPassword: "",
    // Step 2
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    // Terms
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Password must include uppercase, lowercase, and number";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "You must accept the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep2()) return;

    setIsLoading(true);

    try {
      // TODO: Implement actual registration
      // const response = await fetch("/api/auth/register", {
      //   method: "POST",
      //   body: JSON.stringify(formData),
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Account created successfully!", {
        description: "Please check your email to verify your account.",
      });

      router.push("/login");
    } catch (error) {
      toast.error("Registration failed", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    const password = formData.password;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  };

  return (
    <div className="min-h-screen bg-terminal-bg flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-naija-gold/20 via-terminal-surface to-naija-green/10 items-center justify-center p-12 border-r border-terminal-border">
        <div className="max-w-lg">
          <h2 className="text-3xl font-display font-bold text-white mb-6">
            Join Nigeria's Premier<br />
            <span className="text-gradient">Market Intelligence Platform</span>
          </h2>
          
          <div className="space-y-4">
            {[
              "Access 226+ markets across all 37 states",
              "GPS-verified prices from 10,000+ traders",
              "Real-time price alerts and notifications",
              "Advanced analytics and trend analysis",
              "API access for enterprise integration",
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-naija-green/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-naija-green" />
                </div>
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-terminal-surface/50 border border-terminal-border rounded-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-naija-green/20 flex items-center justify-center">
                <span className="text-naija-green font-bold">CK</span>
              </div>
              <div>
                <p className="text-white font-medium">Chidi Kalu</p>
                <p className="text-sm text-gray-400">Procurement Manager, Nestle Nigeria</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm italic">
              "NaijaMarket Intel has transformed how we source commodities. 
              We've reduced procurement costs by 15% in just 3 months."
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
                <span className="text-terminal-bg font-bold text-lg">NM</span>
              </div>
              <span className="font-display font-bold text-xl text-white">
                NaijaMarket<span className="text-naija-green">Intel</span>
              </span>
            </Link>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              step >= 1 ? "bg-naija-green" : "bg-terminal-muted"
            )} />
            <div className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              step >= 2 ? "bg-naija-green" : "bg-terminal-muted"
            )} />
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-white">
              {step === 1 ? "Create your account" : "Tell us about yourself"}
            </h1>
            <p className="text-gray-400 mt-2">
              {step === 1 
                ? "Start with your email and password" 
                : "Help us personalize your experience"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                <FormField label="Email Address" error={errors.email} required>
                  <Input
                    type="email"
                    name="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    leftIcon={<Mail className="w-4 h-4" />}
                    autoComplete="email"
                  />
                </FormField>

                <FormField label="Password" error={errors.password} required>
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:text-white transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    }
                    autoComplete="new-password"
                  />
                  {/* Password Strength */}
                  {formData.password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              passwordStrength() >= level
                                ? passwordStrength() <= 2
                                  ? "bg-price-down"
                                  : passwordStrength() <= 3
                                  ? "bg-naija-gold"
                                  : "bg-price-up"
                                : "bg-terminal-muted"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-2xs text-gray-500 mt-1">
                        {passwordStrength() <= 2
                          ? "Weak password"
                          : passwordStrength() <= 3
                          ? "Medium password"
                          : "Strong password"}
                      </p>
                    </div>
                  )}
                </FormField>

                <FormField label="Confirm Password" error={errors.confirmPassword} required>
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    leftIcon={<Lock className="w-4 h-4" />}
                    autoComplete="new-password"
                  />
                </FormField>

                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  onClick={handleNext}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="First Name" error={errors.firstName} required>
                    <Input
                      type="text"
                      name="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      error={errors.firstName}
                      leftIcon={<User className="w-4 h-4" />}
                      autoComplete="given-name"
                      disabled={isLoading}
                    />
                  </FormField>

                  <FormField label="Last Name" error={errors.lastName} required>
                    <Input
                      type="text"
                      name="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      error={errors.lastName}
                      autoComplete="family-name"
                      disabled={isLoading}
                    />
                  </FormField>
                </div>

                <FormField label="Phone Number (Optional)">
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="+234 800 000 0000"
                    value={formData.phone}
                    onChange={handleChange}
                    leftIcon={<Phone className="w-4 h-4" />}
                    autoComplete="tel"
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Company Name (Optional)">
                  <Input
                    type="text"
                    name="companyName"
                    placeholder="Your Company Ltd"
                    value={formData.companyName}
                    onChange={handleChange}
                    leftIcon={<Building2 className="w-4 h-4" />}
                    autoComplete="organization"
                    disabled={isLoading}
                  />
                </FormField>

                {/* Terms */}
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleChange}
                      className="w-4 h-4 mt-0.5 rounded border-terminal-border bg-terminal-surface text-naija-green focus:ring-naija-green focus:ring-offset-terminal-bg"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-400">
                      I agree to the{" "}
                      <Link href="/terms" className="text-naija-green hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-naija-green hover:underline">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                  {errors.acceptTerms && (
                    <p className="text-xs text-price-down">{errors.acceptTerms}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={isLoading}
                    loadingText="Creating..."
                  >
                    Create Account
                  </Button>
                </div>
              </>
            )}
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-naija-green hover:text-naija-green-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
