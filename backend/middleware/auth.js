const jwt = require('jsonwebtoken');

// Verify JWT and attach user to request
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role guard factory
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

// App-only guard (user + porter cannot use web)
const appOnly = (req, res, next) => {
  if (['user', 'porter'].includes(req.user?.role)) {
    const platform = req.headers['x-platform'];
    if (platform !== 'android')
      return res.status(403).json({ error: 'User and Porter accounts are app-only' });
  }
  next();
};

module.exports = { authenticate, authorize, appOnly };
