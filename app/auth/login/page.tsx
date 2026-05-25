'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-16">
      <Card className="w-full">
        <h1 className="text-2xl font-bold text-gray-900">Sign in to CarouselBrain</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email and we'll send you a magic link.
        </p>

        {success ? (
          <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            Check your inbox for a login link. You can close this tab.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
              Send magic link
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
