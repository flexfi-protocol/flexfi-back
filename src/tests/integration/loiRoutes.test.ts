import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app";
import { LOI } from "../../models/LOI";

describe("LOI API Routes", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    // Disconnect and stop MongoDB
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear LOI collection before each test
    await LOI.deleteMany({});
    const loiService = require('../../services/loiService').default;
    jest.spyOn(loiService, 'generatePDF').mockImplementation((loiData: any) => {
      return Promise.resolve(`/uploads/loi/LOI_FlexFi_${loiData.company.replace(/\s+/g, '_')}_2023-01-01T00-00-00.pdf`);
    });
    jest.spyOn(loiService, 'sendEmail').mockResolvedValue(undefined);
  });

  describe("POST /api/loi", () => {
    it("should create a new LOI", async () => {
      const loiData = {
        fullName: "John Doe",
        company: "Test Company",
        email: "john@example.com",
        country: "United States",
        sector: "Technology",
        comments: "Test comments",
        signature:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      };

      const response = await request(app)
        .post("/api/loi")
        .send(loiData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Letter of Intent submitted successfully"
      );
      expect(response.body.data.pdfUrl).toContain(
        "/uploads/loi/LOI_FlexFi_Test_Company"
      );

      // Verify record was created in database
      const count = await LOI.countDocuments();
      expect(count).toBe(1);
    });

    it("should return 400 when required fields are missing", async () => {
      const loiData = {
        // Missing required fields
        fullName: "John Doe",
        email: "john@example.com",
      };

      const response = await request(app)
        .post("/api/loi")
        .send(loiData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();

      // Verify no record was created
      const count = await LOI.countDocuments();
      expect(count).toBe(0);
    });
  });

  describe("GET /api/loi", () => {
    it("should retrieve all LOIs", async () => {
      // Create test LOIs
      await LOI.create([
        {
          fullName: "John Doe",
          company: "Company A",
          email: "john@example.com",
          country: "United States",
          sector: "Technology",
          signature: "data:image/png;base64,test",
          pdfUrl: "/uploads/loi/testA.pdf",
          createdAt: new Date("2023-01-01"),
        },
        {
          fullName: "Jane Smith",
          company: "Company B",
          email: "jane@example.com",
          country: "Canada",
          sector: "Finance",
          signature: "data:image/png;base64,test",
          pdfUrl: "/uploads/loi/testB.pdf",
          createdAt: new Date("2023-01-02"),
        },
      ]);

      const response = await request(app).get("/api/loi").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].company).toBe("Company B"); // Most recent first
      expect(response.body.data[1].company).toBe("Company A");
    });
  });

  describe("GET /api/loi/:id", () => {
    it("should retrieve a specific LOI by ID", async () => {
      // Create a test LOI
      const loi = await LOI.create({
        fullName: "John Doe",
        company: "Test Company",
        email: "john@example.com",
        country: "United States",
        sector: "Technology",
        signature: "data:image/png;base64,test",
        pdfUrl: "/uploads/loi/test.pdf",
      });

      const response = await request(app)
        .get(`/api/loi/${loi._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fullName).toBe("John Doe");
      expect(response.body.data.company).toBe("Test Company");
    });

    it("should return 404 for non-existent LOI", async () => {
      const response = await request(app)
        .get("/api/loi/60a1b2c3d4e5f6g7h8i9j0k1")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("LOI not found");
    });
  });
});
