# Backend Setup

## Requirements

Install the Python dependencies from `requirements.txt`.

## Environment

Create a `.env` file in this folder with:

```env
MONGO_URL=mongodb://localhost:27017
SECRET_KEY=your_very_strong_random_secret_here
```

## Run

```bash
python main.py
```

The API will be available at `http://localhost:8000`.
