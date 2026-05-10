<div align="center">

# History Record Lens

Languages: [简体中文](README.md) · [English](README-en.md)

</div>

History Record Lens is a Chrome side panel extension for finding, recovering, and cleaning local browsing history. It is designed for two common needs: using an AI model to recall pages from fuzzy memory, and maintaining a website list for quick access plus one-click history cleanup.

## Features

- Search local Chrome browsing history, with filters for the past hour, past day, past seven days, or a custom date range.
- Use an OpenAI-compatible model API for semantic history recall when you remember the idea of a page but not its exact title or keywords.
- Configure multiple model services by setting the API endpoint, API key, and model name.
- Maintain a website list and add frequently used sites to quick access.
- Clean Chrome local browsing history for selected sites with one click.
- Enable automatic cleanup so matching history is cleaned when those sites are closed.

## Installation

1. Download the latest extension ZIP from GitHub Releases.
2. Extract it to a stable local folder.
3. Open `chrome://extensions/` in Chrome.
4. Turn on “Developer mode”.
5. Click “Load unpacked” and select the extracted extension folder.

## Usage

### AI History Recall

1. Enter a keyword in the search box if you want to narrow the history list first.
2. Choose a time range, or keep it as “All time”.
3. Describe what you remember in the AI query field, for example: “I saw a tool or tutorial page a few days ago but cannot remember its name.”
4. Configure or select a model service, then click “AI Query”.

AI queries send the currently filtered history records to the model service you configure. If browsing history contains sensitive information, some models may reject the request because of their content safety policy. In that case, clean the history records or switch to another model.

### One-Click History Cleanup

The website list uses one site per line:

```text
YouTube, https://www.youtube.com, youtube.com, youtu.be
bilibili, https://www.bilibili.com, bilibili.com
```

The first value is the site name, the second value is the URL opened by quick access, and the remaining domains are used to match and clean browsing history. You can also click “Add Current Site” to add the current website.

In the list, the star controls whether a site appears in quick access, and the shield controls whether it is included in one-click cleanup. Cleanup only affects Chrome local browsing history. It does not clear cookies, cache, Local Storage, or watch/search history stored inside website accounts.

## Model Configuration

| Setting | Description |
| --- | --- |
| API Endpoint | OpenAI-compatible API endpoint, such as `https://api.openai.com/v1` |
| API Key | Your model service API key |
| Model Name | The model ID to call |

The API key is stored in local browser extension storage. Use it only on trusted devices, and make sure the API service you configure is trustworthy.

## Permissions

- `history`: read and delete Chrome local browsing history.
- `storage`: save website lists, model configuration, and interface preferences.
- `tabs`: read the current tab for adding the current site and automatic cleanup after closing matching sites.
- `sidePanel`: open the extension interface in the Chrome side panel.
- `favicon`: display website icons.
- Optional host permissions: requested only for the API domain you configure when testing or calling a model service.
