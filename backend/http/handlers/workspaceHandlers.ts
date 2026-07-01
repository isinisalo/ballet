import type { RequestHandler } from "express";
import {
  collectionItemParamsSchema,
  collectionParamsSchema,
  collectionUpsertSchema,
  mutableCollections,
  mutableCollectionParamsSchema,
  readableCollections,
  projectDocumentCreateSchema,
  projectDocumentSaveSchema,
  type MutableCollectionName
} from "../validation/workspaceSchemas.js";
import { HttpValidationError, parseBody, parseParams } from "../validation/httpValidation.js";
import { workspaceService } from "../../services/workspaceService.js";
import type { CollectionName } from "../../../shared/api/workspaceData.js";

const assertReadableCollection = (collection: string): CollectionName => {
  if (!readableCollections.includes(collection as CollectionName)) {
    throw new HttpValidationError("Unknown collection.", [], 404);
  }
  return collection as CollectionName;
};

const assertMutableCollection = (collection: string): MutableCollectionName => {
  if (!mutableCollections.includes(collection as MutableCollectionName)) {
    throw new HttpValidationError("Unknown collection.", [], 404);
  }
  return collection as MutableCollectionName;
};

export const health: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

export const getData: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await workspaceService.readData());
  } catch (error) {
    next(error);
  }
};

export const resetData: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await workspaceService.resetData());
  } catch (error) {
    next(error);
  }
};

export const saveProjectDocument: RequestHandler = async (req, res, next) => {
  try {
    res.json(await workspaceService.saveProjectDocument(parseBody(projectDocumentSaveSchema, req)));
  } catch (error) {
    next(error);
  }
};

export const createProjectDocument: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await workspaceService.createProjectDocument(parseBody(projectDocumentCreateSchema, req)));
  } catch (error) {
    next(error);
  }
};

export const listCollection: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection } = parseParams(collectionParamsSchema, req);
    const collection = assertReadableCollection(rawCollection);
    res.json(await workspaceService.listCollection(collection));
  } catch (error) {
    next(error);
  }
};

export const saveCollectionItem: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection } = parseParams(mutableCollectionParamsSchema, req);
    const collection = assertMutableCollection(rawCollection);
    const item = parseBody(collectionUpsertSchema(collection), req);
    const saved = await workspaceService.saveCollectionItem(collection, item);
    res.status(item.id ? 200 : 201).json(saved);
  } catch (error) {
    next(error);
  }
};

export const removeCollectionItem: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection, id } = parseParams(collectionItemParamsSchema, req);
    const collection = assertMutableCollection(rawCollection);
    await workspaceService.removeCollectionItem(collection, id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
