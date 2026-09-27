# Campus Customs — Design Refresh (Problem 10)

## References

- **Campus Customs** ([campuscustoms.com](https://www.campuscustoms.com/)): the real store's story. It opened in **1975** as a Yale memorabilia shop directly across from campus and is still in that spot. That became the headline, "Bulldog blue, worn every day since 1975."
- **Yale identity** ([yale.edu](https://www.yale.edu), [Yale web identity](https://yaleidentity.yale.edu/web)):
  - **Yale Blue `#00356b`** with its blue tints and Yale grays.
  - Serif headings with a humanist sans for body text, standing in for Yale's own typefaces.
  - The Bulldog **Y** mark (the image you provided) as the logo and favicon, and as Dan.
- **Coral Gardeners** ([coralgardeners.org](https://coralgardeners.org)): a full-bleed hero with stacked headline lines, image cards with overlaid text, a scrolling ticker, impact numbers, big photography, and motion tied to scrolling.

## What changed

| Area | Change |
|---|---|
| **Brand system** | Yale Blue palette, plus the periwinkle from the Y mark and warm paper and cream backgrounds. **EB Garamond** headings (a stand-in for the Yale serif) and **Source Sans 3** body text (a stand-in for Mallory). Clear hierarchy: small uppercase labels → large serif headline → sans-serif body. |
| **Header** | A scrolling announcement bar ("Officially licensed · On Broadway since 1975 · Ask Dan…"). A logo lockup ("Campus Customs / Yale Bulldog Blue"). The header is transparent over the Home hero and turns into a frosted solid bar once you scroll. Nav links get an animated underline, and Create Account is a solid button. |
| **Home** (Coral Gardeners-style motion) | 1. **Hero:** each headline line slides up out of a mask as the page loads; a product-photo collage drifts at different speeds, and a faint Bulldog Y turns slowly as you scroll. 2. A **serif ticker** ("Boola Boola ✦ Beat Harvard…"). 3. **Category cards** with overlaid text that zoom on hover. 4. A **pinned horizontal gallery**: scrolling down slides the collection sideways. 5. **Impact numbers** that count up (1975 · 102 styles · 14 colleges · 6 sizes). 6. **Meet Dan**: the photo's mask opens as you scroll. 7. Fan favorites. 8. A "Visit 57 Broadway" band. |
| **Shop** | An editorial header ("All Yale gear"), and the filter bar stays pinned below the header while you scroll. Products appear as full-bleed photo cards with serif names, hover lift and zoom, and color swatches. Chat results are labelled "Dan found these for you". |
| **Product page** | The large image stays pinned beside the details. The price is in large serif type, with tactile size buttons. A new **"Ask Dan about this"** button opens the chat and asks about the selected size automatically. A shimmer placeholder shows while the page loads. |
| **About / Auth / 404** | About is an editorial story told in three chapters, with parallax photos and slide-in text. Log In and Create Account are split screens with a blue brand panel ("Save your chats with Dan…"). The 404 page says "This page ran off the field." |
| **Chat: "Dan"** | The Bulldog avatar is on the launcher ("Ask Dan", with a small periodic wiggle), in the header ("Dan · Campus Customs bulldog · replies in seconds", with an online dot), and beside every reply. There is a bouncing three-dot typing indicator, bubbles and chips that animate in, and a panel that springs open from the corner. The agent's prompt now makes it **Dan** ("Hi! I'm Dan… Woof!"). "Ask Dan" buttons on Home, About, the product page, and the footer all open him. |
| **Footer** | A full footer with the brand, shop categories, account links, "Chat with Dan", and the store address. |
| **Accessibility and phones** | All motion switches off when "reduce motion" is set in system settings. Keyboard focus is always visible. On phones the nav becomes a single row you can swipe, the chat opens full-width, and nothing scrolls sideways at 390 px wide. |

The scroll effects use no animation library: a small hook writes each section's scroll position as a CSS variable, with no React re-render on scroll, and fade-ins trigger when a section scrolls into view (`frontend/src/motion/`).

## How it helps shoppers stay and buy

- **Trust at first glance.** Yale Blue, the Bulldog Y, "officially licensed," and "since 1975, across from campus" all say *authentic shop*, which matters to shoppers wary of knock-offs.
- **Motion that pulls people down the page.** Each scroll reveals something new (the collage, the sideways-moving collection, the numbers, Dan), so visitors keep scrolling past the first screen and see more products.
- **Short paths to products.** The hero, category cards, gallery, fan favorites, and footer all link straight into the shop or a filtered category, and the filter bar stays in reach while scrolling. Fewer clicks to the item means fewer shoppers giving up.
- **Better product presentation.** Big edge-to-edge photos, a pinned product image, and clear stock by size ("Only 2 left") answer "what does it look like, and can I get my size?" without leaving the page. Low-stock labels also add a little urgency.
- **A friendly guide at the moment of doubt.** Dan is a recognizable mascot rather than a generic bot icon, so shoppers are more willing to ask. "Ask Dan about this" puts him where purchase questions come up, and he answers from live stock.
- **A reason to create an account.** The login screens pitch a concrete benefit ("save your chats with Dan"), so returning shoppers can pick up where they left off.

Screenshots: [home hero](screens/10_home_hero.png) · [pinned gallery](screens/10_pinned_gallery.png) · [stats](screens/10_stats.png) · [shop](screens/10_shop.png) · [Dan](screens/10_dan_chat.png) · [phone](screens/10_mobile_home.png)
