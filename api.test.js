import request from 'supertest';
import app from './app.js';

describe('API Tests with ES modules', () => {
    test('GET / should return success message', async () => {
        const response = await request(app).get('/');
        expect(response.status).to.equal(200);
        expect(response.body.message).to.equal('Testing Environment ready');
        expect(response.body.moduleType).to.equal('ES modules');
    });

    test('GET / health should return health status', async () => {
        const response = await request(app).get('/health');
        expect(response.status).to.equal(200);
        expect(response.body.status).to.equal('OK');
        expect(new Date(response.body.timestamp)).to.not.be.undefined;
    });  
});