import React from 'react'
import { useLocation } from 'react-router-dom'
import Sentry from '../lib/sentry'

function ErrorFallback({ resetError }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl max-w-md w-full text-center border border-outline-variant/10">
        <div className="w-20 h-20 mx-auto bg-error/10 rounded-full flex items-center justify-center text-error mb-6">
          <span className="material-symbols-outlined text-4xl">error</span>
        </div>
        <h2 className="font-headline text-2xl text-on-surface tracking-tight mb-2">Something went wrong</h2>
        <p className="text-on-surface-variant font-medium mb-8">
          This page hit a snag. Your account and data are safe — try reloading, or head back to your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => { resetError(); window.location.reload() }}
            className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all"
          >
            Reload Page
          </button>
          <a
            href="/overview"
            className="px-6 py-3 bg-surface-container-low text-primary font-bold rounded-xl border border-outline-variant/15 hover:bg-surface-container transition-all"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

// Wraps every route so a bug in one page (e.g. a leftover reference to
// state removed in a refactor — the actual cause of the Bulk Payments
// incident this was added for) shows this recovery screen instead of an
// uncaught render error unmounting React's entire tree, which is what
// produces a blank white page with zero indication anything failed.
// resetKeys={[pathname]} clears an errored boundary automatically on
// navigation, so leaving the broken page and coming back doesn't require a
// manual reload. Sentry.ErrorBoundary also reports the error to Sentry on
// its own — no extra wiring needed here.
export default function AppErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return (
    <Sentry.ErrorBoundary resetKeys={[pathname]} fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}
