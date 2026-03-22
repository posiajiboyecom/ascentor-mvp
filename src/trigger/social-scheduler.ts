// src/trigger/social-scheduler.ts — PATCH ONLY
// ─────────────────────────────────────────────────────────────
// Find the postText extraction block (around line 105) and add
// the Instagram Carousel case BEFORE the final `else` fallback.
//
// DO NOT replace the full file — just insert this case.
// ─────────────────────────────────────────────────────────────
//
// BEFORE (the existing else block at the end):
//
//   } else {
//     postText = item.title;
//   }
//
// REPLACE WITH:
//
//   } else if (item.type === "Instagram Carousel") {
//     // Carousel: caption is the post text, coverImageUrl goes to image_url
//     postText = cd?.caption || cd?.hook || item.title;
//     // Pass coverImageUrl into the queue row so buffer-send can use it
//     // (image_url column is set separately below — see amended queueItems.push)
//   } else {
//     postText = item.title;
//   }
//
// ─────────────────────────────────────────────────────────────
// ALSO update queueItems.push to include image_url for carousels:
//
// BEFORE:
//   queueItems.push({
//     platform,
//     content:      postText,
//     pillar:       item.pillar,
//     scheduled_for: scheduledFor.toISOString(),
//     status:       "queued",
//     content_calendar_id: item.id,
//     created_at:   now.toISOString(),
//   });
//
// REPLACE WITH:
//   queueItems.push({
//     platform,
//     content:      postText,
//     pillar:       item.pillar,
//     scheduled_for: scheduledFor.toISOString(),
//     status:       "queued",
//     content_calendar_id: item.id,
//     created_at:   now.toISOString(),
//     // Carousel: attach cover image so buffer-send can send it to Buffer
//     ...(item.type === "Instagram Carousel" && cd?.coverImageUrl
//       ? { image_url: cd.coverImageUrl }
//       : {}),
//   });
//
// ─────────────────────────────────────────────────────────────
// ALSO add "Instagram Carousel" to the .in("type") filter
// so the scheduler picks it up when set to scheduled status:
//
// BEFORE:
//   .in("status", autoApprove ? ["draft", "scheduled"] : ["scheduled"])
//
// This line is fine as-is — it filters by STATUS not type,
// so carousels with status="scheduled" are already included.
// No change needed here.
//
// ─────────────────────────────────────────────────────────────
// SUMMARY OF CHANGES TO MAKE IN social-scheduler.ts:
//
// 1. Add Instagram Carousel case in the postText extraction block
// 2. Spread image_url into queueItems.push for carousel items
//
// EXACT DIFF:

/*
FIND this block in social-scheduler.ts:

      } else if (item.type === "Email Newsletter") {
        postText = `📬 "${cd?.subject || item.title}" — sent to subscribers`;
      } else {
        postText = item.title;
      }

      queueItems.push({
        platform,
        content:      postText,
        pillar:       item.pillar,
        scheduled_for: scheduledFor.toISOString(),
        status:       "queued",
        content_calendar_id: item.id,
        created_at:   now.toISOString(),
      });

REPLACE WITH:

      } else if (item.type === "Email Newsletter") {
        postText = `📬 "${cd?.subject || item.title}" — sent to subscribers`;
      } else if (item.type === "Instagram Carousel") {
        // Caption is the post text; cover image goes to Buffer as image attachment
        postText = cd?.caption
          ? cd.caption.replace(/\\n/g, "\n")
          : (cd?.hook || item.title);
        if (cd?.hashtags?.length) {
          postText += "\n\n" + cd.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ");
        }
      } else {
        postText = item.title;
      }

      queueItems.push({
        platform,
        content:      postText,
        pillar:       item.pillar,
        scheduled_for: scheduledFor.toISOString(),
        status:       "queued",
        content_calendar_id: item.id,
        created_at:   now.toISOString(),
        // Carousel: pass cover slide image_url so buffer-send attaches it
        ...(item.type === "Instagram Carousel" && (cd as any)?.coverImageUrl
          ? { image_url: (cd as any).coverImageUrl }
          : {}),
      });
*/

// That's the entire change. Two additions, nothing removed.
// The rest of social-scheduler.ts is unchanged.
