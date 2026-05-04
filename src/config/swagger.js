const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'MET Academy — Student Portal API',
      version: '1.0.0',
      description:
        'Student backend: self-registration, authentication, activation, password reset, published modules, and Cloudflare Stream signed playback tokens.',
    },
    servers: [{ url: '/api', description: 'API base prefix' }],
    tags: [
      { name: 'Auth', description: 'Student authentication, registration, and password flows' },
      { name: 'Modules', description: 'Published learning modules (protected)' },
    ],
    components: {
      securitySchemes: {
        studentCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'student_session',
          description: 'HttpOnly JWT cookie set by login, activate, or reset-password.',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Same JWT as the session cookie. Use when cross-origin cookies are not sent (typical for SPA + API on different hosts). Send Authorization: Bearer plus the access_token from login, activate, or reset-password.',
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { nullable: true },
            message: { type: 'string' },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        StudentProfile: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            full_name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        ModuleSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            order_index: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            duration_seconds: { type: 'integer', nullable: true },
            thumbnail_url: { type: 'string', nullable: true },
          },
        },
        VideoTokenResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Cloudflare Stream signed token (JWT)' },
          },
        },
        LoginBody: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        ActivateBody: {
          type: 'object',
          required: ['token', 'password', 'confirm_password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', format: 'password', minLength: 8 },
            confirm_password: { type: 'string', format: 'password' },
          },
        },
        ForgotPasswordBody: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        ResetPasswordBody: {
          type: 'object',
          required: ['token', 'password', 'confirm_password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', format: 'password', minLength: 8 },
            confirm_password: { type: 'string', format: 'password' },
          },
        },
        RegisterBody: {
          type: 'object',
          required: ['email', 'full_name', 'password', 'confirm_password'],
          properties: {
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string', minLength: 2, maxLength: 200 },
            password: { type: 'string', format: 'password', minLength: 8 },
            confirm_password: { type: 'string', format: 'password' },
          },
        },
      },
    },
    security: [],
  },
  apis: [path.join(__dirname, '../routes/*.js')],
};

module.exports = swaggerJsdoc(options);
