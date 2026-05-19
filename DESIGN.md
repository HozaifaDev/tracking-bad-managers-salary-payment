---
name: Hours Tracker
description: Track unpaid work, hold managers accountable
colors:
  accent: "#0d8f84"
  accent-bright: "#2cc4b5"
  carbon: "#171c2c"
  carbon-muted: "#7b8294"
  glacial: "#f1f4f9"
  glacial-elevated: "#f9fafb"
  cool-border: "#dfe3eb"
  deep: "#141822"
  deep-elevated: "#1c2130"
  deep-border: "#2a3040"
  steel-light: "#eff1f5"
  steel-muted: "#9198a8"
  success: "#158a6e"
  success-bright: "#2bb893"
  warning: "#b9850b"
  warning-bright: "#d4a12e"
  danger: "#c93c37"
  danger-bright: "#e04e48"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#f0fefa"
    rounded: "{rounded.md}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "#0a7a70"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.carbon-muted}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.glacial-elevated}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0 12px"
---

# Design System: Hours Tracker

## 1. Overview

**Creative North Star: "The Focused Ledger"**

A drafting table under a single focused lamp. Every mark is deliberate. Shadows are soft and ambient, never sharp. Contrast carries the hierarchy. The tool recedes; the numbers stay.

This system serves one job: making unpaid hours and owed money instantly legible. The palette is restrained, cool, and precise. One accent (electric teal) marks interactive elements and primary actions. Neutrals are tinted toward blue, never pure gray. Surfaces are flat with tonal shifts rather than shadows. Typography uses weight and size contrast, not color decoration. Components are tight, precise, and predictable. No hero metrics. No gradient cards. No decorative motion. If Linear and Raycast had a financial accountability tool, this is how it would look and feel.

**Key Characteristics:**
- Restrained color: one accent, tinted neutrals, semantic tones only where data demands
- Flat by default: tonal layering for depth, no shadows at rest
- Tight and precise: 4-6px radii, compact padding, dense information
- Dark-native: both themes designed from scratch, not inverted
- Numbers as the primary visual: weight and size carry the story, not color swatches
- WCAG AAA contrast across all themes

## 2. Colors

Restrained palette with one accent. The teal carries all interactive weight; neutrals are cool-tinted to maintain cohesion. Semantic colors appear only on data (earned, paid, owed, flagged) and state (success, warning, danger). No decorative color anywhere.

### Primary
- **Electric Teal** (#0d8f84 / oklch(52% 0.135 185)): Primary actions, links, active navigation, focus rings, the single interactive accent. Used on less than 10% of any surface. Never used as background fill for content areas.

### Secondary
- **Electric Teal Bright** (#2cc4b5 / oklch(62% 0.14 185)): Hover state on primary buttons and active accent in dark mode where the base teal does not provide enough contrast against dark surfaces.

### Neutral (Light)
- **Glacial** (#f1f4f9 / oklch(97.5% 0.005 250)): Page background. Cool-tinted, never pure white.
- **Glacial Elevated** (#f9fafb / oklch(99% 0.003 250)): Card and panel surfaces. One shade lighter than background, creating tonal depth without shadows.
- **Carbon** (#171c2c / oklch(14% 0.013 255)): Primary text color in light mode. Deep, cool-tinted black. Never #000.
- **Carbon Muted** (#7b8294 / oklch(55% 0.01 250)): Secondary text, labels, and placeholders.
- **Cool Border** (#dfe3eb / oklch(90% 0.007 250)): All borders, dividers, and input strokes in light mode.

### Neutral (Dark)
- **Deep** (#141822 / oklch(13% 0.011 255)): Page background. Near-black with a blue undertone. Never #000.
- **Deep Elevated** (#1c2130 / oklch(17% 0.011 255)): Card, panel, and sidebar surfaces. Tonal lift for depth.
- **Steel Light** (#eff1f5 / oklch(95% 0.005 250)): Primary text in dark mode. Cool-tinted white. Never #fff.
- **Steel Muted** (#9198a8 / oklch(60% 0.01 250)): Secondary text and labels in dark mode.
- **Deep Border** (#2a3040 / oklch(24% 0.01 250)): All borders and dividers in dark mode.

### Semantic
- **Deep Teal** (#158a6e / oklch(48% 0.12 160)): Earned/success states in light mode. Bright variant (#2bb893) for dark mode.
- **Warm Gold** (#b9850b / oklch(55% 0.13 75)): Warning and flagged-item states in light mode. Bright variant (#d4a12e) for dark mode.
- **Coral Red** (#c93c37 / oklch(50% 0.155 25)): Danger, owed-balance, and destructive actions in light mode. Bright variant (#e04e48) for dark mode.

**The One Accent Rule.** Electric teal is the only decorative accent. It marks primary buttons, active navigation, links, focus rings, and selection states. No other hue appears as surface decoration. Semantic colors (teal-success, gold-warning, coral-danger) appear only on data values and state indicators, never as background fills for content areas or cards.

## 3. Typography

**Body Font:** Inter (-apple-system, BlinkMacSystemFont, system-ui, sans-serif)
**Label Font:** Same family, distinguishing through weight, size, and tracking rather than a different face.

**Character:** A single geometric sans tuned for data density. Inter was designed for screens and handles tabular figures, small sizes, and weight contrast well. The hierarchy comes from weight jumps (400 to 600 to 700) and size steps, not from introducing a display face.

### Hierarchy
- **Display** (700, 1.5rem/24px, 1.2 line-height): Page titles only. "Dashboard", "Sessions", "Monthly breakdown". One per page, never repeated.
- **Headline** (600, 1.125rem/18px, 1.3 line-height): Card headers and section labels. Pairs with Display at a 1.33 ratio.
- **Title** (600, 0.875rem/14px, 1.4 line-height): Table headers, inline labels, form labels. The workhorse weight.
- **Body** (400, 0.875rem/14px, 1.6 line-height): All running text, descriptions, table cell content. Capped at 65-75ch for prose areas.
- **Label** (500, 0.75rem/12px, 0.02em letter-spacing): Badges, tags, timestamps, pagination info. Always uppercase tracking when used as a standalone label; sentence case inline.

**The Weight-Step Rule.** Every level transition must include a weight jump of at least 200 (400 to 600, 600 to 700). Flat weight across sizes creates noise, not hierarchy.

## 4. Elevation

Flat by default. The system uses tonal layering, not shadows, to convey depth. Background shifts by 4-6% lightness between layers are sufficient to distinguish content from chrome.

- **Page background** is the base layer.
- **Cards and panels** sit on the elevated surface (one step lighter in light mode, one step darker in dark mode), separated by 1px cool-toned borders.
- **Active/hover states** use a subtle background shift (2-3% lightness) rather than a shadow lift.

### Shadow Vocabulary
No shadows at rest. The only shadow in the system is for modals and dropdowns, which need separation from the page layer:

- **Modal lift** (box-shadow: 0 25px 50px -12px oklch(13% 0.01 255 / 0.25)): Dialogs and overlays. More blur, less offset. Appears behind the surface, not under it.

**The Flat-By-Default Rule.** Surfaces are flat at rest. No elevation shadow on cards, no hover shadows on buttons, no shadow on tables. Modal lift is the only exception.

## 5. Components

### Buttons
- **Shape:** Tight 6px radius. Compact vertical padding (8px for default, 6px for sm). No excessive horizontal padding.
- **Primary:** Electric teal background (#0d8f84), near-white text (#f0fefa). Hover darkens to #0a7a70. Focus: 2px teal ring offset by 2px.
- **Outline:** Transparent background, cool border stroke, carbon text. Hover: filled with glacial background. Dark: same pattern with deep-border and steel-light text.
- **Ghost:** No border, no background, carbon-muted text. Hover: subtle glacial background fill.
- **Destructive:** Coral red background (#c93c37), white text. Used only for irreversible actions (delete).
- **Size scale:** default (36px height), sm (32px height). No lg variant needed in this context.

### Cards / Containers
- **Corner Style:** 8px radius (lg), one step softer than buttons.
- **Background:** Glacial Elevated in light, Deep Elevated in dark. Never the same as the page background.
- **Border:** 1px cool-border in light, 1px deep-border in dark.
- **Shadow Strategy:** None at rest. Flat-by-default rule applies.
- **Internal Padding:** 24px (px-6 py-6). CardHeader gets vertical padding only; CardContent gets bottom padding only.

### Inputs / Fields
- **Style:** 1px border (cool-border light, deep-border dark), transparent background, 6px radius, 36px height.
- **Focus:** 2px electric teal ring, 2px offset. The ring color matches the single accent identity.
- **Disabled:** 50% opacity, cursor-not-allowed. No border color change.
- **Error:** 1px coral-red border, coral-red helper text below.

### Navigation (Sidebar)
- **Light mode:** Glacial tone, slightly cooler and darker than page bg (oklch(95% 0.006 250)). Active item gets teal background with white text. Inactive items in carbon-muted.
- **Dark mode:** Deep Elevated tone. Active item gets teal background (slightly desaturated for dark) with white text. Inactive items in steel-muted.
- **Width:** 224px (w-56). Fixed left, content scrolls independently.
- **Active indicator:** Filled background, not a side stripe.

### Chips / Badges
- **Default (teal):** Teal-10% tint background with teal-700 text. Dark: teal-20% tint background with teal-300 text.
- **Muted (gray):** Glacial background with carbon-muted text. Dark: deep-border background with steel-muted text.
- **Success / Warning / Danger:** Same pattern as Default but with respective semantic tint backgrounds and semantic text colors. Never use the pure accent on badge backgrounds.

## 6. Do's and Don'ts

### Do:
- **Do** use electric teal as the single accent for all interactive elements. Its rarity makes it powerful.
- **Do** use weight jumps (400 to 600 or 600 to 700) to create hierarchy. The Weight-Step Rule.
- **Do** use tonal shifts (4-6% lightness) between page background and card surfaces to convey depth.
- **Do** ensure all color pairs meet WCAG AAA contrast ratios (7:1 for normal text, 4.5:1 for large text).
- **Do** use semantic colors exclusively on data values and state (earned = teal, owed = coral, flagged = gold).
- **Do** design dark and light themes as equal citizens, not inversions. Each has its own calibrated palette.
- **Do** keep spacing rhythm varied. 4, 8, 16, 24, 32, 48. Repeating the same gap everywhere is monotony.

### Don't:
- **Don't** use side-stripe borders (border-left/right wider than 1px) as colored accents on cards or rows. This is the flag-pattern SaaS cliché. Use background tints instead.
- **Don't** create hero-metric cards: big number, small label, gradient accent. This is explicitly the SaaS dashboard anti-pattern.
- **Don't** apply gradient text (background-clip: text with gradient). Use solid colors and weight for emphasis.
- **Don't** use shadows on cards or buttons at rest. Shadows only on modals and dropdowns.
- **Don't** use pure black (#000) or pure white (#fff). All neutrals are cool-tinted toward 250 hue.
- **Don't** use identical-card grids with the same icon-heading-text pattern repeated endlessly. Vary size and weight to break monotony.
- **Don't** animate CSS layout properties. State transitions at 150-250ms with ease-out curves only.
- **Don't** use decorative motion that does not convey state. No page-load orchestrations.
- **Don't** use bright pastels, emoji, illustrations, or confetti. The anti-reference is clear: no playful or cute elements.
- **Don't** use the accent color as a background fill for content areas. Teal is for interactive elements only (The One Accent Rule).