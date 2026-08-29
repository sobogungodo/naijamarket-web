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
    ("gh CLI 可执行，且检测到显式认证配置；Doctor 不执行会写 device-id 的 `gh auth status`，因此未实时验证，未标记为可用。",
     "gh CLI is executable and explicit auth config was detected. Doctor does not run `gh auth status` because it writes a device-id, so this was not live-verified and is not marked available."),
    ("Exa 已写入 mcporter 配置，但 Doctor 未启动远端服务做连通验证，不能仅凭配置宣称可用。",
     "Exa is written into the mcporter config, but Doctor did not start the remote service to verify connectivity, so it will not claim availability from config alone."),
    ("yt-dlp 已安装但未配置 JS runtime。运行：",
     "yt-dlp is installed but has no JS runtime configured. Run: "),
    ("没有可用的 B站后端（搜索 API 也不可达，可能是网络问题）。推荐：",
     "No Bilibili backend available (the search API is also unreachable, possibly a network issue). Recommended: "),
    ("B站搜索 API 可达（仅搜索，curl 直连）。完整功能建议安装 bili-cli：",
     "Bilibili search API reachable (search only, direct curl). For full functionality install bili-cli: "),
    ("（当前后端：B站搜索 API）", " (current backend: Bilibili search API)"),
    ("公开 API 可用（热门主题、节点浏览、主题详情、用户信息）",
     "Public API available (hot topics, node browsing, topic details, user info)"),
    ("注意：Reddit 没有零配置路径（匿名 .json 已被封，官方 API 需人工审批），必须用登录态。推荐：",
     "Note: Reddit has no zero-config path (anonymous .json is blocked and the official API needs manual approval), so a logged-in session is required. Recommended: "),
    ("基本内容可通过 Jina Reader 读取。完整功能需要：",
     "Basic content is readable via Jina Reader. Full functionality requires: "),
    ("（复用 Chrome 登录态，登录过 reddit.com 即可用）",
     "(reuses your Chrome session; works once you have logged into reddit.com)"),
    ("（复用 Chrome 登录态，刷过小红书即零配置可用）",
     "(reuses your Chrome session; zero-config once you have browsed XiaoHongShu)"),
    ("（搜索/热门/视频详情，无需登录）", " (search / trending / video details, no login needed)"),
    ("或桌面装 OpenCLI（额外解锁字幕）：", "or install OpenCLI on desktop (also unlocks subtitles): "),
    ("如需登录 Cookie，请运行：", "For a login cookie, run: "),
    ("；doctor 不会自动读取浏览器 Cookie。", ". Doctor never reads browser cookies on its own."),
    ("登录只使用 Cookie-Editor 明确导", "Login uses only an explicit Cookie-Editor export"),
    ("需要 ffmpeg（音频转码和切片）。安装：", "Requires ffmpeg (audio transcoding and chunking). Install: "),
    ("需要 mcporter + Exa MCP。安装：", "Requires mcporter + Exa MCP. Install: "),
    ("先安装 uv/uvx：", "First install uv/uvx: "),
    ("通过 Jina Reader 读取任意网页", "Read any web page via Jina Reader"),
    ("可提取视频信息和字幕", "Can extract video info and subtitles"),
    ("可读取 RSS/Atom 源", "Can read RSS/Atom feeds"),
    ("然后在 Chrome 里登录", "then log into "),
    ("连接失败（可能需要代理）：", " connection failed (a proxy may be needed): "),
    ("连接失败：", " connection failed: "),
    ("未安装任何 Reddit 后端。", "No Reddit backend installed. "),
    ("未安装任何小红书后端。", "No XiaoHongShu backend installed. "),
    ("未安装。安装方式：", "not installed. Install via: "),
    ("未安装。安装：", "not installed. Install: "),
    ("后端。安装：", "backend. Install: "),
    ("未安装", "not installed"),
    ("安装：", "Install: "),
    ("推荐：", "Recommended: "),
    ("桌面：", "Desktop: "),
    ("服务器/存量：", "Server / legacy: "),
    ("服务器：", "Server: "),
    ("或：", "or: "),
    ("或", " or "),
]

# Chinese channel names can appear inside message bodies too.
NAME_PHRASES = [
    ("Facebook 帖子、主页和群组", "Facebook posts, pages and groups"),
    ("Instagram 用户、主页和指定用户帖子", "Instagram users, profiles and posts"),
    ("B站视频、字幕和搜索", "Bilibili video, subtitles and search"),
    ("小宇宙播客转文字", "Xiaoyuzhou podcast transcription"),
    ("雪球股票行情与社区动态", "Xueqiu stock quotes and community"),
    ("V2EX 节点、主题与回复", "V2EX nodes, topics and replies"),
    ("Reddit 帖子和评论", "Reddit posts and comments"),
    ("LinkedIn 职业社交", "LinkedIn professional network"),
    ("YouTube 视频和字幕", "YouTube video and subtitles"),
    ("GitHub 仓库和代码", "GitHub repos and code"),
    ("全网语义搜索", "Full-web semantic search"),
    ("RSS/Atom 订阅源", "RSS/Atom feeds"),
    ("Twitter/X 推文", "Twitter/X posts"),
    ("小红书笔记", "XiaoHongShu notes"),
    ("任意网页", "Any web page"),
    ("B站", "Bilibili"),
]

EXTRA = [
    ("然后 `rdt login` 或手动写入 Cookie（见 doctor 提示）",
     "then run `rdt login` or write the cookie in manually (see the doctor hint)"),
    ("中国大陆访问 Reddit 需要代理", "Accessing Reddit from mainland China requires a proxy"),
    ("登录只使用 Cookie-Editor 明确导出的文件",
     "Login uses only a file you explicitly export with Cookie-Editor"),
    ("（见 doctor 提示）", " (see the doctor hint)"),
    ("登录只使用 Cookie-Editor 明确导出的 Cookie", "Login uses only a cookie you explicitly export with Cookie-Editor"),
    ("登录只使用 Cookie-Editor 明确导出", "Login uses only an explicit Cookie-Editor export"),
    ("（隐藏输入）", " (hidden input)"),
    ("隐藏输入", "hidden input"),
    ("详见", "See "),
    ("小红书", "XiaoHongShu"),
    ("需要登录 Cookie", "login cookie required"),
    ("B站搜索 API", "Bilibili search API"),
    ("没有可用的", "No available "),
    ("（搜索 API 也不可达，可能是网络问题）", " (the search API is also unreachable, possibly a network issue)"),
    ("后端", " backend"),
    ("然后", "then "),
    ("可能需要代理", "a proxy may be needed"),
]

HAS_CJK = re.compile(r"[一-鿿]")

# One table, applied longest-source-first so a specific sentence always wins
# over a shorter fragment nested inside it.
ALL_PHRASES = sorted(PHRASES + NAME_PHRASES + EXTRA, key=lambda p: -len(p[0]))

# Structural patterns resolved before phrase substitution.
PATTERNS = [
    (re.compile(r"未安装\s*(.+?)\s*后端。安装："), r"No \1 backend installed. Install: "),
    (re.compile(r"未安装任何\s*(.+?)\s*后端。"), r"No \1 backend installed. "),
]


def translate(text):
    for pat, repl in PATTERNS:
        text = pat.sub(repl, text)
    for zh, en in ALL_PHRASES:
        text = text.replace(zh, en)
    text = text.replace("（", " (").replace("）", ") ").replace("，", ", ")
    text = text.replace("。", ". ").replace("：", ": ").replace("、", ", ")
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
