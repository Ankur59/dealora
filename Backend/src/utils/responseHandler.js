const successResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        statusCode,
        message,
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

const errorResponse = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        statusCode,
        message,
    };

    if (errors !== null) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    successResponse,
    errorResponse,
};
