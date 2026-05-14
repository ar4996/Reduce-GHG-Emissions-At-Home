# Reducing Greenhouse Gas Emissions at Home

Interactive Flask app for a UI Design final project about making lower-emission choices at home. The current experience combines a guided lesson module with a drag-and-drop home planner that asks users to build the highest-impact plan within a fixed budget.

## Team Members

- Victor Edward Bula (`sachmosaurus`)
- Avishek Rao (`avishekrao`)
- Dabeet Sharma (`dabeet-sharma`)
- Ankit Mohapatra (`unkith`)

## Current Experience

The active app in [`app.py`](./app.py) has two main parts:

1. Home and lesson flow
   Users start on the landing page, enter the lesson module, and move through four rooms: Kitchen, Living Room, Bathroom, and Laundry Room.
2. Home planner
   Users pick a housing type, receive a fixed budget, and drag room-based improvements into a plan. The planner reveals whether they found the maximum achievable CO2 reduction for that budget and can generate a PDF certificate.

## Main Features

- Hotspot-based lesson screens with room images and revealable sustainability opportunities
- Four-room learning sequence backed by JSON content
- Three housing-budget presets: Studio Apartment (`$250`), Suburban Home (`$1,500`), and Large Family Home (`$3,250`)
- Drag-and-drop planner with budget tracking and emissions tracking
- Planner state persistence in `user_data.json`
- Downloadable certificate PDF for completed plans

## Tech Stack

- Python 3
- Flask 3
- Jinja templates
- HTML, CSS, and JavaScript
- jQuery
- Bootstrap 5
- `html2canvas` and `jsPDF` for certificate export

## Run Locally

1. Create and activate a virtual environment if you want an isolated setup.
2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Start the app:

```powershell
python app.py
```

4. Open `http://127.0.0.1:5000/` in your browser.

## Project Structure

- [`app.py`](./app.py): current Flask application, page routes, and JSON API
- [`data/`](./data): lesson content, planner items, and room metadata
- [`templates/`](./templates): Jinja templates for the landing page, lessons, quiz, and planner
- [`static/css/`](./static/css): page styling
- [`static/js/`](./static/js): lesson, quiz, and planner client behavior
- [`static/images/`](./static/images): room images used in the lesson module
- [`user_data.json`](./user_data.json): single-user local persistence for lesson and planner progress

## Content and Data Files

- [`data/lessons.json`](./data/lessons.json): four lesson rooms and their clickable opportunities
- [`data/planner_items.json`](./data/planner_items.json): planner actions with cost and CO2 impact values
- [`data/rooms.json`](./data/rooms.json): room navigation metadata for the planner

## Important Routes

- `/`: landing page
- `/learn`: lesson intro
- `/learn/<index>`: individual lesson room
- `/quiz/setup`: planner setup screen
- `/quiz/1`: planner with saved state restored when available

## JSON API

- `POST /api/budget`: store the selected budget and target
- `POST /api/items`: add a planner item to the current plan
- `DELETE /api/items/<item_id>`: remove a planner item
- `GET /api/plan/summary`: return a plain-text summary of the current plan

## Developer Notes

- Run the project from [`app.py`](./app.py). That file contains the current route set and app logic.
- The user-facing app flow is the lesson module plus the planner. Some quiz-related files and routes still exist in the repo, but they are not part of the current app path.
- The repo still includes older prototype files such as [`server.py`](./server.py) and some unused templates; they are not part of the current Flask flow.
- This project currently uses local JSON files instead of a database.
- No automated test suite is included in the repository at the moment.
