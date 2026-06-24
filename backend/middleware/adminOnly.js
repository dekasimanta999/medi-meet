const asyncHandler = require('express-async-handler');

const isAdminAccount = (user) => Boolean(user?.isAdmin || user?.email === 'admin@medimeet.com');

const adminOnly = asyncHandler(async (req, res, next) => {
    if (isAdminAccount(req.user)) {
        next();
    } else {
        res.status(403);
        throw new Error("Access Denied: Not authorized as an administrator.");
    }
});

module.exports = { adminOnly };
