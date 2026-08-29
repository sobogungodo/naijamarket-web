# Provenance

Vendored from [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)
(MIT licence), upstream commit `06c202b03400a7d31886bf4399213706da1a0324`,
package version 1.5.0.

Only the skill payload is vendored here: `SKILL.md` (the upstream English
variant, `agent_reach/skill/SKILL_en.md`) and `references/`. The reference
files are written in Chinese upstream; the commands in them are language
independent.

## Companion CLI

Most commands in `SKILL.md` shell out to an `agent-reach` binary that is NOT
part of this repo. Without it, only the zero-config paths work (Jina Reader,
RSS, `gh`, `yt-dlp`, `curl`). To get the rest:

    pipx install git+https://github.com/Panniantong/Agent-Reach.git
    agent-reach doctor

## Credentials

The CLI stores per-platform tokens under `~/.agent-reach/` (dir `0700`, files
`0600`) and can read cookies from a local browser, one explicitly named
platform at a time (`agent-reach configure --from-browser`). Nothing is
committed to this repo, and no credential is required for the zero-config
channels.

## Third parties

Page reads route through `r.jina.ai` and web search through `mcp.exa.ai`, so
URLs you ask it to read are visible to those services. Transcription is the
only outbound POST in the package and goes to Groq or OpenAI using a key you
supply yourself.
