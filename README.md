# Oracle 23ai Help Center

A static site built with [Eleventy (11ty)](https://www.11ty.dev/), featuring individual article pages, full-text search via [Pagefind](https://pagefind.app/), and a CMS via [Decap CMS](https://decapcms.org/).

---

## Developer Quick Start

```bash
npm install          # Install dependencies
npm start            # Dev server at http://localhost:8080
npm run build        # Production build → _site/
npm run build:search # Generate Pagefind search index (run after build)
```

---

## Project Structure

```
oracle23ai-help/
├── src/
│   ├── posts/           ← Blog posts (Markdown)
│   ├── support/         ← Support articles (Markdown)
│   ├── blog/index.njk   ← Blog listing page
│   ├── support/index.njk← Support listing page
│   ├── index.njk        ← Homepage
│   ├── _includes/
│   │   ├── base.njk     ← Main layout (nav, footer)
│   │   ├── article.njk  ← Article layout (TOC, breadcrumb, sidebar)
│   │   └── post.njk     ← Blog post layout
│   ├── _data/
│   │   └── meta.json    ← Global site metadata
│   └── assets/css/
│       ├── main.css     ← Core styles (from original HTML)
│       └── articles.css ← Article/blog page styles
├── admin/
│   ├── index.html       ← Decap CMS UI
│   └── config.yml       ← CMS collection config
├── .github/workflows/
│   └── deploy.yml       ← Auto-deploy to GitHub Pages
├── .eleventy.js
└── package.json
```

---

## Writing Content

### Add a blog post — create `src/posts/your-slug.md`

```markdown
---
layout: post.njk
title: "Your Post Title"
description: "Brief description shown on the card"
date: 2025-04-01
author: Your Name
readTime: 8 min
tag: Tutorial
tags:
  - posts
---

Your Markdown content here...
```

### Add a support article — create `src/support/your-slug.md`

```markdown
---
layout: article.njk
title: "Your Article Title"
description: "Brief description"
date: 2025-04-01
readTime: 6 min
tag: Getting Started
difficulty: beginner        # beginner | intermediate | advanced
order: 5                    # Controls sort order on the support index
category: support
tags:
  - support
---

Your Markdown content here...
```

---

## Installing Oracle Database 23ai Free

### Linux (Oracle Linux 8/9)

**Requirements:** Oracle Linux 8 or 9 (x86_64), 1 GB RAM minimum, 10 GB disk

```bash
# 1. Update system
sudo dnf update -y && sudo reboot

# 2. Install Oracle pre-install package
sudo dnf install -y oracle-database-preinstall-23ai

# 3. Download the RPM (~1.2 GB)
cd /tmp
wget https://download.oracle.com/otn-pub/otn_software/db-free/oracle-database-free-23ai-1.0-1.el9.x86_64.rpm

# 4. Install
sudo dnf localinstall -y oracle-database-free-23ai-*.rpm

# 5. Configure (save the passwords it shows!)
sudo /etc/init.d/oracle-free-23ai configure

# 6. Set environment variables
sudo su - oracle
cat > ~/.bash_profile << 'EOF'
export ORACLE_BASE=/opt/oracle
export ORACLE_HOME=/opt/oracle/product/23ai/dbhomeFree
export ORACLE_SID=FREE
export PATH=$ORACLE_HOME/bin:$PATH
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:/lib:/usr/lib
EOF
source ~/.bash_profile

# 7. Enable auto-start and verify
sudo systemctl enable oracle-free-23ai
sudo systemctl start oracle-free-23ai
sqlplus / as sysdba
```

```sql
SELECT banner FROM v$version;
SHOW PDBS;
EXIT;
```

**Management commands:**

| Action | Command |
|--------|---------|
| Start | `sudo systemctl start oracle-free-23ai` |
| Stop | `sudo systemctl stop oracle-free-23ai` |
| Status | `sudo systemctl status oracle-free-23ai` |
| Alert log | `tail -f $ORACLE_BASE/diag/rdbms/free/FREE/trace/alert_FREE.log` |
| Listener | `lsnrctl status` |

---

### Windows (Server 2019 / 2022)

**Requirements:** Windows Server 2019/2022 64-bit, 8 GB RAM, 50 GB disk, .NET Framework 4.8

**Pre-flight checklist:**
- Run installer as **Administrator**
- Disable UAC (Control Panel → User Accounts → Never Notify)
- Allow TCP port **1521** through Windows Firewall
- Install .NET Framework 4.8
- Apply all Windows Updates
- Ensure `ORACLE_HOME` is not already set

**Install steps:**

1. Download from **oracle.com/database/technologies/oracle-database-software-downloads.html** → Oracle Database 23ai Free for Windows (64-bit)
2. Extract the `.zip` to `C:\Oracle23ai`
3. Open Command Prompt **as Administrator** and run `setup.exe`
4. Follow the InstallShield wizard — set a strong password for SYS/SYSTEM/PDBADMIN
5. After install, verify:

```cmd
lsnrctl status
sqlplus / as sysdba
```

```sql
ALTER PLUGGABLE DATABASE ALL OPEN;
ALTER PLUGGABLE DATABASE ALL SAVE STATE;
SELECT * FROM v$version;
EXIT;
```

6. Open `services.msc` and set both services to **Automatic**:
   - `OracleServiceFREE`
   - `OracleOraDB23HomeTNSListener`

**Default install paths:**

| Path | Purpose |
|------|---------|
| `C:\app\<user>\product\23ai\dbhomeFree` | Oracle Home |
| `C:\app\<user>\oradata\FREE` | Data files |

---

### Docker / Podman

**Requirements:** Docker 20+ or Podman 4+, 2 GB RAM allocated to container

```bash
# Quickest start (ephemeral — data lost on stop)
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  gvenzl/oracle-free:23-slim

# With persistent storage (recommended)
docker volume create oracle-data
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  -v oracle-data:/opt/oracle/oradata \
  gvenzl/oracle-free:23-slim

# Watch logs — wait for "DATABASE IS READY TO USE!"
docker logs -f oracle23ai

# Connect
docker exec -it oracle23ai sqlplus / as sysdba
```

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;
GRANT DB_DEVELOPER_ROLE, UNLIMITED TABLESPACE TO developer IDENTIFIED BY "free";
```

**Image variants:**

| Image | Best for |
|-------|---------|
| `gvenzl/oracle-free:23-slim` | Development (recommended) |
| `gvenzl/oracle-free:23` | Standard tools |
| `gvenzl/oracle-free:23-full` | All components |
| `gvenzl/oracle-free:23-slim-faststart` | Fastest startup |

**Podman / Apple Silicon:**
```bash
podman run --rm --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  gvenzl/oracle-free:23-slim
```

---

### Free Edition Limits (all platforms)

| Resource | Limit |
|----------|-------|
| CPU threads | 2 |
| RAM | 2 GB |
| User data | 12 GB |
| License | Free |

All Oracle 23ai features (VECTOR, AI Functions, JSON Duality) are available within these limits.

---

## Search Setup (Pagefind)

```bash
npm run build
npx pagefind --source _site
```

For GitHub Actions, the `deploy.yml` workflow does this automatically on every push.

---

## CMS Setup (Decap CMS)

1. Edit `admin/config.yml` — change `repo: YOUR-USERNAME/oracle23ai-help` to your GitHub repo
2. Create a free [Netlify](https://netlify.com) account and link it to your repo
3. In Netlify: **Identity → Enable → External providers → GitHub**
4. In Netlify: **Services → Git Gateway → Enable**
5. Add to `base.njk` `<head>`: `<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>`
6. Invite yourself: Netlify **Identity → Invite users**
7. Visit `yoursite.com/admin` to log in and start writing

---

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/oracle23ai-help.git
git push -u origin main
```

The `deploy.yml` workflow builds, indexes, and deploys automatically on every push to `main`. In your repo Settings → Pages → set source to the `gh-pages` branch.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot GET /` | Missing `src/index.njk` |
| CSS not loading | Check `eleventyConfig.addPassthroughCopy("src/assets")` is in `.eleventy.js` |
| ORA-01017 | Connect to `FREEPDB1` not `FREE` |
| Docker exits immediately | Increase Docker Desktop RAM to 4 GB+ |
| Pagefind 404 | Run `npm run build:search` after building |
| CMS login fails | Check Netlify Identity and Git Gateway are both enabled |
