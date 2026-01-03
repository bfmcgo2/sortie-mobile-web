# Deployment Guide for Vercel

## Prerequisites
- A GitHub account
- A Vercel account (sign up at https://vercel.com)
- Your code pushed to a GitHub repository

## Step 1: Push Your Code to GitHub

If you haven't already, commit and push your changes:

```bash
cd sortie-mobile-web
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Using Vercel Dashboard (Recommended)

1. Go to https://vercel.com and sign in (or sign up)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `sortie-mobile-web` (if your repo has multiple folders)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Option B: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Navigate to your project:
```bash
cd sortie-mobile-web
```

3. Run deployment:
```bash
vercel
```

4. Follow the prompts to link your project

## Step 3: Set Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add:

### Required Environment Variables:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/public key
   - Found in Supabase dashboard → Settings → API

3. **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY**
   - Your Google Maps API key
   - Get from Google Cloud Console

4. **NEXT_PUBLIC_GOOGLE_MAP_ID** (optional but recommended)
   - Your Google Maps Map ID
   - Required for AdvancedMarkerElement features

### How to Add Environment Variables:

1. Go to your project in Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: The variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: The actual value
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**

## Step 4: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **Redeploy**
4. Or trigger a new deployment by pushing a commit

## Step 5: Verify Deployment

1. Visit your deployment URL (provided by Vercel)
2. Test the following:
   - Guide pages: `/guide/[companyid]`
   - Philly pins page: `/philly-pins`
   - Desktop detection (should show mobile message)
   - Mobile view (should show maps and videos)

## Troubleshooting

### Build Errors
- Check that all dependencies are in `package.json`
- Ensure Node.js version is compatible (Vercel uses Node 18+ by default)
- Check build logs in Vercel dashboard

### Environment Variable Issues
- Make sure all `NEXT_PUBLIC_*` variables are set
- Variables must be prefixed with `NEXT_PUBLIC_` to be available in the browser
- Redeploy after adding/changing environment variables

### Map Not Loading
- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set correctly
- Check Google Cloud Console for API restrictions
- Ensure Maps JavaScript API is enabled

### Supabase Connection Issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase project is active
- Verify RLS (Row Level Security) policies allow public access

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Vercel will automatically provision SSL certificates

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches or pull requests

You can configure this in **Settings** → **Git**

