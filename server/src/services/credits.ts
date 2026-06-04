/**
 * Credit & community-point transactions.
 *
 * Every credit mutation MUST go through here. Each helper wraps a single
 * Prisma transaction that (a) mutates the user's counters, (b) optionally
 * writes a GenerateLog row for audit, and (c) returns the up-to-date
 * counters. Callers receive a typed `InsufficientCredits` error they can
 * translate to a 402 response.
 *
 * Rationale: the user's generateCredits and communityPoints are read at
 * Generate-button time AND decremented on success. Between those two
 * moments an AI call fires — any failure path must leave both DB and
 * user-perceived state consistent. Hence the atomic compare-and-set
 * against `{ generateCredits: { gt: 0 } }`: if the row no longer meets
 * the condition, Prisma throws, and nothing is written.
 */

import { prisma } from '../lib/prisma.js';
import { Prisma } from '../../../generated/prisma/client.js';

export class InsufficientCredits extends Error {
  constructor(public kind: 'generate' | 'points') {
    super(`Insufficient ${kind}`);
    this.name = 'InsufficientCredits';
  }
}

export interface CreditSnapshot {
  generateCredits: number;
  communityPoints: number;
}

/**
 * Atomically decrement generateCredits by 1 iff > 0. Writes a GenerateLog
 * entry regardless of success/failure so we have an audit trail.
 */
export async function consumeGenerateCredit(
  userId: string,
  kind: 'AI_STYLIZE' | 'AI_ANALYZE' | 'AI_EVALUATE' | 'AI_GENERATE_IMAGE',
): Promise<CreditSnapshot> {
  try {
    return await prisma.$transaction(async (tx: any) => {
      // Conditional update — only affects rows with credits > 0.
      const result = await tx.user.updateMany({
        where: { id: userId, generateCredits: { gt: 0 } },
        data: { generateCredits: { decrement: 1 } },
      });
      if (result.count === 0) throw new InsufficientCredits('generate');

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { generateCredits: true, communityPoints: true },
      });

      await tx.generateLog.create({
        data: { userId, kind, creditCost: -1, success: true },
      });

      return user;
    });
  } catch (err) {
    if (err instanceof InsufficientCredits) throw err;
    throw err;
  }
}

/** Refund a generate credit — call this when an AI call fails after the
 *  credit was already consumed (e.g. upstream 500). */
export async function refundGenerateCredit(
  userId: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { generateCredits: { increment: 1 } },
    }),
    prisma.generateLog.create({
      data: {
        userId,
        kind: 'ADMIN_ADJUST',
        creditCost: 1,
        success: true,
        errorMsg: `refund: ${reason}`,
      },
    }),
  ]);
}

/** Trade community points for a generate credit. 10 points → 1 generate. */
export async function tradePointsForCredit(userId: string): Promise<CreditSnapshot> {
  return prisma.$transaction(async (tx: any) => {
    const result = await tx.user.updateMany({
      where: { id: userId, communityPoints: { gte: 10 } },
      data: {
        communityPoints: { decrement: 10 },
        generateCredits: { increment: 1 },
      },
    });
    if (result.count === 0) throw new InsufficientCredits('points');

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { generateCredits: true, communityPoints: true },
    });
    await tx.generateLog.create({
      data: { userId, kind: 'POINTS_TRADE', creditCost: -10, success: true },
    });
    return user;
  });
}

/** Publish reward: +1 generate credit, +10 community points. */
export async function awardPublishReward(
  userId: string,
  patternId: string,
): Promise<CreditSnapshot> {
  return prisma.$transaction(async (tx: any) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        generateCredits: { increment: 1 },
        communityPoints: { increment: 10 },
      },
      select: { generateCredits: true, communityPoints: true },
    });
    await tx.generateLog.create({
      data: {
        userId,
        kind: 'PUBLISH_REWARD',
        creditCost: 1,
        success: true,
        errorMsg: `pattern:${patternId}`,
      },
    });
    return user;
  });
}

/** Increment community points for download or like events. */
export async function awardCommunityPoint(userId: string, delta: number): Promise<void> {
  // No log for like/download to avoid spamming GenerateLog; aggregated via
  // SavedPattern.downloadCount / likeCount.
  await prisma.user.update({
    where: { id: userId },
    data: { communityPoints: { increment: delta } },
  });
}

// Re-export Prisma error types for callers who need to narrow.
export { Prisma };
