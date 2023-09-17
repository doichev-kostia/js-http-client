export const milliseconds = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
};

export const JWT_SECRET = "secret";

/**
 * seconds
 */
export const JWT_LIFETIME = milliseconds.minute * 5;
export const REFRESH_TOKEN_LIFETIME = milliseconds.day * 7;

export const REFRESH_TOKEN_HEADER = "x-refresh-token";

export const BASE_URL = "http://localhost:3000/api";
