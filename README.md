# CONVERSE 2K26 — Event Management Platform


hey i am krish


Official platform built for **CONVERSE 2K26**, the flagship annual tech fest organized by the IT Department of **Sarvajanik College of Engineering & Technology (SCET), Surat**.

> 🏗️ Themed around LEGO bricks — every button, card, and animation feels like snapping together precision-engineered building blocks.

---

## 🌐 Live Website

Currently showing the **Memories Edition** (Static version)
🔗 **[itaiconverse.in](https://itaiconverse.in)**

---

## 📁 Project Structure

### 1. Static Version (`/static`)
A clean one-page website containing:
- Event memories & highlights
- Photos & videos from the fest
- Messages & acknowledgements

### 2. Full Version (`/full-version`)
Complete full-stack event management system that was used during the fest:

---

## 🚀 Features (Full Version)

### For Students
- 🔐 Google Sign-In with college email verification
- 📋 Onboarding flow to collect student details (enrollment, branch, year, etc.)
- 🎫 Online event registration with auto-generated **Entry Pass + QR Code**
- 📊 Personal Dashboard — view registered events, check-in status, and team info
- 👤 Profile page with editable details and event history
- 🗂️ Browse all events with filters by track (Tech, Non-Tech)

### For Admins (Master Panel)
- 🛠️ Complete Admin Dashboard to manage:
  - Users, Registrations & Events
  - Event posters, logos, timings, rules, descriptions, and venues
  - Team page roster (categories, members, photos, bios)
  - Sponsors, landing page content & site-wide settings
- 📧 **Bulk Email System** — send templated emails to all users, specific events, or custom email lists with real-time progress tracking
- 📥 **Bulk Registration Import** — upload CSV/Google Sheets to register students offline
- 📤 **CSV Export** — download registration data with verification sections
- 🔍 Live search & filtering across all registrations
- 👥 Sub-Admin management — assign volunteers to specific events

### For Volunteers (Sub-Admins)
- 📱 Limited-access panel for assigned event only
- 📷 **QR Code Scanner** — real-time scanning and instant check-in
- ✅ Mark attendance with one tap
- 📤 Export their event's attendance as CSV

### Team Page
- 🏆 Dedicated team page showcasing 16 categories and 138+ members
- 👨‍🏫 Faculty, Mentors, Heads, Coordinators — all auto-sorted by role priority
- 🖼️ Profile photos with fun bios and fun facts

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 19, TypeScript, TanStack Router, TanStack Start |
| **UI Components** | Radix UI, Shadcn/UI, Tailwind CSS 4 |
| **Animations** | Framer Motion, Custom LEGO-themed spring animations |
| **Backend** | Firebase Authentication, Cloud Firestore, Cloud Functions v2 |
| **Email System** | Nodemailer (Gmail SMTP) on Firebase Cloud Functions |
| **QR Codes** | `qrcode.react` (generation), `html5-qrcode` (scanning) |
| **Hosting** | Cloudflare Workers (Nitro/Vite SSR) |
| **Build Tools** | Vite 8, Nitro, Wrangler |

---

## 📊 Event Stats

| Metric | Count |
|:---|:---|
| Total Registered Users | 661 |
| Total Event Registrations | 1,800+ |
| Events Conducted | 7 |
| Team Members | 138 |
| Team Categories | 16 |

---

## 🎨 Design System — LEGO Brick Theme

The entire UI follows a custom **LEGO brick-inspired design language**:

- **BrickCard** — Cards with chunky outlines, drop shadows, and circular studs
- **BrickButton** — 3D buttons that lift on hover and depress on click
- **BrickInput** — Inputs styled as indented molded slots with glow-on-focus
- **Baseplate Navbar** — Navigation bar textured like a LEGO baseplate
- **Snap Animations** — Elements "snap" into place like bricks clicking together
- **Color Palette** — Deep Blue (`#003399`), LEGO Yellow (`#FFD700`), Brick Red (`#C91A09`)

---

## ⚡ Quick Start (Full Version)

### Prerequisites
- Node.js 18+
- npm
- Firebase project (Blaze plan for Cloud Functions)

### Installation

```bash
# Clone the repository
git clone https://github.com/MalharDhosa/scet-big-tech-fest-2026.git
cd scet-big-tech-fest-2026/full-version

# Install dependencies
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..

# Start development server
npm run dev
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy Firestore rules
npx firebase-tools deploy --only firestore:rules

# Deploy Cloud Functions
npx firebase-tools deploy --only functions
```

---

## 🔐 Security

- **Firestore Rules** — Role-based access control (master, sub-admin, participant)
- **Users** can only modify their own profile (cannot escalate role)
- **Sub-admins** can only check in registrations for their assigned event
- **Master admins** have full read/write access
- **Storage rules** restrict photo uploads by size and type

---

## 📌 Note

The full dynamic version is kept in this repository for **portfolio and learning purposes**.
The live website currently serves only the static memories page.

---

## 👤 Author

Built with ❤️ for CONVERSE 2K26 — IT Department, SCET, Surat

## 📄 License

This project is for educational and event management purposes. All rights reserved.
