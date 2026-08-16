// @desc    Smoke-test endpoint proving an API key actually authenticates —
//          the whole point of this route is to have something real to hit
//          once Phase 1 (accounts + key issuance) is verified end-to-end,
//          before any real payment endpoints exist behind authenticateApiKey.
// @route   GET /api/v1/developer/ping
// @access  Public (API key)
export const ping = async (req, res) => {
  res.json({
    success: true,
    mode: req.apiKey.mode,
    developer: { companyName: req.developer.companyName },
  });
};
