# AI policy

Unshell exists to feed web pages to language models, so this is not an anti-AI project. The maintainer works on it with Claude Code, and [AGENTS.md](AGENTS.md) is written for agents as much as for people.

The policy comes down to one rule:

> **A person opens the pull request, and that person answers for every line in it, whoever or whatever wrote it.**

Everything below follows from that.

## The rules

1. **Say exactly what you used.** Every pull request has a disclosure section. Tick "No AI" only if nothing was used, and that includes inline autocomplete. Otherwise name the tool and the exact model with its version, for example `Claude Code, Claude Opus 5.5` or `Cursor, GPT-5.1`. "Claude" or "ChatGPT" on its own is not an answer. Models in the same family write different code and make different mistakes, and the version tells the reviewer what to look for. Then say what the model did: autocomplete, the tests, a first draft of the extractor, all of it.

2. **The explain-it-back test.** A reviewer may point at any line and ask why it is there. Answer in your own words, without pasting the question into a model. If you can't answer, the pull request is closed. This isn't a punishment. Nobody can maintain a change that nobody can explain.

3. **Test on real pages yourself.** The template asks for the URLs where you tried the change. They must be pages you opened in a browser with the built extension loaded, not URLs a model listed. A model that says "tested on reddit.com" has tested nothing.

4. **People write the issues.** A model can translate or tidy your wording. The report itself has to describe what you saw: the URL, what you clicked, what was copied and what you expected instead. Include a model's theory about the cause only if you checked it, and label it as a theory.

5. **No generated media.** Screenshots and recordings in issues and pull requests must be real captures of the extension. The repository takes no generated images, icons or artwork.

6. **No unattended agents.** An agent can write code. It can't open pull requests, file issues or post comments on its own. A person reads the output and presses the button.

## Commits stay clean

Disclosure goes in the pull request, not in commit messages. AGENTS.md forbids `Co-Authored-By` trailers and "generated with" footers, and the pull request description is the record.

## Everyone, maintainer included

There are no exemptions. When the maintainer opens a pull request, it carries the same disclosure section and has to pass the same check.

## When the rules are broken

If a pull request hid its AI use, or its author fails the explain-it-back test, it is closed without further review. A second time gets the account blocked from the repository.

Honest disclosure is never a reason to reject a pull request. "A model wrote most of this, and here is how I checked it" is a perfectly good pull request.
