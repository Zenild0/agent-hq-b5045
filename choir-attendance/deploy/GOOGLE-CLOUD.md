# Free always-on hosting: Google Cloud + Cloudflare (zendias.com)

Result: `https://choir.zendias.com` works on every phone and tablet, 24/7, even when your laptop is off. The app updates itself from GitHub, and a backup is made every night.

> I (Claude) wrote and tested the update and backup scripts on a practice copy, but I could **not** test the Google and Cloudflare screens. Their button names change. If something doesn't match, stop and send me a screenshot.

**Time:** about 45 minutes. **Cost:** the domain (about $10–11 a year for a .com). The server stays free if you keep within Google's free limits (see "Staying free").

---

## Part 1: Get the domain (Cloudflare)
1. Create a free account at **cloudflare.com** and turn on **two-step sign-in** (Profile → Authentication).
2. **Domain Registration → Register Domains**, search `zendias.com`. It shows right away if it is free and the price. Buy it and turn on **auto-renew**. (If it's taken, tell me and we'll pick another.)
3. After you buy it, the domain appears under **Websites**. DNS is already managed by Cloudflare.

## Part 2: Google Cloud account (and a spending alert)
1. Go to **console.cloud.google.com**, sign in with your Google account, and accept the terms. Add a card when asked (it is a check; you are not charged inside the free limits). You may get free trial credits: when the trial ends, upgrade the account (the Always Free server stays free).
2. **Billing → Budgets & alerts → Create budget:** amount **$2**, and tick all the email alerts. This only emails you, but it warns you early.
3. Create a project: top bar → **New project** → name it `choir`.

## Part 3: Create the server
1. Menu → **Compute Engine → VM instances** → **Enable** the API if asked → **Create instance**.
2. Fill in:
   - **Name:** `choir-server`
   - **Region:** `us-east1` (South Carolina) (the free server must be in us-east1, us-central1 or us-west1)
   - **Machine configuration → Series E2, Machine type: `e2-micro`**
   - **Boot disk → Change:** **Debian 12**, boot disk type **Standard persistent disk**, size **30 GB**
   - **Firewall:** leave **Allow HTTP/HTTPS traffic UNticked** (we don't need open ports)
   - Leave the external IP as **Ephemeral** (don't reserve a static IP, it costs money)
3. Check the price box on the right: it should show the free-tier discount. Then **Create**.

## Part 4: Install the app (one paste)
1. In the VM list, click **SSH** next to `choir-server`. A browser terminal opens.
2. Paste this whole line and press Enter:
   ```
   curl -fsSL https://raw.githubusercontent.com/Zenild0/agent-hq-b5045/claude/childrens-choir-attendance-r3d2st/choir-attendance/deploy/setup.sh | sudo bash
   ```
3. It installs everything (a few minutes) and asks you to **choose a teacher PIN** (8+ letters/digits). Write it down. It finishes with `SUCCESS: the choir app is running`.
   (The PIN is saved only on the server, never on GitHub.)

## Part 5: Connect it to the domain (Cloudflare Tunnel)
The tunnel connects the server to Cloudflare, so no ports are open to the internet.
1. In Cloudflare open **Zero Trust** (left menu). If asked, choose the **Free** plan (it may ask for a payment method to verify you).
2. **Networks → Tunnels → Create a tunnel → Cloudflared** → name it `choir-server` → Save.
3. Choose **Debian**, **64-bit**. Copy the command shown that starts with `sudo cloudflared service install ...` and paste it into the **SSH window** from Part 4. When it says it is connected, go back to Cloudflare and click **Next**.
4. **Public hostname:** Subdomain `choir`, Domain `zendias.com`, **Type HTTP**, **URL** `localhost:3000` → Save.

## Part 6: First use
1. Open **https://choir.zendias.com/teacher**, enter your PIN.
2. **Settings → Restore from backup** and pick the backup file you downloaded from your laptop app (Settings → Download backup). Your children, photos and hymns appear.
3. **Settings → Website address to share with parents:** `https://choir.zendias.com` → save.
4. **Children → Parent access:** share the link and codes.
5. On phones and tablets: open the address → Add to Home screen. (Remove the older Tailscale shortcut.)

---

## Changing the app later
You ask me for a change here. I make it, run the tests, and push it to GitHub. **Within about 5 minutes your server downloads it and restarts** (a few seconds of pause). If a new version fails to start, the server **automatically goes back to the previous version**. Your data is never touched by updates.

Check on it any time (SSH window):
```
sudo journalctl -u choir-update -n 20 --no-pager     # update history
sudo systemctl status choir                         # is the app running?
sudo journalctl -u choir -n 40 --no-pager           # app messages
```

## Backups
- The server saves a backup every night at 02:30 (kept for 14 days) in `/var/backups/choir`.
- Those live on the **same server**, so also **download one yourself** now and then: Settings → Download backup. Keep it on your computer or Google Drive.
- To restore anywhere: Settings → Restore from backup.

## Staying free (Google's limits)
- One `e2-micro` server only, in us-east1 / us-central1 / us-west1, with a standard disk of 30 GB or less.
- Only about **1 GB of data out per month** is free. Photos are tiny; hymn recordings are the big ones. Cloudflare keeps a copy of most files, which reduces the traffic. If the budget alert emails you, tell me and we'll act.
- Don't add a reserved IP, a bigger disk or more servers.

## Safety
- No open ports; only the Cloudflare tunnel connects.
- The teacher area needs your PIN everywhere. Parents only see their own child with their code.
- Keep two-step sign-in on **Google, Cloudflare and GitHub**, and keep the domain on auto-renew.
- The code on GitHub is public. It contains no PIN and no children's data.

## Later: using your `main` branch
Right now the server follows the branch `claude/childrens-choir-attendance-r3d2st`. When you want, ask me to merge it into `main`, then on the server run:
`echo main | sudo tee /etc/choir-branch` and `sudo choir-update`.
