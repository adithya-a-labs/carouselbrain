'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

function truncateEmail(email: string): string {
  return email.length > 20 ? `${email.slice(0, 20)}...` : email;
}

export default function Navbar() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setEmail(data.user?.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  async function signOut() {
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/');
    router.refresh();
  }

  const links = (
    <>
      {email ? (
        <>
          <Link className="text-sm text-gray-600 hover:text-gray-900" href="/dashboard">
            Library
          </Link>
          <Link className="text-sm text-gray-600 hover:text-gray-900" href="/extract">
            Extract
          </Link>
          <span className="text-sm text-gray-500">{truncateEmail(email)}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </>
      ) : (
        <Link className="text-sm text-gray-600 hover:text-gray-900" href="/auth/login">
          Sign in
        </Link>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-bold text-gray-900">
          CarouselBrain
        </Link>

        <div className="hidden items-center gap-4 md:flex">{links}</div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 md:hidden"
          onClick={() => setIsOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-3">{links}</div>
        </div>
      )}
    </nav>
  );
}
