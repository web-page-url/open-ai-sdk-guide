# Deployment Guide for AI SDK on Render

## Pre-deployment Fixes Applied

✅ **Fixed Top-level Await Issue**: Moved directory initialization inside async function  
✅ **Updated OpenAI Configuration**: Added graceful handling for missing API key during build  
✅ **Added Node.js Engine Requirements**: Specified Node >=18.0.0  
✅ **Added Health Check Endpoint**: `/health` for deployment verification  
✅ **Updated Render Configuration**: Added build command and proper environment variables  

## Deployment Steps

### 1. Commit Your Changes
```bash
git add .
git commit -m "Fix deployment issues for Render"
git push origin main
```

### 2. Set Environment Variable in Render Dashboard

⚠️ **CRITICAL**: You MUST set the `OPENAI_API_KEY` in your Render service dashboard:

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your `ai-sdk` service
3. Go to "Environment" tab
4. Add environment variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your actual OpenAI API key (starts with `sk-`)
5. Click "Save Changes"

### 3. Deploy

The deployment should now work automatically when you push to your main branch, or you can trigger a manual deploy from the Render dashboard.

## Verification

After deployment, verify these endpoints work:
- `https://ai-sdk.onrender.com/health` - Should return health status
- `https://ai-sdk.onrender.com/` - Should return API documentation

## Environment Variables Set

The following environment variables are configured in `render.yaml`:
- `NODE_ENV`: production
- `DEFAULT_MODEL`: gpt-4o-mini
- `MAX_TOKENS`: 2000
- `TEMPERATURE`: 0.7
- `MAX_FILE_SIZE`: 10485760
- `UPLOAD_DIR`: ./uploads

**Remember**: `OPENAI_API_KEY` must be set manually in the Render dashboard for security.

## Troubleshooting

### If deployment still fails:

1. **Check Build Logs**: Look for specific error messages in Render's build logs
2. **Verify API Key**: Ensure `OPENAI_API_KEY` is correctly set in environment
3. **Check Node Version**: Ensure Render is using Node.js 18+ 
4. **Monitor Health Check**: Check if `/health` endpoint responds after deployment

### Common Issues:

- **Build Timeout**: If build takes too long, the free tier has time limits
- **Memory Issues**: Free tier has memory limitations
- **API Key Missing**: Most common issue - ensure it's set in dashboard

## Contact

If you continue having issues, check:
1. Render service logs in dashboard
2. Network connectivity to your deployed service
3. OpenAI API key validity and permissions 