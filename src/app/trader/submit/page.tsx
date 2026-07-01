'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTraderAuth } from '../layout';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Item {
  id: string;
  name: string;
  unit: string;
}

export default function TraderSubmitPage() {
  const router = useRouter();
  const { profile, token, refreshProfile } = useTraderAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [price, setPrice] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState('');

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/trader/categories');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Use defaults
      setCategories([
        { id: 'food', name: 'Food Items', icon: '🍚' },
        { id: 'building', name: 'Building Materials', icon: '🧱' },
        { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
      ]);
    }
  };

  const loadItems = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/trader/items?categoryId=${categoryId}`);
      const data = await response.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    loadItems(category.id);
    setStep(2);
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setStep(3);
  };

  const handlePriceSubmit = () => {
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }
    setError('');
    setStep(4);
    getGPSLocation();
  };

  const getGPSLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        setGpsError('Unable to get location. Please enable GPS and try again.');
        console.error('GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedItem || !price || !gpsLocation) {
      setError('Missing required information');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/trader/submit-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          price: Number(price),
          unit: selectedItem.unit || 'unit',
          gpsLat: gpsLocation.lat,
          gpsLng: gpsLocation.lng,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        refreshProfile(); // Update balance/stats
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="p-4">
        <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Price Submitted!</h2>
          <p className="text-gray-400 mb-6">
            {profile && profile.reputation >= 80 
              ? 'Instantly approved! ₦50 added to your balance.'
              : 'Sent for validation. You\'ll earn ₦50 once approved.'
            }
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setSuccess(false);
                setStep(1);
                setSelectedCategory(null);
                setSelectedItem(null);
                setPrice('');
                setGpsLocation(null);
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"
            >
              Submit Another Price
            </button>
            <button
              onClick={() => router.push('/trader')}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              {s}
            </div>
            {s < 4 && (
              <div className={`w-12 sm:w-20 h-1 mx-1 ${
                step > s ? 'bg-emerald-500' : 'bg-gray-700'
              }`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-between text-xs text-gray-500 mb-6 px-1">
        <span>Category</span>
        <span>Item</span>
        <span>Price</span>
        <span>Confirm</span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step 1: Category */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Select Category</h2>
          <div className="space-y-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category)}
                className="w-full flex items-center gap-4 p-4 bg-[#1a1f2e] border border-gray-800 hover:border-emerald-500/50 rounded-xl transition-colors text-left"
              >
                <span className="text-3xl">{category.icon}</span>
                <span className="text-white font-medium">{category.name}</span>
                <svg className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Item */}
      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-xl font-bold text-white mb-4">
            {selectedCategory?.icon} Select Item
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.length > 0 ? items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className="w-full flex items-center justify-between p-4 bg-[#1a1f2e] border border-gray-800 hover:border-emerald-500/50 rounded-xl transition-colors text-left"
              >
                <span className="text-white">{item.name}</span>
                <span className="text-gray-500 text-sm">{item.unit}</span>
              </button>
            )) : (
              <p className="text-gray-400 text-center py-8">Loading items...</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Price */}
      {step === 3 && (
        <div>
          <button onClick={() => setStep(2)} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-xl font-bold text-white mb-2">Enter Price</h2>
          <p className="text-gray-400 mb-6">{selectedItem?.name} ({selectedItem?.unit})</p>
          
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">₦</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full pl-10 pr-4 py-4 bg-[#0f172a] border border-gray-700 rounded-xl text-white text-2xl focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>

          <button
            onClick={handlePriceSubmit}
            disabled={!price}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 4: GPS & Confirm */}
      {step === 4 && (
        <div>
          <button onClick={() => setStep(3)} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-xl font-bold text-white mb-4">Confirm Submission</h2>

          {/* Summary */}
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 mb-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="text-white">{selectedCategory?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Item</span>
                <span className="text-white">{selectedItem?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price</span>
                <span className="text-emerald-400 font-bold">₦{Number(price).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* GPS Status */}
          <div className={`p-4 rounded-xl mb-6 ${
            gpsLocation ? 'bg-emerald-500/10 border border-emerald-500/50' : 
            gpsError ? 'bg-red-500/10 border border-red-500/50' : 
            'bg-amber-500/10 border border-amber-500/50'
          }`}>
            <div className="flex items-center gap-3">
              {gpsLocation ? (
                <>
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-emerald-400 font-medium">Location verified</p>
                    <p className="text-gray-400 text-sm">GPS coordinates captured</p>
                  </div>
                </>
              ) : gpsError ? (
                <>
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <p className="text-red-400 font-medium">Location error</p>
                    <p className="text-gray-400 text-sm">{gpsError}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-amber-400"></div>
                  <div>
                    <p className="text-amber-400 font-medium">Getting location...</p>
                    <p className="text-gray-400 text-sm">Please allow GPS access</p>
                  </div>
                </>
              )}
            </div>
            {gpsError && (
              <button
                onClick={getGPSLocation}
                className="mt-3 text-sm text-emerald-400 hover:underline"
              >
                Try again
              </button>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !gpsLocation}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              'Submit Price'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
