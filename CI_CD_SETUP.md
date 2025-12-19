# CI/CD Pipeline Setup Guide

This document explains how to set up and use the GitHub Actions CI/CD pipeline for automatic deployment to your server.

## 📋 Overview

The CI/CD pipeline automatically deploys your Leave Management System to the server whenever you push code to the `main` branch. It handles both backend and frontend deployment sequentially.

## 🏗️ How the CI/CD Pipeline Works

### Step-by-Step Process

1. **Trigger**: When you push code to the `main` branch (or manually trigger via GitHub UI)
2. **GitHub Actions Starts**: A virtual Ubuntu machine is spun up
3. **Backend Deployment**:
   - Connects to your server via SSH
   - Navigates to `/var/www/hrportal/backend`
   - Pulls latest code from Git
   - Installs production dependencies
   - Restarts the backend service with PM2
4. **Frontend Deployment** (after backend completes):
   - Connects to your server via SSH
   - Navigates to `/var/www/hrportal/frontend`
   - Pulls latest code from Git
   - Installs dependencies
   - Builds the production bundle
   - Restarts the frontend service with PM2
5. **Completion**: Both services are running with the latest code

## 🔧 Setup Instructions

### Step 1: Generate SSH Key for GitHub Actions

On your **local machine** (not on the server), run:

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-hrportal" -f ~/.ssh/github_actions_hrportal

# Display the PRIVATE key (you'll add this to GitHub Secrets)
cat ~/.ssh/github_actions_hrportal

# Display the PUBLIC key (you'll add this to server)
cat ~/.ssh/github_actions_hrportal.pub
```

**Important**: 
- Copy the **private key** (entire output from `cat ~/.ssh/github_actions_hrportal`) - you'll need this for GitHub Secrets
- Copy the **public key** (entire output from `cat ~/.ssh/github_actions_hrportal.pub`) - you'll add this to your server

### Step 2: Add Public Key to Server

SSH into your server and add the public key:

```bash
# SSH into your server
ssh root@50.116.57.115

# Add the public key to authorized_keys
nano ~/.ssh/authorized_keys

# Paste the public key content from Step 1
# Save and exit (Ctrl+X, then Y, then Enter)
```

### Step 3: Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these three secrets:

   **Secret 1: SERVER_HOST**
   - Name: `SERVER_HOST`
   - Value: `50.116.57.115` (your server IP)

   **Secret 2: SERVER_USER**
   - Name: `SERVER_USER`
   - Value: `root` (or your server username)

   **Secret 3: SSH_PRIVATE_KEY**
   - Name: `SSH_PRIVATE_KEY`
   - Value: Paste the **entire private key** from Step 1 (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)

### Step 4: Verify Server Paths

Make sure your server has the code at these paths:
- Backend: `/var/www/hrportal/backend`
- Frontend: `/var/www/hrportal/frontend`

If your paths are different, update the workflow file (`.github/workflows/deploy.yml`) accordingly.

### Step 5: Verify PM2 Process Names

The workflow uses these PM2 process names:
- Backend: `hrportal-backend`
- Frontend: `hrportal-frontend`

If your PM2 processes have different names, update the workflow file.

### Step 6: Commit and Push the Workflow

```bash
# Add the workflow file
git add .github/workflows/deploy.yml

# Commit
git commit -m "Add CI/CD deployment workflow"

# Push to GitHub
git push origin main
```

## 🚀 Using the CI/CD Pipeline

### Automatic Deployment

Once set up, every push to the `main` branch will automatically trigger deployment:

```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions will automatically:
1. Detect the push
2. Start the deployment workflow
3. Deploy backend and frontend
4. Show you the results in the GitHub Actions tab

### Manual Deployment

You can also trigger deployment manually:

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy HR Portal** workflow
4. Click **Run workflow** button
5. Select the branch (usually `main`)
6. Click **Run workflow**

## 📊 Monitoring Deployments

### View Deployment Status

1. Go to your GitHub repository
2. Click **Actions** tab
3. You'll see all deployment runs with their status:
   - ✅ Green checkmark = Success
   - ❌ Red X = Failed
   - 🟡 Yellow circle = In progress

### View Deployment Logs

1. Click on any workflow run
2. Expand the job (Deploy Backend or Deploy Frontend)
3. Expand the "Deploy to Server via SSH" step
4. View the detailed logs

## 🔍 Troubleshooting

### Issue: "Permission denied (publickey)"

**Solution**: 
- Verify the SSH public key is added to `~/.ssh/authorized_keys` on the server
- Check that the private key in GitHub Secrets is complete (includes BEGIN and END lines)

### Issue: "git: command not found"

**Solution**: Install Git on your server:
```bash
sudo apt-get update
sudo apt-get install git -y
```

### Issue: "pm2: command not found"

**Solution**: Install PM2 on your server:
```bash
npm install -g pm2
```

### Issue: "npm: command not found"

**Solution**: Install Node.js and npm on your server:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Issue: Deployment fails but no clear error

**Solution**: 
- Check the GitHub Actions logs for detailed error messages
- SSH into your server and manually run the commands from the workflow to see the actual error
- Verify all paths and process names are correct

## 🔐 Security Best Practices

1. **Never commit secrets**: All sensitive information (SSH keys, passwords) should be in GitHub Secrets, not in code
2. **Use separate SSH keys**: Don't reuse your personal SSH key for CI/CD
3. **Rotate keys periodically**: Generate new SSH keys every few months
4. **Limit access**: Only give necessary permissions to the CI/CD workflow

## 📝 Workflow File Structure

The workflow file (`.github/workflows/deploy.yml`) contains:

- **Triggers**: When to run (push to main, manual trigger)
- **Jobs**: 
  - `deploy-backend`: Deploys backend first
  - `deploy-frontend`: Deploys frontend after backend completes
- **Steps**: Each job has steps that:
  1. Checkout code
  2. Connect to server via SSH
  3. Pull latest code
  4. Install dependencies
  5. Build (frontend only)
  6. Restart services

## 🎯 Next Steps

After setting up CI/CD:

1. Test the pipeline by making a small change and pushing to main
2. Monitor the first few deployments to ensure everything works
3. Consider adding:
   - Health checks after deployment
   - Rollback mechanism
   - Email notifications on deployment success/failure
   - Staging environment for testing before production

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SSH Action Documentation](https://github.com/appleboy/ssh-action)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

---

**Note**: Make sure your server has Git, Node.js, npm, and PM2 installed before running the first deployment.


