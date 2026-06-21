# Policy Exception Registry

A modern, high-performance web application designed to track, audit, and visualize security policy waivers and exception records. It includes real-time anomaly detection, interactive portfolio dashboards, and automated PDF & Excel audit report generation.

---

### 🏗️ Architecture & Features
- **Interactive Dashboards**: Visualizes risk density (heatmaps) and risk accumulation by approver (stacked horizontal bar charts).
- **Automated Anomaly Scanning**: Evaluates waivers in real-time against 12 custom security rules (e.g., zombie exceptions, risk accumulation limits, vague justifications, stalled reviews).
- **Compliance PDF Export**: Instantly compiles executive or detailed audit logs as high-fidelity vector PDFs via **Pandoc** and **Typst** on the backend, scaling to 100,000+ rows.
- **Excel Spreadsheet Export**: Downloads the Exception Register, Anomaly Log, or Compliance Report as Excel `.xlsx` spreadsheets directly from database records.
- **Workflow Actions**: Supports lifecycle actions like renewing, revoking, or mitigating risk ratings directly from the registry view.

---

### 📁 Project Structure
```text
grc-exception-manager/
├── backend/            # FastAPI Python server (PostgreSQL client)
├── frontend/           # Vite React TypeScript application
├── docker-compose.yml  # Multi-container service orchestrator
└── test_exceptions.csv # Mock exception data for ingestion
```

---

### 🐳 Quick Start: Running with Docker (Recommended)

If you have Docker Desktop installed and running on your machine, you can launch the entire stack (PostgreSQL database, FastAPI backend, and Nginx frontend) with a single command without installing Python or Node.js locally.

#### 1. Build and Start the Services
Navigate to the root directory (`grc-exception-manager/`) and run:
```bash
docker compose up --build -d
```
- `--build` ensures your local source code changes are packaged.
- `-d` runs the containers in detached (background) mode, freeing up your terminal.

#### 2. Access the Applications
Docker Compose will orchestrate and expose the following services on your machine:
- 🌐 **Frontend Application**: [http://localhost:5173/](http://localhost:5173/)
- ⚙️ **FastAPI Backend API**: [http://localhost:8000/](http://localhost:8000/)
- 🗄️ **PostgreSQL Database**: Runs internally inside the container network on port `5432`.

#### 3. Managing the Containers
- **View running containers**: `docker compose ps`
- **Stop the services**: `docker compose down`
- **Reset & wipe database data (Fresh start)**: `docker compose down -v`

---

### 💻 Alternative: Local Manual Setup

If you prefer to run the applications directly on your host system without Docker, follow the prerequisites and setup guides below.

#### Local Prerequisites
Ensure the following base tools are installed on your host machine:
1. **Node.js** (v18+) & **npm**
2. **Python** (v3.9+) & **pip3**
3. **Pandoc & Typst** (Required locally for PDF compilation):
   - **macOS (Homebrew)**: `brew install pandoc typst`
   - **Windows (Winget)**: `winget install JohnMacFarlane.Pandoc` and `winget install Typst.Typst`
   - **Linux (Ubuntu/Debian)**: `sudo apt-get install pandoc` and `sudo snap install typst`

#### Execution Steps

##### 1. Backend Server Setup
```bash
cd backend

# Install python dependencies
pip3 install -r requirements.txt

# Start the FastAPI server (runs on http://localhost:8000)
python3 main.py
```
*Note: Upon startup, the backend automatically runs a database normalization task to cleanse legacy records.*

##### 2. Frontend Development Setup
Open a second terminal window or tab:
```bash
cd frontend

# Install node dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev
```

---

### 📊 Importing Sample Data

Once either your Docker containers or your local servers are active:
1. Open your web browser and navigate to [http://localhost:5173/](http://localhost:5173/).
2. Locate the **CSV Ingestion** widget on the application dashboard.
3. Upload the sample `test_exceptions.csv` file located at the root of this project repository.
4. The database will populate, and your dashboard charts will automatically render the live risk analytics.
