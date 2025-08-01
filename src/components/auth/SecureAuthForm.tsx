import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { validateInput, validatePasswordStrength, sanitizeInput } from '@/utils/securityValidation';
import { useRateLimit } from '@/hooks/useRateLimit';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface SecureAuthFormProps {
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
}

export const SecureAuthForm: React.FC<SecureAuthFormProps> = ({ mode, onModeChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  const { signIn, signUp } = useAuth();
  const { checkRateLimit, getRemainingAttempts, getTimeUntilReset } = useRateLimit(5, 300000); // 5 attempts per 5 minutes

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Email validation
    if (!validateInput(email, 'email')) {
      newErrors.push('Please enter a valid email address');
    }

    // Password validation
    if (mode === 'register') {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        newErrors.push(...passwordValidation.errors);
      }

      if (password !== confirmPassword) {
        newErrors.push('Passwords do not match');
      }

      if (fullName && !validateInput(fullName, 'name')) {
        newErrors.push('Please enter a valid full name');
      }
    } else {
      if (!password || password.length < 6) {
        newErrors.push('Password must be at least 6 characters long');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rateLimitKey = `auth_${mode}_${email}`;
    
    if (!checkRateLimit(rateLimitKey)) {
      const timeLeft = Math.ceil(getTimeUntilReset(rateLimitKey) / 1000);
      setErrors([`Too many attempts. Please try again in ${timeLeft} seconds.`]);
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    setErrors([]);

    try {
      const sanitizedEmail = sanitizeInput(email);
      
      if (mode === 'login') {
        const { error } = await signIn(sanitizedEmail, password);
        if (error) {
          setErrors([error.message || 'Login failed']);
        }
      } else {
        const sanitizedFullName = sanitizeInput(fullName);
        const { error } = await signUp(sanitizedEmail, password, {
          full_name: sanitizedFullName,
        });
        if (error) {
          setErrors([error.message || 'Registration failed']);
        }
      }
    } catch (error) {
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const remainingAttempts = getRemainingAttempts(`auth_${mode}_${email}`);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img 
            src="https://lh3.googleusercontent.com/d/1ZDW1GB_y68htjrMiZHZQ478Eu0j_DBv-=s360?authuser=0" 
            alt="Dapoer At-Tauhid Logo" 
            className="h-360 w-360 object-contain"
          />
        </div>
        <CardTitle className="text-2xl font-bold flex items-center justify-center">
          <Shield className="h-6 w-6 mr-2" />
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === 'login' 
            ? 'Enter your credentials to access your account' 
            : 'Create a new account to get started'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google OAuth Button */}
        <GoogleAuthButton mode={mode} />
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                maxLength={100}
                required
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              maxLength={254}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                maxLength={128}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  maxLength={128}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {remainingAttempts < 5 && remainingAttempts > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || remainingAttempts === 0}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
            className="text-sm"
          >
            {mode === 'login' 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
