import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import loiService from '../../services/loiService';
import { LOI } from '../../models/LOI';

// Mock dependencies
jest.mock('nodemailer', () => ({
  createTestAccount: jest.fn().mockResolvedValue({
    user: 'test-user',
    pass: 'test-pass',
  }),
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn(),
    end: jest.fn(),
  })),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    end: jest.fn().mockImplementation(function(this: any) {
      // Force PDF generation to "complete" by resolving the promise
      if (this.pipe && typeof this.pipe === 'function') {
        const stream = this.pipe.mock.calls[0][0];
        if (stream && stream.on && stream.on.mock.calls.length > 0) {
          // Find the 'finish' handler and call it
          for (const call of stream.on.mock.calls) {
            if (call[0] === 'finish' && typeof call[1] === 'function') {
              call[1]();
            }
          }
        }
      }
    }),
  }));
});

describe('LOI Service', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await LOI.deleteMany({});
    jest.clearAllMocks();
    jest.spyOn(loiService, 'generatePDF').mockImplementation((loiData: any) => {
      return Promise.resolve(`/uploads/loi/LOI_FlexFi_${loiData.company.replace(/\s+/g, '_')}_2023-01-01T00-00-00.pdf`);
    });
    jest.spyOn(loiService, 'sendEmail').mockResolvedValue(undefined);
  });

  describe('createLOI', () => {
    it('should create an LOI record and generate PDF', async () => {
      // Mock data
      const loiData = {
        fullName: 'John Doe',
        company: 'Test Company',
        email: 'john@example.com',
        country: 'United States',
        sector: 'Technology',
        comments: 'Test comments',
        signature: 'data:image/png;base64,test',
      };

      // Call the service
      const result = await loiService.createLOI(loiData);

      // Expectations
      expect(result).toBeDefined();
      expect(result.fullName).toBe(loiData.fullName);
      expect(result.company).toBe(loiData.company);
      expect(result.email).toBe(loiData.email);
      expect(result.pdfUrl).toContain('/uploads/loi/LOI_FlexFi_Test_Company');

      // Check if record was created in database
      const loi = await LOI.findById(result._id);
      expect(loi).not.toBeNull();
      expect(loi?.fullName).toBe(loiData.fullName);
    });

    it('should handle errors during LOI creation', async () => {
      // Mock implementation to throw an error
      jest.spyOn(LOI, 'create').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      // Mock data
      const loiData = {
        fullName: 'John Doe',
        company: 'Test Company',
        email: 'john@example.com',
        country: 'United States',
        sector: 'Technology',
        signature: 'data:image/png;base64,test',
      };

      // Expect the service to throw an error
      await expect(loiService.createLOI(loiData)).rejects.toThrow('Database error');
    });
  });

  describe('getLOIById', () => {
    it('should retrieve an LOI by ID', async () => {
      // Create a test LOI
      const loi = await LOI.create({
        fullName: 'John Doe',
        company: 'Test Company',
        email: 'john@example.com',
        country: 'United States',
        sector: 'Technology',
        signature: 'data:image/png;base64,test',
        pdfUrl: '/uploads/loi/test.pdf',
      });

      // Retrieve the LOI
      const result = await loiService.getLOIById(loi._id.toString());

      // Expectations
      expect(result).not.toBeNull();
      expect(result?.fullName).toBe('John Doe');
      expect(result?.company).toBe('Test Company');
    });

    it('should return null for non-existent LOI', async () => {
      const result = await loiService.getLOIById('60a1b2c3d4e5f6g7h8i9j0k1');
      expect(result).toBeNull();
    });
  });

  describe('getAllLOIs', () => {
    it('should retrieve all LOIs sorted by creation date', async () => {
      // Create test LOIs
      await LOI.create([
        {
          fullName: 'John Doe',
          company: 'Company A',
          email: 'john@example.com',
          country: 'United States',
          sector: 'Technology',
          signature: 'data:image/png;base64,test',
          pdfUrl: '/uploads/loi/testA.pdf',
          createdAt: new Date('2023-01-01'),
        },
        {
          fullName: 'Jane Smith',
          company: 'Company B',
          email: 'jane@example.com',
          country: 'Canada',
          sector: 'Finance',
          signature: 'data:image/png;base64,test',
          pdfUrl: '/uploads/loi/testB.pdf',
          createdAt: new Date('2023-01-02'),
        },
      ]);

      // Retrieve all LOIs
      const results = await loiService.getAllLOIs();

      // Expectations
      expect(results).toHaveLength(2);
      expect(results[0].company).toBe('Company B'); // Most recent first
      expect(results[1].company).toBe('Company A');
    });
  });
}); 