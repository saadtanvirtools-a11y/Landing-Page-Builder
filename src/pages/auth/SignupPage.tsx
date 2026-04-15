import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { signupApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { SignupPayload } from '../../types';


export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupPayload & { confirmPassword: string }>();

  // Watch password field for confirm password validation
  const password = watch('password');

  const onSubmit = async (data: SignupPayload & { confirmPassword: string }) => {
    setIsLoading(true);
    setServerError('');

    try {
      const { confirmPassword, ...payload } = data;
      const response = await signupApi(payload);
      setAuth(response.user, response.token);
      navigate('/dashboard');
    } catch (error: any) {
      setServerError(
        error?.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white
                    flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* ── Card ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create account</h1>
            <p className="text-gray-500 mt-2">Start building your landing page</p>
          </div>

          {/* Server Error */}
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200
                            rounded-lg text-red-600 text-sm text-center">
              {serverError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  transition
                  ${errors.name
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                {...register('name', {
                  required: 'Full name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
                })}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  transition
                  ${errors.email
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  transition
                  ${errors.password
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Re-enter your password"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  transition
                  ${errors.confirmPassword
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) =>
                    value === password || 'Passwords do not match',
                })}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 text-white font-semibold
                         rounded-lg hover:bg-indigo-700 transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>

          </form>

          {/* Footer Link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-indigo-600 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
