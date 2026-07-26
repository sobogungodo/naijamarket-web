# func-naijamarket-api — recovered source snapshot

Recovered snapshot of the DEPLOYED `func-naijamarket-api` **api-v19** package,
byte-identical to the live `WEBSITE_RUN_FROM_PACKAGE` blob (SHA256 `48C8D6D053105607751CCE1FC90EFC887C5E40D3548AA245090525FEDD26A6F5`), recovered 2026-07-26.

The DEPLOYED artifact — NOT this tree — is the source of truth until a build/deploy
pipeline exists. Edits here are not live until packaged as `api-vNN` and deployed via
the blob / SAS / `az rest` pipeline (preserving the 28-settings + SQL_SERVER guard).
Vendored dependencies (`.python_packages`) are intentionally excluded.