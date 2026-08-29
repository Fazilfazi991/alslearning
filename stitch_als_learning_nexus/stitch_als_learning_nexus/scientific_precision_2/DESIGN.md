---
name: Scientific Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#EDEDF7'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e1ed'
  on-surface: '#191b23'
  on-surface-variant: '#564149'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
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
  surface-variant: '#e1e1ed'
  surface-main: '#FAF8FF'
  live-indicator: '#BA1A1A'
  verification-gold: '#C5A059'
  chart-grid: '#E2E2EC'
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
  mono-data:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1280px
---

## Brand & Style
The design system is engineered for the **Academy for Laboratory Science (ALS)**, targeting medical professionals and researchers who value intellectual rigor and high-fidelity data. The brand personality is **authoritative, analytical, and surgical**, evoking the cleanliness of a state-of-the-art clinical environment.

The visual style is a fusion of **Corporate Modern** and **Glassmorphism**. It leverages a "Laboratory Lens" aesthetic—utilizing spacious layouts, translucent surface layers, and high-precision typography to make complex scientific information digestible. The emotional response is one of trust and clarity, ensuring the user feels they are using a professional-grade instrument rather than a standard educational tool.

## Colors
The palette is rooted in scholarly depth and clinical airiness.
- **Berry (#A4226C)**: The primary action color for critical CTAs, active progress states, and high-priority live indicators.
- **Purple (#773575) & Deep Blue (#2A437F)**: Used for academic categorization, navigation, and secondary interactive states.
- **Analytics Palette**: Use a logical sequence of the Primary, Secondary, and Tertiary hues for data visualization. Charts should utilize a "De-saturated Neutral" (#E2E2EC) for grid lines to keep focus on data points.
- **Verification & Prestige**: For certificates and stamps, introduce a **Verification Gold (#C5A059)** to signal achievement and institutional authenticity.

## Typography
**Plus Jakarta Sans** provides geometric clarity.
- **Headlines**: Use Bold (700) weights with tight letter spacing to mirror the density of scientific journals.
- **Analytics/Data**: For chart labels and numeric data, use the `mono-data` style (SemiBold) to ensure digit alignment and readability in dense tables.
- **Body Content**: Maintain a generous 1.5x line height for educational long-form text to reduce eye strain during extended study sessions.

## Layout & Spacing
The design uses a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 
- **The 4px Rule**: All dimensions, padding, and margins must be multiples of 4px.
- **Dashboard Layout**: Use a fixed-width left navigation (280px) and a fluid content area.
- **Analytical Spacing**: In data-heavy views, reduce vertical stacking to `stack-sm` (8px) for related data points, but maintain `stack-lg` (32px) between unrelated sections to prevent visual clutter.

## Elevation & Depth
Depth is created through "Laboratory Layers"—simulating the stacking of glass slides.
- **Surface**: The base layer is a solid clinical white (#FAF8FF).
- **Glassmorphic Tier**: Cards and overlays use 80% opacity with a `20px` backdrop blur and a `1px` inner stroke (White, 40% opacity).
- **Shadow Character**: Shadows are infrequent and highly diffused. Use a Deep Blue tint: `0px 12px 32px rgba(42, 67, 127, 0.08)`.
- **Live State Elevation**: Live class containers should feature a subtle "pulse" glow using the Berry color to indicate real-time activity.

## Shapes
Shapes balance precision with approachability.
- **Core Radius**: 0.5rem (8px) for standard UI controls like inputs and buttons.
- **Container Radius**: 1rem (16px) for major course cards and certificate frames.
- **Indicators**: Progress bar fills and status badges (e.g., "Live") must use the **Pill (full)** radius for high contrast against the rectangular grid.
- **Analytics**: Chart bars should have a subtle 4px top-radius to soften the data visualization.

## Components
- **Live Indicators**: A "LIVE" badge using `label-sm`, Pill-shaped, with a Berry (#A4226C) background and a radiating 2px outer pulse animation.
- **Chat Bubbles**: Modern glassmorphic style. Student messages use a Secondary Container (#FDABF4) tint; Instructor messages use a Tertiary Container (#3F5794) with white text to signify authority.
- **Certificates**: Feature a `2px` double-border in Verification Gold. A "Verified" stamp component should be circular, using a subtle rotation (-15deg) and a vector-based "ALS" seal.
- **Progress Bars**: 6px height. The background is a 10% tint of Berry, with the active fill utilizing a linear gradient from Berry (#A4226C) to Purple (#773575).
- **Analytics Charts**: Line charts use a 2px stroke width with points highlighted by white-centered "donuts" in the Berry primary color.
- **Input Fields**: Focus state includes a `4px` soft outer glow in Deep Blue to guide the user's attention.