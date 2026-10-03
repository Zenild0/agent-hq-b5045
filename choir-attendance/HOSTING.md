# Putting Children's Choir ZD online (Render)

This puts the app on an always-on server, so it keeps running when your laptop is closed, parents can open it on their phones, and you can take attendance from your phone too.

> Prices and button names below are from memory of Render's site: check them on render.com before you pay.

## Why Render and not Netlify
This app is a small Node server that saves everything (children, photos, hymn recordings) to a disk. Netlify runs short-lived functions with no disk, so the app would have to be rewritten and recordings above ~6 MB couldn't be uploaded. Render runs the app exactly as it is, with a disk that keeps your data.

## Before you start
1. On your computer, open the app → **Settings → Download backup**. Keep that `.tar` file safe. It holds everything.
2. Make a free account at https://render.com (sign up with GitHub).

## Create the service
1. **New + → Web Service** → connect GitHub → choose the `agent-hq-b5045` repository.
2. Fill in:
   - **Branch:** `claude/childrens-choir-attendance-r3d2st`
   - **Root Directory:** `choir-attendance`
   - **Runtime:** Node
   - **Build Command:** `echo ok`
   - **Start Command:** `node server.js`
   - **Instance type:** Starter (a paid instance is needed to keep a disk)
   - **Health Check Path:** `/healthz`
3. **Environment variables:**
   | Name | Value |
   |---|---|
   | `CHOIR_PIN` | a PIN only you know (8+ letters/digits). This is how you reach the teacher pages online |
   | `CHOIR_DATA` | `/data/db.json` |
   | `CHOIR_TRUST_PROXY` | `1` |
   | `NODE_VERSION` | `22` |
4. **Disks → Add Disk:** name `choir-data`, mount path `/data`, size `1 GB`. Photos, recordings and the database live here.
5. **Create Web Service.** After a few minutes you get an address like `https://childrens-choir-zd.onrender.com`.

(A ready-made `render.yaml` is in the repository root if you prefer Render's *Blueprint* option.)

## First-time setup
1. Open `https://<your-address>/teacher`. Enter your PIN. The browser remembers it on that device.
2. **Settings → Restore from backup** and pick the `.tar` file from step 1. Your children, attendance, hymns and photos appear.
3. **Settings → Website address to share with parents**: paste your address and save.
4. **Children → Parent access:** copy the link and codes to WhatsApp.
5. On a phone: open the address, then **Add to Home screen / Install app**.

## Looking after it
- **Backups:** Settings → Download backup, now and then (for example monthly, and before big changes).
- **Updates:** Render redeploys when new code is pushed to the branch.
- **Parents locked out together?** Tell me. That points to the proxy setting `CHOIR_TRUST_PROXY`.
