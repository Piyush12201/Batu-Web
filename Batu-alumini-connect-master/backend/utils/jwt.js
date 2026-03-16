const jwt = require('jsonwebtoken');

const generateAuthTokens = (userId, isAdmin = false) => {
  const accessToken = jwt.sign(
    { 
      userId, 
      type: isAdmin ? 'admin' : 'user',
      isAdmin 
    },
    process.env.JWT_SECRET || 'jwt_secret_key',
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { userId, type: isAdmin ? 'admin' : 'user' },
    process.env.JWT_REFRESH_SECRET || 'jwt_refresh_secret_key',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'jwt_refresh_secret_key');
  } catch (error) {
    return null;
  }
};

const generateLoginCredentials = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let loginId = '';
  for (let i = 0; i < 10; i++) {
    loginId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  const passwordChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += passwordChars.charAt(Math.floor(Math.random() * passwordChars.length));
  }

  return { loginId, password };
};

module.exports = {
  generateAuthTokens,
  verifyAccessToken,
  verifyRefreshToken,
  generateLoginCredentials
};
