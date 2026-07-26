# CrimeSense AI - Police Intelligence Platform
## AI-Powered Crime Intelligence & Investigation Platform for Karnataka State Police

### 🎯 Overview
CrimeSense AI is a production-grade artificial intelligence platform specifically built for the **Karnataka State Police Datathon 2026**. It transforms raw crime data, FIR documents, and investigation records into actionable intelligence through advanced analytics and AI-powered insights.

### 🚀 Key Features

#### 1. **Real-Time Crime Dashboard**
- Animated KPI cards showing:
  - Total Crimes
  - Solved Cases
  - Pending Cases
  - Cyber Crimes
  - Women Safety Cases
  - Juvenile Crimes
  - High Risk Areas
  - Active FIRs
- Live data updates with trend indicators
- AI-generated insights for each metric

#### 2. **Interactive Crime Hotspot Map**
- Geographic visualization of crime incidents across Karnataka
- District-level crime density heatmaps
- Police station markers
- Severity indicators (High/Medium/Low risk)
- Real-time location-based insights

#### 3. **AI-Powered Crime Analytics**
- Automatic trend detection and analysis
- Crime category breakdown
- Time-series analysis
- Anomaly detection
- Predictive crime forecasting

#### 4. **Intelligent Document Processing**
Upload and automatically analyze:
- FIR PDFs
- Charge Sheets
- Investigation Reports
- Crime Records (CSV/Excel)
- CDR Datasets
- CCTV Metadata
- Vehicle Movement Data

#### 5. **Suspect Network Analysis**
- Relationship mapping between suspects
- Gang network visualization
- Repeat offender identification
- Criminal history tracking
- Association discovery

#### 6. **Investigation Assistant**
- AI recommendations for case investigations
- Evidence correlation and linking
- Timeline generation
- Suspect profiling
- Leads prioritization

#### 7. **Predictive Policing**
- Crime hotspot prediction for next 7 days
- Resource optimization suggestions
- Patrol route optimization
- Risk level forecasting
- Festival/event impact analysis

#### 8. **Natural Language Query Engine**
Ask questions like:
- "Show robbery trend"
- "Summarize this FIR"
- "Which district has highest cyber crime?"
- "Which suspects appear in multiple FIRs?"
- "Generate investigation summary"
- "Predict tomorrow's crime hotspots"
- "Which locations require more patrol?"

### 🏗️ Architecture

#### Frontend (React + Vite)
- **Real-time Dashboard**: Animated KPI cards and metrics
- **Interactive Maps**: Leaflet-based geographic visualization
- **Charts & Analytics**: ECharts and Recharts for data visualization
- **Police Command Center UI**: Dark theme with police branding
- **Responsive Design**: Mobile, tablet, and desktop support

#### Backend (Node.js + Express)
- RESTful APIs for data management
- Gemini AI integration for insights
- Document processing pipeline
- Data ingestion services

#### Database
- Crime records
- FIR metadata
- Investigation data
- Suspect information
- Evidence logs

### 📊 Demo Data
The platform comes with realistic Karnataka Police dataset:
- **1000+ crime records**
- **Multiple districts**: Bengaluru, Mysuru, Hubballi, Mangaluru, Belagavi, Shivamogga, Tumakuru
- **Crime categories**:
  - Cyber Fraud
  - Vehicle Theft
  - Murder
  - Kidnapping
  - Drug Trafficking
  - Domestic Violence
  - Women Safety Cases
  - Robbery
  - Burglary
  - Assault

### 🛠️ Tech Stack

**Frontend:**
- React 18.2
- Vite (Build tool)
- Leaflet (Maps)
- ECharts & Recharts (Charts)
- Lucide React (Icons)
- CSS3 (Animations & Glassmorphism)

**Backend:**
- Node.js (v20+)
- Express.js
- Google Gemini API
- Axios (HTTP client)

**Design:**
- Dark Police Command Center theme
- Police blue (#3B82F6) + Red alerts (#EF4444)
- Glassmorphism effects
- Smooth animations
- Responsive layout

### 🚀 Getting Started

#### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

#### Installation

1. **Clone the repository**
```bash
cd c:\Users\HI\Documents\crimesence_ai\frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
Create `.env` file with:
```
VITE_API_URL=http://localhost:3000
VITE_GEMINI_API_KEY=your_api_key_here
```

4. **Start development server**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
```

6. **Preview production build**
```bash
npm run preview
```

### 📱 Platform Modules

#### Crime Intelligence
- **Dashboard**: Real-time KPI monitoring
- **Crime Analytics**: Trend analysis and patterns
- **Crime Hotspots**: Geographic visualization
- **FIR Intelligence**: Case analysis and tracking

#### Investigation & Prediction
- **Investigation Assistant**: AI-powered case recommendations
- **Hotspot Prediction**: Future crime area forecasting
- **Suspect Network**: Relationship and gang analysis

#### Analysis & Reports
- **AI Assistant**: Natural language query interface
- **Report Generator**: PDF/Excel/PowerPoint export
- **Evidence Analyzer**: Case evidence analysis

#### Operations
- **Patrol Optimization**: Deployment suggestions
- **Data Upload**: Crime dataset ingestion
- **Settings**: System configuration

### 🎨 UI/UX Highlights

1. **Police Command Center Aesthetic**
   - Dark navy/black background (#0F1419)
   - Police blue accents (#3B82F6)
   - Red alerts (#EF4444)
   - Glassmorphism effects
   - Professional typography

2. **Animated Components**
   - Counter animations on KPI cards
   - Smooth transitions between views
   - Gradient flows on headings
   - Pulse effects on alerts
   - Hover animations on interactive elements

3. **Responsive Design**
   - Mobile-first approach
   - Adaptive grid layouts
   - Touch-friendly interactions
   - Optimized for all screen sizes

### 🔐 Security Features
- API key management
- Secure data upload
- Role-based access control (RBAC)
- Audit logging
- Data encryption

### 📈 Performance
- Fast load times
- Lazy loading of components
- Optimized bundle size
- Smooth animations (60 FPS)
- Efficient data caching

### 🤖 AI Capabilities

#### Gemini Integration
- **Crime Trend Analysis**: Identify patterns and trends
- **Investigation Recommendations**: Suggest next steps
- **Risk Prediction**: Forecast crime hotspots
- **Pattern Detection**: Identify crime clusters
- **Suspect Analysis**: Relationship discovery
- **Natural Language SQL**: Convert questions to queries
- **Report Generation**: Automated briefings

### 📚 API Endpoints

```
GET  /api/dataset/status
POST /api/query
POST /api/upload
POST /api/ingest
POST /api/root-cause
GET  /api/workspace
```

### 🧪 Testing

Run the application in development:
```bash
npm run dev
```

Access at: `http://localhost:5173`

### 📋 Checklist for Demo

- ✅ Dashboard loads with animated KPIs
- ✅ Crime map displays with district markers
- ✅ Navigation between all modules works
- ✅ Dark police theme is applied
- ✅ Animations are smooth and responsive
- ✅ Responsive design on mobile/tablet
- ✅ Quick prompts for AI assistant
- ✅ Upload functionality operational

### 🏆 Datathon Specifications

**For**: Karnataka State Police Datathon 2026
**Built**: Production-grade AI platform
**Focus**: Crime intelligence, investigation support, predictive policing
**Demo Time**: 60 seconds to impress judges

### 💡 Key Differentiators

1. **Production Quality**: Not a prototype, but a fully-functional platform
2. **Police-Specific**: Built specifically for law enforcement workflows
3. **AI-Powered**: Google Gemini integration for intelligent insights
4. **Real-Time**: Live dashboards and instant analysis
5. **Scalable**: Designed to handle large datasets
6. **User-Friendly**: Intuitive interface for all skill levels

### 📖 Documentation

- **Architecture**: See `ARCHITECTURE.md`
- **API Reference**: See `API.md`
- **Deployment**: See `DEPLOYMENT.md`
- **Contributing**: See `CONTRIBUTING.md`

### 🆘 Support

For issues or questions:
1. Check the documentation
2. Review the API endpoints
3. Check browser console for errors
4. Verify environment variables

### 📄 License

Built for Karnataka State Police Datathon 2026

---

**CrimeSense AI** - Empowering Police Intelligence with AI 🚔
