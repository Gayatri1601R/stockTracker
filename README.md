# Stock Tracker App

## Frontend

Install dependencies and start Expo:

```bash
npm install
npm start
```

If you want to point the app at a different backend, set:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
```

## Backend

The FastAPI backend lives in `backend/`.

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python main.py
```

## MongoDB

Use either a local MongoDB server or MongoDB Atlas. Update `backend/.env` with your connection string and secret key.
