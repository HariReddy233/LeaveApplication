'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { setAuthToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const registered = searchParams?.get('registered') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/Auth/LoginUser', {
        email,
        password,
      });

      if (response.data.token) {
        setAuthToken(response.data.token);
        console.log('✅ Login successful, token stored');
        // Use window.location for reliable redirect
        window.location.href = '/dashboard';
      } else {
        setError('No token received from server');
      }
    } catch (err: any) {
      // Handle network errors (no response from server)
      if (!err.response) {
        // Network error - server not reachable
        if (err.message && (err.message.includes('Network Error') || err.message.includes('network') || err.message.includes('Failed to fetch'))) {
          setError('Unable to connect to server. Please check your internet connection and try again.');
        } else {
          setError('Network error. Please check your connection and try again.');
        }
      } else {
        // Handle specific error cases from server
        const status = err.response?.status;
        // Backend returns errors in { message: "..." } format
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || '';
        const errorLower = errorMessage.toLowerCase();
        
        // Check for authentication/authorization errors
        if (status === 401 || 
            errorLower.includes('unauthorized') || 
            errorLower.includes('invalid email or password') ||
            errorLower.includes('invalid credentials') ||
            errorLower.includes('user not found')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (status === 404 || errorLower.includes('not found')) {
          setError('User not found. Please check your email and try again.');
        } else if (status === 400) {
          setError('Invalid email or password format. Please check your input.');
        } else if (status === 403 || errorLower.includes('inactive')) {
          setError('Account is inactive. Please contact administrator.');
        } else if (errorMessage) {
          setError(errorMessage);
        } else {
          setError('Login failed. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      {/* Centered Content - Login Form with Company Info */}
      <div className="w-full max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row items-start justify-center gap-16">
          {/* Left Side - Company Info & Logo */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left mt-8 lg:mt-16">
            {/* Logo Section */}
            <div className="mb-8">
              <div className="mb-6">
                {!imageError ? (
                  <Image
                    src="/consultare-logo.png"
                    alt="Consultare Logo"
                    width={280}
                    height={80}
                    className="object-contain mx-auto lg:mx-0"
                    priority
                    unoptimized
                    onError={() => {
                      console.error('Logo image failed to load');
                      setImageError(true);
                    }}
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))', width: 'auto', height: 'auto' }}
                  />
                ) : (
                  <div className="text-gray-400 text-sm">
                    <p>Logo image not found. Please add consultare-logo.png to the public folder.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="mb-8">
              <p className="text-lg text-gray-700 leading-relaxed max-w-lg" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Consultare is a leading consulting firm specializing in innovative business solutions and strategic advisory services. We help organizations transform their operations and achieve sustainable growth.
              </p>
            </div>

            {/* Services List */}
            <div className="space-y-5">
              <div className="flex items-center gap-4 text-gray-700 group hover:text-blue-600 transition-colors justify-center lg:justify-start">
                <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-lg font-medium" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Strategic Consulting</span>
              </div>
              <div className="flex items-center gap-4 text-gray-700 group hover:text-indigo-600 transition-colors justify-center lg:justify-start">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 flex-shrink-0 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-lg font-medium" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Innovation & Technology</span>
              </div>
              <div className="flex items-center gap-4 text-gray-700 group hover:text-purple-600 transition-colors justify-center lg:justify-start">
                <div className="w-12 h-12 rounded-xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 flex-shrink-0 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-lg font-medium" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Team Excellence</span>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center">
            <div className="w-full max-w-md">
              {/* Success Message */}
              {registered && (
                <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 text-green-700 p-4 rounded-xl shadow-sm animate-fade-in">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="font-medium text-sm">Account created successfully! Please sign in.</p>
                  </div>
                </div>
              )}

              {/* Login Card */}
              <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100 backdrop-blur-sm">
                {/* Header */}
                <div className="mb-10">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Sign In
                  </h1>
                  <p className="text-gray-500 text-base" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Access your Leave Management account
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-sm">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <p className="font-medium text-sm">{error}</p>
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white text-gray-900 placeholder-gray-400 text-base hover:border-gray-300"
                        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                        placeholder="Enter your email"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white text-gray-900 placeholder-gray-400 text-base hover:border-gray-300"
                        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex items-center justify-end -mt-1">
                    <a
                      href="#"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      Forgot password?
                    </a>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-base"
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>

                {/* Sign Up Link */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-center text-sm text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Don't have an account?{' '}
                    <a
                      href="/register"
                      className="text-blue-600 hover:text-indigo-600 font-semibold transition-colors inline-flex items-center gap-1 hover:gap-2"
                    >
                      Sign up
                      <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-400" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <p>© {new Date().getFullYear()} Consultare. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
