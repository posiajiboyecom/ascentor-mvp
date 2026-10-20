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
import * as partner from './schemas/partner';
import * as admin from './schemas/admin';

export const BODY_SCHEMAS: Record<string, z.ZodType> = {
  '/api/auth/login': auth.login,
  '/api/auth/signup': auth.signup,
  '/api/auth/verify-signup': auth.verifySignup,
  '/api/auth/resend-signup': auth.resendSignup,
  '/api/account/password': auth.changePassword,
  '/api/account/delete': auth.deleteAccount,
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
  '/api/shop/checkout': commerce.shopCheckout,
  '/api/shop/free': commerce.shopFree,
  '/api/donate/initiate': commerce.donateInitiate,
  '/api/donate/verify': commerce.donateVerify,
  '/api/donate/abandon': commerce.donateAbandon,
  // partner portal
  '/api/partner/brand': partner.brandSave,
  '/api/partner/config': partner.configPatch,
  '/api/partner/settings': partner.settingsPatch,
  '/api/partner/domain': partner.domainSave,
  '/api/partner/apply': partner.apply,
  '/api/partner/courses': partner.courseUpdate,
  '/api/partner/events': partner.eventUpdate,
  '/api/partner/members': partner.memberAction,
  '/api/partner/payment/verify': partner.paymentVerify,
  '/api/partner/subscription': partner.subscriptionChange,

  // admin
  '/api/admin/agents': admin.agentTrigger,
  '/api/admin/buffer-send': admin.bufferSend,
  '/api/admin/coaching-sessions': admin.coachingSessionsDelete,
  '/api/admin/community-messages': admin.communityMessagesAction,
  '/api/admin/intel-analyse': admin.adminIntelAnalyse,
  '/api/admin/knowledge/ingest-text': admin.ingestText,
  '/api/admin/knowledge/ingest-url': admin.ingestUrl,
  '/api/admin/knowledge/ingest-youtube': admin.ingestYoutube,
  '/api/admin/knowledge/batch-ingest': admin.batchIngest,
  '/api/admin/mailerlite': admin.mailerlite,
  '/api/admin/marketing-cms': admin.marketingCms,
  '/api/admin/partners': admin.partnerAdminAction,
  '/api/admin/permissions': admin.permissionsAction,
  '/api/admin/users': admin.userAdminAction,
  '/api/admin/payments': admin.paymentsPost,
  '/api/admin/summit-registrations': admin.summitRegistrationAction,
  '/api/admin/summit-donations': admin.summitDonationAction,
  '/api/admin/summit-stream': admin.summitStream,
  '/api/admin/surveys': admin.surveyCreate,
  '/api/admin/promo-codes': admin.promoCreate,
  '/api/admin/shop/products': admin.shopProductCreate,
  '/api/admin/personal-brand': admin.personalBrandGenerate,
  '/api/admin/personal-brand/image': admin.personalBrandImage,

  // Secondary handlers on the same path (other HTTP methods / modes): "<path>#<label>"
  '/api/admin/payments#DELETE': admin.paymentsDelete,
  '/api/admin/users#FIND': admin.findUser,
  '/api/admin/shop/products#PATCH': admin.shopProductUpdate,
  '/api/admin/shop/products#DELETE': admin.shopProductDelete,
  '/api/admin/shop/orders#PATCH': admin.shopOrderUpdate,
  '/api/admin/promo-codes#PATCH': admin.promoUpdate,
  '/api/admin/promo-codes#DELETE': admin.promoDelete,
  '/api/admin/summit-registrations#PATCH': admin.summitRegistrationPatch,
  '/api/admin/surveys#PATCH': admin.surveyUpdate,
  '/api/partner/members#POST': partner.membersInvite,
  '/api/partner/courses#POST': partner.courseCreate,
  '/api/partner/courses#DELETE': partner.courseDelete,
  '/api/partner/events#POST': partner.eventCreate,
};
