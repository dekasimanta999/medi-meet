
# Online Doctor Consultation

A full-stack healthcare platform for online doctor consultations, built with React, TypeScript, Node.js, Express, MongoDB, and Socket.io.

## Features
- Patient and Doctor authentication with 2FA
- Secure payment integration (Razorpay)
- Real-time video calls (Jitsi)
- AI symptom checker (Gemini AI)
- Profile management with photo uploads
- Appointment booking and management

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, MongoDB, Socket.io
- **Payments:** Razorpay
- **AI:** Google Gemini
- **Deployment:** Docker, Docker Compose

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Setup
1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   ```
3. Set up environment variables (copy `.env.example` to `.env` in backend)
4. Start MongoDB
5. Set `DEV_SEED_EMAIL` and `DEV_SEED_PASSWORD` in `backend/.env`, then create a local login account:
   ```bash
   npm run seed:dev-user
   ```
6. Run backend: `cd backend && npm run dev`
7. Run frontend: `npm run dev`

## Production Deployment

### Using Docker
1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```
2. Access at http://localhost (frontend) and http://localhost:5001 (backend)

### Manual Deployment
- Deploy backend to Heroku/Railway/AWS
- Deploy frontend to Vercel/Netlify
- Use MongoDB Atlas for database

## Security
- JWT authentication
- Input validation and sanitization
- Rate limiting
- HTTPS required in production
- HIPAA/GDPR compliance considerations

## Testing
Run tests: `cd backend && npm test`

## License
ISC
