# Put ZenoBid on your own server and domain

Result: `https://auction.yourdomain.com` — anyone, anywhere, can open it. HTTPS is automatic.

## What you need

* **A Linux server with a public IP** — any small VPS works (1 vCPU / 1 GB RAM runs hundreds of connections): Hetzner, DigitalOcean, Linode, AWS Lightsail… Ubuntu 22.04 / 24.04 is assumed below.
  *Shared "cPanel" hosting usually can't run it: ZenoBid needs a Node process that stays running and WebSockets.*
* **A domain you control**, and permission to add a DNS record.
* Ports **80 and 443** reachable from the internet.

## 1 · Point your domain at the server

In your domain's DNS settings add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `auction` | *your server's IP address* |

(That makes `auction.yourdomain.com`; use `@` for the bare domain.) If you use Cloudflare, set the record to **DNS only** (grey cloud) while setting up; the orange proxy also works afterwards.
Check it: `ping auction.yourdomain.com` should show your server's IP (can take a few minutes).

## 2 · Prepare the server (once)

```bash
ssh youruser@YOUR_SERVER_IP

curl -fsSL https://get.docker.com | sudo sh        # installs Docker + Compose
sudo usermod -aG docker $USER && newgrp docker      # lets you run docker without sudo

# firewall (allow SSH FIRST so you don't lock yourself out)
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

## 3 · Get the app and start it

```bash
git clone -b claude/zeno-team-auction-app-bhi4m3 https://github.com/Zenild0/agent-hq-b5045.git
cd agent-hq-b5045/zeno-auction/deploy

cp .env.example .env
nano .env                    # set DOMAIN=auction.yourdomain.com   (save: Ctrl+O, Enter, Ctrl+X)

docker compose up -d --build # first build takes a few minutes
```

*Private repository?* Create a read-only **deploy key** (or a fine-grained token) in GitHub → Settings and clone with it.

## 4 · Check it works

```bash
docker compose ps                 # app: healthy, caddy: running
docker compose logs -f caddy      # look for "certificate obtained successfully"  (Ctrl+C to leave)
```

Open `https://auction.yourdomain.com`, click **Create an auction**, and open the **Share & links** tab —
the links there now use your domain, ready to send to captains and viewers.

## Everyday operations

| Task | Command (inside `zeno-auction/deploy`) |
|---|---|
| See logs | `docker compose logs -f app` |
| **Update** to the newest version | `git pull && docker compose up -d --build` |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` *(your data is kept)* |
| **Back up** all auctions + photos | `./backup.sh` → `deploy/backups/zenobid-DATE.tgz` |

*Updating restarts the app for a few seconds: open screens reconnect by themselves and auctions are saved to disk
on every change — still, avoid updating in the middle of a live event.*

**Automatic backups** — `crontab -e` and add (hourly):
`0 * * * * /home/youruser/agent-hq-b5045/zeno-auction/deploy/backup.sh >> /home/youruser/zenobid-backup.log 2>&1`

**Restore** a backup (stops the app, replaces the data, starts it again):
```bash
docker compose stop app
docker run --rm -v zenobid_zenobid-data:/data -v "$PWD/backups":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/zenobid-YYYY-MM-DD-HHMM.tgz -C /data"
docker compose start app
```

## Event-day checklist

1. `docker compose ps` — both services up; take a `./backup.sh`.
2. Open the site from a **different network** (your phone on mobile data) and run a **practice run**.
3. Check the big-screen tab on the computer you'll share in Zoom (sound + announcer voice).
4. Send each captain their personal link; keep the **admin link** to yourself.

## Server already runs nginx or Apache for other sites?

Ports 80/443 are taken, so use the alternative: 

```bash
docker compose -f docker-compose.behind-nginx.yml up -d --build   # app only, on 127.0.0.1:8787
sudo cp nginx.example.conf /etc/nginx/sites-available/zenobid      # edit server_name, then enable it
sudo ln -s /etc/nginx/sites-available/zenobid /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d auction.yourdomain.com                     # adds HTTPS
```
The `Upgrade` / `Connection` lines in that file are essential — without them the live screens fall back to slow polling.

## Without Docker (Node + systemd)

```bash
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx   # Node 20+ required (check: node -v)
sudo useradd -r -m -d /opt/zenobid zenobid && sudo mkdir -p /var/lib/zenobid && sudo chown zenobid /var/lib/zenobid
sudo -u zenobid git clone -b claude/zeno-team-auction-app-bhi4m3 https://github.com/Zenild0/agent-hq-b5045.git /tmp/zb
sudo -u zenobid cp -r /tmp/zb/zeno-auction/. /opt/zenobid/ && cd /opt/zenobid
sudo -u zenobid npm ci && sudo -u zenobid npm run build && sudo -u zenobid npm prune --omit=dev
sudo cp deploy/zenobid.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now zenobid
# then nginx + certbot exactly as in the section above
```

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| No HTTPS / browser warns | DNS not pointing at the server yet, or ports 80/443 blocked (cloud firewall / security group). `docker compose logs caddy` says why. |
| `502 Bad Gateway` | The app isn't healthy: `docker compose logs app`. |
| Screens feel slow, "Connection lost" appears repeatedly | Something between the browser and the app blocks WebSockets (a CDN setting, or nginx without the `Upgrade` lines). |
| "Too many wrong keys" for everyone | A real visitor address isn't reaching the app: make sure `TRUST_PROXY=true` (already set in the compose files) and that your proxy sets `X-Forwarded-For`. |
| Port 80 or 443 already in use | Another web server is running → use the nginx variant above. |
| Out of disk | Photos are in the data volume; `docker system df`, and delete old auctions' photos if needed. |

## Good to know

* **One instance only.** All live state is in one process (that's what keeps bids strictly ordered). Don't run two copies against the same data.
* **Where is my data?** In the Docker volume `zenobid_zenobid-data` (or `/var/lib/zenobid` without Docker): one JSON file per auction plus `uploads/`.
* **Keep secret:** the admin link, auctioneer link and captain PINs. The big-screen link and join code are meant to be shared.
* Optional settings (environment variables): `BAD_KEY_LIMIT` (wrong keys allowed per minute per visitor, default 120), `MAX_EVENTS` (default 2000).
