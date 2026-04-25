/**
 * VPN Guard Middleware
 * Restricts access to Tailscale VPN clients (100.x.x.x range) in production.
 */
const vpnGuard = (req, res, next) => {
  // Always permit in development/test environments
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Detect visitor's IP from Render's x-forwarded-for header
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // Block any request not starting with 100. (Tailscale IP range)
  if (ip && ip.startsWith('100.')) {
    return next();
  }

  console.warn(`[Security] Blocked unauthorized access attempt from IP: ${ip}`);
  return res.status(403).json({
    status: 'error',
    message: 'Access Forbidden: This route is only accessible via the PayChainKE Secure VPN.'
  });
};

export default vpnGuard;
