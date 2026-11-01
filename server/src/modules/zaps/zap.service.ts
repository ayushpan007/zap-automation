import type { AppDeps } from '../../app-deps.js';
import { AppError, notFound } from '../../errors/app-error.js';
import { getUserToken } from '../auth/auth.service.js';
import { RunModel } from '../runs/run.model.js';
import { assertRepoAdmin, ensureRepoHook, releaseRepoHookIfUnused } from '../webhooks/repo-hook.service.js';
import { toRunDto, toZapDto, type RunDto, type ZapDto } from './zap.mapper.js';
import { ZapModel } from './zap.model.js';
import { templateProblem, type CreateZapInput, type UpdateZapInput } from './zap.schema.js';

const MAX_ZAPS_LISTED = 200;
const MAX_RUNS_LISTED = 20;

/** Ownership lives in the query itself: another user's Zap is indistinguishable from a missing one. */
const findOwned = async (userId: string, zapId: string) => {
  const zap = await ZapModel.findOne({ _id: zapId, userId });
  if (!zap) throw notFound('Zap');
  return zap;
};

/** Going live = access check + webhook. Done before saving so an "enabled" Zap always has a hook. */
const goLive = async (deps: AppDeps, userId: string, repo: { id: number; fullName: string }) => {
  const token = await getUserToken(deps.config, userId);
  await assertRepoAdmin(deps, token, repo);
  await ensureRepoHook(deps, userId, token, repo);
};

/** Runs the save; if it fails after goLive created a hook, removes that hook again instead of orphaning it. */
const saveOrReleaseHook = async <T>(deps: AppDeps, wentLive: boolean, repoId: number, save: () => Promise<T>): Promise<T> => {
  try {
    return await save();
  } catch (err) {
    if (wentLive) await releaseRepoHookIfUnused(deps, repoId);
    throw err;
  }
};

export const listZaps = async (userId: string): Promise<ZapDto[]> => {
  const zaps = await ZapModel.find({ userId }).sort({ updatedAt: -1 }).limit(MAX_ZAPS_LISTED).lean();
  return zaps.map(toZapDto);
};

export const getZap = async (userId: string, zapId: string): Promise<ZapDto> => toZapDto(await findOwned(userId, zapId));

export const createZap = async (deps: AppDeps, userId: string, input: CreateZapInput): Promise<ZapDto> => {
  if (input.enabled) await goLive(deps, userId, input.trigger.repo);
  const zap = await saveOrReleaseHook(deps, input.enabled, input.trigger.repo.id, () => ZapModel.create({ ...input, userId }));
  return toZapDto(zap);
};

export const updateZap = async (deps: AppDeps, userId: string, zapId: string, patch: UpdateZapInput): Promise<ZapDto> => {
  const current = await findOwned(userId, zapId);
  const next = {
    name: patch.name ?? current.name,
    enabled: patch.enabled ?? current.enabled,
    trigger: patch.trigger ?? current.trigger,
    action: patch.action ?? current.action,
  };

  // The patch schema validates each part alone; re-check the merged trigger/action pair for field mapping.
  const problem = templateProblem(next);
  if (problem) throw new AppError('VALIDATION_FAILED', problem, [{ path: ['action', 'body'], message: problem }]);

  const previousRepoId = current.trigger.repo.id;
  const repoChanged = next.trigger.repo.id !== previousRepoId;
  const wentLive = next.enabled && (!current.enabled || repoChanged);
  if (wentLive) await goLive(deps, userId, next.trigger.repo);

  current.set(next);
  await saveOrReleaseHook(deps, wentLive, next.trigger.repo.id, () => current.save());

  if (!next.enabled || repoChanged) await releaseRepoHookIfUnused(deps, previousRepoId);
  return toZapDto(current);
};

export const deleteZap = async (deps: AppDeps, userId: string, zapId: string): Promise<void> => {
  const zap = await findOwned(userId, zapId);
  await zap.deleteOne();
  await RunModel.deleteMany({ zapId: zap._id });
  await releaseRepoHookIfUnused(deps, zap.trigger.repo.id);
};

export const listRuns = async (userId: string, zapId: string): Promise<RunDto[]> => {
  const zap = await findOwned(userId, zapId);
  const runs = await RunModel.find({ zapId: zap._id }).sort({ createdAt: -1 }).limit(MAX_RUNS_LISTED).lean();
  return runs.map(toRunDto);
};
