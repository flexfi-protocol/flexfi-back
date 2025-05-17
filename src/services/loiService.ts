import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import PDFDocument from "pdfkit";
import { ILOI, LOI } from "../models/LOI";

// Interface for the LOI form data
interface ILOIFormData {
  fullName: string;
  company: string;
  email: string;
  country: string;
  sector: string;
  comments?: string;
  signature: string; // base64 PNG
}

class LOIService {
  // Ensure required directories exist
  private ensureDirectoriesExist(): void {
    const uploadsDir = path.join(__dirname, "../../uploads/loi");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  /**
   * Create a new LOI record and generate PDF
   */
  async createLOI(loiData: ILOIFormData): Promise<ILOI> {
    try {
      // Ensure directories exist
      this.ensureDirectoriesExist();

      // Generate PDF and get the file path
      const pdfPath = await this.generatePDF(loiData);

      // Create a URL for the PDF
      const pdfUrl = `/uploads/loi/${path.basename(pdfPath)}`;

      // Store the LOI data in the database
      const newLOI = await LOI.create({
        ...loiData,
        pdfUrl,
      });

      // Send the PDF via email
      await this.sendEmail(loiData, pdfPath);

      return newLOI;
    } catch (error) {
      console.error("Error creating LOI:", error);
      throw error;
    }
  }

  /**
   * Generate a PDF from the LOI data, based on the commercial pilot template
   */
  async generatePDF(loiData: ILOIFormData): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Ensure directories exist
        this.ensureDirectoriesExist();

        // Create a unique filename based on company name and timestamp
        const timestamp = new Date()
          .toISOString()
          .replace(/:/g, "-")
          .split(".")[0];
        const filename = `LOI_FlexFi_${loiData.company.replace(
          /\s+/g,
          "_"
        )}_${timestamp}.pdf`;
        const outputPath = path.join(__dirname, "../../uploads/loi", filename);

        // Get image paths
        const logoPath = path.join(
          __dirname,
          "../assets/images/Logo_-_FlexF.png"
        );
        const bannerPath = path.join(
          __dirname,
          "../assets/images/LOI_banner_-_FlexFi.png"
        );
        const logoExists = fs.existsSync(logoPath);
        const bannerExists = fs.existsSync(bannerPath);

        // Create a PDF document
        const doc = new PDFDocument({
          margin: 50,
          size: "A4",
        });

        // Pipe output to file
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Set document metadata
        doc.info.Title = "Letter of Intent for Commercial Pilot";
        doc.info.Author = "FlexFi";
        doc.info.Subject = "Commercial Pilot Partnership";

        // Start with white background for the entire page
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFFFFF");

        // Add header with banner image or gradient
        if (bannerExists) {
          // Add banner image at the top (adjusted height)
          doc.image(bannerPath, 0, 0, { width: doc.page.width, height: 80 });

          // Banner without header text
          // We don't add header text here, just use the banner image
        } else {
          // Fallback to gradient header
          this.addHeader(doc, "LETTER OF INTENT FOR COMMERCIAL PILOT");
        }

        // Set starting position for content (after header)
        const margin = 50;
        let y = 100;

        // Partner information - more compact
        doc.fontSize(11).fillColor("#000000");
        doc.text(`FlexFi - Pilot Partner in ${loiData.country}`, margin, y);
        y += 15;

        doc.fontSize(12).fillColor("#000000").font("Helvetica-Bold");
        doc.text(`${loiData.company}`, margin, y);
        doc.font("Helvetica");
        y += 20;

        // Subject line
        doc.fontSize(10).fillColor("#000000");
        doc.text(
          "Subject: Statement of Intent to Participate in a Pilot Partnership with FlexFi",
          margin,
          y
        );
        y += 20;

        // Introduction text - more concise
        doc.fontSize(10).fillColor("#333333");
        const introText = `I, ${loiData.fullName}, founder and manager of ${loiData.company}, located in ${loiData.country}, hereby express my interest in testing the FlexFi solution as soon as it becomes available in ${loiData.country}.`;
        doc.text(introText, margin, y, {
          width: doc.page.width - margin * 2,
          align: "justify",
        });
        y = doc.y + 10;

        // About FlexFi - more concise
        const aboutText =
          "FlexFi is a crypto-native Buy Now, Pay Later solution, allowing consumers to split purchases into multiple installments without fees, while earning crypto-based rewards.";
        doc.text(aboutText, margin, y, {
          width: doc.page.width - margin * 2,
          align: "justify",
        });
        y = doc.y + 15;

        // Benefits section - more compact
        doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold");
        doc.text("Potential Benefits:", margin, y);
        doc.font("Helvetica");
        y = doc.y + 5;

        // Benefits bullet points - more compact
        const benefits = [
          "Increase in average customer basket size through flexible payment options",
          "Targeted promotional campaigns via FlexBoost",
          "Attraction of a tech-savvy customer base",
          "Competitive differentiation through innovative payment options",
          `Ease of integration within ${loiData.country}'s regulatory framework`,
        ];

        benefits.forEach((benefit) => {
          y = this.addBulletPoint(doc, benefit, margin, y);
        });
        y = doc.y + 10;

        // Moral commitment - more concise
        doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold");
        doc.text("Moral Commitment:", margin, y);
        doc.font("Helvetica");
        y = doc.y + 5;

        doc.fontSize(10).fillColor("#333333");
        doc.text(
          "This non-binding letter of intent aims to demonstrate real market interest, support FlexFi's development, and position our company as a priority partner for the pilot phase.",
          margin,
          y,
          { width: doc.page.width - margin * 2 }
        );
        y = doc.y + 15;

        // Signature section - follow the requested format
        const today = new Date();
        const formattedDate = today.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        doc.fontSize(10).fillColor("#000000");
        doc.text(
          `Signed in ${loiData.country}, on ${formattedDate}`,
          margin,
          y
        );
        y = doc.y + 15;

        doc.text(`Name: ${loiData.fullName}`, margin, y);
        y = doc.y + 10;

        doc.text(`Position: Founder – ${loiData.company}`, margin, y);
        y = doc.y + 10;

        doc.text(`Email: ${loiData.email}`, margin, y);
        y = doc.y + 15;

        doc.text("Signature:", margin, y);
        y = doc.y + 5;

        // Convert base64 signature to Buffer and add to PDF
        if (loiData.signature) {
          const signatureData = loiData.signature.replace(
            /^data:image\/png;base64,/,
            ""
          );
          const signatureBuffer = Buffer.from(signatureData, "base64");

          // Save signature as temporary file to load into PDF
          const signatureTempPath = path.join(
            __dirname,
            "../../uploads/loi/temp_signature.png"
          );
          fs.writeFileSync(signatureTempPath, signatureBuffer);

          // Add the signature image (smaller size)
          doc.image(signatureTempPath, margin, y, { width: 100 });
          y = doc.y + 10;

          // Clean up the temporary file
          fs.unlinkSync(signatureTempPath);
        } else {
          y += 30; // Space for signature
        }

        // Add FlexFi logo on the bottom right
        if (logoExists) {
          doc.image(logoPath, doc.page.width - 120, doc.page.height - 80, {
            width: 70,
          });
        } else {
          // If logo file doesn't exist, just add text
          doc.fontSize(14).fillColor("#0099cc");
          doc.text("FLEXFi", doc.page.width - 120, doc.page.height - 70);
        }

        // Finalize the PDF
        doc.end();

        // Return the path when the stream is closed
        stream.on("finish", () => {
          resolve(outputPath);
        });

        stream.on("error", (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add a styled header to the PDF (fallback if banner image is missing)
   */
  private addHeader(doc: PDFKit.PDFDocument, text: string): void {
    // Draw gradient background for header
    const grad = doc.linearGradient(0, 0, doc.page.width, 0);
    grad.stop(0, "#000000").stop(0.5, "#004466").stop(1, "#009999");

    doc.rect(0, 0, doc.page.width, 80).fill(grad);

    // Don't add header text, just the gradient background
  }

  /**
   * Add a bullet point to the document and return the new Y position
   */
  private addBulletPoint(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number
  ): number {
    const bulletX = x + 5;
    const textX = x + 15;

    doc.fontSize(10).fillColor("#333333");
    doc.text("•", bulletX, y);
    doc.text(text, textX, y, {
      width: doc.page.width - textX - 50,
      continued: false,
    });

    return doc.y + 5; // Return the new Y position after adding text with smaller spacing
  }

  /**
   * Send the LOI PDF via email
   */
  async sendEmail(loiData: ILOIFormData, pdfPath: string): Promise<void> {
    try {
      // Create a test account on ethereal.email
      // In production, you would use your actual SMTP settings
      const testAccount = await nodemailer.createTestAccount();

      // Create a transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || testAccount.user,
          pass: process.env.SMTP_PASS || testAccount.pass,
        },
      });

      // Send mail to the merchant
      await transporter.sendMail({
        from: '"FlexFi Team" <no-reply@flex-fi.io>',
        to: loiData.email,
        cc: "contact@flex-fi.io",
        subject: "Your FlexFi Letter of Intent for Commercial Pilot",
        text: `Dear ${loiData.fullName},\n\nThank you for your interest in becoming a FlexFi commercial pilot partner. Please find attached your signed Letter of Intent.\n\nWe'll be in touch shortly to discuss next steps for the pilot program.\n\nBest regards,\nThe FlexFi Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #004466;">Thank you for your interest in FlexFi</h2>
            <p>Dear ${loiData.fullName},</p>
            <p>We're excited about your interest in becoming a commercial pilot partner with FlexFi. Your signed Letter of Intent is attached to this email.</p>
            <p>Here's what happens next:</p>
            <ol>
              <li>Our team will review your submission</li>
              <li>We'll contact you to discuss integration requirements</li>
              <li>We'll set up a kickoff call to plan the pilot program</li>
            </ol>
            <p>If you have any questions in the meantime, please don't hesitate to contact us at <a href="mailto:partners@flex-fi.io">partners@flex-fi.io</a>.</p>
            <p>Best regards,<br>The FlexFi Team</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>FlexFi - Crypto-native Buy Now, Pay Later solution</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: path.basename(pdfPath),
            path: pdfPath,
          },
        ],
      });

      console.log("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
      // We don't throw here to prevent breaking the flow if email fails
    }
  }

  /**
   * Get all LOI records
   */
  async getAllLOIs(): Promise<ILOI[]> {
    return await LOI.find().sort({ createdAt: -1 });
  }

  /**
   * Get an LOI by ID
   */
  async getLOIById(loiId: string): Promise<ILOI | null> {
    try {
      return await LOI.findById(loiId);
    } catch (error: any) {
      if (error.name === 'CastError') {
        return null;
      }
      throw error;
    }
  }
}

export default new LOIService();
