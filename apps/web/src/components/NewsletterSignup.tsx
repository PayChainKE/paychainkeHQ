import { useState } from 'react';

const NewsletterSignup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: 'Successfully subscribed to our newsletter!' });
        setEmail('');
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to subscribe. Please try again.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Unable to connect to the server. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={onSubscribe} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your business email"
          required
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Subscribing...
            </span>
          ) : 'Subscribe'}
        </button>
      </form>
      {status && (
        <div className={`mt-3 text-sm font-medium animate-in fade-in slide-in-from-top-1 ${status.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
};

export default NewsletterSignup;
