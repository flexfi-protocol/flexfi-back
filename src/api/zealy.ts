import { Router } from "express";
import zealyController from "../controllers/zealyController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// User connection routes
router.get("/connect", authMiddleware, zealyController.connect);
router.get("/callback", authMiddleware, zealyController.callback);

// Points management routes
router.post("/sync-points", authMiddleware, zealyController.syncPoints);
router.post("/add-xp", authMiddleware, zealyController.addXP);
router.post("/remove-xp", authMiddleware, zealyController.removeXP);

// Quest management routes
router.get("/quests", authMiddleware, zealyController.listQuests);
router.get("/quests/:questId", authMiddleware, zealyController.getQuest);
router.post("/quests", authMiddleware, zealyController.createQuest);
router.patch("/quests/:questId", authMiddleware, zealyController.updateQuest);

// Webhook management routes
router.get("/webhooks", authMiddleware, zealyController.listWebhooks);
router.post("/webhooks", authMiddleware, zealyController.createWebhook);
router.patch("/webhooks/:webhookId", authMiddleware, zealyController.updateWebhook);
router.delete("/webhooks/:webhookId", authMiddleware, zealyController.deleteWebhook);
router.get("/webhooks-event-types", authMiddleware, zealyController.getWebhookEventTypes);
router.get("/webhooks/:webhookId/events", authMiddleware, zealyController.getWebhookEvents);

export default router;
