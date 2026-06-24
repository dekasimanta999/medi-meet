const errorHandler = (err, req, res, next) => {
  // If the status code is 200, change it to 500. Otherwise, keep the existing error code.
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { errorHandler };