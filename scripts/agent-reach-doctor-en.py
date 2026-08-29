#!/usr/bin/env python3
"""English report for `agent-reach doctor`.

Agent Reach ships no i18n layer: its status strings are hardcoded Chinese, and
AGENT_REACH_LANG only selects which SKILL.md gets installed. This wrapper reads
the language-neutral `doctor --json` (channel ids, status, tier and backends are
already English) and renders it in English, translating the Chinese `name` and
`message` fields via a phrase table.

Usage:  python agent-reach-doctor-en.py [--raw]
        --raw  also print the untranslated upstream message under each channel
"""

import json
import re
import subprocess
import sys

CHANNELS = {
    "github": "GitHub repos and code",
    "twitter": "Twitter/X posts",
    "youtube": "YouTube video and subtitles",
    "reddit": "Reddit posts and comments",
    "facebook": "Facebook posts, pages and groups",
    "instagram": "Instagram users, profiles and posts",
    "bilibili": "Bilibili video, subtitles and search",
    "xiaohongshu": "XiaoHongShu notes",
    "linkedin": "LinkedIn professional network",
    "xiaoyuzhou": "Xiaoyuzhou podcast transcription",
    "v2ex": "V2EX nodes, topics and replies",
    "xueqiu": "Xueqiu stock quotes and community",
    "rss": "RSS/Atom feeds",
    "exa_search": "Full-web semantic search",
    "web": "Any web page",
}

STATUS = {
    "ok": ("[OK]", "available"),
    "warn": ("[! ]", "installed, needs config/login or unverified"),
    "off": ("[X ]", "not installed"),
}

TIERS = {0: "Zero-config", 1: "Login-backed", 2: "Partial"}

# Ordered longest-first so specific sentences win over generic fragments.
PHRASES = [
    ("gh CLI \u53ef\u6267\u884c\uff0c\u4e14\u68c0\u6d4b\u5230\u663e\u5f0f\u8ba4\u8bc1\u914d\u7f6e\uff1bDoctor \u4e0d\u6267\u884c\u4f1a\u5199 device-id \u7684 `gh auth status`\uff0c\u56e0\u6b64\u672a\u5b9e\u65f6\u9a8c\u8bc1\uff0c\u672a\u6807\u8bb0\u4e3a\u53ef\u7528\u3002",
     "gh CLI is executable and explicit auth config was detected. Doctor does not run `gh auth status` because it writes a device-id, so this was not live-verified and is not marked available."),
    ("Exa \u5df2\u5199\u5165 mcporter \u914d\u7f6e\uff0c\u4f46 Doctor \u672a\u542f\u52a8\u8fdc\u7aef\u670d\u52a1\u505a\u8fde\u901a\u9a8c\u8bc1\uff0c\u4e0d\u80fd\u4ec5\u51ed\u914d\u7f6e\u5ba3\u79f0\u53ef\u7528\u3002",
     "Exa is written into the mcporter config, but Doctor did not start the remote service to verify connectivity, so it will not claim availability from config alone."),
    ("yt-dlp \u5df2\u5b89\u88c5\u4f46\u672a\u914d\u7f6e JS runtime\u3002\u8fd0\u884c\uff1a",
     "yt-dlp is installed but has no JS runtime configured. Run: "),
    ("\u6ca1\u6709\u53ef\u7528\u7684 B\u7ad9\u540e\u7aef\uff08\u641c\u7d22 API \u4e5f\u4e0d\u53ef\u8fbe\uff0c\u53ef\u80fd\u662f\u7f51\u7edc\u95ee\u9898\uff09\u3002\u63a8\u8350\uff1a",
     "No Bilibili backend available (the search API is also unreachable, possibly a network issue). Recommended: "),
    ("B\u7ad9\u641c\u7d22 API \u53ef\u8fbe\uff08\u4ec5\u641c\u7d22\uff0ccurl \u76f4\u8fde\uff09\u3002\u5b8c\u6574\u529f\u80fd\u5efa\u8bae\u5b89\u88c5 bili-cli\uff1a",
     "Bilibili search API reachable (search only, direct curl). For full functionality install bili-cli: "),
    ("\uff08\u5f53\u524d\u540e\u7aef\uff1aB\u7ad9\u641c\u7d22 API\uff09", " (current backend: Bilibili search API)"),
    ("\u516c\u5f00 API \u53ef\u7528\uff08\u70ed\u95e8\u4e3b\u9898\u3001\u8282\u70b9\u6d4f\u89c8\u3001\u4e3b\u9898\u8be6\u60c5\u3001\u7528\u6237\u4fe1\u606f\uff09",
     "Public API available (hot topics, node browsing, topic details, user info)"),
    ("\u6ce8\u610f\uff1aReddit \u6ca1\u6709\u96f6\u914d\u7f6e\u8def\u5f84\uff08\u533f\u540d .json \u5df2\u88ab\u5c01\uff0c\u5b98\u65b9 API \u9700\u4eba\u5de5\u5ba1\u6279\uff09\uff0c\u5fc5\u987b\u7528\u767b\u5f55\u6001\u3002\u63a8\u8350\uff1a",
     "Note: Reddit has no zero-config path (anonymous .json is blocked and the official API needs manual approval), so a logged-in session is required. Recommended: "),
    ("\u57fa\u672c\u5185\u5bb9\u53ef\u901a\u8fc7 Jina Reader \u8bfb\u53d6\u3002\u5b8c\u6574\u529f\u80fd\u9700\u8981\uff1a",
     "Basic content is readable via Jina Reader. Full functionality requires: "),
    ("\uff08\u590d\u7528 Chrome \u767b\u5f55\u6001\uff0c\u767b\u5f55\u8fc7 reddit.com \u5373\u53ef\u7528\uff09",
     "(reuses your Chrome session; works once you have logged into reddit.com)"),
    ("\uff08\u590d\u7528 Chrome \u767b\u5f55\u6001\uff0c\u5237\u8fc7\u5c0f\u7ea2\u4e66\u5373\u96f6\u914d\u7f6e\u53ef\u7528\uff09",
     "(reuses your Chrome session; zero-config once you have browsed XiaoHongShu)"),
    ("\uff08\u641c\u7d22/\u70ed\u95e8/\u89c6\u9891\u8be6\u60c5\uff0c\u65e0\u9700\u767b\u5f55\uff09", " (search / trending / video details, no login needed)"),
    ("\u6216\u684c\u9762\u88c5 OpenCLI\uff08\u989d\u5916\u89e3\u9501\u5b57\u5e55\uff09\uff1a", "or install OpenCLI on desktop (also unlocks subtitles): "),
    ("\u5982\u9700\u767b\u5f55 Cookie\uff0c\u8bf7\u8fd0\u884c\uff1a", "For a login cookie, run: "),
    ("\uff1bdoctor \u4e0d\u4f1a\u81ea\u52a8\u8bfb\u53d6\u6d4f\u89c8\u5668 Cookie\u3002", ". Doctor never reads browser cookies on its own."),
    ("\u767b\u5f55\u53ea\u4f7f\u7528 Cookie-Editor \u660e\u786e\u5bfc", "Login uses only an explicit Cookie-Editor export"),
    ("\u9700\u8981 ffmpeg\uff08\u97f3\u9891\u8f6c\u7801\u548c\u5207\u7247\uff09\u3002\u5b89\u88c5\uff1a", "Requires ffmpeg (audio transcoding and chunking). Install: "),
    ("\u9700\u8981 mcporter + Exa MCP\u3002\u5b89\u88c5\uff1a", "Requires mcporter + Exa MCP. Install: "),
    ("\u5148\u5b89\u88c5 uv/uvx\uff1a", "First install uv/uvx: "),
    ("\u901a\u8fc7 Jina Reader \u8bfb\u53d6\u4efb\u610f\u7f51\u9875", "Read any web page via Jina Reader"),
    ("\u53ef\u63d0\u53d6\u89c6\u9891\u4fe1\u606f\u548c\u5b57\u5e55", "Can extract video info and subtitles"),
    ("\u53ef\u8bfb\u53d6 RSS/Atom \u6e90", "Can read RSS/Atom feeds"),
    ("\u7136\u540e\u5728 Chrome \u91cc\u767b\u5f55", "then log into "),
    ("\u8fde\u63a5\u5931\u8d25\uff08\u53ef\u80fd\u9700\u8981\u4ee3\u7406\uff09\uff1a", " connection failed (a proxy may be needed): "),
    ("\u8fde\u63a5\u5931\u8d25\uff1a", " connection failed: "),
    ("\u672a\u5b89\u88c5\u4efb\u4f55 Reddit \u540e\u7aef\u3002", "No Reddit backend installed. "),
    ("\u672a\u5b89\u88c5\u4efb\u4f55\u5c0f\u7ea2\u4e66\u540e\u7aef\u3002", "No XiaoHongShu backend installed. "),
    ("\u672a\u5b89\u88c5\u3002\u5b89\u88c5\u65b9\u5f0f\uff1a", "not installed. Install via: "),
    ("\u672a\u5b89\u88c5\u3002\u5b89\u88c5\uff1a", "not installed. Install: "),
    ("\u540e\u7aef\u3002\u5b89\u88c5\uff1a", "backend. Install: "),
    ("\u672a\u5b89\u88c5", "not installed"),
    ("\u5b89\u88c5\uff1a", "Install: "),
    ("\u63a8\u8350\uff1a", "Recommended: "),
    ("\u684c\u9762\uff1a", "Desktop: "),
    ("\u670d\u52a1\u5668/\u5b58\u91cf\uff1a", "Server / legacy: "),
    ("\u670d\u52a1\u5668\uff1a", "Server: "),
    ("\u6216\uff1a", "or: "),
    ("\u6216", " or "),
]

# Chinese channel names can appear inside message bodies too.
NAME_PHRASES = [
    ("Facebook \u5e16\u5b50\u3001\u4e3b\u9875\u548c\u7fa4\u7ec4", "Facebook posts, pages and groups"),
    ("Instagram \u7528\u6237\u3001\u4e3b\u9875\u548c\u6307\u5b9a\u7528\u6237\u5e16\u5b50", "Instagram users, profiles and posts"),
    ("B\u7ad9\u89c6\u9891\u3001\u5b57\u5e55\u548c\u641c\u7d22", "Bilibili video, subtitles and search"),
    ("\u5c0f\u5b87\u5b99\u64ad\u5ba2\u8f6c\u6587\u5b57", "Xiaoyuzhou podcast transcription"),
    ("\u96ea\u7403\u80a1\u7968\u884c\u60c5\u4e0e\u793e\u533a\u52a8\u6001", "Xueqiu stock quotes and community"),
    ("V2EX \u8282\u70b9\u3001\u4e3b\u9898\u4e0e\u56de\u590d", "V2EX nodes, topics and replies"),
    ("Reddit \u5e16\u5b50\u548c\u8bc4\u8bba", "Reddit posts and comments"),
    ("LinkedIn \u804c\u4e1a\u793e\u4ea4", "LinkedIn professional network"),
    ("YouTube \u89c6\u9891\u548c\u5b57\u5e55", "YouTube video and subtitles"),
    ("GitHub \u4ed3\u5e93\u548c\u4ee3\u7801", "GitHub repos and code"),
    ("\u5168\u7f51\u8bed\u4e49\u641c\u7d22", "Full-web semantic search"),
    ("RSS/Atom \u8ba2\u9605\u6e90", "RSS/Atom feeds"),
    ("Twitter/X \u63a8\u6587", "Twitter/X posts"),
    ("\u5c0f\u7ea2\u4e66\u7b14\u8bb0", "XiaoHongShu notes"),
    ("\u4efb\u610f\u7f51\u9875", "Any web page"),
    ("B\u7ad9", "Bilibili"),
]

EXTRA = [
    ("\u7136\u540e `rdt login` \u6216\u624b\u52a8\u5199\u5165 Cookie\uff08\u89c1 doctor \u63d0\u793a\uff09",
     "then run `rdt login` or write the cookie in manually (see the doctor hint)"),
    ("\u4e2d\u56fd\u5927\u9646\u8bbf\u95ee Reddit \u9700\u8981\u4ee3\u7406", "Accessing Reddit from mainland China requires a proxy"),
    ("\u767b\u5f55\u53ea\u4f7f\u7528 Cookie-Editor \u660e\u786e\u5bfc\u51fa\u7684\u6587\u4ef6",
     "Login uses only a file you explicitly export with Cookie-Editor"),
    ("\uff08\u89c1 doctor \u63d0\u793a\uff09", " (see the doctor hint)"),
    ("\u767b\u5f55\u53ea\u4f7f\u7528 Cookie-Editor \u660e\u786e\u5bfc\u51fa\u7684 Cookie", "Login uses only a cookie you explicitly export with Cookie-Editor"),
    ("\u767b\u5f55\u53ea\u4f7f\u7528 Cookie-Editor \u660e\u786e\u5bfc\u51fa", "Login uses only an explicit Cookie-Editor export"),
    ("\uff08\u9690\u85cf\u8f93\u5165\uff09", " (hidden input)"),
    ("\u9690\u85cf\u8f93\u5165", "hidden input"),
    ("\u8be6\u89c1", "See "),
    ("\u5c0f\u7ea2\u4e66", "XiaoHongShu"),
    ("mcporter \u672c\u5730\u914d\u7f6e\u672a\u53d1\u73b0 LinkedIn MCP\uff1b\u914d\u7f6e\u8fd8\u542f\u7528\u4e86 editor imports\uff0cDoctor \u4e3a\u907f\u514d\u6269\u5927\u51ed\u636e\u8bfb\u53d6\u8303\u56f4\u6ca1\u6709\u5c55\u5f00\uff0c\u5f53\u524d\u672a\u9a8c\u8bc1\u3002",
     "No LinkedIn MCP found in the local mcporter config. That config also enables editor imports, which Doctor did not expand in order to avoid widening the scope of credential reads, so this is currently unverified."),
    ("\u8f6c\u5f55\u811a\u672c\u672a\u5b89\u88c5\u3002\u8fd0\u884c\uff1a", "Transcription script not installed. Run: "),
    ("\u6216\u624b\u52a8\u590d\u5236 transcribe.sh \u5230", "or manually copy transcribe.sh to "),
    ("\u767b\u5f55\u53ea\u4f7f\u7528 Cookie-Editor \u660e\u786e\u5bfc\u51fa\uff1a", "Login uses only an explicit Cookie-Editor export: "),
    ("\u8fde\u63a5\u5931\u8d25\uff1aHTTP Error", " connection failed: HTTP Error"),
    ("\u9700\u8981\u767b\u5f55 Cookie", "login cookie required"),
    ("B\u7ad9\u641c\u7d22 API", "Bilibili search API"),
    ("\u6ca1\u6709\u53ef\u7528\u7684", "No available "),
    ("\uff08\u641c\u7d22 API \u4e5f\u4e0d\u53ef\u8fbe\uff0c\u53ef\u80fd\u662f\u7f51\u7edc\u95ee\u9898\uff09", " (the search API is also unreachable, possibly a network issue)"),
    ("\u540e\u7aef", " backend"),
    ("\u7136\u540e", "then "),
    ("\u53ef\u80fd\u9700\u8981\u4ee3\u7406", "a proxy may be needed"),
]

HAS_CJK = re.compile(r"[\u4e00-\u9fff]")

# One table, applied longest-source-first so a specific sentence always wins
# over a shorter fragment nested inside it.
ALL_PHRASES = sorted(PHRASES + NAME_PHRASES + EXTRA, key=lambda p: -len(p[0]))

# Structural patterns resolved before phrase substitution.
PATTERNS = [
    (re.compile(r"\u672a\u5b89\u88c5\s*(.+?)\s*\u540e\u7aef\u3002\u5b89\u88c5\uff1a"), r"No \1 backend installed. Install: "),
    (re.compile(r"\u672a\u5b89\u88c5\u4efb\u4f55\s*(.+?)\s*\u540e\u7aef\u3002"), r"No \1 backend installed. "),
]


def translate(text):
    for pat, repl in PATTERNS:
        text = pat.sub(repl, text)
    for zh, en in ALL_PHRASES:
        text = text.replace(zh, en)
    text = text.replace("\uff08", " (").replace("\uff09", ") ").replace("\uff0c", ", ")
    text = text.replace("\u3002", ". ").replace("\uff1a", ": ").replace("\u3001", ", ")
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def main():
    raw = "--raw" in sys.argv
    try:
        out = subprocess.run(
            ["agent-reach", "doctor", "--json"],
            capture_output=True, text=True, encoding="utf-8", timeout=180,
        )
    except FileNotFoundError:
        sys.exit("agent-reach not found on PATH. Is it installed via pipx?")
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        sys.exit(f"Could not parse doctor --json output:\n{out.stdout or out.stderr}")

    print("Agent Reach status (English)")
    print("=" * 62)
    print("Legend:  [OK] available   [! ] needs config/login or unverified   [X ] not installed")
    print()

    untranslated = 0
    for tier in (0, 1, 2):
        rows = [(k, v) for k, v in data.items() if v.get("tier") == tier]
        if not rows:
            continue
        print(f"{TIERS[tier]}:")
        for cid, v in rows:
            mark, _ = STATUS.get(v.get("status"), ("[? ]", "unknown"))
            name = CHANNELS.get(cid, cid)
            print(f"  {mark} {name}")
            msg = translate(v.get("message", ""))
            if msg:
                for line in msg.splitlines():
                    if line.strip():
                        print(f"       {line.strip()}")
                if HAS_CJK.search(msg):
                    untranslated += 1
            backends = ", ".join(translate(b) for b in (v.get("backends") or []))
            active = translate(v["active_backend"]) if v.get("active_backend") else None
            if backends:
                tail = f"       backends: {backends}"
                if active:
                    tail += f"   |   active: {active}"
                print(tail)
            if raw and v.get("message"):
                print(f"       [upstream] {v['message'].splitlines()[0]}")
        print()

    ok = sum(1 for v in data.values() if v.get("status") == "ok")
    warn = sum(1 for v in data.values() if v.get("status") == "warn")
    print(f"{ok}/{len(data)} channels verified available; {warn} installed but unverified.")
    print("Note: Doctor only counts channels it positively probed. Channels it")
    print("declines to probe (GitHub, Exa) can work while still showing [! ].")
    if untranslated:
        print(f"\n{untranslated} message(s) contain text this wrapper has no mapping for,")
        print("shown above in the original. Run with --raw to see all upstream text.")


if __name__ == "__main__":
    main()
