"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const analytics_1 = require("../services/analytics");
const router = (0, express_1.Router)();
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};
/**
 * @swagger
 * /analytics/productivity:
 *   get:
 *     tags: [Analytics]
 *     summary: Get productivity analytics for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Productivity analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductivityAnalyticsResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/analytics/productivity', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const analytics = await (0, analytics_1.getProductivityAnalytics)(userId);
        return res.json(analytics);
    }
    catch (error) {
        console.error('GET /analytics/productivity error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
