# ContentAI Pro - LinkedIn & Twitter Content Automation Platform

A comprehensive SaaS platform that automates LinkedIn and Twitter content creation from uploaded documents using AI. Transform your documents into engaging social media posts with built-in moderation, scheduling, and analytics.

## Features

### 🚀 Core Functionality

- **Multi-Format Document Upload**: Support for PDF, DOCX, TXT files, URLs, and manual text input
- **AI-Powered Content Generation**: Generate multiple post variants with customizable tone, style, and intent
- **Content Moderation Workflow**: Built-in approval system with audit trails and quality control
- **Smart Scheduling**: Calendar-based scheduling with optimal timing recommendations
- **Performance Analytics**: Track engagement metrics and get AI-driven optimization insights
- **Multi-Platform Support**: Manage LinkedIn and Twitter from a unified dashboard

### 🔐 Authentication & Security

- Email/password authentication with Supabase
- Secure session management
- Row-level security (RLS) on all database operations
- Workspace-based access control
- Team collaboration support

### 💼 Workspace Management

- Multi-tenant architecture
- Team member roles (Owner, Admin, Editor, Viewer)
- Customizable branding (colors, logos)
- Subscription tiers (Free, Pro, Enterprise)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Database**: PostgreSQL with RLS policies

## Database Schema

The platform includes 11 core tables:

1. **profiles** - User profile information
2. **workspaces** - Tenant/workspace configuration
3. **workspace_members** - Team members and roles
4. **social_accounts** - Connected LinkedIn/Twitter accounts
5. **ai_agent_configs** - AI agent configuration profiles
6. **documents** - Uploaded documents and content sources
7. **generated_posts** - AI-generated social media posts
8. **scheduled_posts** - Publishing schedule and calendar
9. **post_analytics** - Engagement metrics and performance data
10. **moderation_logs** - Audit trail for content moderation
11. **subscriptions** - Billing and subscription management

All tables have comprehensive RLS policies ensuring data security and proper access control.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account with a project set up
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Usage Guide

### First-Time Setup

1. **Sign Up**: Create your account on the landing page
2. **Create Workspace**: Set up your first workspace during onboarding
3. **Connect Social Accounts**: Link your LinkedIn and Twitter accounts in Settings
4. **Upload Documents**: Add your content sources (PDFs, articles, etc.)
5. **Generate Content**: Use the AI generator to create posts
6. **Review & Approve**: Moderate content before publishing
7. **Schedule Posts**: Plan your content calendar
8. **Track Performance**: Monitor engagement in Analytics

### Document Upload Options

- **File Upload**: Drag and drop PDF, DOCX, or TXT files
- **URL Import**: Fetch content from web articles
- **Manual Input**: Paste or type content directly

### Content Generation

1. Select a source document
2. Choose target platform (LinkedIn or Twitter)
3. Configure tone (Professional, Casual, Thought Leader, Educational, Promotional)
4. Generate 3-5 post variants
5. Edit and refine as needed
6. Submit for moderation

### Moderation Workflow

- **Pending**: New posts awaiting review
- **Approved**: Ready to schedule and publish
- **Rejected**: Posts that need revision
- **Flagged**: Posts requiring additional review

## Project Structure

```
src/
├── components/
│   ├── AppLayout.tsx          # Main application layout with sidebar
│   └── ProtectedRoute.tsx     # Route protection wrapper
├── contexts/
│   └── AuthContext.tsx        # Authentication state management
├── lib/
│   ├── supabase.ts           # Supabase client configuration
│   └── database.types.ts     # TypeScript types for database
├── pages/
│   ├── Landing.tsx           # Marketing landing page
│   ├── SignIn.tsx            # Sign in page
│   ├── SignUp.tsx            # Registration page
│   ├── Onboarding.tsx        # First-time user setup
│   ├── Dashboard.tsx         # Main dashboard
│   ├── Documents.tsx         # Document management
│   ├── Generator.tsx         # AI content generation
│   ├── Moderation.tsx        # Content review queue
│   ├── Schedule.tsx          # Publishing calendar
│   ├── Analytics.tsx         # Performance metrics
│   └── Settings.tsx          # Account & workspace settings
└── App.tsx                    # Root component with routing
```

## Key Features by Page

### Dashboard
- Overview statistics (documents, posts, scheduled items)
- Quick actions for common tasks
- Recent activity feed
- Pending moderation alerts

### Documents
- Multi-format upload support
- Real-time processing status
- Search and filter capabilities
- Document preview and management

### Generator
- Source document selection
- Platform-specific configuration
- Multi-variant generation
- Inline editing with character count

### Moderation
- Tabbed interface (Pending, Approved, Rejected)
- Side-by-side content review
- One-click approval/rejection
- Audit log creation

### Schedule
- Calendar view (coming soon)
- Drag-and-drop scheduling
- Optimal time suggestions
- Bulk operations

### Analytics
- Engagement metrics dashboard
- Performance trends
- Platform comparison
- Export capabilities

### Settings
- Profile management
- Workspace configuration
- Social account connections
- Notification preferences
- Security settings
- Billing and subscriptions

## Security Features

- All database queries protected by Row-Level Security (RLS)
- Workspace-based data isolation
- Secure token storage for social accounts
- Audit trails for all moderation actions
- CSRF protection via Supabase
- Secure session management

## Subscription Tiers

### Free Tier
- 10 posts per month
- 50 AI generations
- 1 workspace
- Basic analytics

### Pro Tier
- Unlimited posts
- Unlimited AI generations
- 3 workspaces
- Advanced analytics
- Priority support

### Enterprise Tier
- Unlimited everything
- Custom workspaces
- Dedicated support
- Custom integrations
- SLA guarantees

## Future Enhancements

- [ ] Direct LinkedIn/Twitter API integration for publishing
- [ ] Advanced calendar with drag-and-drop
- [ ] Real-time collaboration features
- [ ] A/B testing for post variants
- [ ] AI-powered engagement predictions
- [ ] Content performance recommendations
- [ ] Multi-language support
- [ ] Instagram and Facebook integration
- [ ] Advanced team permissions
- [ ] Custom AI agent training

## Contributing

This is a proprietary SaaS platform. For feature requests or bug reports, please contact support.

## License

Proprietary - All rights reserved

## Support

For support inquiries:
- Email: support@contentaipro.com
- Documentation: https://docs.contentaipro.com
- Community: https://community.contentaipro.com

---

Built with ❤️ using React, TypeScript, and Supabase
