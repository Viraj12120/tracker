# Billing Tracker

A Next.js (App Router) application for parsing, managing, and exporting STAR and Amazon billing PDFs.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Initialize Database:
   Start the dev server and visit `http://localhost:3000/api/init` to create the SQLite schema.

3. Run Development Server:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Features
- Minimalist Dashboard for uploading PDFs
- Automatic regex extraction for STAR and AMAZON PDFs
- Edit parsed fields before saving
- View confirmed bills in a tabular format
- Export bills to Excel (`/api/export`)
