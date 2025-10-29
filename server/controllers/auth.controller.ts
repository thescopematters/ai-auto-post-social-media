// @ts-nocheck
import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";

export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, fullName } = req.body;

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new AuthenticationError("Failed to create user account");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: "user",
      } as any);

    if (profileError) {
      logger.error("Profile creation error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new AuthenticationError("Failed to create user profile");
    }

    const accessToken = generateAccessToken({
      userId: authData.user.id,
      email,
    });

    const refreshToken = generateRefreshToken({
      userId: authData.user.id,
      email,
    });

    successResponse(
      res,
      {
        user: {
          id: authData.user.id,
          email,
          fullName,
        },
        accessToken,
        refreshToken,
      },
      "Registration successful",
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      throw new AuthenticationError("User profile not found");
    }

    const accessToken = generateAccessToken({
      userId: (profile as any as any).id,
      email: (profile as any as any).email,
    });

    const refreshToken = generateRefreshToken({
      userId: (profile as any as any).id,
      email: (profile as any as any).email,
    });

    successResponse(
      res,
      {
        user: {
          id: (profile as any as any).id,
          email: (profile as any as any).email,
          fullName: (profile as any as any).full_name,
          role: (profile as any as any).role,
        },
        accessToken,
        refreshToken,
      },
      "Login successful"
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new ValidationError("Refresh token is required");
    }

    const decoded = verifyRefreshToken(token);

    const { data: user } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", decoded.userId)
      .single();

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    const accessToken = generateAccessToken({
      userId: (user as any as any).id,
      email: (user as any as any).email,
    });

    const newRefreshToken = generateRefreshToken({
      userId: (user as any as any).id,
      email: (user as any as any).email,
    });

    successResponse(
      res,
      {
        accessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      logger.info(`User logged out: ${req.user.email}`);
    }

    successResponse(res, null, "Logout successful");
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (!profile) {
      throw new AuthenticationError("User profile not found");
    }

    successResponse(res, profile, "User profile retrieved successfully");
  } catch (error) {
    next(error);
  }
};
