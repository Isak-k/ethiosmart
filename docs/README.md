# EthioSmart Documentation

User and deployment documentation for the EthioSmart project.

## Getting started

- [Getting started](development/getting-started.md) — install, dev server, build, scripts
- [Architecture](architecture.md) — tech stack, data flow, folder structure

## Homepage chatbot

- [Chatbot overview](chatbot/README.md) — what the assistant is and is not
- [API reference](chatbot/api.md) — `POST /api/chatbot/ask`, errors, rate limits
- [Configuration](chatbot/configuration.md) — `GEMINI_API_KEY`, kill switch, model selection
- [Knowledge base](chatbot/knowledge-base.md) — verified facts the assistant may use
- [Troubleshooting](chatbot/troubleshooting.md) — common failures and fixes

## Deployment

- [Handoff & deployment guide](deployment/handoff.md) — complete steps for the new owner
- [Environment variables](deployment/environment.md) — full variable reference

## Reports

- [Chatbot verification report](reports/chatbot-verification.md) — what was tested and how

## Archive

- [Archive index](archive/README.md) — historical implementation notes and plans

Everything in `archive/` is preserved for reference. It is not required reading and may
describe designs that were later changed.
