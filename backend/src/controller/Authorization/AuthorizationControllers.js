//Internal Lib Import
import {
  CreateAuthorizationService,
  GetAuthorizationListService,
  GetAllAuthorizationsService,
  GetAuthorizationDetailsService,
  UpdateAuthorizationService,
  DeleteAuthorizationService,
  ApproveAuthorizationService,
  GetAuthorizationStatsService,
} from "../../services/Authorization/AuthorizationService.js";

/**
 * @desc Authorization Create
 * @access private
 * @route /api/v1/Authorization/AuthorizationCreate
 * @method POST
 */
export const AuthorizationCreate = async (req, res, next) => {
  try {
    const result = await CreateAuthorizationService(req);
    res.status(201).json({ message: "Authorization request submitted successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Authorization List (Employee's own requests)
 * @access private
 * @route /api/v1/Authorization/AuthorizationList
 * @method GET
 */
export const AuthorizationList = async (req, res, next) => {
  try {
    const result = await GetAuthorizationListService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Authorization Admin List (All requests for Admin/HOD)
 * @access private
 * @route /api/v1/Authorization/AuthorizationAdminList
 * @method GET
 */
export const AuthorizationAdminList = async (req, res, next) => {
  try {
    const result = await GetAllAuthorizationsService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Authorization Details
 * @access private
 * @route /api/v1/Authorization/AuthorizationDetails/:id
 * @method GET
 */
export const AuthorizationDetails = async (req, res, next) => {
  try {
    const result = await GetAuthorizationDetailsService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Authorization Update
 * @access private
 * @route /api/v1/Authorization/AuthorizationUpdate/:id
 * @method PATCH
 */
export const AuthorizationUpdate = async (req, res, next) => {
  try {
    const result = await UpdateAuthorizationService(req);
    res.json({ message: "Authorization request updated successfully", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Authorization Delete
 * @access private
 * @route /api/v1/Authorization/AuthorizationDelete/:id
 * @method DELETE
 */
export const AuthorizationDelete = async (req, res, next) => {
  try {
    const result = await DeleteAuthorizationService(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Approve/Reject Authorization
 * @access private
 * @route /api/v1/Authorization/AuthorizationApprove/:id
 * @method PATCH
 */
export const AuthorizationApprove = async (req, res, next) => {
  try {
    const result = await ApproveAuthorizationService(req);
    res.json({ message: `Authorization request ${result.status}`, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Authorization Statistics
 * @access private
 * @route /api/v1/Authorization/AuthorizationStats
 * @method GET
 */
export const AuthorizationStats = async (req, res, next) => {
  try {
    const result = await GetAuthorizationStatsService(req);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  AuthorizationCreate,
  AuthorizationList,
  AuthorizationAdminList,
  AuthorizationDetails,
  AuthorizationUpdate,
  AuthorizationDelete,
  AuthorizationApprove,
  AuthorizationStats,
};













