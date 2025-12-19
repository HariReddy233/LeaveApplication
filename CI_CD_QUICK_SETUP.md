# CI/CD Quick Setup Checklist

## ✅ Step 1: SSH Keys Generated (DONE)
SSH keys have been generated and are located at:
- **Private Key**: `C:\Users\harin\.ssh\github_actions_hrportal`
- **Public Key**: `C:\Users\harin\.ssh\github_actions_hrportal.pub`

## 📋 Step 2: Add Public Key to Server

SSH into your server and add the public key:

```bash
ssh root@50.116.57.115

# Add the public key
nano ~/.ssh/authorized_keys

# Paste this public key:
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPx1zLRmuQ0A+MeWtSRUDOOvYPU3ROK/+CMGi1DFcJqe github-actions-hrportal

# Save and exit (Ctrl+X, then Y, then Enter)
```

## 🔐 Step 3: Add Secrets to GitHub

1. Go to your GitHub repository: https://github.com/HariReddy233/LeaveApplication
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three secrets:

### Secret 1: SERVER_HOST
- **Name**: `SERVER_HOST`
- **Value**: `50.116.57.115`

### Secret 2: SERVER_USER
- **Name**: `SERVER_USER`
- **Value**: `root`

### Secret 3: SSH_PRIVATE_KEY
- **Name**: `SSH_PRIVATE_KEY`
- **Value**: Copy the entire private key from `C:\Users\harin\.ssh\github_actions_hrportal`

   The private key should look like:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   QyNTUxOQAAACD8dcy0ZrkNAPjHlrUkVAzjr2D1N0Tiv/gjBotQxXCangAAAKCVE4pKlROK
   SgAAAAtzc2gtZWQyNTUxOQAAACD8dcy0ZrkNAPjHlrUkVAzjr2D1N0Tiv/gjBotQxXCang
   AAAEAovwX8bzFRcKO7JGRx/Qmnz+Tiz6q4ehTPH9KfipgVdfx1zLRmuQ0A+MeWtSRUDOOv
   YPU3ROK/+CMGi1DFcJqeAAAAF2dpdGh1Yi1hY3Rpb25zLWhycG9ydGFsAQIDBAUG
   -----END OPENSSH PRIVATE KEY-----
   ```

   **Important**: Copy the ENTIRE key including the BEGIN and END lines!

## ✅ Step 4: Verify Server Setup

Make sure on your server:
- Code exists at `/var/www/hrportal/backend` and `/var/www/hrportal/frontend`
- PM2 processes are named `hrportal-backend` and `hrportal-frontend`
- Git, Node.js, npm, and PM2 are installed

## 🚀 Step 5: Test the Pipeline

After completing steps 2 and 3, you can test the pipeline:

1. **Automatic**: Make any small change and push:
   ```bash
   git commit --allow-empty -m "Test CI/CD pipeline"
   git push origin main
   ```

2. **Manual**: Go to GitHub → Actions tab → "Deploy HR Portal" → "Run workflow"

## 📊 Step 6: Monitor Deployment

- Go to: https://github.com/HariReddy233/LeaveApplication/actions
- Click on the latest workflow run to see deployment logs
- Green checkmark = Success ✅
- Red X = Failed ❌ (check logs for errors)

---

## 🔍 Quick Reference: SSH Keys Location

- **Private Key**: `C:\Users\harin\.ssh\github_actions_hrportal`
- **Public Key**: `C:\Users\harin\.ssh\github_actions_hrportal.pub`

To view them again:
```powershell
# View private key
Get-Content $env:USERPROFILE\.ssh\github_actions_hrportal

# View public key
Get-Content $env:USERPROFILE\.ssh\github_actions_hrportal.pub
```

---

**Note**: The CI/CD workflow file has been pushed to GitHub. Once you complete steps 2 and 3 above, the pipeline will be fully functional!



