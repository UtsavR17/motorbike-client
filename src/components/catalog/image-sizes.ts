// `sizes` for product images, matched to the layouts that render them, so the browser picks a
// file close to the rendered width. Page container: max-w-7xl (1280px) with 16/24/32px padding.

/** /parts and /bikes grids: 260px filter column from lg, 2 columns from sm, 3 from xl. */
export const LIST_CARD_SIZES = '(min-width: 1280px) 300px, (min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw';

/** Home page sections: 2 columns from sm, 4 from lg. */
export const HOME_CARD_SIZES = '(min-width: 1280px) 292px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw';

/** Part and bike detail pages: image fills one of two columns from lg. */
export const DETAIL_IMAGE_SIZES = '(min-width: 1280px) 600px, (min-width: 1024px) 50vw, 100vw';

/** Reserve page: image is 2/5 of the bike card from sm; the card shares the row with a 380px panel from lg. */
export const RESERVE_IMAGE_SIZES = '(min-width: 1280px) 325px, (min-width: 1024px) 22vw, (min-width: 640px) 40vw, 100vw';

/** How many cards at the top of a grid load eagerly (above the fold on common screens). */
export const EAGER_CARD_COUNT = 4;
