const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload.isPlatformAdmin
      ? { id: payload.sub, isPlatformAdmin: true }
      : { id: payload.sub, organizationId: payload.organizationId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}

function requirePlatformAdmin(req, res, next) {
  if (!req.user || !req.user.isPlatformAdmin) {
    return res.status(403).json({ error: "Platform admin access required." });
  }
  next();
}

module.exports = { requireAuth, requireRole, requirePlatformAdmin };
