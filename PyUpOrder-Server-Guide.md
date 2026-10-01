# PyUp-Order — Server Startup Guide
**Raspberry Pi 4 Production Server**

---

## Important Info

| Item | Value |
|------|-------|
| SSH IP (Tailscale) | `100.65.57.7` |
| SSH Username | `pyup-order` |
| App folder | `/home/pyup-order/PyUp-Order` |
| Public URL | `https://pyuporder.tail74d12c.ts.net` |
| Domain (when DNS ready) | `https://pyup-order.com` |

---

## Every Day Startup

### Step 1 — Power on the Raspberry Pi
- Plug in the power cable
- Wait **2 minutes** for it to fully boot

### Step 2 — SSH into the Pi (from Mac/PC)
Open **Terminal** on your Mac and type:
```bash
ssh pyup-order@100.65.57.7
```
Enter your password when asked.

> ✅ The Tailscale IP **100.65.57.7 never changes** — you can always use this address from anywhere in the world as long as Tailscale is running on your Mac.

### Step 3 — Everything is already running!
These services start automatically on boot:
- ✅ Your app (serviceapp)
- ✅ Nginx (web server)
- ✅ Tailscale Funnel (public access)

**No extra commands needed.**

---

## Verify Everything is Running (optional)

If you want to double-check:

```bash
# Check app is running
sudo systemctl status serviceapp

# Check nginx is running
sudo systemctl status nginx
```

Both should show **active (running)** in green.

---

## Useful Commands

### Restart the app (after code changes)
```bash
sudo systemctl restart serviceapp
```

### View live app logs
```bash
sudo journalctl -u serviceapp -f
```
Press `CTRL+C` to stop viewing logs.

### Update code from Git
```bash
cd ~/PyUp-Order
git pull
sudo systemctl restart serviceapp
```

### Reboot the Pi safely
```bash
sudo reboot
```

### Check disk space
```bash
df -h
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't SSH in | Make sure Tailscale is running on your Mac |
| Site not loading | Run `sudo systemctl restart serviceapp` |
| 502 Bad Gateway | App crashed — run `sudo systemctl restart serviceapp` |
| App won't start | Check logs: `sudo journalctl -u serviceapp -n 50` |

---

## Requirements on Your Mac
- **Tailscale app** must be installed and logged in
- That's it — SSH works from any network (school, home, cafe)

---


---

Status/Name@
VrstaA
TTL3600
Vrijednost185.40.234.37

FieldValueStatus/Name
www
Vrsta
CNAME
TTL3600
Vrijednost
pyuporder.tail74d12c.ts.net

---


*PyUp-Order Server Guide v1.0*
