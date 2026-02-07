'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Item {
  id: string;
  name: string;
  categoryId: string;
  defaultUnit: string;
}

interface Brand {
  id: string;
  name: string;
  itemId: string;
}

interface Unit {
  id: string;
  name: string;
  symbol: string;
}

interface TraderInfo {
  phone: string;
  fullName: string;
  marketId: string;
  marketName: string;
  marketLat: number;
  marketLng: number;
  reputation: number;
}

type SubmissionStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function PriceSubmission() {
  const router = useRouter();
  const [step, setStep] = useState<SubmissionStep>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [trader, setTrader] = useState<TraderInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [price, setPrice] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'pending' | 'checking' | 'verified' | 'failed'>('pending');
  const [gpsError, setGpsError] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const token = localStorage.getItem('trader_token');
    const phone = localStorage.getItem('trader_phone');
    
    if (!token || !phone) {
      router.push('/trader/login');
      return;
    }

    try {
      const profileRes = await fetch(`/api/trader/profile?phone=${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!profileRes.ok) {
        if (profileRes.status === 401) {
          localStorage.removeItem('trader_token');
          router.push('/trader/login');
          return;
        }
        throw new Error('Failed to load profile');
      }
      
      const profileData = await profileRes.json();
      setTrader(profileData);

      const categoriesRes = await fetch('/api/trader/categories');
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }

      const unitsRes = await fetch('/api/trader/units');
      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(unitsData.units || []);
      }
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = async (category: Category) => {
    setSelectedCategory(category);
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/trader/items?categoryId=${category.id}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setStep(2);
      }
    } catch (err) {
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = async (item: Item) => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('trader_token');
      const duplicateRes = await fetch(
        `/api/trader/check-duplicate?marketId=${trader?.marketId}&itemId=${item.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (duplicateRes.ok) {
        const duplicateData = await duplicateRes.json();
        if (duplicateData.exists) {
          setError(`We already have the price of ${item.name}, please submit price for another product.`);
          setLoading(false);
          return;
        }
      }

      setSelectedItem(item);

      const brandsRes = await fetch(`/api/trader/brands?itemId=${item.id}`);
      if (brandsRes.ok) {
        const brandsData = await brandsRes.json();
        setBrands(brandsData.brands || []);
      }
      
      const defaultUnit = units.find(u => u.id === item.defaultUnit);
      if (defaultUnit) {
        setSelectedUnit(defaultUnit);
      }

      setStep(3);
    } catch (err) {
      setError('Failed to check item availability');
    } finally {
      setLoading(false);
    }
  };

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    setStep(4);
  };

  const handlePriceSubmit = () => {
    const priceNum = parseFloat(price.replace(/,/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid price');
      return;
    }
    setError('');
    setStep(5);
  };

  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    setStep(6);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const requestGPS = () => {
    setGpsStatus('checking');
    setGpsError('');

    if (!navigator.geolocation) {
      setGpsStatus('failed');
      setGpsError('GPS is not supported on your device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });

        if (trader) {
          const distance = calculateDistance(
            userLat, userLng,
            trader.marketLat, trader.marketLng
          );

          if (distance <= 500) {
            setGpsStatus('verified');
            setStep(7);
          } else {
            setGpsStatus('failed');
            setGpsError(`You are ${Math.round(distance)}m away from ${trader.marketName}. You must be within 500m to submit prices.`);
          }
        }
      },
      (error) => {
        setGpsStatus('failed');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please enable GPS access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location unavailable. Please try again.');
            break;
          case error.TIMEOUT:
            setGpsError('Location request timed out. Please try again.');
            break;
          default:
            setGpsError('Failed to get location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('trader_token');
      
      const res = await fetch('/api/trader/submit-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: trader?.phone,
          marketId: trader?.marketId,
          categoryId: selectedCategory?.id,
          itemId: selectedItem?.id,
          brandId: selectedBrand?.id,
          price: parseFloat(price.replace(/,/g, '')),
          unitId: selectedUnit?.id,
          gpsLat: userCoords?.lat,
          gpsLng: userCoords?.lng
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit price');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    if (!digits) return '';
    return parseInt(digits).toLocaleString();
  };

  const goBack = () => {
    if (step > 1) {
      setError('');
      setStep((step - 1) as SubmissionStep);
    }
  };

  if (loading && step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-green-200 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-green-800/50 border border-green-500/50 rounded-3xl p-8 text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Submitted! 🎉</h2>
          <p className="text-green-200 mb-6">
            Your price for <strong>{selectedItem?.name}</strong> has been submitted for validation.
          </p>
          
          {(trader?.reputation || 0) >= 80 ? (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 mb-6">
              <p className="text-yellow-300 text-sm">
                ⚡ <strong>Instant Approval!</strong> Your high reputation means automatic approval. +₦200 added to your balance!
              </p>
            </div>
          ) : (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-3 mb-6">
              <p className="text-blue-300 text-sm">
                ⏱️ Validators will review your submission within 20 minutes. You&apos;ll earn ₦200 if approved!
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-4 rounded-xl transition-all"
            >
              Submit Another Price
            </button>
            <Link href="/trader">
              <button className="w-full bg-green-900/50 border border-green-600/50 text-green-300 font-medium py-4 rounded-xl hover:bg-green-800/50 transition-all">
                Back to Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900">
      <header className="bg-green-950/80 backdrop-blur-sm border-b border-green-700/50 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-4">
          {step > 1 ? (
            <button onClick={goBack} className="text-green-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <Link href="/trader" className="text-green-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
          <div className="flex-1">
            <h1 className="text-white font-bold">Submit Price</h1>
            <p className="text-green-400 text-xs">{trader?.marketName}</p>
          </div>
          <div className="text-green-400 text-sm font-medium">Step {step}/7</div>
        </div>
        <div className="h-1 bg-green-900">
          <div 
            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
            style={{ width: `${(step / 7) * 100}%` }}
          ></div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Select Category</h2>
            <p className="text-green-300 text-sm mb-6">What type of product are you submitting?</p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className="bg-green-900/40 border border-green-600/30 rounded-2xl p-4 text-center hover:bg-green-800/40 hover:border-green-500/50 transition-all active:scale-[0.98]"
                >
                  <span className="text-3xl mb-2 block">{cat.icon}</span>
                  <span className="text-white font-medium">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Select Item</h2>
            <p className="text-green-300 text-sm mb-6">{selectedCategory?.icon} {selectedCategory?.name} → Choose item</p>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemSelect(item)}
                  disabled={loading}
                  className="w-full bg-green-900/40 border border-green-600/30 rounded-xl p-4 text-left hover:bg-green-800/40 hover:border-green-500/50 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <span className="text-white font-medium">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Select Brand</h2>
            <p className="text-green-300 text-sm mb-6">{selectedItem?.name} → Choose brand</p>
            <div className="space-y-2">
              {brands.length > 0 ? brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => handleBrandSelect(brand)}
                  className="w-full bg-green-900/40 border border-green-600/30 rounded-xl p-4 text-left hover:bg-green-800/40 hover:border-green-500/50 transition-all active:scale-[0.99]"
                >
                  <span className="text-white font-medium">{brand.name}</span>
                </button>
              )) : (
                <button
                  onClick={() => {
                    setSelectedBrand({ id: 'generic', name: 'Generic / No Brand', itemId: selectedItem?.id || '' });
                    setStep(4);
                  }}
                  className="w-full bg-green-900/40 border border-green-600/30 rounded-xl p-4 text-left hover:bg-green-800/40 hover:border-green-500/50 transition-all active:scale-[0.99]"
                >
                  <span className="text-white font-medium">Generic / No Brand</span>
                </button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Enter Price</h2>
            <p className="text-green-300 text-sm mb-6">{selectedItem?.name} ({selectedBrand?.name})</p>
            <div className="mb-6">
              <label className="block text-green-200 text-sm font-medium mb-2">Price in Naira (₦)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 font-bold text-xl">₦</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(formatPrice(e.target.value))}
                  placeholder="0"
                  className="w-full bg-green-950/50 border border-green-600/50 rounded-xl py-4 pl-10 pr-4 text-white text-2xl font-bold placeholder:text-green-700 focus:outline-none focus:border-green-400 transition-colors"
                  autoFocus
                />
              </div>
              <p className="text-green-400/60 text-xs mt-2">Enter the actual selling price at {trader?.marketName}</p>
            </div>
            <button
              onClick={handlePriceSubmit}
              disabled={!price || parseFloat(price.replace(/,/g, '')) <= 0}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:from-green-700 disabled:to-green-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Select Unit</h2>
            <p className="text-green-300 text-sm mb-6">₦{price} for {selectedItem?.name} → Per what unit?</p>
            <div className="grid grid-cols-2 gap-3">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => handleUnitSelect(unit)}
                  className={`bg-green-900/40 border rounded-xl p-4 text-center hover:bg-green-800/40 transition-all active:scale-[0.98] ${
                    selectedUnit?.id === unit.id ? 'border-green-400 bg-green-800/50' : 'border-green-600/30 hover:border-green-500/50'
                  }`}
                >
                  <span className="text-white font-medium">{unit.name}</span>
                  <span className="text-green-400 text-sm block mt-1">{unit.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Verify Location</h2>
            <p className="text-green-300 text-sm mb-6">We need to confirm you&apos;re at {trader?.marketName}</p>
            
            <div className="bg-green-900/40 border border-green-600/30 rounded-2xl p-6 text-center mb-6">
              {gpsStatus === 'pending' && (
                <>
                  <div className="w-20 h-20 bg-green-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-white font-medium mb-2">Location Required</p>
                  <p className="text-green-300 text-sm mb-4">You must be within 500m of {trader?.marketName}</p>
                  <button onClick={requestGPS} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-3 px-6 rounded-xl transition-all">
                    Share My Location
                  </button>
                </>
              )}

              {gpsStatus === 'checking' && (
                <>
                  <div className="w-20 h-20 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white font-medium">Checking location...</p>
                </>
              )}

              {gpsStatus === 'verified' && (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-300 font-medium">Location Verified! ✓</p>
                </>
              )}

              {gpsStatus === 'failed' && (
                <>
                  <div className="w-20 h-20 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-red-300 font-medium mb-2">Location Failed</p>
                  <p className="text-red-400 text-sm mb-4">{gpsError}</p>
                  <button onClick={requestGPS} className="bg-green-700 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-xl transition-all">
                    Try Again
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Confirm Submission</h2>
            <p className="text-green-300 text-sm mb-6">Please review your submission</p>
            
            <div className="bg-green-900/40 border border-green-600/30 rounded-2xl p-5 mb-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-green-700/30">
                  <span className="text-green-400 text-sm">Market</span>
                  <span className="text-white font-medium">{trader?.marketName}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-green-700/30">
                  <span className="text-green-400 text-sm">Category</span>
                  <span className="text-white font-medium">{selectedCategory?.name}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-green-700/30">
                  <span className="text-green-400 text-sm">Item</span>
                  <span className="text-white font-medium">{selectedItem?.name}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-green-700/30">
                  <span className="text-green-400 text-sm">Brand</span>
                  <span className="text-white font-medium">{selectedBrand?.name}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-green-700/30">
                  <span className="text-green-400 text-sm">Price</span>
                  <span className="text-yellow-400 font-bold text-lg">₦{price}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-400 text-sm">Unit</span>
                  <span className="text-white font-medium">{selectedUnit?.name}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
              <p className="text-yellow-300 text-sm">
                💰 You&apos;ll earn <strong>₦200</strong> when this submission is approved
              </p>
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:from-green-700 disabled:to-green-800 text-white font-bold py-4 rounded-xl transition-all"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </span>
              ) : (
                'Submit Price'
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
