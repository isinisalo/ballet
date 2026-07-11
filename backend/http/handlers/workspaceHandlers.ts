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
} from "../validation/schemas.js";
import { HttpValidationError, parseBody, parseParams } from "../validation/httpValidation.js";
import { store } from "../../store.js";
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

const saveStoreCollectionItem = <T extends MutableCollectionName>(
  collection: T,
  item: Record<string, unknown> & { id?: string }
) => store.upsert(collection, item as Parameters<typeof store.upsert<T>>[1]);

export const health: RequestHandler = (_req, res) => {
  res.json({ ok: true, projectId: process.env.BALLET_PROJECT_ID });
};

export const getData: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await store.read());
  } catch (error) {
    next(error);
  }
};

export const resetData: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await store.reset());
  } catch (error) {
    next(error);
  }
};

export const saveProjectDocument: RequestHandler = async (req, res, next) => {
  try {
    res.json(await store.saveProjectDocument(parseBody(projectDocumentSaveSchema, req)));
  } catch (error) {
    next(error);
  }
};

export const createProjectDocument: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await store.createProjectDocument(parseBody(projectDocumentCreateSchema, req)));
  } catch (error) {
    next(error);
  }
};

export const listCollection: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection } = parseParams(collectionParamsSchema, req);
    const collection = assertReadableCollection(rawCollection);
    res.json(await store.list(collection));
  } catch (error) {
    next(error);
  }
};

export const saveCollectionItem: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection } = parseParams(mutableCollectionParamsSchema, req);
    const collection = assertMutableCollection(rawCollection);
    const item = parseBody(collectionUpsertSchema(collection), req);
    const saved = await saveStoreCollectionItem(collection, item);
    res.status(item.id ? 200 : 201).json(saved);
  } catch (error) {
    next(error);
  }
};

export const removeCollectionItem: RequestHandler = async (req, res, next) => {
  try {
    const { collection: rawCollection, id } = parseParams(collectionItemParamsSchema, req);
    const collection = assertMutableCollection(rawCollection);
    await store.remove(collection, id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
