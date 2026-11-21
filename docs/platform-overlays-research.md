# Platform preview overlays: research notes

Research date: 2026-11-21. Goal: data to draw CapCut-style "platform preview" overlays (TikTok, Instagram, YouTube, etc.) over the Studio preview, as SVG, from fractions of the frame.

## How to read this

- All coordinates are fractions of the video frame: `x`, `w` of width, `y`, `h` of height. Reference canvas 1080x1920 (9:16) or 1920x1080 (16:9).
- `src` tags:
  - **OFFICIAL**: a number published by the platform (help page, ads guide, or official template file). I read the page myself on the date shown, or a third party quotes the official file and I say so.
  - **3P**: a third-party template/guide; the page date is given.
  - **EST**: my estimate of where an element sits, built from the official zones plus the usual layout. **No source publishes per-icon coordinates.** Treat these as a starting draft to calibrate against fresh phone screenshots before release.
- Every official safe zone is **for ads**. No platform publishes margins for organic posts. Ads add a CTA button and a "Sponsored" label, so ad zones are stricter than organic UI. That is why sources disagree.
- **Tall phones:** on modern 19.5:9+ phones, TikTok, Reels and Shorts usually draw the 9:16 video *above* the bottom nav bar, so the nav bar does not cover the frame. On 16:9 phones, or when the app zooms to fill the screen, it does. Draw the nav bar as a separate optional layer.

## (a) Summary: safe-zone margins (fractions of frame)

| Platform / format | Top | Bottom | Left | Right | Src | Notes |
|---|---|---|---|---|---|---|
| TikTok In-Feed (ad template) | 0.125 (240px) | 0.344 (660px) | 0.111 (120px) | 0.111 (120px) + rail | OFFICIAL (TikTok Feed.png template, dated 2025-04-15, as measured by 3P) | Right rail column x 0.722–0.889 from y 0.4375 down |
| TikTok with long captions (ad "anchor" templates) | 0.131 (252px) | 0.423 / 0.457 / 0.493 / 0.528 for 1 / 2 / 3 / 4 caption lines | 0.111 | rail 0.222 (240px) from y 0.1875 | OFFICIAL via 3P measurement | Worst case for caption-heavy posts |
| TikTok organic (3P measured) | 0.068–0.104 | 0.167–0.252 | 0.041–0.080 | 0.111–0.130 | 3P | Ranges across 3 sources, see sources |
| Instagram Reels | 0.14 | 0.35 (0.40 if the ad has a disclaimer) | 0.06 | 0.06 | OFFICIAL (Meta Ads Guide) | 3P adds: rail over the rightmost ~0.21 in the bottom ~0.40 |
| Instagram Stories | 0.14 | 0.35 | 0.06 | 0.06 | OFFICIAL (Meta Ads Guide) | Organic 3P rule of thumb: ~0.13 (250px) top and bottom |
| Instagram feed 4:5 (1080x1350) | 0 | 0 | 0 | 0 | n/a | No UI over the media in feed. The profile grid crops to 3:4 (since Jan 2025), cutting ~0.031 per side of a 4:5 post |
| YouTube Shorts | 0.15 (288px) | 0.35 (672px) | 0.044 (48px) | 0.178 (192px) | OFFICIAL (Google Ads safe-zone image, values per 3P) | 3P organic: top 0.080, bottom 0.240, left 0.060, right 0.160 |
| Facebook Reels | 0.14 | 0.35 | 0.06 | 0.06 | OFFICIAL for Meta Reels ads in general; not confirmed for FB specifically | |
| X vertical, LinkedIn vertical | — | — | — | — | none found | Kapwing and Tella offer templates but publish no numbers |

**Where they disagree:** the TikTok top margin ranges from 0.068 to 0.125 and the bottom from 0.167 to 0.528. Use the official ad template as the "strict" mode and the organic range as "relaxed". YouTube Shorts: the official right margin of 0.178 is wider than the 3P organic 0.160, and the official bottom of 0.35 is taller than the organic 0.24. Meta's 14/35/6 appears on its live Ads Guide pages (Reels and Stories, read 2026-11-21). One 3P page (lilachbullock, Oct 2026) says Meta's *Business Help Center* page gives the rule only in words, without numbers.

## (b) Element boxes (ready for SVG)

The JSON below holds every value. `safe` = recommended safe rectangle (frame minus margins). `elements` = UI mock boxes. `kind` is a drawing hint (`text`, `icon`, `pill`, `bar`, `avatar`, `zone`).

```json
{
  "version": "2026-11-21",
  "canvas": {"portrait": [1080, 1920], "landscape": [1920, 1080]},
  "platforms": {
    "tiktok_feed": {
      "aspect": "9:16",
      "safe": {
        "strict_ad": {"x": 0.111, "y": 0.125, "w": 0.778, "h": 0.531, "src": "OFFICIAL", "ref": ["S1", "S2", "S3"]},
        "strict_ad_rail_cutout": {"x": 0.722, "y": 0.4375, "w": 0.167, "h": 0.219, "src": "OFFICIAL", "note": "rail column inside the safe rect; exclude it", "ref": ["S2", "S3"]},
        "caption_lines_bottom_margin": {"1": 0.423, "2": 0.457, "3": 0.493, "4": 0.528, "src": "OFFICIAL (anchor templates)", "ref": ["S2"]},
        "relaxed_organic": {"x": 0.08, "y": 0.104, "w": 0.79, "h": 0.722, "src": "3P measured", "ref": ["S3"]}
      },
      "elements": [
        {"id": "live",       "label": "LIVE",                    "kind": "icon",   "x": 0.03, "y": 0.035, "w": 0.08, "h": 0.04, "src": "EST"},
        {"id": "tabs",       "label": "Following | For You",     "kind": "text",   "x": 0.25, "y": 0.035, "w": 0.50, "h": 0.04, "src": "EST", "note": "some regions show extra tabs (e.g. Local, US, Feb 2026)"},
        {"id": "search",     "label": "Search",                  "kind": "icon",   "x": 0.89, "y": 0.035, "w": 0.08, "h": 0.04, "src": "EST"},
        {"id": "rail",       "label": "Action rail",             "kind": "zone",   "x": 0.84, "y": 0.47,  "w": 0.14, "h": 0.42, "src": "EST", "note": "official ad template puts the column at x 0.722-0.889 from y 0.4375; organic sits closer to the edge"},
        {"id": "avatar",     "label": "Avatar + follow",         "kind": "avatar", "x": 0.855,"y": 0.47,  "w": 0.11, "h": 0.065,"src": "EST", "note": "profile image 98x98 px asset (OFFICIAL via S3)"},
        {"id": "like",       "label": "Like + count",            "kind": "icon",   "x": 0.86, "y": 0.56,  "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "comment",    "label": "Comment + count",         "kind": "icon",   "x": 0.86, "y": 0.63,  "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "bookmark",   "label": "Save + count",            "kind": "icon",   "x": 0.86, "y": 0.70,  "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "share",      "label": "Share + count",           "kind": "icon",   "x": 0.86, "y": 0.77,  "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "sound_disc", "label": "Sound disc",              "kind": "avatar", "x": 0.87, "y": 0.845, "w": 0.08, "h": 0.045,"src": "EST", "note": "icon pitch ~0.07 of height (~130 px)"},
        {"id": "username",   "label": "@username",               "kind": "text",   "x": 0.03, "y": 0.80,  "w": 0.50, "h": 0.03, "src": "EST"},
        {"id": "caption",    "label": "Caption (1-2 lines, 'more')", "kind": "text", "x": 0.03, "y": 0.83, "w": 0.72, "h": 0.055,"src": "EST", "note": "up to 4 lines before 'See more' (S3)"},
        {"id": "sound_line", "label": "Original sound - ...",    "kind": "text",   "x": 0.03, "y": 0.885, "w": 0.60, "h": 0.025,"src": "EST"},
        {"id": "progress",   "label": "Progress bar",            "kind": "bar",    "x": 0.0,  "y": 0.993, "w": 1.0,  "h": 0.004,"src": "EST"},
        {"id": "navbar",     "label": "Home, Friends/Shop, +, Inbox, Profile", "kind": "bar", "x": 0.0, "y": 0.925, "w": 1.0, "h": 0.075, "src": "EST", "optional": true, "note": "outside the frame on tall phones"}
      ]
    },
    "instagram_reels": {
      "aspect": "9:16",
      "safe": {
        "official": {"x": 0.06, "y": 0.14, "w": 0.88, "h": 0.51, "src": "OFFICIAL", "ref": ["M1"]},
        "official_with_disclaimer": {"x": 0.06, "y": 0.14, "w": 0.88, "h": 0.46, "src": "OFFICIAL per 3P", "ref": ["M3"]},
        "rail_zone": {"x": 0.79, "y": 0.60, "w": 0.21, "h": 0.40, "src": "3P", "ref": ["M3"]}
      },
      "elements": [
        {"id": "title",      "label": "Reels",                   "kind": "text",   "x": 0.04, "y": 0.035, "w": 0.20, "h": 0.04, "src": "EST"},
        {"id": "camera",     "label": "Camera",                  "kind": "icon",   "x": 0.89, "y": 0.035, "w": 0.07, "h": 0.04, "src": "EST"},
        {"id": "rail",       "label": "Action rail",             "kind": "zone",   "x": 0.86, "y": 0.58,  "w": 0.12, "h": 0.38, "src": "EST"},
        {"id": "like",       "label": "Like + count",            "kind": "icon",   "x": 0.875,"y": 0.60,  "w": 0.09, "h": 0.05, "src": "EST"},
        {"id": "comment",    "label": "Comment + count",         "kind": "icon",   "x": 0.875,"y": 0.665, "w": 0.09, "h": 0.05, "src": "EST"},
        {"id": "repost",     "label": "Repost",                  "kind": "icon",   "x": 0.875,"y": 0.73,  "w": 0.09, "h": 0.05, "src": "EST"},
        {"id": "share",      "label": "Share (send)",            "kind": "icon",   "x": 0.875,"y": 0.795, "w": 0.09, "h": 0.05, "src": "EST"},
        {"id": "more",       "label": "...",                     "kind": "icon",   "x": 0.875,"y": 0.86,  "w": 0.09, "h": 0.03, "src": "EST"},
        {"id": "audio_thumb","label": "Audio thumbnail",         "kind": "avatar", "x": 0.88, "y": 0.90,  "w": 0.08, "h": 0.045,"src": "EST"},
        {"id": "account",    "label": "Avatar + username + Follow", "kind": "pill","x": 0.04, "y": 0.80,  "w": 0.60, "h": 0.04, "src": "EST"},
        {"id": "caption",    "label": "Caption (1 line, '... more')", "kind": "text","x": 0.04,"y": 0.845,"w": 0.75, "h": 0.035,"src": "EST"},
        {"id": "audio_line", "label": "Audio / Remix line",      "kind": "text",   "x": 0.04, "y": 0.885, "w": 0.60, "h": 0.025,"src": "EST"},
        {"id": "navbar",     "label": "Home, Reels, DMs, Search, Profile", "kind": "bar", "x": 0.0, "y": 0.93, "w": 1.0, "h": 0.07, "src": "EST", "optional": true, "note": "order varies: Reels-first nav tested since Sep 2025"}
      ]
    },
    "instagram_stories": {
      "aspect": "9:16",
      "safe": {
        "official": {"x": 0.06, "y": 0.14, "w": 0.88, "h": 0.51, "src": "OFFICIAL", "ref": ["M2"]},
        "organic_rule_of_thumb": {"x": 0.0, "y": 0.13, "w": 1.0, "h": 0.74, "src": "3P", "ref": ["M4"]}
      },
      "elements": [
        {"id": "segments",   "label": "Story progress segments", "kind": "bar",    "x": 0.02, "y": 0.01,  "w": 0.96, "h": 0.004,"src": "EST"},
        {"id": "header",     "label": "Avatar + name + time",    "kind": "pill",   "x": 0.03, "y": 0.025, "w": 0.60, "h": 0.04, "src": "EST"},
        {"id": "close",      "label": "... / X",                 "kind": "icon",   "x": 0.82, "y": 0.025, "w": 0.15, "h": 0.04, "src": "EST"},
        {"id": "reply",      "label": "Send message",            "kind": "pill",   "x": 0.03, "y": 0.925, "w": 0.68, "h": 0.045,"src": "EST"},
        {"id": "reply_icons","label": "Like, Share",             "kind": "icon",   "x": 0.74, "y": 0.925, "w": 0.23, "h": 0.045,"src": "EST"}
      ]
    },
    "instagram_feed_4x5": {
      "aspect": "4:5",
      "safe": {"grid_crop_3x4": {"x": 0.031, "y": 0.0, "w": 0.938, "h": 1.0, "src": "derived from the 3:4 grid (Jan 2025)", "ref": ["M3"]}},
      "elements": []
    },
    "youtube_shorts": {
      "aspect": "9:16",
      "safe": {
        "official_ad": {"x": 0.044, "y": 0.15, "w": 0.778, "h": 0.50, "src": "OFFICIAL (Google Ads image, values per 3P)", "ref": ["Y1", "Y2"]},
        "relaxed_organic": {"x": 0.060, "y": 0.080, "w": 0.780, "h": 0.680, "src": "3P", "ref": ["Y3"]}
      },
      "elements": [
        {"id": "top_icons",  "label": "Search, more",            "kind": "icon",   "x": 0.80, "y": 0.03,  "w": 0.17, "h": 0.045,"src": "EST"},
        {"id": "rail",       "label": "Action rail",             "kind": "zone",   "x": 0.85, "y": 0.53,  "w": 0.14, "h": 0.38, "src": "EST"},
        {"id": "like",       "label": "Like (heart) + count",    "kind": "icon",   "x": 0.87, "y": 0.55,  "w": 0.10, "h": 0.055,"src": "EST", "note": "heart replaced thumbs-up; dislike retired (Jun 2026)"},
        {"id": "comment",    "label": "Comments + count",        "kind": "icon",   "x": 0.87, "y": 0.625, "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "share",      "label": "Share",                   "kind": "icon",   "x": 0.87, "y": 0.70,  "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "remix",      "label": "Remix",                   "kind": "icon",   "x": 0.87, "y": 0.775, "w": 0.10, "h": 0.055,"src": "EST"},
        {"id": "sound",      "label": "Sound thumbnail",         "kind": "avatar", "x": 0.88, "y": 0.85,  "w": 0.08, "h": 0.045,"src": "EST"},
        {"id": "channel",    "label": "Avatar + @handle",        "kind": "pill",   "x": 0.03, "y": 0.82,  "w": 0.38, "h": 0.04, "src": "EST"},
        {"id": "subscribe",  "label": "Subscribe",               "kind": "pill",   "x": 0.42, "y": 0.822, "w": 0.20, "h": 0.035,"src": "EST"},
        {"id": "title",      "label": "Title (1-2 lines)",       "kind": "text",   "x": 0.03, "y": 0.865, "w": 0.78, "h": 0.04, "src": "EST"},
        {"id": "sound_line", "label": "Sound line",              "kind": "text",   "x": 0.03, "y": 0.91,  "w": 0.60, "h": 0.025,"src": "EST"},
        {"id": "progress",   "label": "Progress bar",            "kind": "bar",    "x": 0.0,  "y": 0.993, "w": 1.0,  "h": 0.004,"src": "EST"},
        {"id": "navbar",     "label": "Home, Shorts, +, Subs, You", "kind": "bar", "x": 0.0, "y": 0.93,  "w": 1.0,  "h": 0.07, "src": "EST", "optional": true, "note": "Subscriptions tab moved to a header swipe in Nov 2026 redesign (rolling out)"}
      ]
    },
    "facebook_reels": {
      "aspect": "9:16",
      "safe": {"official_meta_reels": {"x": 0.06, "y": 0.14, "w": 0.88, "h": 0.51, "src": "OFFICIAL Meta Reels ads (not FB-specific)", "ref": ["M1", "F1"]}},
      "elements": "reuse instagram_reels boxes; FB adds a top bar (Reels title, search, profile) and an 'Add comment' style row is not confirmed"
    },
    "youtube_watch_16x9": {
      "aspect": "16:9",
      "safe": {
        "end_screen": {"note": "Google publishes no safe-area box: up to 4 elements, last 5-20 s, video >= 25 s, custom image >= 300x300 px", "src": "OFFICIAL", "ref": ["Y4"]},
        "end_screen_element_sizes_3p": {"video": {"w": 0.319, "h": 0.318}, "subscribe_circle": {"w": 0.153, "h": 0.272}, "src": "3P (613x343 vs 615x345 px disagree slightly)", "ref": ["Y5", "Y6"]}
      },
      "elements": [
        {"id": "title_overlay", "label": "Title + channel (fullscreen/embed, on hover)", "kind": "text", "x": 0.02, "y": 0.02, "w": 0.70, "h": 0.08, "src": "EST"},
        {"id": "gradient",      "label": "Bottom gradient (on hover)", "kind": "zone",   "x": 0.0,  "y": 0.78, "w": 1.0,  "h": 0.22, "src": "EST"},
        {"id": "progress",      "label": "Progress bar (thickens on hover)", "kind": "bar", "x": 0.012,"y": 0.895,"w": 0.976,"h": 0.006,"src": "EST"},
        {"id": "controls",      "label": "Play, next, volume, time | CC, settings, theater, fullscreen", "kind": "bar", "x": 0.0, "y": 0.905, "w": 1.0, "h": 0.095, "src": "EST", "note": "pill/bubble controls since Oct 2025 redesign"},
        {"id": "captions",      "label": "Closed captions (default bottom-centre)", "kind": "zone", "x": 0.15, "y": 0.78, "w": 0.70, "h": 0.11, "src": "EST", "note": "moves up while controls are visible; viewers can restyle"},
        {"id": "end_screen",    "label": "End-screen element area (last 5-20 s)", "kind": "zone", "x": 0.05, "y": 0.25, "w": 0.90, "h": 0.55, "src": "EST"}
      ]
    }
  }
}
```

**About the YouTube 16:9 player numbers:** the player chrome is in CSS pixels, not a fraction of the video. A 48 px control bar is 0.067 of a 720 px-tall player and 0.044 at 1080. The fractions above assume a roughly 720 px player and are **EST**. On TV, since the Oct 2025 redesign, the title sits top-left and the controls sit below the progress bar. On mobile landscape, the controls are grouped in a left pill (S: 9to5Google 2025-10-14).

## (c) Sources

| Ref | Source | Date | What it supports |
|---|---|---|---|
| S1 | socialync.io/tools/safe-zones/tiktok | read by site 2026-10-11 | TikTok 240/660/120/120 from TikTok In-Feed safe zone file (720x1280 scaled). Rail width 180px measured by the site |
| S2 | manypixels.co/blog/social-media-design/tiktok-ad-specs | 2026-11-11 | Same official values; anchor templates (1–4 caption lines: 812/878/946/1014px bottom); rail 1080px tall from bottom |
| S3 | adchecklab.com/articles/tiktok-safe-area-overlay-guide-2026 (formerly checksafe.zone) | updated 2026-09-28 | Rail x 780–960 from y 840; TikTok Feed.png template dated 2025-04-15; organic measured ~200/334/86/140; avatar 98x98; caption 4 lines |
| S4 | cadenus.io/resources/blog/tiktok-safe-zone | references a Jul 2026 check | 130/484/44/140 (the "industry" organic numbers) |
| S5 | ignitesocialmedia.com (via search) | undated | 108/320/60/120 |
| M1 | facebook.com/business/ads-guide/update/video/instagram-reels | read 2026-11-21 | **OFFICIAL** 14% top, 35% bottom, 6% sides |
| M2 | facebook.com/business/ads-guide/update/video/instagram-story | read 2026-11-21 | **OFFICIAL** same 14/35/6 for Stories |
| M3 | hopperhq.com/blog/instagram-reel-size | 2026-09-18 | Bottom 40% with disclaimer; rail over the rightmost 21% in the bottom 40%; 3:4 grid since Jan 2025 |
| M4 | maketecheasier / shopify Stories guides (via search) | 2026 | 250px top/bottom organic Stories rule of thumb |
| M5 | lilachbullock.com/instagram-reels-safe-zone | Oct 2026 | Says the Business Help Center safe-zone page has no numbers |
| F1 | socialync.io/tools/safe-zones/facebook-reels | 2026-10-11 | FB Reels uses the Meta Reels values; FB spec page did not load |
| Y1 | support.google.com/google-ads/answer/9128498 | read 2026-11-21 | **OFFICIAL** 1080x1920 red safe-zone image (pixel values are only inside the image) |
| Y2 | socialync.io/tools/safe-zones/youtube-shorts | 2026-10-11 | Reads Y1's image as 288/672/48/192 |
| Y3 | aicarousels.com/free-tools/youtube-safe-zone-checker | © 2026 | Organic 154/461/65/173 |
| Y4 | support.google.com/youtube/answer/6388789 | read 2026-11-21 | **OFFICIAL** end screen rules (4 elements, 5–20 s, grid and snap in Studio) |
| Y5 | collabpals.com/tools/youtube-end-screen-previewer | 2026 | Video element 613x343, "inner 80%" (unverified) |
| Y6 | dreamina.capcut.com/resource/youtube-end-screen | 2026 | 615x345 video, 294x294 subscribe |
| Y7 | blog.youtube/news-and-events/youtube-shorts-experience-updates-features | 2026-06-25 | Heart replaces thumbs-up, dislike retired, Clear Screen mode |
| Y8 | 9to5google.com/2025/10/14/youtube-video-player-redesign | 2025-10-14 | Player redesign: bubble/pill controls, "obscuring less content" |
| Y9 | 9to5google.com/2026/11/05/youtube-app-redesign-subscriptions-tab | 2026-11-05 | Subscriptions tab moved off the bottom bar (rolling out) |
| I1 | techcrunch.com/2025/09/29/instagram-is-testing-a-reels-first-ui-in-india-and-south-korea; about.fb.com 2025-09 | 2025-09 | Reels-first nav: Home, Reels, DMs, Search, Profile (test, global rollout undated) |
| T1 | macrumors.com/2026/02/11/tiktok-us-local-feed | 2026-02-11 | New Local feed tab in the US home header |

**Changes in 2025–2026 that matter for overlays:**
- TikTok: new official template file (Apr 2025) and a Local tab in the US header (Feb 2026). I found no report of the right rail or caption block moving.
- Instagram: 3:4 grid (Jan 2025); Reels-first nav test (Sep 2025).
- YouTube: player redesign (Oct 2025); Shorts heart icon, dislike removed and Clear Screen (Jun 2026); app nav reshuffle (Nov 2026).

## (d) UX notes from other editors

- **CapCut.** Desktop and mobile have a built-in **"Social media preview"**. CapCut publishes no help page for it: the name and location come from 3P sources (wildandfreetools, updated 2026-03-17), which put a phone/monitor icon at the **top-right of the preview panel** on desktop and a toolbar icon on mobile. A creator video (TikTok @_lindsalissa, ~Jul 2025) shows it previewing **TikTok, Instagram and YouTube Shorts** "so assets aren't blocked by the icons". That wording suggests drawn UI icons (a mockup), not just guide lines, but I could not confirm it from a CapCut source. A YouTube video ties new features to **CapCut PC 6.2.0**; I could not confirm whether this one is among them. CapCut's own pages otherwise push downloadable "safe zone templates" as overlay PNGs.
- **Kapwing:** pick a platform in the **right sidebar** (TikTok, Reels, Shorts, X, LinkedIn). It shows a masked overlay with borders, toggles on and off at any time, and is never exported (page © 2026, "2025 layouts").
- **Tella:** "Safe zones" in the canvas-size menu, or Layout → Adjust → Social safe zones. 9:16 only, for Reels, TikTok, Shorts and LinkedIn. It shows a **UI mockup** (top bar, buttons, caption), plus a shaded "Long captions and ads" band. The overlay **fades while you edit** and is never exported.
- **Premiere Pro:** only generic Safe Margins (action and title boxes). Social overlays need third-party panels (e.g. Premiere Copilot "Safe Zones": interface, covered-zone and common-area views) or PNGs on a top track. Users have open feature requests on Adobe Community.
- **Cap (open-source recorder, a close analog):** PR #2380 (2026-09-29, closed unmerged 2026-10-20 because of the GPUI port). A single toolbar button cycles **Off → Reels → TikTok → Shorts**. Portrait only (w/h ≤ 0.7). It shades outside the safe rectangle with a dashed border and a label, ignores pointer input, sits under the canvas handles, is remembered per device and never exported. Its insets are "deliberately approximate".
- **DaVinci Resolve, Descript, Canva:** not verified in this pass. I found no reliable current source, so I make no claim.

**Design recommendations for Syka Studio** (my synthesis):
1. One preview-toolbar control (a dropdown, not blind cycling) listing Off, TikTok, Reels, Stories, Shorts, YouTube 16:9. Offer only the formats that match the current aspect ratio.
2. Two render modes: **Guides** (shade outside the safe rect, dashed border) and **Mockup** (semi-transparent icons and text from `elements`). Tella's fade-while-editing (e.g. drop to ~30% opacity during drag/transform) is a good detail.
3. A "Strict (ads) / Relaxed (organic)" switch, and for TikTok a "caption lines 1–4" slider that drives the anchor bottom margins.
4. A "Show nav bar" toggle, off by default, explaining that tall phones keep it outside the video.
5. Never export the overlay. Ship the JSON with a `version` date and show "layout as of <date>" in a tooltip, because these UIs change several times a year.
