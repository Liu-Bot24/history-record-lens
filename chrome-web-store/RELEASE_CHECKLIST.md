# Chrome Web Store Release Checklist

## Before Packaging

- Confirm `public/manifest.json` version matches the release version.
- Run `npm test -- --run`.
- Run `npm run build`.
- Validate all `public/_locales/*/messages.json` files are valid JSON.
- Confirm localized titles and descriptions still fit Chrome Web Store limits.
- Confirm store-only listing languages in `chrome-web-store/STORE_LISTING.md` stay aligned with the actual feature set.
- Confirm the privacy policy URL is reachable.

## Assets

- `store-assets/store-icon-128.png`
- `store-assets/small-promo-440x280.jpg`
- `store-assets/top-promo-1400x560.jpg`

If the store listing later needs screenshots, keep them in `store-assets/` or add them to this checklist explicitly.

## Upload Package

Use:

`releases/history-record-lens-v1.0.3-cws.zip`

Recommended command:

`npm run pack:store`

The ZIP should contain `manifest.json` at the package root.

The ZIP should include `_locales/` because the extension name and description are localized.

Current extension package locales:

- `en`
- `zh_CN`

Store listing locales can be broader than the extension UI locales.

The ZIP should not contain:

- `.git`
- `docs/`
- `node_modules/`
- `src/`
- `releases/`
- `chrome-web-store/`
- `README.md`
- `README-en.md`
- `store-assets/`
- `*.map`
- `.DS_Store`

## Store Listing

Use `chrome-web-store/STORE_LISTING.md` for titles, summaries, and descriptions.

Use `chrome-web-store/DATA_PRIVACY.md` for the data privacy questionnaire and permission explanations.

## After Upload

- Load the package in a Chrome Web Store draft.
- Verify the default English listing.
- Verify Simplified Chinese localized title and description.
- Verify Japanese, Hindi, Indonesian, Brazilian Portuguese, Spanish, and Korean listing text before publishing those locales.
- Confirm the uploaded ZIP expands with `manifest.json` at the root.
- Confirm promotional images render at the expected sizes.
- Keep Chrome Web Store upload packages out of GitHub Releases unless a release specifically requires them.
