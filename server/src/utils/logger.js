// Simple request logger middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const sanitizedUrl = req.url.replace(/\?.*/, ''); // Remove query params for logging
    console.log(`${req.method} ${sanitizedUrl} ${res.statusCode} ${duration}ms`);
  });
  
  next();
};
