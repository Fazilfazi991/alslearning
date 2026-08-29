---
name: 'Scientific Precision: Examination'
colors:
  surface: '#faf8ff'
  surface-dim: '#dbd9e0'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3fa'
  surface-container: '#efedf4'
  surface-container-high: '#e9e7ee'
  surface-container-highest: '#e3e1e8'
  on-surface: '#1a1b20'
  on-surface-variant: '#554149'
  inverse-surface: '#2f3035'
  inverse-on-surface: '#f2f0f7'
  outline: '#887179'
  outline-variant: '#dbbfc9'
  surface-tint: '#a92a71'
  primary: '#5b0038'
  on-primary: '#ffffff'
  primary-container: '#830053'
  on-primary-container: '#ff88c0'
  inverse-primary: '#ffafd1'
  secondary: '#445c9a'
  on-secondary: '#ffffff'
  secondary-container: '#a2bafe'
  on-secondary-container: '#304985'
  tertiary: '#5b0038'
  on-tertiary: '#ffffff'
  tertiary-container: '#830053'
  on-tertiary-container: '#ff88c0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd8e6'
  primary-fixed-dim: '#ffafd1'
  on-primary-fixed: '#3d0024'
  on-primary-fixed-variant: '#890958'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b2c5ff'
  on-secondary-fixed: '#001848'
  on-secondary-fixed-variant: '#2b4480'
  tertiary-fixed: '#ffd8e6'
  tertiary-fixed-dim: '#ffafd1'
  on-tertiary-fixed: '#3d0024'
  on-tertiary-fixed-variant: '#8b0358'
  background: '#faf8ff'
  on-background: '#1a1b20'
  surface-variant: '#e3e1e8'
  success-emerald: '#059669'
  warning-amber: '#F59E0B'
  error-warm-red: '#DC2626'
  status-answered: '#2A437F'
  status-unanswered: '#D9D9E3'
  status-flagged: '#A4226C'
typography:
  assessment-question:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 34px
  assessment-question-mobile:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  option-text:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  exam-header:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  meta-label:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  assessment-gap: 48px
  option-padding: 20px
  sidebar-width: 320px
  container-tight: 800px
---

## Brand & Style
The examination experience within the design system evolves the "laboratory lens" aesthetic into a high-stakes, focused environment. The personality is **calm, precise, and unobtrusive**, minimizing cognitive noise to prioritize student performance. 

The design style is a refined **Corporate Modern** approach with **Minimalist** tendencies. It retains the signature light and spacious feel of the parent system but introduces stricter visual discipline. Glassmorphism is reserved for global navigation and high-level feedback, while the core assessment area uses a clean, paper-like surface logic to ensure maximum concentration. The emotional response should be one of "quiet confidence"—providing the user with all necessary tools and status indicators without overwhelming the primary task of critical thinking.

## Colors
The color palette for examinations is functional and semantic. The background remains **Surface (#FAF8FF)** to maintain the light, clinical atmosphere. 

Status colors are meticulously calibrated:
- **Success/Pass:** Emerald Green is used for completion and positive results.
- **Warning/Low Time:** A subtle Amber is reserved for the timer and cautionary alerts, avoiding high-stress vibrations.
- **Error/Needs Improvement:** A Warm Red provides clear feedback on incorrect responses or system errors without appearing overly punitive.
- **Navigation Toggles:** Answered states utilize **Deep Blue (#2A437F)** for strong visual confirmation, while **Surface-dim** represents the neutral, unanswered state. **Berry (#A4226C)** is strictly used for "Flagged" items to ensure they stand out as high-priority review tasks.

## Typography
To facilitate the reading of complex scientific scenarios and long-form questions, the design system introduces **Source Serif 4** for primary assessment content. The transition from sans-serif interface elements to serif question text signals a shift into "deep reading" mode.

- **Question Text:** Set in `assessment-question` using Source Serif 4. The increased line height (34px) and organic serif letterforms reduce eye strain during prolonged testing sessions.
- **Answer Options:** Utilize **Plus Jakarta Sans** in a medium weight to provide a clean, modern contrast against the question text, making the interactive elements feel distinct from the narrative content.
- **Metadata:** Captions, question numbers, and timer displays use all-caps labels with increased letter spacing to maintain an analytical, instrument-like appearance.

## Layout & Spacing
The examination layout adopts a **Fixed Grid** model to prevent line lengths from becoming excessively long, which can hinder reading comprehension.

- **Main Content:** Centered in a `container-tight` (800px) column to keep the eye focused on the vertical flow of the assessment.
- **Sidebar:** A fixed 320px sidebar on the right (on desktop) houses the question navigator, timer, and flagging tools. 
- **Reflow:** On mobile, the sidebar collapses into a bottom sheet or a top-bar drawer to maximize vertical space for the question.
- **Rhythm:** Use `assessment-gap` (48px) between the question stem and the set of options to create a clear structural break.

## Elevation & Depth
In the exam experience, elevation is used to denote interactivity and state change rather than pure aesthetic depth.

- **The Assessment Stage:** The primary question area is flat (Level 0) to minimize distractions.
- **Option Cards:** Use **Low-Contrast Outlines**. A subtle 1px border (#D9D9E3) is the default state.
- **Elevated States:** Only the "Selected" option and the active "Navigator Card" should receive a subtle shadow (Deep Blue tint) to indicate they are currently in focus or active.
- **Overlays:** Modals for "Submit Exam" or "Time Expired" should utilize the signature Glassmorphic style with a `32px` backdrop blur to momentarily pause the assessment flow.

## Shapes
The design system maintains the **Rounded** (0.5rem) language for standard components but adapts it for the specific needs of an assessment.

- **Option Cards:** Use the `rounded-lg` (1rem) radius. This creates a clear "capsule" for each answer choice, making them feel like distinct, selectable touch targets.
- **Question Navigator:** The grid of question numbers uses `rounded-md` (0.75rem) squares to maintain a technical, systematic feel.
- **Utility Buttons:** Buttons for "Next" and "Previous" follow the standard 12px radius from the parent system to maintain consistency across the platform.

## Components

### Assessment Option Cards
The most critical component of the experience.
- **Default:** White background, 1px `surface-dim` border.
- **Hover:** Background shifts to `surface-container-low`, border color stays neutral.
- **Selected:** Background becomes a 5% tint of **Deep Blue (#2A437F)**, border weight increases to 2px using the solid Deep Blue. A checkmark icon appears in the trailing edge.
- **Focused (Keyboard):** A 3px outer glow in **Deep Blue** with 20% opacity.

### Question Navigator
A grid of 40x40px tiles representing each question.
- **Answered:** Solid Deep Blue background with white text.
- **Unanswered:** `surface-dim` background with `on-surface-variant` text.
- **Flagged:** Berry (#A4226C) top-right corner "dog-ear" or a small dot indicator.
- **Current:** Thick 2px bottom border or a high-contrast outline.

### Progress & Timer
- **Timer:** Uses the **Warning-Amber** color only when the remaining time is less than 10%. Otherwise, it remains `on-surface`.
- **Progress Bar:** A slim 4px bar fixed to the top of the viewport. The fill uses the **Action Gradient** to provide a subtle sense of momentum.

### Action Bar
A fixed footer containing "Back," "Flag," and "Next" buttons. This area uses the Glassmorphic level 1 style (80% opacity, blur) to allow the assessment content to scroll behind it while keeping primary controls accessible.