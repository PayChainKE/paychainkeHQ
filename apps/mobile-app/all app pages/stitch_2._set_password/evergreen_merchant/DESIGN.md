# Design System Specification: The Merchant’s Editorial

## 1. Overview & Creative North Star: "The Digital Estate"
This design system moves away from the "disruptive" noise of typical fintech and toward the quiet authority of an established estate. Our North Star is **The Digital Estate**: a visual philosophy that treats financial management like a high-end physical workspace. 

We reject the "app-in-a-box" aesthetic. Instead, we embrace **Intentional Asymmetry** and **Editorial Scale**. By pairing the structural stability of *Plus Jakarta Sans* with the poetic elegance of *DM Serif Display*, we signal to Kenyan merchants that their business isn't just a series of transactions—it is a legacy. We break the grid with overlapping "paper" layers and high-contrast typography, ensuring the UI feels curated, not generated.

---

## 2. Colors & Surface Philosophy
Our palette is rooted in the "Deep Forest" of Kenyan commerce—professional, fertile, and grounded.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders for sectioning are strictly prohibited. We define boundaries through tonal shifts. A section does not "end" with a line; it transitions into a new surface depth. 
*   Use `surface-container-low` (#f4f3f0) for secondary content areas.
*   Use `surface-container-lowest` (#ffffff) for primary interactive cards.

### Surface Hierarchy & Nesting
Treat the UI as a physical desk.
1.  **Base:** `background` (#faf9f6) – The foundation.
2.  **Middle Layer:** `surface-container` (#efeeeb) – Used for grouping related modules.
3.  **Top Layer:** `surface-container-lowest` (#ffffff) – Reserved for the most critical merchant data (e.g., Today’s Sales).

### The Glass & Gradient Rule
To prevent the UI from feeling flat, use **Glassmorphism** for floating elements like bottom navigation bars or sticky headers. 
*   **Token:** `on_secondary_container` at 80% opacity with a 20px backdrop blur.
*   **Signature Texture:** Use a subtle linear gradient (Top-Left to Bottom-Right) from `primary` (#00351d) to `primary_container` (#0b4d2e) for high-impact CTAs. This creates a "silk" finish that a flat hex code cannot replicate.

---

## 3. Typography: The Editorial Voice
We use typography to create an "Editorial Hierarchy" that guides the merchant's eye through complex financial data.

*   **Display & Headlines (The Statement):** Use *Plus Jakarta Sans* at `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero balances.
*   **The Brand Tagline:** "Collect. Pay. Grow." must always be set in *DM Serif Display*. This serif intervention breaks the "tech" feel and introduces a "High-End Financial Journal" aesthetic.
*   **Body & Labels (The Utility):** *Plus Jakarta Sans* provides a neutral, highly readable counterpoint. 

**Pro Tip:** Use `headline-sm` (1.5rem) in Bold for section headers, but pair them with `label-md` in all-caps (tracked out to +5%) to create a sophisticated, architectural look.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "digital." We use **Ambient Depth**.

### The Layering Principle
Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` background. The subtle 2% difference in brightness creates "Natural Lift."

### Ambient Shadows
When a card must float (e.g., a Modal or a Floating Action Button):
*   **Blur:** 40px to 60px.
*   **Opacity:** 4% - 8%.
*   **Color:** Use a tinted shadow. Instead of #000, use a dark variant of our forest green (`on_primary_fixed_variant`). This makes the shadow feel like it belongs to the environment.

### The "Ghost Border" Fallback
If contrast is required for accessibility, use a **Ghost Border**:
*   `outline-variant` (#c0c9c0) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Precision & Grace

### Buttons (The Merchant's Seal)
*   **Primary:** Gradient from `primary` to `primary_container`. Border-radius: `md` (1.5rem). Text: `title-sm` (Bold, White).
*   **Secondary:** `surface-container-highest` background with `on_surface` text. No border.
*   **Tertiary:** Ghost style. No background, `primary` text, with a 10% `outline-variant` underline.

### Cards & Lists (The Ledger)
*   **Forbid Dividers:** Do not use horizontal lines between list items. Use `spacing-4` (1.4rem) of vertical whitespace to separate items.
*   **Interaction:** On tap, a card should scale down slightly (0.98x) and shift background to `surface-container-high`.

### Input Fields (The Registration)
*   **Style:** Minimalist. No box. A bottom "weighted" line using `outline` (#707971) at 30% opacity. 
*   **Focus State:** The line transforms into the `secondary` (#006c4e) color at 2px thickness.

### Signature Component: The "Growth Ribbon"
A horizontal scrolling area using `DM Serif Display` for metrics, sitting on a `primary_fixed` (#b1f1c6) background. This acts as a "ticker" for merchant motivation.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use the full `xl` (3rem) corner radius for large promotional hero cards.
*   **DO** allow typography to overlap slightly with background shapes to create an editorial feel.
*   **DO** use `secondary_fixed_dim` for "Positive" states instead of standard bright green to maintain the premium palette.

### Don't
*   **DON’T** use 100% black (#000000). Use `on_background` (#1b1c1a) for all deep values.
*   **DON’T** use standard iOS blue for links. Use `accent` (#1D9E75).
*   **DON’T** crowd the edges. If you think there is enough whitespace, add `spacing-2` (0.7rem) more.
*   **DON’T** use icons with varying stroke weights. Use a consistent 1.5px or 2px "Linear" icon set.