const Joi = require('joi');
const logger = require('../config/logger');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error:', { errors, body: req.body });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.validatedBody = value;
    next();
  };
};

// Validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    full_name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    mobile_number: Joi.string().pattern(/^[0-9]{10}$/).required(),
    designation: Joi.string().max(100).allow(''),
    company_name: Joi.string().max(100).allow(''),
    years_of_experience: Joi.number().min(0).max(50).allow(null),
    sector: Joi.string().max(100).allow(''),
    skills: Joi.array().items(Joi.string()).allow(null),
    linkedin_url: Joi.string().uri().allow(''),
    location: Joi.string().max(100).allow('')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Post schemas
  createPost: Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    image_url: Joi.string().allow('', null),  // Allow both URIs and relative paths
    hashtags: Joi.array().items(Joi.string().max(50)).max(10).allow(null),
    mentions: Joi.array().items(Joi.string().uuid()).max(20).allow(null)
  }),

  updatePost: Joi.object({
    content: Joi.string().min(1).max(5000)
  }),

  comment: Joi.object({
    content: Joi.string().min(1).max(1000).required()
  }),

  // Message schemas
  sendMessage: Joi.object({
    receiver_id: Joi.string().uuid().required(),
    content: Joi.string().min(1).max(5000).required(),
    image_url: Joi.string().allow('', null)  // Allow both URIs and relative paths
  }),

  // Profile schema
  updateProfile: Joi.object({
    full_name: Joi.string().min(2).max(100),
    mobile_number: Joi.string().pattern(/^[0-9]{10}$/),
    designation: Joi.string().max(100).allow(''),
    company_name: Joi.string().max(100).allow(''),
    bio: Joi.string().max(500).allow(''),
    years_of_experience: Joi.number().min(0).max(50),
    sector: Joi.string().max(100).allow(''),
    skills: Joi.array().items(Joi.string()).max(20),
    linkedin_url: Joi.string().uri().allow(''),
    location: Joi.string().max(100).allow(''),
    profile_picture_url: Joi.string().allow('')  // Allow both URIs and relative paths
  }),

  // Opportunity schema
  createOpportunity: Joi.object({
    title: Joi.string().min(5).max(200).required(),
    description: Joi.string().min(10).max(5000).required(),
    company: Joi.string().max(100).required(),
    location: Joi.string().max(100).allow(''),
    type: Joi.string().valid('job', 'internship', 'freelance').required(),
    salary_range: Joi.string().max(50).allow(''),
    application_url: Joi.string().uri().allow(''),
    deadline: Joi.date().iso().allow(null)
  }),

  // Helpdesk schema
  createTicket: Joi.object({
    subject: Joi.string().min(5).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    category: Joi.string().max(50).required()
  }),

  // Pagination validation
  pagination: Joi.object({
    cursor: Joi.string().allow('', null),
    limit: Joi.number().min(1).max(50).default(20)
  })
};

// Sanitize input to prevent XSS
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        obj[key] = sanitize(obj[key]);
      });
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};

module.exports = {
  validate,
  schemas,
  sanitizeInput
};
