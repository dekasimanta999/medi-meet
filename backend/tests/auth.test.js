const request = require('supertest');

jest.mock('../utils/generatePrescriptionPDF', () => ({
  generatePrescriptionPDF: jest.fn(),
  PRESCRIPTION_DIR: '',
}));

const app = require('../server'); // Assuming you export app from server.js

describe('Auth Routes', () => {
  it('should return 400 for invalid login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid', password: '123' });
    expect(res.statusCode).toBe(400);
  });
});
