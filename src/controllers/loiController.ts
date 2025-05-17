import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import loiService from "../services/loiService";

/**
 * Handle LOI form submission
 */
export const submitLOI = async (req: Request, res: Response) => {
  try {
    // Extract data from request body
    const { fullName, company, email, country, sector, comments, signature } =
      req.body;

    // Validate required fields
    if (!fullName || !company || !email || !country || !sector || !signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Create LOI record and generate PDF
    const newLOI = await loiService.createLOI({
      fullName,
      company,
      email,
      country,
      sector,
      comments,
      signature,
    });

    // Return success response with download URL
    return res.status(201).json({
      success: true,
      message: "Letter of Intent submitted successfully",
      data: {
        id: newLOI._id,
        pdfUrl: newLOI.pdfUrl,
      },
    });
  } catch (error) {
    console.error("Error submitting LOI:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request",
    });
  }
};

/**
 * Get all LOIs
 */
export const getAllLOIs = async (_req: Request, res: Response) => {
  try {
    const lois = await loiService.getAllLOIs();

    return res.status(200).json({
      success: true,
      data: lois.map((loi) => ({
        id: loi._id,
        fullName: loi.fullName,
        company: loi.company,
        email: loi.email,
        country: loi.country,
        sector: loi.sector,
        pdfUrl: loi.pdfUrl,
        createdAt: loi.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error getting LOIs:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving LOIs",
    });
  }
};

/**
 * Get a specific LOI by ID
 */
export const getLOIById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let loi;
    try {
      loi = await loiService.getLOIById(id);
    } catch (error: any) {
      if (error.name === 'CastError') {
        return res.status(404).json({
          success: false,
          message: 'LOI not found',
        });
      }
      throw error;
    }

    if (!loi) {
      return res.status(404).json({
        success: false,
        message: 'LOI not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: loi._id,
        fullName: loi.fullName,
        company: loi.company,
        email: loi.email,
        country: loi.country,
        sector: loi.sector,
        comments: loi.comments,
        pdfUrl: loi.pdfUrl,
        createdAt: loi.createdAt,
      },
    });
  } catch (error) {
    console.error('Error getting LOI:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving the LOI',
    });
  }
};

/**
 * Download LOI PDF
 */
export const downloadLOI = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let loi;
    try {
      loi = await loiService.getLOIById(id);
    } catch (error: any) {
      if (error.name === 'CastError') {
        return res.status(404).json({
          success: false,
          message: 'LOI not found',
        });
      }
      throw error;
    }

    if (!loi) {
      return res.status(404).json({
        success: false,
        message: 'LOI not found',
      });
    }

    // Get the file path from the URL
    const filePath = path.join(__dirname, "..", "..", loi.pdfUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "PDF file not found",
      });
    }

    // Set headers and send file
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading LOI:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while downloading the LOI',
    });
  }
};
