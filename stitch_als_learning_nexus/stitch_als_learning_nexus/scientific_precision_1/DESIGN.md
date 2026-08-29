---
name: Scientific Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e3'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fd'
  surface-container: '#ededf7'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e2e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#564149'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#f0f0fa'
  outline: '#897179'
  outline-variant: '#dcbfc9'
  surface-tint: '#aa2871'
  primary: '#830053'
  on-primary: '#ffffff'
  primary-container: '#a4226c'
  on-primary-container: '#ffc0d9'
  inverse-primary: '#ffafd1'
  secondary: '#894586'
  on-secondary: '#ffffff'
  secondary-container: '#fdabf4'
  on-secondary-container: '#7b3979'
  tertiary: '#263f7b'
  on-tertiary: '#ffffff'
  tertiary-container: '#3f5794'
  on-tertiary-container: '#c1d0ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd8e6'
  primary-fixed-dim: '#ffafd1'
  on-primary-fixed: '#3d0024'
  on-primary-fixed-variant: '#8b0358'
  secondary-fixed: '#ffd6f7'
  secondary-fixed-dim: '#fdabf4'
  on-secondary-fixed: '#380039'
  on-secondary-fixed-variant: '#6e2d6c'
  tertiary-fixed: '#dae2ff'
  tertiary-fixed-dim: '#b2c5ff'
  on-tertiary-fixed: '#001848'
  on-tertiary-fixed-variant: '#2b4480'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e2e2ec'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built for the **Academy for Laboratory Science (ALS)**, a premium EdTech platform that bridges the gap between academic theory and clinical practice. The brand personality is **authoritative, analytical, and high-fidelity**. It aims to evoke a sense of intellectual rigor and professional advancement.

The visual style is a sophisticated blend of **Corporate Modern** and **Glassmorphism**. It utilizes a light, spacious UI to maintain clarity—essential for complex scientific data—while employing translucent layers and subtle background blurs to create depth and a "laboratory lens" effect. The aesthetic is clean and surgical, ensuring that the educational content remains the focal point while the interface feels like a premium, state-of-the-art instrument.

## Colors

The palette is rooted in deep, scholarly tones balanced by a clinical, airy background. 
- **Berry (#A4226C)** serves as the primary action color, used for high-priority CTAs and critical status indicators.
- **Purple (#773575)** and **Deep Blue (#2A437F)** provide professional depth, used for navigational elements, secondary actions, and academic categorization.
- **Primary Text (#11131A)** ensures high legibility against the **Background (#F8F9FC)**.

Gradients should be used sparingly. Apply the **Action Gradient** to primary buttons and active progress states to draw the eye. Use the **Surface Gradient** in conjunction with backdrop filters to create the signature glassmorphic cards that house course content.

## Typography

**Plus Jakarta Sans** is the sole typeface for this design system, chosen for its modern, geometric clarity and friendly yet professional demeanor. 

- **Headlines:** Use Bold (700) weights with slightly tightened letter spacing for a compact, impactful look in course titles and module names.
- **Body:** Use Regular (400) for long-form educational content to ensure readability. 
- **Labels:** Use SemiBold (600) for metadata (e.g., "Duration," "Level") often paired with the Deep Blue color to differentiate from body text.
- **Hierarchy:** Ensure a clear vertical rhythm. Display sizes are reserved for landing pages and dashboard welcomes.

## Layout & Spacing

The design system employs a **12-column fluid grid** for desktop, transitioning to a **4-column grid** for mobile. 

- **Spaciousness:** The layout prioritizes "white space" to reduce cognitive load. Use the `stack-lg` (32px) spacing between major sections and course cards.
- **Safe Margins:** A generous 64px margin on desktop keeps the content centered and focused.
- **Consistency:** All spacing is a multiple of the 4px base unit. Internal card padding should be a minimum of 24px (`stack-md` + 8px) to maintain the "premium" feel.

## Elevation & Depth

This design system uses **Tonal Layers** combined with **Glassmorphism** to establish hierarchy.

1.  **Level 0 (Background):** Solid #F8F9FC.
2.  **Level 1 (Cards/Containers):** White background with 80% opacity and a `20px` backdrop blur. Use a subtle 1px inner border (white, 40% opacity) to simulate the edge of a glass slide.
3.  **Level 2 (Dropdowns/Modals):** Increased shadow diffusion. Use a soft, Deep Blue-tinted shadow: `0px 12px 32px rgba(42, 67, 127, 0.08)`.

Avoid heavy black shadows. Depth should feel like light passing through translucent materials in a laboratory setting.

## Shapes

The shape language is purposefully **Rounded**, moving away from the harshness of traditional scientific software. 

- **Primary Cards:** Use a 18px radius to create a soft, inviting frame for course content.
- **Interactive Elements:** Buttons and input fields use a 12px radius, providing a tactile, modern feel.
- **Indicators:** Progress bars and tags (chips) should use the "pill" shape (100px) for a distinct, organic contrast against the structured grid.

## Components

- **Course Cards:** Utilize the glassmorphic style. Feature a prominent image/icon area at the top, followed by a Berry-colored category tag, the course title in `headline-md`, and a bottom-aligned progress bar.
- **Progress Bars:** Background is a light tint of the primary color (10% opacity). The active fill uses the **Action Gradient**. Height should be a slim 6px for a refined look.
- **Buttons:** 
    - *Primary:* Action Gradient with white text and a subtle glow shadow.
    - *Secondary:* Modern outline style (1.5px) using the Deep Blue color.
- **Skeleton Loaders:** Use a shimmering pulse animation moving from #F0F2F5 to #E2E8F0. Shapes must match the 12px/18px corner radii of the components they represent.
- **Icons:** Use **Modern Outline Icons** with a consistent 1.5px stroke width. Icons should be dual-toned, using Deep Blue for the primary path and Berry for accent details (like a plus sign or a checkmark).
- **Input Fields:** 12px radius, light gray border (#E2E8F0). On focus, the border transitions to Deep Blue with a soft 4px outer glow.