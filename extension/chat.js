// ScrapLLM Chat
// Copies an LLM conversation — the whole thread or just the last N exchanges,
// where one exchange is a user turn plus the assistant's reply.
//
// Two extraction paths, in this order:
//
// 1. The site's own conversation API, when it has one (claude.ai, chatgpt.com).
//    A chat is a *tree*, not a list: editing a message mid-thread grows a
//    second branch and leaves the old one behind in the database. The UI shows
//    a single root→leaf path, so we walk parents up from the active leaf and
//    export exactly what the user sees. Scraping the DOM cannot know this, and
//    virtualised transcripts drop everything off-screen anyway.
//
// 2. The rendered DOM, for everything else — Gemini, Grok, Perplexity,
//    DeepSeek, Copilot, Cursor, and self-hosted front-ends on localhost
//    (Open WebUI, LibreChat, LobeChat, AnythingLLM, Jan…). Known layouts are
//    matched first; unknown ones fall back to a role-detection heuristic, so a
//    front-end nobody has heard of still works if it labels its turns at all.
var ScrapLLMChat = typeof ScrapLLMChat !== 'undefined' ? ScrapLLMChat : (function () {
  'use strict';

  const ROOT_PARENT = '00000000-0000-4000-8000-000000000000';
  const API_TIMEOUT = 12000;

  // Attributes and class fragments front-ends use to mark who is speaking.
  // Ordered by how explicit they are: an author-role attribute is a statement,
  // a class containing "user" is a hint.
  const ROLE_ATTRIBUTES = [
    'data-message-author-role',
    'data-message-role',
    'data-author-role',
    'data-role',
    'data-testid-role'
  ];

  const USER_HINTS = /(?:^|[-_ ])(?:user|human|you|me|query|prompt|request)(?:$|[-_ ])/i;
  const ASSISTANT_HINTS = /(?:^|[-_ ])(?:assistant|assistent|bot|ai|model|response|answer|reply|agent|gpt|claude|gemini|grok)(?:$|[-_ ])/i;

  let logger = { log() {}, error() {} };

  // ==========================================================================
  // SITE REGISTRY
  // ==========================================================================

  const SITES = [
    {
      id: 'claude',
      label: 'Claude',
      host: /(^|\.)claude\.ai$/i,
      thread: /^\/chat\/([0-9a-f-]{36})/i,
      api: fetchClaudeConversation
    },
    {
      id: 'chatgpt',
      label: 'ChatGPT',
      host: /(^|\.)(?:chatgpt\.com|chat\.openai\.com)$/i,
      thread: /^\/(?:c|g\/[^/]+\/c|share)\/([0-9a-zA-Z-]{16,})/i,
      api: fetchChatGptConversation,
      dom: { turn: 'article[data-testid^="conversation-turn"], [data-message-author-role]' }
    },
    {
      id: 'google-ai',
      label: 'Google AI Mode',
      // google.com, google.co.uk, google.de… all serve it from /search, and the
      // udm parameter is what separates the AI conversation from a plain result
      // page on the very same path.
      host: /(^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i,
      thread: /^\/search/i,
      query: (search) => new URLSearchParams(search).get('udm') === '50',
      extract: extractGoogleAiMode
    },
    {
      id: 'gemini',
      label: 'Gemini',
      host: /(^|\.)gemini\.google\.com$/i,
      thread: /^\/(?:app|share)\//i,
      dom: { user: 'user-query, .user-query-container', assistant: 'model-response, message-content.model-response-text' }
    },
    {
      id: 'grok',
      label: 'Grok',
      host: /(^|\.)(?:grok\.com|x\.ai)$/i,
      thread: /^\/(?:chat|c|share)\//i
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      host: /(^|\.)perplexity\.ai$/i,
      thread: /^\/(?:search|page)\//i
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      host: /(^|\.)(?:deepseek\.com|chat\.deepseek\.com)$/i,
      thread: /^\/a\/chat\//i
    },
    {
      id: 'copilot',
      label: 'Copilot',
      host: /(^|\.)copilot\.microsoft\.com$/i,
      thread: /^\/(?:chats?|c)\//i
    },
    {
      id: 'mistral',
      label: 'Le Chat',
      host: /(^|\.)chat\.mistral\.ai$/i,
      thread: /^\/chat\//i
    },
    {
      id: 'cursor',
      label: 'Cursor',
      host: /(^|\.)cursor\.(?:com|sh)$/i,
      thread: /^\/(?:agents?|chat|dashboard)/i
    },
    {
      id: 'openwebui',
      label: 'Local chat',
      // Self-hosted front-ends sit on a loopback port (Open WebUI 8080,
      // LibreChat 3080, LobeChat 3210, Jan 1337, …). The port is not a
      // reliable identifier, so any local origin is a candidate and the DOM
      // decides whether there is a conversation on it.
      host: /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)$/i,
      thread: /.*/
    }
  ];

  function getSite(location) {
    const loc = location || window.location;
    return SITES.find(site => site.host.test(loc.hostname)) || null;
  }

  function isThreadUrl(site, location) {
    const loc = location || window.location;
    if (site.thread && !site.thread.test(loc.pathname)) return false;
    // Some surfaces live on a path they share with something else entirely and
    // are told apart by the query string.
    if (site.query && !site.query(loc.search || '')) return false;
    return true;
  }

  // ==========================================================================
  // CONVERSATION APIS
  // ==========================================================================

  async function fetchJson(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
    try {
      const response = await fetch(url, Object.assign({
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      }, options || {}));
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
      const type = response.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error(`Expected JSON, got "${type || 'unknown'}"`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Walk parents from the active leaf back to the root. Anything the user
  // edited away hangs off a sibling branch and is correctly skipped.
  function walkActiveBranch(byId, leafId, parentOf) {
    const chain = [];
    const seen = new Set();
    let id = leafId;
    while (id && byId.has(id) && !seen.has(id)) {
      seen.add(id);
      const node = byId.get(id);
      chain.push(node);
      id = parentOf(node);
    }
    return chain.reverse();
  }

  async function fetchClaudeConversation(location) {
    const conversationId = location.pathname.split('/').pop();
    const orgs = await fetchJson('/api/organizations');
    if (!Array.isArray(orgs) || !orgs.length) throw new Error('No Claude organization on this session');
    const orgId = orgs[0].uuid;
    // rendering_mode=messages is what carries the `content` array; with `raw`
    // the field is absent entirely and everything collapses into a flat
    // `text`, where the server has already flattened thinking into the answer
    // and replaced every tool block with "This block is not supported on your
    // current device yet". render_all_tools=true is what turns those
    // placeholders back into real tool_use/tool_result blocks. tree=True stays:
    // without it this conversation loses 31 of its 429 messages.
    const data = await fetchJson(
      `/api/organizations/${orgId}/chat_conversations/${conversationId}` +
      '?tree=True&rendering_mode=messages&render_all_tools=true'
    );

    const all = data.chat_messages || [];
    if (!all.length) return null;
    const byId = new Map(all.map(m => [m.uuid, m]));

    let leafId = data.current_leaf_message_uuid;
    if (!leafId || !byId.has(leafId)) {
      // Older payloads omit the pointer; the newest message is the leaf.
      leafId = all.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].uuid;
    }

    const chain = walkActiveBranch(byId, leafId, (m) => (m.parent_message_uuid === ROOT_PARENT ? null : m.parent_message_uuid));
    logger.log('Claude conversation fetched', { total: all.length, active: chain.length });

    return {
      title: data.name || conversationId,
      messages: chain.map(m => ({
        role: m.sender === 'human' ? 'user' : 'assistant',
        text: claudeMessageText(m),
        time: m.created_at || ''
      })).filter(m => m.text)
    };
  }

  // One message can hold several text blocks, thinking before *and* after the
  // answer, and any number of tool round-trips — so the blocks are rendered in
  // their own order rather than grouped by kind, which is also the order the
  // site shows them in.
  function claudeMessageText(message) {
    const blocks = Array.isArray(message.content) ? message.content : [];
    if (blocks.length) {
      const parts = blocks.map(claudeBlockMarkdown).filter(Boolean);
      const files = claudeFileList(message);
      if (files) parts.push(files);
      return parts.join('\n\n').trim();
    }
    // Only reached on payload shapes that carry no content array at all.
    const flat = String(message.text || '').trim();
    const files = claudeFileList(message);
    return files ? `${flat}\n\n${files}`.trim() : flat;
  }

  function claudeBlockMarkdown(block) {
    if (!block || !block.type) return '';
    if (block.type === 'text') return String(block.text || '').trim();
    if (block.type === 'thinking') return claudeThinking(block);
    if (block.type === 'tool_use') return claudeToolUse(block);
    if (block.type === 'tool_result') return claudeToolResult(block);
    return '';
  }

  // The site keeps reasoning behind a disclosure, so the export does too: it is
  // context, not the answer, and inlining it is what made the two run together.
  function claudeThinking(block) {
    if (block.hidden || block.thinking_hidden) return '';
    const text = String(block.thinking || '').trim();
    if (!text) return '';
    const steps = Array.isArray(block.summaries)
      ? block.summaries.map(s => (s && s.summary) || '').filter(Boolean)
      : [];
    const label = steps.length ? steps[0] : 'Thinking';
    // Any further steps belong in the body as their own lines rather than in
    // the title: joined into one summary they ran to nearly 200 characters.
    const rest = steps.length > 1
      ? steps.slice(1).map(step => `- ${step}`).join('\n') + '\n\n'
      : '';
    const truncated = block.cut_off || block.truncated ? '\n\n_(cut off)_' : '';
    return `<details>\n<summary>${label}</summary>\n\n${rest}${text}${truncated}\n\n</details>`;
  }

  // A tool call is a labelled step on the page, not a JSON payload. The label
  // the site prints is in `message`, and `display_content` is the code block it
  // renders — both are used before falling back to guessing at `input`.
  function claudeToolUse(block) {
    const label = String(block.message || block.name || 'Tool').trim();
    const display = block.display_content;
    if (display && display.type === 'code_block' && display.code) {
      return `**${label}**\n\n${fence(String(display.code), display.language || '')}`;
    }
    const input = block.input || {};
    if (typeof input.query === 'string' && input.query) {
      return `**${label}**: ${inlineCode(input.query)}`;
    }
    // Artifacts are expected to arrive here as input.content with a title and a
    // language. No conversation checked so far contains one, so this branch is
    // written from the documented shape and has never run against real data.
    const command = typeof input.command === 'string' ? input.command : '';
    const content = typeof input.content === 'string' ? input.content : '';
    const body = content || command;
    if (body) {
      const language = typeof input.language === 'string' ? input.language : '';
      const title = typeof input.title === 'string' && input.title ? ` — ${input.title}` : '';
      return `**${label}${title}**\n\n${fence(body, language)}`;
    }
    // Nothing recognisable: keep the shape rather than pretend it was empty.
    return `**${label}**\n\n${fence(JSON.stringify(input, null, 2), 'json')}`;
  }

  function claudeToolResult(block) {
    const items = Array.isArray(block.content) ? block.content : [];
    const failed = block.is_error ? ' (failed)' : '';

    // Search results are a list of sources, which is how the page shows them.
    const sources = items.filter(item => item && item.type === 'knowledge' && item.url);
    if (sources.length) {
      const lines = sources.map(item => {
        const site = (item.metadata && item.metadata.site_name) || '';
        const title = String(item.title || item.url).trim();
        return `- [${title}](${item.url})${site ? ` — ${site}` : ''}`;
      });
      return `**Sources${failed}**\n\n${lines.join('\n')}`;
    }

    const texts = items.filter(item => item && item.type === 'text' && item.text)
      .map(item => String(item.text));
    if (!texts.length) return '';

    // A shell result arrives as a JSON envelope; the useful part is the output,
    // not the wrapper.
    const rendered = texts.map(text => {
      const shell = parseShellResult(text);
      if (!shell) return fence(text, '');
      const out = [];
      if (shell.stdout) out.push(fence(shell.stdout.replace(/\n$/, ''), ''));
      if (shell.stderr) out.push(`_stderr_\n\n${fence(shell.stderr.replace(/\n$/, ''), '')}`);
      if (!out.length) out.push(`_exit code ${shell.returncode}, no output_`);
      return out.join('\n\n');
    });
    return `**Result${failed}**\n\n${rendered.join('\n\n')}`;
  }

  function parseShellResult(text) {
    if (!/^\s*\{/.test(text)) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && (typeof parsed.stdout === 'string' || typeof parsed.stderr === 'string')) {
        return { stdout: parsed.stdout || '', stderr: parsed.stderr || '', returncode: parsed.returncode };
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  // Images and files attached to a turn were dropped entirely before this.
  function claudeFileList(message) {
    const files = Array.isArray(message.files) ? message.files : [];
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const lines = [];
    files.forEach(file => {
      const name = String((file && (file.file_name || file.file_uuid)) || 'file').trim();
      const url = file && (file.preview_url || file.thumbnail_url);
      const kind = file && file.file_kind === 'image' ? 'image' : 'attached';
      // Deliberately a link, not an embedded image: these URLs are private
      // endpoints that need the session cookie, so an inline image would be a
      // broken picture in every reader — including this user's other browser.
      lines.push(url ? `- ${kind}: [${name}](${url})` : `- ${kind}: ${name}`);
    });
    attachments.forEach(attachment => {
      const name = String((attachment && (attachment.file_name || attachment.name)) || 'attachment').trim();
      lines.push(`- attached: ${name}`);
    });
    return lines.length ? lines.join('\n') : '';
  }

  // Inline code needs the same treatment as a fence: a query with a backtick in
  // it would otherwise close the span early and spill into the sentence.
  function inlineCode(text) {
    const body = String(text);
    const runs = body.match(/`+/g) || [];
    const marker = '`'.repeat(runs.reduce((max, run) => Math.max(max, run.length), 0) + 1);
    const pad = /^`|`$/.test(body) ? ' ' : '';
    return `${marker}${pad}${body}${pad}${marker}`;
  }

  // A fence long enough to survive whatever backticks are inside it.
  function fence(body, language) {
    const runs = String(body).match(/`{3,}/g) || [];
    const marker = '`'.repeat(runs.reduce((max, run) => Math.max(max, run.length), 2) + 1);
    return `${marker}${language || ''}\n${String(body)}\n${marker}`;
  }

  async function fetchChatGptConversation(location) {
    const match = location.pathname.match(/([0-9a-zA-Z-]{16,})$/);
    if (!match) return null;
    const conversationId = match[1];

    // The backend wants the session's bearer token, not just the cookie.
    const session = await fetchJson('/api/auth/session');
    const token = session && session.accessToken;
    if (!token) throw new Error('No ChatGPT session token (signed out?)');

    const data = await fetchJson(`/backend-api/conversation/${conversationId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });

    const mapping = data.mapping || {};
    const byId = new Map(Object.entries(mapping));
    const leafId = data.current_node || [...byId.keys()].pop();
    const chain = walkActiveBranch(byId, leafId, (node) => node.parent);
    logger.log('ChatGPT conversation fetched', { total: byId.size, active: chain.length });

    const messages = chain.map(node => node.message).filter(Boolean).map(message => {
      const role = message.author && message.author.role;
      if (role !== 'user' && role !== 'assistant') return null; // system/tool noise
      const parts = (message.content && message.content.parts) || [];
      const text = parts
        .map(part => (typeof part === 'string' ? part : (part && part.text) || ''))
        .join('\n\n')
        .trim();
      if (!text) return null;
      return {
        role,
        text,
        time: message.create_time ? new Date(message.create_time * 1000).toISOString() : ''
      };
    }).filter(Boolean);

    return { title: data.title || conversationId, messages };
  }

  // ==========================================================================
  // DOM EXTRACTION
  // ==========================================================================

  function roleFromAttributes(element) {
    for (const attribute of ROLE_ATTRIBUTES) {
      const value = element.getAttribute && element.getAttribute(attribute);
      if (!value) continue;
      const normalized = value.toLowerCase();
      if (/user|human/.test(normalized)) return 'user';
      if (/assistant|model|bot|ai/.test(normalized)) return 'assistant';
    }
    return null;
  }

  function roleFromHints(element) {
    const haystack = [
      element.tagName.toLowerCase(),
      typeof element.className === 'string' ? element.className : '',
      element.getAttribute('data-testid') || '',
      element.getAttribute('aria-label') || ''
    ].join(' ');
    if (USER_HINTS.test(haystack)) return 'user';
    if (ASSISTANT_HINTS.test(haystack)) return 'assistant';
    return null;
  }

  // Collect candidate turn elements, deepest-first so nested wrappers don't
  // swallow their own children.
  function collectTurns() {
    const attributeSelector = ROLE_ATTRIBUTES.map(a => `[${a}]`).join(', ');
    let nodes = Array.from(document.querySelectorAll(attributeSelector));

    if (nodes.length < 2) {
      nodes = Array.from(document.querySelectorAll(
        'article[data-testid*="turn"], [data-testid*="message"], user-query, model-response, ' +
        '[class*="message-row"], [class*="chat-message"], [class*="message-bubble"], ' +
        '[class*="user-message"], [class*="assistant-message"], [class*="ChatMessage"], ' +
        // Self-hosted front-ends often label nothing but the bubble itself.
        '[class*="chat-bubble"], [class*="chatBubble"], [class*="message-item"], [class*="messageItem"]'
      ));
    }

    if (nodes.length < 2) {
      // Last resort for unknown UIs: repeated sibling bubbles under one parent.
      // Requiring several of them keeps articles and comment lists out.
      const generic = Array.from(document.querySelectorAll('[class*="bubble"], [class*="msg"], [class*="turn"]'));
      if (generic.length >= 4) nodes = generic;
    }

    // Drop anything that is an ancestor of another candidate: we want leaves.
    return nodes.filter(node => !nodes.some(other => other !== node && node.contains(other)));
  }

  function extractFromDom(site, createTurndown) {
    const turns = collectTurns();
    if (turns.length < 2) return null;

    const messages = [];
    turns.forEach((turn, index) => {
      const role = roleFromAttributes(turn) ||
                   roleFromHints(turn) ||
                   // Nothing labelled: chats alternate, and the first turn is
                   // the user's. Better than dropping the transcript.
                   (index % 2 === 0 ? 'user' : 'assistant');
      const text = turnToMarkdown(turn, createTurndown);
      if (text) messages.push({ role, text, time: turnTimestamp(turn) });
    });

    if (messages.length < 2) return null;
    logger.log('Chat extracted from DOM', { site: site ? site.id : 'generic', turns: messages.length });
    return { title: document.title.replace(/\s*[|·—-]\s*(?:ChatGPT|Claude|Gemini|Grok|Perplexity|DeepSeek|Copilot).*$/i, '').trim(), messages };
  }

  function turnToMarkdown(turn, createTurndown) {
    const clone = turn.cloneNode(true);
    // Action rails ("Copy", "Regenerate", "Good response") are chrome, not
    // conversation, and they end up inline in the text otherwise.
    clone.querySelectorAll('button, [role="button"], svg, script, style, [aria-hidden="true"]').forEach(node => node.remove());
    if (createTurndown) {
      try {
        return createTurndown().turndown(clone.innerHTML).trim();
      } catch (error) {
        logger.error('Turndown failed on a chat turn', error);
      }
    }
    return (clone.textContent || '').trim();
  }

  function turnTimestamp(turn) {
    const time = turn.querySelector('time[datetime]');
    if (time) return time.getAttribute('datetime');
    const attribute = turn.getAttribute('data-timestamp') || turn.getAttribute('data-time');
    return attribute || '';
  }

  // Google's AI Mode is a conversation that does not look like one in the DOM:
  // there are no author-role attributes, no per-turn elements, and the class
  // names are build hashes that change without notice. Two things are stable —
  // the question is in the URL's q parameter, and the answer is Google's own
  // result column, data-container-id="main-col", which has been that for years.
  //
  // Signed out, the surface allows exactly one exchange. Signed in it allows
  // more, and each answer is appended to the same column; the follow-up
  // questions are rendered as headings whose text Google localises, so they are
  // read from the transcript rather than matched by a phrase.
  // Google marks each turn with its own heading — the question at level 2, the
  // answer at level 3 — which is the only per-turn structure the page has. The
  // headings exist for screen readers, so their wording is localised and cannot
  // be matched by phrase; the *levels* are what the transcript is cut along.
  function googleTurnHeadings(main) {
    const headings = Array.from(
      main.querySelectorAll('h1, h2, h3, h4, [role="heading"]')
    );
    return headings
      .map(node => ({ node, level: googleHeadingLevel(node) }))
      .filter(entry => entry.level === 2 || entry.level === 3);
  }

  function googleHeadingLevel(node) {
    const explicit = node.getAttribute('aria-level');
    if (explicit) return Number(explicit);
    const match = /^H([1-6])$/.exec(node.tagName || '');
    return match ? Number(match[1]) : 0;
  }

  // A heading reads "You said: <question>" or "AI Mode reply for <question>",
  // both localised. Everything up to the first colon is the label, and the rest
  // is the question — but a question may itself contain a colon, so only a
  // short leading label is treated as one.
  function googleHeadingText(node) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    const colon = text.indexOf(':');
    if (colon > 0 && colon <= 24) return text.slice(colon + 1).trim();
    return text;
  }

  // Google closes every answer with the same handful of controls. They are
  // buttons and status lines rather than prose, and they are localised, so they
  // are matched by what they are — a control, a file counter, a copy status —
  // rather than by their wording.
  const GOOGLE_FURNITURE = /^(copied to clipboard|failed to copy|show all|\d+ files?|shared|transcribing)/i;

  function googleAnswerFromNodes(nodes, createTurndown) {
    const holder = document.createElement('div');
    for (const node of nodes) holder.appendChild(node.cloneNode(true));

    holder.querySelectorAll('button, [role="button"], img[src^="data:"]').forEach(n => n.remove());
    // Status lines Google leaves behind after its buttons are gone.
    holder.querySelectorAll('div, span, p').forEach(n => {
      if (n.children.length === 0 && GOOGLE_FURNITURE.test((n.textContent || '').trim())) n.remove();
    });

    let markdown = '';
    try {
      markdown = createTurndown ? createTurndown().turndown(holder.innerHTML) : holder.textContent;
    } catch (error) {
      logger.error('Turndown failed on an AI Mode turn', error);
      markdown = holder.textContent;
    }
    return String(markdown || '')
      .split('\n')
      .filter(line => !GOOGLE_FURNITURE.test(line.trim()))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function extractGoogleAiMode(createTurndown) {
    const main = document.querySelector('[data-container-id="main-col"]');
    if (!main) return null;

    const query = new URLSearchParams(window.location.search).get('q') || '';
    const turns = googleTurnHeadings(main);

    // Every level-2 heading opens a turn; the level-3 heading under it opens
    // the answer, and the answer runs until the next turn begins.
    const messages = [];
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].level !== 2) continue;
      const question = googleHeadingText(turns[i].node);

      // Google gives its own sections a level-2 heading too — the source list,
      // for one. A turn is a question *with* an answer under it, so a heading
      // with no level-3 heading before the next turn is page furniture, not
      // something the user said.
      const answerHeading = turns[i + 1] && turns[i + 1].level === 3 ? turns[i + 1] : null;
      if (!answerHeading) continue;
      if (GOOGLE_FURNITURE.test(question)) continue;
      const nextTurn = turns.slice(i + 1).find(entry => entry.level === 2);
      const from = answerHeading.node;

      const nodes = [];
      for (let node = from.nextElementSibling; node; node = node.nextElementSibling) {
        if (nextTurn && (node === nextTurn.node || node.contains(nextTurn.node))) break;
        nodes.push(node);
      }
      const answer = googleAnswerFromNodes(nodes, createTurndown);

      if (question) messages.push({ role: 'user', text: question, time: '' });
      if (answer) messages.push({ role: 'assistant', text: answer, time: '' });
    }

    // No per-turn headings: a signed-out page, or a build that dropped them.
    // The old reading still holds — the question is in the URL and the column
    // is one answer — so it stands rather than returning nothing.
    if (!messages.length) {
      const answer = googleAnswerMarkdown(main, createTurndown);
      if (!answer) return null;
      if (query.trim()) messages.push({ role: 'user', text: query.trim(), time: '' });
      messages.push({ role: 'assistant', text: answer, time: '' });
    }

    logger.log('Google AI Mode captured', { turns: turns.length, messages: messages.length });

    return {
      title: query.trim() || document.title,
      messages
    };
  }

  // Google closes the answer column with its own furniture: a one-line "AI can
  // make mistakes" disclaimer, and after a thumbs-down a short feedback panel.
  // Both are localised — the disclaimer arrives in whatever language the IP
  // suggests — so they are recognised by shape rather than by phrase: a short
  // trailing block with no links, list, heading, table or code in it.
  //
  // The limits are deliberate. 120 characters keeps a real closing paragraph
  // (the answer's own "tell me more about X and I can be specific" runs well
  // past 200), and stopping after three blocks means a mistake trims a line or
  // two, never the answer.
  // Known remainder, measured rather than assumed: on a signed-out AI Mode page
  // two one-line notices survive this pass — the "AI can make mistakes"
  // disclaimer and one "a copy of this chat will be included" label. They sit
  // among the answer's own nodes rather than after them, so removing them by
  // position would mean guessing at the answer's last paragraph. About 90
  // characters out of 3,900; the panels that used to add 500 are gone.
  const FURNITURE_MAX_CHARS = 120;
  // Generous, because what is left after the panels are gone is a run of
  // one-line labels — a disclaimer, three copies of one notice, a thank-you —
  // and each is its own block. The 120-character rule is what protects the
  // answer, not this count.
  const FURNITURE_MAX_BLOCKS = 14;

  // The share row and the feedback panel are identified by where their links
  // point. Every string in them is translated; these hosts are not.
  const SHARE_AND_FEEDBACK_LINKS = [
    'a[href*="policies.google.com"]',
    'a[href*="support.google.com/legal"]',
    'a[href*="facebook.com/sharer"]',
    'a[href*="twitter.com/intent"]',
    'a[href*="x.com/intent"]',
    'a[href*="reddit.com/submit"]',
    'a[href*="api.whatsapp.com"]',
    'a[href*="wa.me"]',
    'a[href*="mail.google.com"]'
  ].join(', ');

  function isFurniture(element) {
    const text = (element.textContent || '').trim();
    if (!text || text.length > FURNITURE_MAX_CHARS) return false;
    return !element.querySelector('a, ul, ol, h1, h2, h3, h4, table, pre, code, img');
  }

  function trimGoogleFurniture(root) {
    // Walk the tail of the document rather than one branch of it: the closing
    // labels are not siblings of the answer, they are the last elements that
    // carry text, wherever they happen to hang.
    for (let removed = 0; removed < FURNITURE_MAX_BLOCKS; removed++) {
      const blocks = Array.from(root.querySelectorAll('*'))
        .filter(el => ownTextLength(el) > 0);
      const last = blocks[blocks.length - 1];
      if (!last) break;
      // Climb to the outermost element that still says only this much: the
      // label usually sits in two or three nested wrappers of its own.
      let block = last;
      while (block.parentElement && block.parentElement !== root &&
             (block.parentElement.textContent || '').trim() === (block.textContent || '').trim()) {
        block = block.parentElement;
      }
      if (!isFurniture(block)) break;
      // A short phrase inside a real paragraph (a bold span, a citation label)
      // has a parent that says much more than it does. A disclaimer's own
      // wrapper does not: climbing above already stopped at the whole label.
      const parentText = block.parentElement && block.parentElement !== root
        ? (block.parentElement.textContent || '').trim()
        : '';
      if (parentText.length > FURNITURE_MAX_CHARS && parentText !== (block.textContent || '').trim()) break;
      block.remove();
    }
  }

  function ownTextLength(element) {
    let length = 0;
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 3) length += (child.nodeValue || '').trim().length;
    }
    return length;
  }

  // The address bar carries a fresh tracking token on every load. The page
  // itself is the query in AI Mode, and that is the URL worth citing.
  function pageUrl() {
    try {
      const loc = new URL(window.location.href);
      const params = new URLSearchParams(loc.search);
      if (params.get('udm') === '50') {
        return loc.origin + '/search?udm=50&q=' + encodeURIComponent(params.get('q') || '');
      }
    } catch (error) {
      // A URL the browser handed us and still could not parse: keep it whole.
    }
    return window.location.href;
  }

  // Citation chips are an empty link (the icon) next to a button that says
  // the source name. Left alone, Turndown writes [](/goto?url=…), and the
  // token in that path is not an address. The name the pill already shows is.
  // The pill is only the chip when every child is the empty link, a button, or
  // hidden decoration. Anything else means the link sits inside the sentence,
  // and replacing the parent would delete the words around it.
  function isChipOnly(pill, link) {
    const children = pill.childNodes;
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node === link) continue;
      if (node.nodeType === 8) continue;
      if (node.nodeType === 3 && !(node.nodeValue || '').trim()) continue;
      if (node.nodeType === 1 && (node.getAttribute('aria-hidden') === 'true' || node.tagName === 'BUTTON')) continue;
      return false;
    }
    return true;
  }

  function replaceCitationChips(clone) {
    clone.querySelectorAll('a[href*="goto?url="]').forEach(link => {
      if ((link.textContent || '').trim()) return;
      const pill = link.parentElement;
      const aria = (link.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      let label = aria;
      let host = link;
      if (pill && pill !== clone && isChipOnly(pill, link)) {
        label = (pill.innerText || '').replace(/\s+/g, ' ').trim() || aria;
        host = pill;
      }
      if (!label || label.length > 80) {
        link.remove();
        return;
      }
      host.replaceWith(clone.ownerDocument.createTextNode(' (' + label + ')'));
    });
  }

  // Section titles are role="heading" divs. Turndown does not treat a role as
  // a heading, so the outline was coming out as plain lines between rules.
  function promoteHeadings(clone) {
    clone.querySelectorAll('[role="heading"]').forEach(node => {
      const level = googleHeadingLevel(node);
      if (level < 2 || level > 4) return;
      const heading = clone.ownerDocument.createElement('h' + level);
      heading.textContent = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!heading.textContent) return;
      node.replaceWith(heading);
    });
  }

  // The disclaimer and the "a copy of this chat will be included" notice are
  // short lines with no markup, in whatever language the page is in, and they
  // sit after the answer. A real closing paragraph of the answer runs well
  // past this, which is the same bound the DOM trim uses.
  function trimTrailingLines(markdown) {
    const lines = String(markdown || '').split('\n');
    let removed = 0;
    while (lines.length && removed < FURNITURE_MAX_BLOCKS) {
      const last = lines[lines.length - 1].trim();
      if (!last) {
        lines.pop();
        continue;
      }
      if (last.length > FURNITURE_MAX_CHARS || /^[#>*\-+|]/.test(last) || last.includes('](')) break;
      lines.pop();
      removed++;
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function googleAnswerMarkdown(main, createTurndown) {
    const clone = main.cloneNode(true);
    // Feedback rails, "show more" affordances and the sources carousel are
    // chrome around the answer, not the answer.
    // The feedback panel first, while it is still recognisable. It is a block of
    // controls closing with Google's own policy links, and those URLs are the
    // one part of it that is never translated — unlike every string in it.
    clone.querySelectorAll(SHARE_AND_FEEDBACK_LINKS)
      .forEach(link => {
        const panel = link.closest('div');
        if (panel && panel !== clone) panel.remove();
      });

    // Share sheets and feedback prompts are dialogs, and ARIA roles are the one
    // part of Google's markup that is neither hashed nor translated.
    clone.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="tooltip"], [role="alert"], [role="status"]')
      .forEach(node => node.remove());

    replaceCitationChips(clone);
    promoteHeadings(clone);
    clone.querySelectorAll('hr').forEach(node => node.remove());
    // Share-sheet titles. The answer's own sections are level 2–3, promoted
    // above; a short h1 in this column is the dialog, not the answer.
    clone.querySelectorAll('h1').forEach(node => {
      if ((node.textContent || '').trim().length < FURNITURE_MAX_CHARS) node.remove();
    });

    clone.querySelectorAll('button, [role="button"], [role="navigation"], [role="listbox"], svg, style, script')
      .forEach(node => node.remove());

    // The action rail under the answer — copy, share, good response, bad
    // response, and the acknowledgement that replaces them — is built from
    // tooltips the page hides from assistive technology. Google says they are
    // not content; taking it at its word costs nothing, because the answer
    // itself is never hidden from a screen reader.
    clone.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
    // Google hangs a citation chip on the end of most sentences. The chip is an
    // icon, so the link has no text of its own and Turndown writes an empty
    // link — "[](https://…)" — into the middle of the prose. The citation is
    // worth nothing without its label, and the sentence reads worse with it.
    clone.querySelectorAll('a').forEach(link => {
      if (!(link.textContent || '').trim()) link.remove();
    });
    trimGoogleFurniture(clone);
    let markdown = '';
    if (createTurndown) {
      try {
        markdown = createTurndown().turndown(clone.innerHTML).trim();
      } catch (error) {
        logger.error('Turndown failed on the AI Mode answer', error);
      }
    }
    if (!markdown) markdown = (clone.textContent || '').trim();
    return trimTrailingLines(markdown);
  }

  // The source column is a second list of the same cards: the one on screen,
  // and a hidden copy whose text nodes are sn._setImageSrc(…, 'data:image…')
  // calls. That second copy is what a full-page conversion dumps as base64.
  // The card's own link is /goto?url=<opaque>, which is not an address either;
  // the publisher site is on the favicon URL beside the card.
  function publisherSite(card) {
    const html = card.innerHTML || '';
    const found = html.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^"'\\\s<]*/gi) || [];
    for (let i = 0; i < found.length; i++) {
      let host = '';
      let origin = '';
      try {
        const url = new URL(found[i]);
        host = url.hostname;
        origin = url.origin;
      } catch (error) {
        continue;
      }
      if (/gstatic|google|ggpht|youtube|googleapis|googleusercontent/i.test(host)) continue;
      return origin;
    }
    return '';
  }

  function sourceTitle(link) {
    return (link.getAttribute('aria-label') || '')
      .replace(/\.\s+[^.0-9]{1,48}\.\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function googleSourceEntries() {
    const column = document.querySelector('[data-container-id="rhs-col"]');
    if (!column) return [];
    const seen = new Set();
    const entries = [];
    column.querySelectorAll('li').forEach(card => {
      const link = card.querySelector('a[href*="goto?url="]');
      if (!link) return;
      const key = link.getAttribute('href') || '';
      if (!key || seen.has(key)) return;
      const title = sourceTitle(link);
      if (!title) return;
      seen.add(key);
      const lines = (card.innerText || '').split('\n').map(line => line.trim()).filter(Boolean);
      const dirty = /setImageSrc|data:image/i.test(card.textContent || '') || lines.length < 2;
      let publisher = '';
      let snippet = '';
      if (!dirty) {
        publisher = lines[0] || '';
        if (publisher === title) publisher = '';
        snippet = lines.length > 2 ? lines.slice(2).join(' ') : (lines[1] && lines[1] !== title ? lines[1] : '');
      }
      entries.push({
        title,
        publisher,
        snippet,
        site: publisherSite(card)
      });
    });
    return entries;
  }

  function escapeLinkText(text) {
    return text.replace(/[\[\]]/g, '');
  }

  function googleSourcesMarkdown() {
    const entries = googleSourceEntries();
    if (!entries.length) return '';
    const items = entries.map(entry => {
      const title = escapeLinkText(entry.title);
      const linked = entry.site ? `[${title}](${entry.site})` : title;
      const who = entry.publisher && entry.publisher !== entry.title ? ` — ${entry.publisher}` : '';
      const snippet = entry.snippet ? `\n  ${entry.snippet}` : '';
      return `- ${linked}${who}${snippet}`;
    });
    return `## Sources\n\n${items.join('\n')}`;
  }

  // The search page around an AI Mode answer is chrome: the tab strip, the
  // sign-in button, the voice-search prompts, and a hidden copy of the source
  // list that is mostly base64. The page worth copying is the answer, and on
  // a full-page copy the source column beside it.
  function convertPage(settings, deps) {
    logger = (deps && deps.logger) || logger;
    const createTurndown = deps && deps.createTurndown;
    const site = getSite(window.location);
    if (!site || site.id !== 'google-ai' || !isThreadUrl(site, window.location)) return null;

    const main = document.querySelector('[data-container-id="main-col"]');
    if (!main) return null;
    const answer = googleAnswerMarkdown(main, createTurndown);
    if (!answer) return null;

    const query = (new URLSearchParams(window.location.search).get('q') || '').trim() || document.title;
    let markdown = `# ${query}\n\n${answer}`;
    if (settings && settings.contentScope === 'fullPage') {
      const sources = googleSourcesMarkdown();
      if (sources) markdown += `\n\n${sources}`;
    }

    return {
      markdown,
      url: pageUrl(),
      articleData: {
        title: query,
        author: '',
        siteName: site.label,
        publishedTime: '',
        excerpt: answer.slice(0, 300)
      }
    };
  }

  // ==========================================================================
  // EXCHANGES
  // ==========================================================================

  // One exchange = a user turn plus everything the assistant said in reply.
  // Leading assistant turns (a greeting before the first prompt) form their own
  // group so nothing silently disappears.
  function groupExchanges(messages) {
    const groups = [];
    let current = null;
    messages.forEach(message => {
      if (message.role === 'user') {
        current = { messages: [message] };
        groups.push(current);
      } else if (current) {
        current.messages.push(message);
      } else {
        groups.push({ messages: [message] });
        current = null;
      }
    });
    return groups;
  }

  function resolveLimit(settings) {
    const raw = settings && settings.chatExchangeLimit;
    if (raw === 'all' || raw === 0) return Infinity;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function render(conversation, site, settings) {
    const groups = groupExchanges(conversation.messages);
    const limit = resolveLimit(settings);
    const kept = limit === Infinity ? groups : groups.slice(-limit);
    const messages = kept.reduce((all, group) => all.concat(group.messages), []);
    if (!messages.length) return null;

    // A local front-end has no brand name; the origin is the honest label.
    const label = (site && site.label) || window.location.hostname || 'Chat';
    const header = [
      `# ${conversation.title || 'Conversation'}`,
      '',
      `**Source:** ${label} — ${pageUrl()}`,
      `**Exchanges:** ${kept.length} of ${groups.length}${limit === Infinity ? '' : ` (last ${Math.min(limit, groups.length)})`}`,
      `**Messages:** ${messages.length}`,
      `**Exported:** ${formatTime(new Date().toISOString())}`
    ].join('\n');

    // Each turn is its own block with a role and a time, so a model reading the
    // transcript can tell them apart and quote them.
    const body = messages.map(message => {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      const time = formatTime(message.time);
      return `### ${role}${time ? ` · ${time}` : ''}\n\n${message.text}`;
    }).join('\n\n---\n\n');

    return {
      markdown: `${header}\n\n---\n\n${body}`,
      articleData: {
        title: conversation.title || document.title,
        author: '',
        siteName: label,
        publishedTime: '',
        excerpt: (messages[0].text || '').slice(0, 300)
      }
    };
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  // Cheap probe for the popup: is this page a conversation worth offering the
  // button for, and how many exchanges are in it.
  function inspect() {
    const site = getSite(window.location);
    const onThread = site ? isThreadUrl(site, window.location) : false;
    const turns = collectTurns();
    const labelled = turns.filter(turn => roleFromAttributes(turn) || roleFromHints(turn)).length;

    const exchanges = turns.length ? groupExchanges(
      turns.map((turn, index) => ({
        role: roleFromAttributes(turn) || roleFromHints(turn) || (index % 2 === 0 ? 'user' : 'assistant'),
        text: 'x'
      }))
    ).length : 0;

    // A known chat host on a thread URL is enough on its own. Anywhere else we
    // require the page to say who is speaking on most turns — otherwise a
    // comment thread or a forum would light the button up on a page that has
    // no conversation to copy.
    const knownChat = !!site && onThread && (!!site.api || !!site.extract || turns.length >= 2);
    const looksLikeChat = turns.length >= 4 && labelled >= Math.ceil(turns.length / 2);

    return {
      isChat: knownChat || looksLikeChat,
      site: site ? site.id : null,
      label: (site && site.label) || window.location.hostname,
      exchanges
    };
  }

  // Returns { markdown, articleData }, or null when this page holds no
  // conversation (caller falls back to the generic extractor).
  async function convert(settings, deps) {
    logger = (deps && deps.logger) || logger;
    const createTurndown = deps && deps.createTurndown;
    const site = getSite(window.location);

    if (site && site.api && isThreadUrl(site, window.location)) {
      try {
        const conversation = await site.api(window.location);
        if (conversation && conversation.messages.length) {
          return render(conversation, site, settings || {});
        }
      } catch (error) {
        // The API is the better source, not the only one: fall through to the
        // DOM rather than failing the copy outright.
        logger.error(`${site.label} API unavailable, using the rendered page`, error);
      }
    }

    // A site with its own extractor knows something the generic reader cannot
    // work out from the markup alone.
    if (site && site.extract && isThreadUrl(site, window.location)) {
      const captured = site.extract(createTurndown);
      if (captured && captured.messages.length) {
        return render(captured, site, settings || {});
      }
    }

    const scraped = extractFromDom(site, createTurndown);
    if (!scraped) return null;
    return render(scraped, site, settings || {});
  }

  return {
    getSite,
    inspect,
    convert,
    convertPage,
    // Exposed for tests
    _internals: {
      extractGoogleAiMode,
      googleTurnHeadings,
      googleHeadingText, groupExchanges, resolveLimit, walkActiveBranch, roleFromHints, collectTurns, render, SITES }
  };
})();

if (typeof window !== 'undefined') {
  window.ScrapLLMChat = ScrapLLMChat;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrapLLMChat;
}
