// How much of a conversation a chat copy takes.
//
// The default is by date: what was said in the last few days (3 unless the
// user picks otherwise). Dates come from the site's own data: ChatGPT's
// create_time and Claude's created_at through their APIs, a <time datetime> in
// the page elsewhere. A chat that carries no dates cannot be cut by date, so
// it is cut by the exchange count instead, and both the copy and the popup
// say so. A date range that holds nothing is an error naming the latest date,
// not an empty copy.

const UnshellChat = require('../extension/chat.js');

const { render } = UnshellChat._internals;
const SITE = { id: 'chatgpt', label: 'ChatGPT' };
const DAY = 24 * 60 * 60 * 1000;

function ago(ms) {
  return new Date(Date.now() - ms).toISOString();
}

// Three exchanges: ten days old, two days old, an hour old.
function dated() {
  return {
    title: 'Heat pumps',
    messages: [
      { role: 'user', text: 'Question from ten days ago', time: ago(10 * DAY) },
      { role: 'assistant', text: 'Answer from ten days ago', time: ago(10 * DAY - 60000) },
      { role: 'user', text: 'Question from two days ago', time: ago(2 * DAY) },
      { role: 'assistant', text: 'Answer from two days ago', time: ago(2 * DAY - 60000) },
      { role: 'user', text: 'Question from an hour ago', time: ago(60 * 60 * 1000) },
      { role: 'assistant', text: 'Answer from an hour ago', time: ago(59 * 60 * 1000) }
    ]
  };
}

function undated() {
  const conversation = dated();
  conversation.messages.forEach((message) => { message.time = ''; });
  return conversation;
}

describe('chat range', () => {
  it('by date keeps only the exchanges from the last N days and says which range it took', () => {
    const result = render(dated(), SITE, { chatRangeMode: 'days', chatDays: 3, chatExchangeLimit: 10 });
    expect(result.markdown).toContain('**Exchanges:** 2 of 3 (last 3 days)');
    expect(result.markdown).toContain('Question from two days ago');
    expect(result.markdown).toContain('Question from an hour ago');
    expect(result.markdown).not.toContain('ten days ago');
    expect(result.notice).toBeFalsy();
  });

  it('reads the number of days as the user set it', () => {
    const result = render(dated(), SITE, { chatRangeMode: 'days', chatDays: '30', chatExchangeLimit: 10 });
    expect(result.markdown).toContain('**Exchanges:** 3 of 3 (last 30 days)');
    expect(result.markdown).toContain('ten days ago');
  });

  it('says "day" for a one-day range', () => {
    const result = render(dated(), SITE, { chatRangeMode: 'days', chatDays: 1, chatExchangeLimit: 10 });
    expect(result.markdown).toContain('**Exchanges:** 1 of 3 (last 1 day)');
  });

  it('cuts a chat without dates by the exchange count instead, and says so in the copy and to the popup', () => {
    const result = render(undated(), SITE, { chatRangeMode: 'days', chatDays: 3, chatExchangeLimit: 1 });
    expect(result.markdown).toContain('**Exchanges:** 1 of 3 (last 1;');
    expect(result.markdown).toMatch(/no message dates/i);
    expect(result.markdown).toContain('Question from an hour ago');
    expect(result.markdown).not.toContain('two days ago');
    expect(result.notice).toMatch(/last 1 exchange\b/);
    expect(result.notice).toMatch(/no message dates/i);
  });

  it('treats a chat where only some exchanges are dated as undated', () => {
    const conversation = dated();
    conversation.messages[2].time = '';
    conversation.messages[3].time = '';
    const result = render(conversation, SITE, { chatRangeMode: 'days', chatDays: 3, chatExchangeLimit: 10 });
    expect(result.notice).toMatch(/no message dates/i);
    expect(result.markdown).toContain('**Exchanges:** 3 of 3 (last 10;');
  });

  it('throws when nothing is newer than the range, naming the latest message date', () => {
    const conversation = dated();
    conversation.messages = conversation.messages.slice(0, 2);
    expect(() => render(conversation, SITE, { chatRangeMode: 'days', chatDays: 3, chatExchangeLimit: 10 }))
      .toThrow(/newer than 3 days.*latest.*\d{4}-\d{2}-\d{2}/i);
  });

  it('takes the whole chat when asked to', () => {
    const result = render(dated(), SITE, { chatRangeMode: 'all', chatDays: 3, chatExchangeLimit: 1 });
    expect(result.markdown).toContain('**Exchanges:** 3 of 3');
    expect(result.markdown).not.toContain('(last');
  });

  it('cuts by the exchange count when that is the mode', () => {
    const result = render(dated(), SITE, { chatRangeMode: 'exchanges', chatDays: 3, chatExchangeLimit: 1 });
    expect(result.markdown).toContain('**Exchanges:** 1 of 3 (last 1)');
    expect(result.notice).toBeFalsy();
  });

  it('defaults to 3 days in the shared settings', () => {
    const SettingsUtils = require('../extension/settings.js');
    expect(SettingsUtils.DEFAULT_CHAT_RANGE).toEqual({ chatRangeMode: 'days', chatDays: 3, showChatRange: false });
  });
});
