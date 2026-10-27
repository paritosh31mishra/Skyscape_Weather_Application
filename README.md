# Skyscape Weather

Skyscape is a responsive weather application for checking current conditions and forecasts for your location or places around the world. It combines a React frontend with a Node.js and Express API, MongoDB storage, and JWT-based accounts.

## What users can do

- Create an account, sign in, and sign out.
- Allow the browser to use their current location, or search for a city or place by name. Location access can be changed in browser settings; searching works when it is unavailable.
- See the selected place's current temperature, feels-like temperature, humidity, wind, precipitation, and high and low temperatures.
- View an hourly forecast for each available forecast date. Choose a date with the date picker, then scroll horizontally inside the hourly panel to see its hours.
- View a seven-day forecast and local sunrise and sunset times.
- Switch between Celsius and Fahrenheit.
- Switch between light and dark themes; the selected theme is remembered in the browser.
- Save and remove favorite places. Favorites are kept in that browser's local storage.
- See the hero illustration reflect local day or night and the current weather conditions. At night it shows an estimated lunar phase.
- Receive refreshed weather conditions every ten minutes while the dashboard is open.

Weather and place data come from Open-Meteo. The application does not need an Open-Meteo API key. Browser geolocation generally requires HTTPS; `localhost` is permitted during development.

## Technology stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 18, Create React App | Dashboard, account forms, and interactive weather views |
| Styling | Tailwind CSS, PostCSS, custom responsive CSS | Tailwind build setup and responsive Skyscape interface |
| Backend | Node.js, Express 4 | REST endpoints, request parsing, and CORS |
| Database | MongoDB with Mongoose | User accounts and weather history records |
| Authentication | JSON Web Token (`jsonwebtoken`) | Signed, expiring access tokens for protected API requests |
| Password handling | `bcryptjs` | Hashes passwords before they are stored |
| Weather data | Open-Meteo Geocoding and Forecast APIs | Place search, current conditions, hourly and daily forecasts |

## Run the project locally

You need Node.js/npm, a running MongoDB database (local MongoDB or MongoDB Atlas), and internet access for the Open-Meteo APIs.

### 1. Configure the backend

In PowerShell, from the project folder:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and set the MongoDB connection string and a long, random JWT secret:

```env
PORT=5557
MONGODB_URI=mongodb://127.0.0.1:27017/skyscape
JWT_SECRET=replace-this-with-a-long-random-secret
CLIENT_URL=http://localhost:3000
```

For MongoDB Atlas, use the connection string Atlas provides for `MONGODB_URI`. Keep `.env` private and do not commit it.

Install dependencies and start the API in a terminal:

```powershell
cd backend
npm install
npm start
```

The API connects to MongoDB before it begins listening at `http://localhost:5557`.

### 2. Configure and start React

Open a second terminal from the project folder:

```powershell
Copy-Item reactapp/.env.example reactapp/.env
cd reactapp
npm install
npm start
```

Open `http://localhost:3000`. If the API runs at a different address, set `REACT_APP_API_URL` in `reactapp/.env` and restart the React development server.

## User workflow: start to finish

1. The user creates an account with a name, email, and password, or signs in with an existing account.
2. Express checks the request. On signup it validates required fields and password length, checks for an existing email, hashes the password, and creates the MongoDB user record.
3. After successful signup or login, the API returns a JWT. The frontend stores the token in browser local storage and sends it as a `Bearer` token on protected weather-history requests.
4. The dashboard asks the browser for location access. If permitted, coordinates are used for the local forecast; otherwise, the user can search for a place.
5. React searches Open-Meteo's geocoder for matching locations. Selecting a result provides coordinates for an Open-Meteo forecast request.
6. The dashboard displays current, hourly, and daily weather data. The hourly date picker changes the day shown in the fixed-size hourly panel; horizontal scrolling stays inside that panel.
7. When the user is signed in, each successful weather refresh is also sent to the Express API and saved to MongoDB under that user's account.
8. The user can save places as favorites in the browser and sign out to remove the local session token.

## Technical details

### JWT authentication

- `POST /auth/signup` creates an account and returns a JWT.
- `POST /auth/login` checks the password against its bcrypt hash and returns a JWT.
- Tokens contain the account's MongoDB user ID and expire after seven days.
- The `auth` middleware reads `Authorization: Bearer <token>`, verifies the signature and expiry, and sets `req.userId` for the protected route.
- Passwords are never stored as plain text. The frontend currently stores the JWT in local storage; signing out removes it.

### Weather history API

Both routes require a valid JWT:

- `POST /weather` saves a city, temperature, condition, user ID, and timestamp.
- `GET /weather` returns up to the latest 50 records belonging to the signed-in user.

Weather history is stored by the backend, but the current dashboard does not yet have a history screen. Favorites are separate and are stored locally in the browser rather than in MongoDB.

### MongoDB database and collections

With the example URI, the database name is `skyscape`. Mongoose creates collections as records are first saved:

- `users` — account name, normalized email, password hash, and timestamps.
- `weatherhistories` — user reference, city, temperature, condition, and recorded time.

### API endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Confirms that the Weather API is running |
| `POST` | `/auth/signup` | Public | Creates an account and issues a JWT |
| `POST` | `/auth/login` | Public | Authenticates an account and issues a JWT |
| `POST` | `/weather` | JWT required | Saves a weather history record |
| `GET` | `/weather` | JWT required | Gets the signed-in user's latest history records |

## Project layout

```text
backend/
  middleware/auth.js          JWT verification middleware
  routes/auth.js               Signup and login routes
  routes/weather.js            Protected weather history routes
  schema/userschema.js         MongoDB user model
  schema/weatherhistoryschema.js  MongoDB weather history model
  myserver.js                  Express app and MongoDB connection
  .env.example                 Backend configuration template

reactapp/
  src/App.js                   React application and dashboard
  src/App.css                  Responsive interface styles
  src/index.css                Global styles and Tailwind directives
  tailwind.config.js           Tailwind content and theme configuration
  postcss.config.js            PostCSS/Tailwind pipeline
  .env.example                 Frontend API URL template
```

## Notes

- Weather lookup and forecasts require a network connection to Open-Meteo.
- The browser's location permission is optional. The user can search instead.
- JWTs expire after seven days; the user must sign in again after expiry.
- Use a private, strong `JWT_SECRET` and a secured MongoDB connection when deploying the API.
