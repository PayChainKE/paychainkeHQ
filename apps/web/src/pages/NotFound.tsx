import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // If user hit an auth path, forward to the dashboard proxy path
  useEffect(() => {
    const authPaths = ['/signin', '/signup', '/forgot-password'];
    if (authPaths.includes(location.pathname) || location.pathname.startsWith('/kyc')) {
      const target = `/paychain-dashboard${location.pathname}`;
      // use native replace so we don't push extra history entry
      window.location.replace(target);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
