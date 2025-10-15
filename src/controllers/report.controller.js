
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import Client from "../models/client.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Report } from "../models/report.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
// Helper function to generate reports
export const generateReport = async (req, res) => {
  const { clientId, reportType } = req.params;

  if (!clientId || !reportType) {
    throw new ApiError(400, "Client ID and Report Type are required");
  }

  // Fetch client data
  const client = await Client.findById(clientId)
    .populate("assignedAgent", "firstName companyName")
    // .select("clientName amlStatus verificationTimeline amlDocuments");
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  // Select report template based on the report type
  let reportContent = '';
  switch (reportType) {
    case "compliance":
      reportContent = await generateComplianceReport(client);
      break;
    case "document":
      reportContent = await generateDocumentReport(client);
      break;
    case "verification_timeline":
      reportContent = await generateVerificationTimelineReport(client);
      break;
    default:
      throw new ApiError(400, "Invalid report type");
  }

  // Store the generated report in the DB
  const generatedReport = await Report.create({
    reportType,
    clientId: client._id,
    generatedBy: req.user._id,
    content: reportContent,
  });

  return res.status(200).json({
    message: "Report generated successfully",
    report: generatedReport,
  });
};

// Function to generate the Compliance Report
const generateComplianceReport = (client) => {
  console.log("🚀 ~ generateComplianceReport ~ client:", client)
  let report = `
    COMPLIANCE REPORT
    Client Name: ${client.clientName}
    Date Generated: ${new Date().toLocaleDateString()}
    Agent: ${client.assignedAgent.firstName}
    Company: ${client.assignedAgent.companyName}
    AML Status: ${client.amlStatus}
    Verification Date: ${client.verificationTimeline[0]?.date || "N/A"}
    Provider Used: [Enter AML Provider Name]
  `;

  // Client Overview section
  report += `
    ⸻
    Client Overview
    • Client Type: ${client.clientType || "N/A"}
    • Purchase Method: ${client?.buyingPreference?.purchaseMethod || "N/A"}
    • Reason for Purchase: ${client.reasonForPurchase || "N/A"}
    • Budget Range: £${client.budgetMin}–£${client.budgetMax}
    • Preferred Area: ${client?.buyingPreference.preferredLocation || "N/A"}
    • Current Position: ${client.currentPosition || "N/A"}
  `;

  // Verification Summary section
  report += `
    ⸻
    Verification Summary
    • Status: ${client.amlStatus} (Not Started / Pending / Verified / Flagged)
    • Verification Performed By: ${client.assignedAgent.firstName}
    • Verification Completed On: ${client.verificationDate || "N/A"}
    • Third-Party Provider: [Enter AML Provider Name]
  `;

  // Uploaded Documents section
  report += `
    ⸻
    Uploaded Documents
  `;
  client.amlDocuments.forEach(doc => {
    report += `
      ${doc.documentType} ${doc.file.filename} ${doc.uploadedAt} ${doc.uploadedBy} ${doc.status}
    `;
  });

  // Additional Notes section
//   report += `
//     ⸻
//     Additional Notes
//     ${client.metadata.notes || "No additional notes"}
//   `;

  // Footer section
  report += `
    ⸻
    Generated via SaxonFinder
    Saxon Finder is a software platform that provides secure storage and reporting tools for AML verification data.
  `;
  return report;
};

// Function to generate the Document Report
const generateDocumentReport = (client) => {
  let report = `
    DOCUMENT REPORT
    Client Name: ${client.clientName}
    Date Generated: ${new Date().toLocaleDateString()}
    Agent: ${client.assignedAgent.firstName}
    Company: ${client.assignedAgent.companyName}
    AML Status: ${client.amlStatus}
    Verification Date: ${client.verificationTimeline[0]?.date || "N/A"}
    Provider Used: [Enter AML Provider Name]
  `;

  // Uploaded Documents section
  report += `
    ⸻
    Uploaded Documents
  `;
  client.amlDocuments.forEach(doc => {
    report += `
      ${doc.documentType} ${doc.file.filename} ${doc.uploadedAt} ${doc.uploadedBy} ${doc.status}
    `;
  });

  // Additional Notes section
  report += `
    ⸻
    Additional Notes
    ${client.metadata.notes || "No additional notes"}
  `;

  // Footer section
  report += `
    ⸻
    Generated via SaxonFinder
    Saxon Finder is a software platform that provides secure storage and reporting tools for AML verification data.
  `;
  return report;
};

// Function to generate the Verification Timeline Report
const generateVerificationTimelineReport = (client) => {
  let report = `
    AML VERIFICATION TIMELINE REPORT
    Client Name: ${client.clientName}
    Date Generated: ${new Date().toLocaleDateString()}
    Agent: ${client.assignedAgent.firstName}
    Company: ${client.assignedAgent.companyName}
    AML Status: ${client.amlStatus}
    Verification Date: ${client.verificationTimeline[0]?.date || "N/A"}
    Provider Used: [Enter AML Provider Name]
  `;

  // Verification Timeline section
  report += `
    ⸻
    Verification Timeline
  `;
  client.verificationTimeline.forEach(entry => {
    report += `
      ${entry.date} ${entry.action} ${entry.description} ${entry.performedBy}
    `;
  });

  // Verification Summary section
  report += `
    ⸻
    Verification Summary
    Verification Status: ${client.amlStatus} (Not Started / Pending / Verified / Flagged)
    Verification Completed On: ${client.verificationDate || "N/A"}
    Third-Party Provider Used: [Enter AML Provider Name]
  `;

  // Additional Notes section
  report += `
    ⸻
    Additional Notes
    ${client.metadata.notes || "No additional notes"}
  `;

  // Footer section
  report += `
    ⸻
    Generated via SaxonFinder
    Saxon Finder is a software platform that provides secure storage and reporting tools for AML verification data.
  `;
  return report;
};


export const getClientReports = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const reports = await Report.find({ clientId }).populate("generatedBy", "firstName email");

  if (!reports) {
    throw new ApiError(404, "No reports found for this client");
  }

  return res.status(200).json(new ApiResponse(200, reports, "Reports fetched successfully"));
});
