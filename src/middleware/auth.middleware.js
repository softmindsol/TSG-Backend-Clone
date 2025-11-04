import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import Agent from "../models/agent.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Access Denied");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);


    const user = await Agent.findById(decodedToken?.id).select(
      "-password -refreshToken"
    );


    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});

export const verifyAdminJWT = asyncHandler(async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Access Denied");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Agent.findById(decodedToken?.id).select(
      "-password"
    );

    if (!user || user.role !== "admin") {
      throw new ApiError(401, "Invalid Access Token or Insufficient Permissions");
    }
    req.admin = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});
