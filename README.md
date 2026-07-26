# 🚔 CrimeSense AI

> AI-Powered Crime Intelligence & Investigation Platform for Karnataka State Police

CrimeSense AI is an intelligent crime analytics platform developed for the **Karnataka State Police Datathon 2026**. It leverages Artificial Intelligence to assist law enforcement agencies in analyzing crime data, identifying hotspots, predicting crime trends, generating investigation insights, and optimizing patrol operations.

---

## 🎥 Demo Video

👉 **Watch the Project Demo:**  
https://YOUR-YOUTUBE-LINK

---

## 🌟 Key Features

- 📊 Interactive Crime Analytics Dashboard
- 🔥 Crime Hotspot Detection & Visualization
- 🤖 AI Investigation Assistant (Gemini AI)
- 📈 Crime Trend Prediction
- 🗺️ Geospatial Crime Mapping
- 📄 AI-Based Report Generation
- 🚓 Patrol Route Optimization
- 📂 Multi-format Dataset Upload (CSV, Excel, JSON, PDF, Word)
- 📌 KPI Dashboard with Real-time Insights

---

## 🏗️ System Architecture

```
                +-----------------------+
                |      React Frontend   |
                +----------+------------+
                           |
                           |
                   REST API Requests
                           |
                           ▼
                +-----------------------+
                |   Node.js + Express   |
                +----------+------------+
                           |
       ---------------------------------------------
       |            |            |                 |
       ▼            ▼            ▼                 ▼
  Gemini AI     MySQL DB    Azure Blob      Data Processing
                                Storage
       |
       ▼
 AI Analysis & Recommendations
       |
       ▼
 Dashboard & Reports
```

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- Material UI
- Recharts
- Leaflet Maps

### Backend
- Node.js
- Express.js
- REST APIs
- Multer
- CORS

### AI
- Google Gemini AI

### Database
- MySQL
- SQL Server (Connector)

### Cloud & Storage
- Zoho Catalyst
- Azure Blob Storage

### Other Integrations
- Splunk
- CSV Parser
- dotenv

---

## 🚀 Zoho Catalyst Services Used

- ✅ AppSail
- ✅ Slate
- ✅ GitHub Deployment
- ✅ Serverless Environment

---

## 📂 Project Structure

```
CrimeSense-AI
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── uploads/
│   ├── data/
│   └── package.json
│
└── README.md
```

---

## 📊 Solution Workflow

1. Upload crime datasets.
2. Backend validates and processes the data.
3. AI analyzes crime patterns and investigation context.
4. Analytics engine generates dashboards.
5. Crime hotspots are visualized on maps.
6. Investigation reports and patrol recommendations are generated.

---

## 🚀 Running Locally

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file inside the backend directory.

```env
GEMINI_API_KEY=YOUR_API_KEY
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
AZURE_STORAGE_CONNECTION_STRING=
```

---

## 📷 Screenshots

Add screenshots here.

```
Dashboard
Crime Analytics
Hotspot Detection
Investigation Assistant
Report Generator
```

---

## 🎯 Problem Statement

Law enforcement agencies often struggle to derive actionable intelligence from large volumes of crime data. CrimeSense AI addresses this challenge by providing AI-powered analytics, hotspot detection, predictive insights, and investigation assistance to support faster and smarter policing.

---

## 🌟 Future Enhancements

- Real-time crime monitoring
- CCTV and image analytics
- Predictive policing models
- Citizen reporting portal
- Mobile application
- Multi-language AI Assistant

---

## 👨‍💻 Developed For

**Karnataka State Police Datathon 2026**

Powered by **Zoho Catalyst** and **Hack2Skill**

---

## 👩‍💻 Developer

**Shiny Villuri**

GitHub: https://github.com/villuri-s

---

## 📜 License

This project is developed for the **Karnataka State Police Datathon 2026** and is intended for demonstration and evaluation purposes.
