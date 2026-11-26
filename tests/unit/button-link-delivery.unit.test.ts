import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const deliveryActionFindMany = vi.fn();
  const deliveryActionFindUnique = vi.fn();
  const deliveryActionUpsert = vi.fn();
  const deliveryActionUpdate = vi.fn();
  const deliveryActionUpdateMany = vi.fn();
  const executionFindUnique = vi.fn();
  const executionUpdate = vi.fn();
  const executionUpdateMany = vi.fn();
  const webhookEventUpdate = vi.fn();
  const messagingWebhookEventUpdateMany = vi.fn();
  const queryRaw = vi.fn();
  const deliverProducts = vi.fn();
  const sendDirectMessage = vi.fn();
  const checkUserFollowsBusiness = vi.fn();

  const tx = {
    deliveryAction: {
      findMany: deliveryActionFindMany,
    },
    automationExecution: {
      findUnique: executionFindUnique,
      update: executionUpdate,
    },
    webhookEvent: {
      update: webhookEventUpdate,
    },
  };

  return {
    deliveryActionFindMany,
    deliveryActionFindUnique,
    deliveryActionUpsert,
    deliveryActionUpdate,
    deliveryActionUpdateMany,
    executionFindUnique,
    executionUpdate,
    executionUpdateMany,
    webhookEventUpdate,
    messagingWebhookEventUpdateMany,
    queryRaw,
    deliverProducts,
    sendDirectMessage,
    checkUserFollowsBusiness,
    tx,
  };
});

vi.mock("@replyza/database", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => fn(mocks.tx),
    $queryRaw: mocks.queryRaw,
    $disconnect: vi.fn().mockResolvedValue(undefined),
    deliveryAction: {
      findMany: mocks.deliveryActionFindMany,
      findUnique: mocks.deliveryActionFindUnique,
      upsert: mocks.deliveryActionUpsert,
      update: mocks.deliveryActionUpdate,
      updateMany: mocks.deliveryActionUpdateMany,
    },
    automationExecution: {
      findUnique: mocks.executionFindUnique,
      update: mocks.executionUpdate,
      updateMany: mocks.executionUpdateMany,
    },
    webhookEvent: {
      update: mocks.webhookEventUpdate,
    },
    messagingWebhookEvent: {
      updateMany: mocks.messagingWebhookEventUpdateMany,
    },
  },
}));

vi.mock("@replyza/shared", () => ({
  decryptToken: () => "mock_access_token",
  interpolateVariables: (text: string) => text,
  signFollowCheckPayload: (id: string) => `FOLLOW_CHECK:${id}.mock`,
}));

vi.mock("../../apps/worker/src/config/env", () => ({
  workerEnv: {
    metaTokenEncryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    metaGraphApiVersion: "v27.0",
    sessionSecret: "test_session_secret_must_be_at_least_32_characters_long",
  },
}));

vi.mock("../../apps/worker/src/services/product-delivery.service", () => ({
  deliverProducts: mocks.deliverProducts,
}));

vi.mock("../../apps/worker/src/services/instagram-graph.service", () => ({
  checkUserFollowsBusiness: mocks.checkUserFollowsBusiness,
  sendDirectMessage: mocks.sendDirectMessage,
  MetaApiError: class MetaApiError extends Error {
    httpStatus = 400;
    isTransient = false;
    category = "PERMANENT";
    metaError?: { code?: number };
  },
  MetaApiUnknownOutcomeError: class MetaApiUnknownOutcomeError extends Error {},
}));

import { syncExecutionFromDeliveryActions } from "../../apps/worker/src/services/delivery-action.service";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

describe("Button & Follow-Gate State Machine Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messagingWebhookEventUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryActionUpsert.mockResolvedValue({});
    mocks.deliveryActionUpdate.mockResolvedValue({});
    mocks.executionUpdate.mockResolvedValue({});
    mocks.webhookEventUpdate.mockResolvedValue({});
  });

  it("syncExecutionFromDeliveryActions keeps status=PARTIAL and completedAt=null when AWAITING_TAP", async () => {
    mocks.deliveryActionFindMany.mockResolvedValue([
      { actionType: "PUBLIC_REPLY", status: "SENT", metaId: "pub_1", lastErrorMessage: null },
      { actionType: "HOOK_DM", status: "SENT", metaId: "dm_1", lastErrorMessage: null },
    ]);
    mocks.executionFindUnique.mockResolvedValue({
      conversationState: "AWAITING_TAP",
      followCheckStatus: "PENDING",
      automation: {
        followRequired: false,
        deliveryMode: "BUTTON",
        productDeliveryMode: "SINGLE_MESSAGE",
        _count: { products: 0 },
      },
    });

    await syncExecutionFromDeliveryActions("exec-1", "wh-1");

    expect(mocks.executionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-1" },
        data: expect.objectContaining({
          status: "PARTIAL",
          completedAt: null,
          publicReplyStatus: "SUCCESS",
          privateReplyStatus: "SUCCESS",
        }),
      })
    );
  });

  it("syncExecutionFromDeliveryActions marks DIRECT automation COMPLETED when PUBLIC_REPLY is SKIPPED and HOOK_DM is SENT", async () => {
    mocks.deliveryActionFindMany.mockResolvedValue([
      { actionType: "PUBLIC_REPLY", status: "SKIPPED", metaId: null, lastErrorMessage: null },
      { actionType: "HOOK_DM", status: "SENT", metaId: "dm_1", lastErrorMessage: null },
    ]);
    mocks.executionFindUnique.mockResolvedValue({
      conversationState: "COMPLETED",
      followCheckStatus: "PENDING",
      automation: {
        followRequired: false,
        deliveryMode: "DIRECT",
        productDeliveryMode: "SINGLE_MESSAGE",
        _count: { products: 0 },
      },
    });

    await syncExecutionFromDeliveryActions("exec-2", "wh-2");

    expect(mocks.executionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-2" },
        data: expect.objectContaining({
          status: "COMPLETED",
          publicReplyStatus: "SKIPPED",
          privateReplyStatus: "SUCCESS",
        }),
      })
    );
    const callArg = mocks.executionUpdate.mock.calls[0][0];
    expect(callArg.data.completedAt).toBeInstanceOf(Date);
  });

  it("processFollowCheckJob delivers LINK_DM when conversationState=AWAITING_TAP even if status was prematurely COMPLETED", async () => {
    mocks.executionFindUnique.mockResolvedValue({
      id: "exec-3",
      status: "COMPLETED",
      conversationState: "AWAITING_TAP",
      followCheckStatus: "PENDING",
      followCheckRetryCount: 0,
      followCheckSentAt: new Date(),
      createdAt: new Date(),
      tapEventMid: null,
      automation: {
        followRequired: false,
        deliveryMode: "BUTTON",
        dmMessageText: "Here is your link:",
        dmLink: "https://replyza.buzz/deal",
        productDeliveryMode: "SINGLE_MESSAGE",
        productIntroText: null,
        productClosingText: null,
        followUpEnabled: false,
        followUpText: null,
        products: [],
        instagramAccount: {
          id: "acc-1",
          instagramUserId: "ig_biz_1",
          encryptedAccessToken: "enc",
        },
      },
      webhookEvent: {
        commenterInstagramId: "igsid_1",
        commenterUsername: "fan",
        commentText: "LINK",
      },
    });
    mocks.deliveryActionFindUnique.mockResolvedValue(null);
    mocks.executionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.queryRaw.mockResolvedValue([{ id: "da-link-1", attempts: 1 }]);
    mocks.deliverProducts.mockResolvedValue("msg_link_123");

    await processFollowCheckJob({
      id: "job-1",
      data: {
        executionId: "exec-3",
        igsid: "igsid_1",
        instagramUserId: "ig_biz_1",
        providerEventId: "mid_1",
      },
    } as never);

    expect(mocks.deliverProducts).toHaveBeenCalledTimes(1);
    expect(mocks.executionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-3" },
        data: expect.objectContaining({
          status: "COMPLETED",
          followCheckStatus: "SUCCESS",
          conversationState: "COMPLETED",
        }),
      })
    );
  });

  it("processFollowCheckJob skips when conversationState=COMPLETED", async () => {
    mocks.executionFindUnique.mockResolvedValue({
      id: "exec-4",
      status: "COMPLETED",
      conversationState: "COMPLETED",
      followCheckStatus: "SUCCESS",
      followCheckRetryCount: 0,
      automation: {
        instagramAccount: { id: "acc-1", instagramUserId: "ig_biz_1" },
        products: [],
      },
      webhookEvent: {},
    });

    await processFollowCheckJob({
      id: "job-2",
      data: {
        executionId: "exec-4",
        igsid: "igsid_1",
        instagramUserId: "ig_biz_1",
        providerEventId: "mid_2",
      },
    } as never);

    expect(mocks.deliverProducts).not.toHaveBeenCalled();
  });
});
