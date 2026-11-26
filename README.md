# LostConnect

LostConnect is a campus lost-and-found portal built with React, Express, Node.js, and MongoDB. It includes a searchable found-items catalog, student reports, similarity matching, ownership challenges, claims, and security-desk pickup passes.

## Run locally

1. Install Node.js 20.19+ and start a local MongoDB server, or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to your MongoDB connection string.
3. Install dependencies with `npm install`.
4. Start the API and Vite development server with `npm run dev`.
5. Open the Vite URL printed in the terminal. The Express API runs on port 8080 by default.

The server seeds empty MongoDB collections from `data/seed.json` when it starts. Existing collections are left intact. For a production build, run `npm run build` and then `npm start`; Express serves the built React app.

## Demo sign-in

Use `test.student@example.com` to try the seeded student account. Authentication is a demo campus-email flow; configure a real identity provider before using the portal for real accounts.
