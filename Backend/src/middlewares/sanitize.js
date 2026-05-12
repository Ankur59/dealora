const { sanitizeInput } = require('../utils/validators');

const sanitize = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach((key) => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        });
    }

    if (req.query) {
        Object.keys(req.query).forEach((key) => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeInput(req.query[key]);
            }
        });
    }

    next();
};

module.exports = sanitize;

