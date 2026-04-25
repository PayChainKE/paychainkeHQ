/**
 * VPN Guard Middleware (Refined)
 * Authorizes traffic from Tailscale VPN (100.x.x.x) and Internal Loopback.
 * Specifically optimized for Render's rootless deployment.
 */
const vpnGuard = (req, res, next) => {
  // Permit all in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Robust IP Extraction
  // Priority: x-forwarded-for (Render Proxy) -> remoteAddress
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // Whitelist Logic
  const isTailscale = ip && ip.startsWith('100.');
  const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].some(loopback => ip === loopback) || ip?.includes('127.0.0.1');

  if (isTailscale || isLoopback) {
    console.log(`[Security] Authorized access from IP: ${ip} (${isTailscale ? 'Tailscale' : 'Internal'})`);
    return next();
  }

  // Strictly Block Unauthorized Public Traffic
  console.warn(`[Security] Blocked unauthorized access attempt from IP: ${ip}`);
  return res.status(403).json({
    status: 'error',
    message: `Access Forbidden: This route is only accessible via the PayChainKE Secure VPN. (Detected IP: ${ip})`,
    ip: ip,
    code: 'VPN_REQUIRED'
  });
};

export default vpnGuard;
