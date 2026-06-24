import express from "express";
import type { CollectionName } from "./shared/domain.js";
import { store } from "./store.js";

const collections: CollectionName[] = ["projects", "goals", "adrs", "agents", "runtimes", "policies", "events"];
const collectionSet = new Set(collections);

export const apiRouter = express.Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get("/data", async (_req, res, next) => {
  try {
    res.json(await store.read());
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/reset", async (_req, res, next) => {
  try {
    res.json(await store.reset());
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/:collection", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection)) return res.status(404).json({ error: "Unknown collection." });
    res.json(await store.list(collection));
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/events/intake", async (req, res, next) => {
  try {
    const { projectId, eventType } = req.body;
    if (!projectId || !eventType) {
      return res.status(400).json({ error: "projectId and eventType are required." });
    }

    const event = await store.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/:collection", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection) || collection === "events") {
      return res.status(404).json({ error: "Unknown mutable collection." });
    }

    const saved = await store.upsert(collection, req.body);
    res.status(req.body.id ? 200 : 201).json(saved);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/:collection/:id", async (req, res, next) => {
  try {
    const collection = req.params.collection as CollectionName;
    if (!collectionSet.has(collection)) return res.status(404).json({ error: "Unknown collection." });
    await store.remove(collection, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
