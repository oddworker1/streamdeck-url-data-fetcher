# URL Data Fetcher for Stream Deck

Stream Deck plugin for turning JSON endpoints into live tiles.

## What it does

- Fetches JSON from a user-provided URL
- Reads the specific value the user wants by JSON path
- Renders the value on a custom Stream Deck tile
- Flashes the tile when the value moves over or under configured thresholds
- Opens a user-defined URL when the key is pressed

## Free vs Pro

Free:

- Refresh every `5`, `10`, `15`, `30`, or `60` minutes
- Focused icon set
- Warning flashes and click-through URL support

Pro:

- Refresh in seconds or minutes
- Full icon library
- Same warning and click-through workflow with faster monitoring

## Development

Install dependencies:

```bash
npm install
```

Useful commands:

```bash
npm run typecheck
npm run build
npm run validate:variants
npm run sd:doctor
npm run sd:dev:free
npm run sd:dev:premium
npm run pack:variants
```

## Repo layout

- `src/plugin` - Stream Deck plugin runtime
- `src/pi` - property inspector UI
- `src/core` - fetching, rendering, warning, and variant logic
- `scripts` - build, asset generation, validation, and Stream Deck dev helpers
- `assets` - action and plugin icon assets

## Notes

- The plugin was tested on this machine with Stream Deck developer mode, link/restart flow, startup logs, build, and Elgato validation.
- Virtual Stream Deck is not enabled on this machine, so end-to-end key interaction without hardware or Stream Deck Mobile Pro is still limited.
- Figma marketing file: https://www.figma.com/design/X73D7GXEvoNcqvVv4Moa16
