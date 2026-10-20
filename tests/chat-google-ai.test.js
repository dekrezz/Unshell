/**
 * @jest-environment-options {"url": "https://www.google.com/search?q=How+do+heat+pumps+work%3F&udm=50"}
 */
// Google AI Mode: Copy Chat, and copying the page.
//
// The fixtures are reconstructed, not captured. Nobody has recorded a live AI
// Mode thread for these tests, and neither model below has been checked
// against a live page. They follow the model the extractor is built on — one
// data-container-id="main-col" per answer, the question a level-2 heading
// outside it, citation chips that are an empty /goto?url=<opaque> link beside
// a button carrying the label, the source cards in rhs-col — and they carry
// the class names two third-party exporters read off the live page
// (google-ai-canvas-exporter 5.0.3, AfterChat 1.23): the turn div.CKgc1d in
// [data-xid="aim-mars-turn-root"], the question h2.iMqumd "You said: …" (a
// level-2 heading, so both models agree on it), the answer .pWvJNd /
// [data-xid="VpUvz"], chips span.WBgIic with a.PMDqCb, the action rail
// .DBd2Wb, and formulas as [data-xpm-latex] images in .mTEjhd (inline) and
// .cPGBZb (block).
//
// jsdom has no layout. Every scrollHeight and clientHeight is 0 and there is
// no document.scrollingElement, so the extractor's scroll walk finds no
// scroller and reads the page once, after a single 60 ms wait. Real timers
// are used for that wait: it is short, and fake timers would only add a way
// for the awaited loop to hang. The one test that needs the walk gives a
// container a height and a scrollTop that mounts and unmounts turns the way a
// virtualised thread does.
//
// jsdom has no innerText either (jsdom#1245). For an element that is not
// being rendered the HTML spec defines innerText as its textContent, so that
// is what the extractor gets here.
//
// Requirements, one or more tests each:
//   R1  a question asked twice survives twice, each with its own answer, in order
//   R2  the localised "You said:" label is cut, a colon the question holds is not
//   R3  formulas are written as LaTeX ($…$ inline, $$ blocks), verbatim
//   R4  route detection: saved thread yes, empty home no, plain search no, /ai yes
//   R5  a thread that cannot be read throws a sentence naming Google AI Mode and
//       what was missing, and the content script hands that sentence to the popup
//   R6  the cited URL never carries an empty q= and never the mstk token
//   R7  regression guards for what the extractor already does
//   R8  Gemini is Gemini: only Google Search hosts are AI Mode
//   R9  an answer that ends in a list or a code block keeps all of it

const fs = require('fs');
const path = require('path');

// The extension's own converter, configured the way a copy configures it.
// turndown.js declares a global `var` and exports nothing.
window.TurndownService = new Function(
  fs.readFileSync(path.join(__dirname, '../extension/libs/turndown.js'), 'utf8') +
  '\nreturn TurndownService;'
)();
require('../extension/convert-core.js');
const ScrapLLMChat = require('../extension/chat.js');

const SETTINGS = { includeImages: true, includeLinks: true, preserveTables: true };
const createTurndown = () => window.ScrapLLMConvert.configureTurndownService(SETTINGS);
const extract = () => ScrapLLMChat._internals.extractGoogleAiMode(createTurndown);
const copyChat = (settings) => ScrapLLMChat.convert(
  Object.assign({ contentScope: 'chat' }, settings),
  { createTurndown }
);
const copyPage = (settings) => ScrapLLMChat.convertPage(settings, { createTurndown });

const BASE_URL = '/search?q=How+do+heat+pumps+work%3F&udm=50';

function goTo(url) {
  window.history.replaceState(null, '', url);
}

function show(html) {
  document.body.innerHTML = html;
}

function questionsOf(captured) {
  return captured.messages.filter(m => m.role === 'user').map(m => m.text);
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected a rejection, but the promise resolved');
}

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const RAIL =
  '<div class="DBd2Wb"><button aria-label="Copy">Copy</button><button aria-label="Share">Share</button>' +
  '<span aria-hidden="true">Good response</span><span aria-hidden="true">Bad response</span></div>';
const FEEDBACK =
  '<div class="RkJvxe"><div>Thanks for your feedback</div>' +
  '<a href="https://policies.google.com/privacy">Privacy Policy</a></div>';
const DISCLAIMER = '<div class="Fzsovc">AI responses may include mistakes.</div>';

function turn(question, answer) {
  return `
    <div data-xid="aim-mars-turn-root">
      <div class="CKgc1d">
        <div class="ilZyRc R7mRQb"><h2 class="iMqumd">${question}</h2></div>
        <div data-container-id="main-col">
          <div class="pWvJNd" data-xid="VpUvz">${answer}</div>
          ${RAIL}
          ${FEEDBACK}
          ${DISCLAIMER}
        </div>
      </div>
    </div>`;
}

const GOTO_TOKEN = 'CAESJGh0dHBzOi8vd3d3LmVuZXJneS5nb3Y';

const SOURCES = `
  <div data-container-id="rhs-col">
    <ul>
      <li><a href="/goto?url=${GOTO_TOKEN}" aria-label="Heat pump systems. Energy.gov.">` +
        '<img src="https://t0.gstatic.com/faviconV2?url=https://www.energy.gov/">' +
        `<div>Energy.gov</div><div>Heat pump systems</div></a></li>
    </ul>
  </div>`;

const PROMPT_BOX = '<div data-xid="aim-mars-input-plate"><textarea aria-label="Ask anything">Ask anything</textarea></div>';

function thread(...turns) {
  return `<div id="rcnt">${turns.join('')}</div>${SOURCES}${PROMPT_BOX}`;
}

function paragraph(text) {
  return `<div class="n6owBd">${text}</div>`;
}

const CHIP =
  '<span class="WBgIic">' +
  `<a class="PMDqCb" href="/goto?url=${GOTO_TOKEN}">` +
  '<img aria-hidden="true" src="https://t0.gstatic.com/faviconV2?url=https://www.energy.gov/"></a>' +
  '<button>Energy.gov +1</button></span>';

const HEAT_ANSWER = `
  <div class="n6owBd">A heat pump moves heat from one place to another instead of generating it, which is why it can deliver several units of heat for every unit of electricity it uses.${CHIP}</div>
  <div role="heading" aria-level="2">The refrigeration cycle</div>
  ${paragraph('Refrigerant evaporates in the outdoor coil and absorbs heat even from cold air, then a compressor raises its temperature so that it condenses indoors and releases that heat.')}
  <div role="heading" aria-level="3">Efficiency</div>
  <ul><li>A coefficient of performance of 3 to 4</li><li>Works below freezing</li></ul>
  ${paragraph('Modern cold-climate models keep most of their rated output down to about minus fifteen degrees Celsius, so a backup heater is rarely needed in mild regions.')}`;

const TOML_ANSWER = `
  ${paragraph('Since Python 3.11 the standard library ships tomllib, which parses TOML into plain dictionaries; on older versions the tomli package offers exactly the same interface.')}
  <div role="heading" aria-level="2">Example</div>
  ${paragraph('Open the file in binary mode and pass it to tomllib.load, which returns a dictionary of tables, arrays and values that you can index like any other mapping.')}`;

const HEAT_PUMPS = thread(
  turn('You said: How do heat pumps work?', HEAT_ANSWER),
  turn('You said: Python: which library reads TOML?', TOML_ANSWER)
);

const STORY_START = 'Elin had kept the light on Skarv Island for eleven winters, and in all that time no ship had passed close enough for her to see a face on deck.';
const STORY_MIDDLE = 'Then one night in March a small boat came in under the beam with its sail torn, and the man at the tiller raised a hand as if he had expected her.';
const STORY_END = 'She rowed out at first light, found the boat empty and dry on the shingle, and never told anyone in the village what she had seen from the gallery.';
const STORY_TITLE = 'A fitting title would be The Keeper of Skarv, since the story turns on what Elin alone sees from the lamp room and chooses never to tell anyone else.';

const INLINE_TEX = 'Q_h = W + Q_c';
const COP_TEX = String.raw`\mathrm{COP} = \frac{Q_h}{W} \le \frac{T_h}{T_h - T_c}`;
const CARNOT_TEX = String.raw`\eta_{\text{Carnot}} = 1 - \frac{T_c}{T_h}`;

const COP_ANSWER = `
  <div class="n6owBd">By the first law the heat delivered indoors is the work done plus the heat drawn from outside, <span class="mTEjhd"><img aria-hidden="true" data-xpm-latex="${INLINE_TEX}" src="data:image/png;base64,AAAA"></span>, which is why the coefficient of performance can exceed one.</div>
  <div class="cPGBZb"><img data-xpm-latex="${COP_TEX}" alt="COP" src="data:image/png;base64,BBBB"></div>
  ${paragraph('Real machines reach roughly half of that ideal, because the compressor, the fans and the defrost cycles all lose energy that the Carnot bound does not count.')}
  <div class="cPGBZb"><img data-xpm-latex="${CARNOT_TEX}" alt="Carnot efficiency" src="data:image/png;base64,CCCC"></div>`;

// Markup no build of AI Mode has used, on an AI Mode thread URL.
const UNKNOWN_MARKUP = '<div id="rcnt"><div class="zzNew">An answer in markup nobody has seen before.</div></div>';

// The same, but shaped so the generic chat reader would happily take it.
const GENERIC_CHAT =
  '<div id="rcnt"><div class="message-row">How do heat pumps work?</div>' +
  '<div class="message-row">They move heat rather than make it.</div></div>';

const SEARCH_RESULTS =
  '<div id="search"><div class="g"><a href="https://www.energy.gov/heat-pumps">' +
  '<h3>Heat Pump Systems | Department of Energy</h3></a></div></div>';

// --------------------------------------------------------------------------

describe('Google AI Mode', () => {
  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent;
      }
    });
  });

  afterAll(() => {
    delete window.HTMLElement.prototype.innerText;
  });

  beforeEach(() => {
    // jsdom prints "Not implemented: window.scrollTo" for the walk's restore.
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    goTo(BASE_URL);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('R1: a question asked twice', () => {
    it('keeps both, each with its own answer, in order', async () => {
      goTo('/search?q=Write+a+story+about+a+lighthouse+keeper&udm=50');
      show(thread(
        turn('You said: Write a story about a lighthouse keeper', paragraph(STORY_START)),
        turn('You said: continue', paragraph(STORY_MIDDLE)),
        turn('You said: continue', paragraph(STORY_END))
      ));

      const captured = await extract();
      expect(captured.messages.map(m => [m.role, m.text])).toEqual([
        ['user', 'Write a story about a lighthouse keeper'],
        ['assistant', STORY_START],
        ['user', 'continue'],
        ['assistant', STORY_MIDDLE],
        ['user', 'continue'],
        ['assistant', STORY_END]
      ]);

      const page = await copyChat({ chatExchangeLimit: 10 });
      expect(page.markdown).toContain('**Exchanges:** 3 of 3');
    });

    it('keeps both while the scroll walk mounts and unmounts turns, without copying any turn twice', async () => {
      goTo('/search?udm=50&mtid=r1thread');
      const turns = [
        turn('You said: Write a story about a lighthouse keeper', paragraph(STORY_START)),
        turn('You said: continue', paragraph(STORY_MIDDLE)),
        turn('You said: continue', paragraph(STORY_END)),
        turn('You said: Give the story a title', paragraph(STORY_TITLE))
      ];
      show(`<div id="thread" style="overflow-y: auto"></div>${SOURCES}${PROMPT_BOX}`);
      const scroller = document.getElementById('thread');

      // Each turn is 400 px tall and 500 px of the thread are on screen, so
      // two turns are mounted at a time and every step of the walk shares a
      // turn with the step before it.
      const TURN_HEIGHT = 400;
      const VIEW_HEIGHT = 500;
      const bottom = turns.length * TURN_HEIGHT - VIEW_HEIGHT;
      let position = bottom; // the reader is at the end of the thread
      const visited = [];
      const mount = () => {
        const first = Math.floor(position / TURN_HEIGHT);
        const last = Math.min(turns.length - 1, Math.floor((position + VIEW_HEIGHT) / TURN_HEIGHT));
        scroller.innerHTML = turns.slice(first, last + 1).join('');
      };
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => turns.length * TURN_HEIGHT });
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => VIEW_HEIGHT });
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => position,
        set: (value) => {
          position = value;
          visited.push(value);
          mount();
        }
      });
      // Found either way: by its overflow on the way up from the first
      // column, or as the document's scroller.
      Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => scroller });
      mount();

      try {
        const captured = await extract();

        // The walk itself: from the top, down the thread, and back to where
        // the reader was.
        expect(visited[0]).toBe(0);
        expect(new Set(visited).size).toBeGreaterThan(2);
        expect(position).toBe(bottom);

        expect(captured.messages.map(m => [m.role, m.text])).toEqual([
          ['user', 'Write a story about a lighthouse keeper'],
          ['assistant', STORY_START],
          ['user', 'continue'],
          ['assistant', STORY_MIDDLE],
          ['user', 'continue'],
          ['assistant', STORY_END],
          ['user', 'Give the story a title'],
          ['assistant', STORY_TITLE]
        ]);
      } finally {
        delete document.scrollingElement;
      }
    });
  });

  describe('R2: the "You said:" label', () => {
    it('is cut when every question carries it, and a question with its own colon keeps it when there is no label', async () => {
      goTo('/search?udm=50&mtid=r2thread');

      show(thread(
        turn('Du hast gesagt: How do heat pumps work?', HEAT_ANSWER),
        turn('Du hast gesagt: Python: which library reads TOML?', TOML_ANSWER)
      ));
      expect(questionsOf(await extract())).toEqual([
        'How do heat pumps work?',
        'Python: which library reads TOML?'
      ]);

      show(thread(
        turn('How do heat pumps work?', HEAT_ANSWER),
        turn('Python: which library reads TOML?', TOML_ANSWER)
      ));
      expect(questionsOf(await extract())).toEqual([
        'How do heat pumps work?',
        'Python: which library reads TOML?'
      ]);
    });

    it('never cuts a lone question that is the one in the address bar, labelled or not', async () => {
      goTo('/search?q=Python%3A+which+library+reads+TOML%3F&udm=50');
      const headings = [
        'You said: Python: which library reads TOML?',
        'Du hast gesagt: Python: which library reads TOML?',
        'Python: which library reads TOML?'
      ];
      for (const heading of headings) {
        show(thread(turn(heading, TOML_ANSWER)));
        expect([heading, questionsOf(await extract())]).toEqual([
          heading,
          ['Python: which library reads TOML?']
        ]);
      }
    });
  });

  describe('R3: formulas', () => {
    it('are written as LaTeX, inline and as blocks, verbatim, including one that closes the answer', async () => {
      show(thread(turn('You said: Why can a heat pump beat 100% efficiency?', COP_ANSWER)));
      const { messages } = await extract();
      const answer = messages[1].text;

      expect(answer).toContain(`$${INLINE_TEX}$`);
      expect(answer).toContain(`$$\n${COP_TEX}\n$$`);
      const closing = `$$\n${CARNOT_TEX}\n$$`;
      expect(answer.slice(answer.length - closing.length)).toBe(closing);
      expect(answer).not.toContain('data:image');
      expect(answer).not.toMatch(/may include mistakes/);
    });
  });

  describe('R4: which addresses are a conversation', () => {
    it('a saved thread with no q is one; the empty AI Mode home is not', () => {
      goTo('/search?udm=50&mtid=abc123&mstk=tok456');
      show(HEAT_PUMPS);
      const saved = ScrapLLMChat.inspect();
      expect(saved.site).toBe('google-ai');
      expect(saved.isChat).toBe(true);

      goTo('/search?udm=50');
      show(PROMPT_BOX);
      expect(ScrapLLMChat.inspect().isChat).toBe(false);
    });

    it('an ordinary search is not one; the /ai and /aimode entry points with a question are', () => {
      goTo('/search?q=heat+pumps');
      show(SEARCH_RESULTS);
      expect(ScrapLLMChat.inspect().isChat).toBe(false);

      show(HEAT_PUMPS);
      for (const url of ['/ai?q=heat+pumps', '/aimode?q=heat+pumps']) {
        goTo(url);
        const info = ScrapLLMChat.inspect();
        expect([url, info.site, info.isChat]).toEqual([url, 'google-ai', true]);
      }
    });
  });

  describe('R5: a thread that cannot be read fails loudly', () => {
    beforeEach(() => {
      goTo('/search?udm=50&mtid=r5thread');
    });

    it('throws a sentence naming Google AI Mode and the question and answer it did not find', async () => {
      show(UNKNOWN_MARKUP);
      const error = await rejection(extract());
      expect(error.message).toMatch(/Google AI Mode/);
      expect(error.message).toMatch(/question/i);
      expect(error.message).toMatch(/answer/i);
    });

    it('Copy Chat throws it rather than handing the page to the generic chat reader', async () => {
      show(GENERIC_CHAT);
      const error = await rejection(copyChat({ chatExchangeLimit: 10 }));
      expect(error.message).toMatch(/Google AI Mode/);
    });

    it('copying the page throws it too', async () => {
      show(UNKNOWN_MARKUP);
      const error = await rejection(copyPage({ contentScope: 'mainContent' }));
      expect(error.message).toMatch(/Google AI Mode/);
    });

    it('a question with no answer text under it throws and says so', async () => {
      show(thread(turn('You said: How do heat pumps work?', '')));
      const error = await rejection(extract());
      expect(error.message).toMatch(/Google AI Mode/);
      expect(error.message).toMatch(/no answer/i);
    });
  });

  describe('R5: the content script hands that sentence to the popup', () => {
    let listener;

    beforeAll(() => {
      global.chrome.runtime = { onMessage: { addListener: jest.fn() } };
      require('../extension/content.js');
      listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
    });

    afterAll(() => {
      delete global.chrome.runtime;
    });

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(window.ScrapLLMConvert, 'convertDocument')
        .mockReturnValue({ markdown: '# heat pumps\n\nHeat Pump Systems | Department of Energy' });
    });

    // The popup prints response.error; response.details is never shown.
    const ask = (settings) => new Promise(resolve => {
      listener({ action: 'convertToMarkdown', settings }, {}, resolve);
    });

    it('Copy Chat on an AI Mode thread it cannot read shows why, not "An error occurred"', async () => {
      goTo('/search?udm=50&mtid=r5thread');
      show(UNKNOWN_MARKUP);
      const response = await ask({ contentScope: 'chat', chatExchangeLimit: 10 });
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Google AI Mode/);
    });

    it('copying that page shows the same sentence and does not fall back to the page reader', async () => {
      goTo('/search?udm=50&mtid=r5thread');
      show(UNKNOWN_MARKUP);
      const response = await ask({ contentScope: 'mainContent' });
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Google AI Mode/);
      expect(window.ScrapLLMConvert.convertDocument).not.toHaveBeenCalled();
    });

    it('an ordinary Google search page is converted as a page, not refused as an AI Mode thread', async () => {
      goTo('/search?q=heat+pumps');
      show(SEARCH_RESULTS);
      const response = await ask({ contentScope: 'mainContent' });
      expect(response.success).toBe(true);
      expect(window.ScrapLLMConvert.convertDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('R6: the cited address', () => {
    it('is the question when there is one, the thread id when there is not, never an empty q= and never mstk', async () => {
      show(HEAT_PUMPS);

      goTo('/search?q=How+do+heat+pumps+work%3F&udm=50&ved=2ahUKEwi&ei=Xy1');
      const asked = await copyChat({});
      expect(asked.url).toBe('https://www.google.com/search?udm=50&q=How%20do%20heat%20pumps%20work%3F');

      goTo('/search?udm=50&mtid=8f2c41aa&mstk=AUtExfC9q&ved=2ahUKEwi');
      const saved = await copyChat({});
      expect(saved.url).not.toMatch(/[?&]q=(?:&|$)/);
      expect(saved.url).toContain('mtid=8f2c41aa');
      expect(saved.url).not.toMatch(/mstk|AUtExfC9q/);
      expect(saved.markdown).toContain(`**Source:** Google AI Mode — ${saved.url}`);
    });
  });

  describe('R7: what already works', () => {
    beforeEach(() => {
      show(HEAT_PUMPS);
    });

    it('an answer\'s own section headings stay inside that answer', async () => {
      const { messages } = await extract();
      expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      expect(questionsOf({ messages })).toEqual([
        'How do heat pumps work?',
        'Python: which library reads TOML?'
      ]);
      expect(messages[1].text).toMatch(/^#{2,6} The refrigeration cycle$/m);
      expect(messages[1].text).toMatch(/^#{2,6} Efficiency$/m);
      expect(messages[1].text).toMatch(/^-\s+A coefficient of performance of 3 to 4$/m);
      expect(messages[3].text).toMatch(/^#{2,6} Example$/m);
    });

    it('a citation chip becomes the label it shows, never an empty link or the /goto token', async () => {
      const { messages } = await extract();
      expect(messages[1].text).toContain('Energy.gov +1');

      const page = await copyChat({});
      expect(page.markdown).not.toContain('[](');
      expect(page.markdown).not.toContain('goto?url=');
      expect(page.markdown).not.toContain(GOTO_TOKEN);
    });

    it('the action rail, feedback panel, disclaimer and prompt box stay out of the answers', async () => {
      const { messages } = await extract();
      const answers = messages.filter(m => m.role === 'assistant').map(m => m.text).join('\n');
      expect(answers).not.toMatch(
        /You said|\bCopy\b|\bShare\b|Good response|Bad response|Thanks for your feedback|Privacy Policy|may include mistakes|Ask anything/
      );
      expect(answers).not.toContain('How do heat pumps work?');
    });

    it('the copy holds every exchange, whatever the saved limit, and names Google AI Mode as its source', async () => {
      const page = await copyChat({ chatExchangeLimit: 1 });
      expect(page.markdown).toContain('**Exchanges:** 2 of 2');
      expect(page.markdown).not.toContain('(last');
      expect(page.markdown).toContain('**Source:** Google AI Mode');
    });
  });

  describe('R8: which Google hosts are AI Mode', () => {
    const siteOf = (url) => (ScrapLLMChat.getSite(new URL(url)) || {}).id || null;

    it('Gemini is read as Gemini, not as AI Mode', () => {
      expect(siteOf('https://gemini.google.com/app/1a2b3c4d')).toBe('gemini');
    });

    it('AI Mode is Google Search, on any country domain, and no other Google product', () => {
      expect(siteOf('https://www.google.com/search?q=heat+pumps&udm=50')).toBe('google-ai');
      expect(siteOf('https://google.com/ai?q=heat+pumps')).toBe('google-ai');
      expect(siteOf('https://www.google.co.uk/search?q=heat+pumps&udm=50')).toBe('google-ai');
      expect(siteOf('https://www.google.de/search?q=heat+pumps&udm=50')).toBe('google-ai');
      expect(siteOf('https://docs.google.com/document/d/1abc/edit')).not.toBe('google-ai');
      expect(siteOf('https://mail.google.com/mail/u/0/')).not.toBe('google-ai');
    });
  });

  describe('R9: the end of an answer is the answer\'s', () => {
    // Long enough that no trim takes it for a closing label.
    const LEAD = paragraph('Here is the short version of what to do, followed by the detail you asked for, kept to the essentials so that it fits on one screen.');

    it('a closing numbered list keeps every item', async () => {
      show(thread(turn('You said: How do I upgrade?', `${LEAD}<ol><li>Install the package</li><li>Run the migration</li></ol>`)));
      const answer = (await extract()).messages[1].text;
      expect(answer).toMatch(/^1\.\s+Install the package$/m);
      expect(answer).toMatch(/^2\.\s+Run the migration$/m);
      expect(answer).not.toMatch(/may include mistakes/);
    });

    it('a closing bulleted list keeps every item', async () => {
      show(thread(turn('You said: Why pick it?', `${LEAD}<ul><li>Fast</li><li>Small</li></ul>`)));
      const answer = (await extract()).messages[1].text;
      expect(answer).toMatch(/^-\s+Fast$/m);
      expect(answer).toMatch(/^-\s+Small$/m);
      expect(answer).not.toMatch(/may include mistakes/);
    });

    it('a closing code block survives whole', async () => {
      const code = 'import tomllib\nwith open("config.toml", "rb") as f:\n    config = tomllib.load(f)';
      show(thread(turn('You said: Show me the code', `${LEAD}<pre><code class="language-python">${code}</code></pre>`)));
      const answer = (await extract()).messages[1].text;
      expect(answer).toContain('```python\n' + code + '\n```');
      expect(answer).not.toMatch(/may include mistakes/);
    });
  });
});
