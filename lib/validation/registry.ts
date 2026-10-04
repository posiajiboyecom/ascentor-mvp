// lib/validation/registry.ts
// Maps every API route that accepts a JSON body to its strict schema.
// Used by scripts/check-api-contracts.ts to prove that every client call sends
// only fields the server accepts (strict schemas reject unknown fields), and
// serves as the index of the request contract in the documentation.
import type { z } from 'zod';
import * as auth from './schemas/auth';
import * as member from './schemas/member';
import * as pub from './schemas/public';
import * as commerce from './schemas/commerce';

export const BODY_SCHEMAS: Record<string, z.ZodType> = {
  '/api/auth/login': auth.login,
  '/api/auth/signup': auth.signup,
  '/api/auth/forgot-password': auth.forgotPassword,
  '/api/auth/reset-password': auth.resetPassword,
  '/api/welcome': auth.welcome,

  '/api/coach/session': member.coachSession,
  '/api/coaching/summary': member.coachingSummary,
  '/api/community/checkin': member.communityCheckin,
  '/api/community/circle': member.channelSlug,
  '/api/community/read': member.channelSlug,
  '/api/goals/milestone': member.goalMilestone,
  '/api/experts/register': member.expertSessionRef,
  '/api/referral': member.referralRedeem,
  '/api/usage/check': member.usageFeature,
  '/api/subscription/cancel': member.subscriptionCancel,
  '/api/push/community': member.pushCommunity,
  '/api/push/send': member.pushSend,
  '/api/push/subscribe': member.pushSubscribe,
  '/api/push/subscribe-native': member.pushSubscribeNative,
  '/api/push/unsubscribe': member.pushUnsubscribe,
  '/api/push/session-reminder': member.sessionReminder,
  '/api/intel-analyse': member.intelAnalyse,
  '/api/user/welcome': member.userWelcome,

  '/api/contact': pub.contact,
  '/api/newsletter': pub.newsletterSubscribe,
  '/api/newsletter/send': pub.newsletterSend,
  '/api/partner-enquiry': pub.partnerEnquiry,
  '/api/waitlist': pub.waitlist,
  '/api/lead-magnet': pub.leadMagnet,
  '/api/events/register': pub.eventRegister,
  '/api/events/notify': pub.eventNotify,
  '/api/summit/register': pub.summitRegister,
  '/api/summit/stream/verify': pub.summitStreamVerify,
  '/api/summit/notify': pub.summitNotify,
  '/api/checkout-pending': pub.checkoutPending,

  '/api/pay/start': commerce.payStart,
  '/api/pay/promo': commerce.payPromo,
  '/api/pay/activate-free': commerce.payActivateFree,
  '/api/payment/product/verify': commerce.productVerify,
  '/api/donate/initiate': commerce.donateInitiate,
  '/api/donate/verify': commerce.donateVerify,
  '/api/donate/abandon': commerce.donateAbandon,
};
