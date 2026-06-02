# Nexus Justice — Advocate Portal

A full-featured legal practice management portal for Kerala advocates,
powered by **Gemini 2.5 Flash** for all AI features.

## ✦ AI Stack

| Feature | Model |
|---|---|
| Chat / Legal Consult | Gemini 2.5 Flash |
| Document Drafting | Gemini 2.5 Flash |
| Legal Research | Gemini 2.5 Flash |
| Contract Review | Gemini 2.5 Flash |
| Case Briefs | Gemini 2.5 Flash |
| Clause Analysis | Gemini 2.5 Flash |
| OCR (fallback) | Gemini 2.5 Flash Vision |

## 🚀 Deploy to Vercel

### 1. Clone / upload this project

```bash
git init
git add .
git commit -m "Initial commit"
```

Push to GitHub, then import the repo in [vercel.com/new](https://vercel.com/new).

### 2. Set Environment Variables in Vercel Dashboard

Go to **Project → Settings → Environment Variables** and add:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `JWT_SECRET` | Any long random string (32+ chars) |
| `KV_REST_API_URL` | From Vercel KV storage |
| `KV_REST_API_TOKEN` | From Vercel KV storage |
| `SARVAM_API_KEY` | *(Optional)* Sarvam AI key for multilingual OCR/TTS |

### 3. Add Vercel KV

1. Go to **Project → Storage → Create Database → KV**
2. Link to your project — the `KV_REST_API_URL` and `KV_REST_API_TOKEN` are auto-added

### 4. Deploy

```bash
vercel --prod
```

Or just push to `main` — Vercel auto-deploys.

## 🛠 Local Development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

## Features

- 📋 Case management & hearing tracker
- 🤖 AI legal assistant (Gemini 2.5 Flash)
- 📝 Document drafting & vault
- 🔍 Legal research
- 🎙️ Voice-to-action assistant
- 📅 Deadline calculator
- 💳 Fee notes & billing
- 🌐 Malayalam / English support
- 📱 PWA — installable on mobile
