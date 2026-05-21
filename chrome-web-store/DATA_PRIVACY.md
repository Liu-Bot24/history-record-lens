# Chrome Web Store Data And Privacy Notes

## Single Purpose

Help users find, review, and clean local Chrome browsing history, including AI-assisted recall and website-list-based cleanup workflows.

## Permission Justification

`history`

Used to read local Chrome browsing history for search and AI-assisted recall, and to delete matching local history records during one-click cleanup or automatic cleanup.

`storage`

Used to store website lists, cleanup settings, model-service configuration, language preference, and other interface preferences in the user's browser.

`tabs`

Used to read the active tab when the user adds the current website to the cleanup list, and to detect matching tabs for automatic cleanup when a site is closed.

`sidePanel`

Used to open the extension UI inside the Chrome side panel.

`favicon`

Used to display site icons in history and website-list views.

Optional host permissions for `https://*/*` and `http://*/*`

Used only when the user chooses to test or call a model API endpoint. The extension requests access to the user-configured API host so it can send AI query or connection-test requests.

## Data Handling

The extension reads Chrome browsing-history records such as page title, URL, visit time, visit count, and typed count.

Website lists, cleanup rules, model-service settings, and interface preferences are stored locally in the browser.

When the user explicitly configures a model service and runs an AI query or connection test, the extension sends a request to that model API. The request may include filtered browsing-history records that match the user's current search scope.

The extension does not send browsing-history data to developer-operated servers.

The extension does not sell data, does not use data for advertising, and does not transfer data to third parties except the user-configured model service.

The extension does not execute remote code.

## User-Facing Privacy Policy

- English: `PRIVACY-en.md`
- Chinese: `PRIVACY.md`
