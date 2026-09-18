const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');
const { computeRecommendationsForLot, serializeResult } = require('../services/recommendations');
const { generateAiExplanation } = require('../services/aiChat');

const router = express.Router();

const chatSchema = z.object({
  message: z.string().min(1),
  lotId: z.string().optional(),
  sessionId: z.string().optional(),
  language: z.enum(['en', 'hi']).optional(),
});

// Non-streaming chat endpoint. Returns explanation grounded in backend calculations.
router.post('/chat', requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { message, lotId, sessionId, language } = parsed.data;

  // If a lotId is given, fetch fresh backend calculation context
  let analysisContext = null;
  if (lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: lotId } });
    if (lot) {
      if (req.user.role === 'FARMER' && lot.farmerId !== req.user.farmer?.id) return res.status(403).json({ error: 'Forbidden' });
      const result = await computeRecommendationsForLot(lot.id);
      analysisContext = serializeResult(result);
    }
  } else {
    // Try farmer's active lot
    if (req.user.role === 'FARMER') {
      const active = await prisma.lot.findFirst({
        where: { farmerId: req.user.farmer.id, status: { in: ['AVAILABLE', 'OFFERED', 'ACCEPTED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (active) {
        const result = await computeRecommendationsForLot(active.id);
        analysisContext = serializeResult(result);
      }
    }
  }

  // Persist conversation
  const conversation = await prisma.conversation.upsert({
    where: { id: sessionId || '__no_session__' },
    update: {},
    create: { id: sessionId || undefined, userId: req.user.id, title: 'Sathi conversation' },
  }).catch(async () => prisma.conversation.create({ data: { userId: req.user.id, title: 'Sathi conversation' } }));

  await prisma.message.create({ data: { conversationId: conversation.id, role: 'user', content: message } });

  const { text, source } = await generateAiExplanation({ userMessage: message, analysisContext, language: language || 'en' });

  await prisma.message.create({ data: { conversationId: conversation.id, role: 'assistant', content: text, toolCalls: { source, analysisContext: analysisContext ? { topThree: analysisContext.topThree.length, comparison: analysisContext.comparison } : null } } });

  res.json({
    sessionId: conversation.id,
    reply: text,
    source,
    analysis: analysisContext,
  });
});

// Tool: get recommendations for a lot (AI or FE can call it explicitly)
router.get('/tools/recommendations/:lotId', requireAuth, async (req, res) => {
  const lot = await prisma.lot.findUnique({ where: { id: req.params.lotId } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  if (req.user.role === 'FARMER' && lot.farmerId !== req.user.farmer?.id) return res.status(403).json({ error: 'Forbidden' });
  const result = await computeRecommendationsForLot(lot.id);
  res.json(serializeResult(result));
});

module.exports = router;
