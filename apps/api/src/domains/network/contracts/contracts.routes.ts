import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createContract,
  declineContract,
  listAllContracts,
  listMyContracts,
  signContract,
} from './contracts.service.js';

export const contractsRouter: Router = Router();
contractsRouter.use(authenticate);

const createSchema = z.object({
  receiverUserId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20_000),
  senderSignature: z.string().trim().min(2).max(120),
});

contractsRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const contract = await createContract({ ...req.body, senderId: req.user.id });
    const body: ApiResponse<typeof contract> = { success: true, data: contract };
    res.status(201).json(body);
  }),
);

contractsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const contracts = await listMyContracts(req.user.id);
    const body: ApiResponse<typeof contracts> = { success: true, data: contracts };
    res.json(body);
  }),
);

const signSchema = z.object({ signature: z.string().trim().min(2).max(120) });
contractsRouter.post(
  '/:id/sign',
  validate(signSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const contract = await signContract(req.params.id ?? '', req.user.id, req.body.signature);
    const body: ApiResponse<typeof contract> = { success: true, data: contract };
    res.json(body);
  }),
);

contractsRouter.post(
  '/:id/decline',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const contract = await declineContract(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof contract> = { success: true, data: contract };
    res.json(body);
  }),
);

// Admin "CC bar": every contract on the platform.
contractsRouter.get(
  '/all',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const contracts = await listAllContracts();
    const body: ApiResponse<typeof contracts> = { success: true, data: contracts };
    res.json(body);
  }),
);
