# SafeBet IQ - Testing Guide

## Quick Start

The application is ready to test! The database has already been set up with demo data.

## Demo Credentials

Use these credentials to test different user roles:

### Super Admin (Full System Access)
- **Email**: `admin@safeplayai.com`
- **Password**: `password123`
- **Access**: All casinos, all data, user management

### Casino Admin (Royal Palace Casino)
- **Email**: `admin@royalpalace.com`
- **Password**: `password123`
- **Access**: Only Royal Palace Casino data and settings

### Casino Admin (Golden Dragon Gaming)
- **Email**: `admin@goldendragon.com`
- **Password**: `password123`
- **Access**: Only Golden Dragon Gaming data

### Regulator (Read-Only)
- **Email**: `regulator@gamblingboard.gov`
- **Password**: `password123`
- **Access**: Read-only view of all casinos

## How to Test

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

3. **Explore the homepage**:
   - View the marketing site
   - Click "Login" or "Book a Demo"

4. **Test the login flow**:
   - Go to `/login`
   - Use any of the demo credentials above
   - You'll be automatically redirected based on your role:
     - Super Admin → `/admin`
     - Casino Admin → `/casino/dashboard`
     - Regulator → `/regulator/dashboard`

## Testing Each Role

### Testing Super Admin
1. Login with `admin@safeplayai.com`
2. View system-wide metrics
3. See all 3 casinos listed
4. Access user management features

### Testing Casino Admin
1. Login with `admin@royalpalace.com`
2. View the casino dashboard with 6 tabs:
   - **Overview**: Active players, high-risk players, betting stats
   - **Live Monitor**: Real-time player activity (demo data)
   - **Players**: Player list with risk assessments
   - **Interventions**: WhatsApp/Email intervention logs
   - **Reports**: Compliance report generation
   - **Settings**: WhatsApp API and simulation mode settings
3. Note: You can only see data for Royal Palace Casino

### Testing Regulator
1. Login with `regulator@gamblingboard.gov`
2. View aggregated data across all casinos
3. Access compliance reports (read-only)
4. View intervention logs for all operators

## Key Features to Test

- [x] Role-based authentication
- [x] Automatic redirect based on user role
- [x] Responsive design (try mobile/tablet views)
- [x] Navigation and logout buttons
- [x] Dark theme with casino aesthetic
- [ ] Live data simulation (to be implemented)
- [ ] Chart visualizations (placeholders shown)
- [ ] WhatsApp integration (demo mode)
- [ ] PDF report generation

## Database Structure

The app uses Supabase with these main tables:
- `casinos` - 3 demo casinos
- `users` - 4 demo users (different roles)
- `players` - Player data with risk scores
- `risk_scores` - Historical risk data
- `interventions` - AI intervention logs
- `configurations` - Casino settings

## Troubleshooting

### Can't login?
- Check that the Supabase environment variables are set in `.env`
- Verify the user exists in the database
- Check browser console for errors

### Page not loading?
- Make sure the dev server is running (`npm run dev`)
- Check for TypeScript or build errors
- Clear browser cache

### Need to reset data?
- The database is in demo/simulation mode
- All data is safe to modify for testing

## Next Steps

To extend the application:
1. Implement real-time data simulation with auto-refresh
2. Add chart libraries (Chart.js/Recharts) for visualizations
3. Build WhatsApp integration service
4. Add PDF generation for reports
5. Create player AI timeline modal
6. Implement filters and search functionality
