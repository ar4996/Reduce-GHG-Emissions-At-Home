# import flask
from flask import Flask, render_template, request, jsonify

# create an app instance
app = Flask(__name__)

sustainable_living_opportunities = [
  {
    "room": "Kitchen",
    "room_image": "https://t4.ftcdn.net/jpg/01/97/62/75/360_F_197627587_9W7ar7XOEv2586rWWbkHL1GqeZmMlv6l.jpg",
    "opportunity": "Cooktops",
    "description": "Switching from a gas cooktop to an induction cooktop",
    "impact": "This can cut stove-related carbon emissions by ~640 kg CO₂ every year.",
    "impact_cost_effectiveness": "Low",
    "next_room": "Living Room",
  },
  {
    "room": "Living Room",
    "room_image": "https://www.shutterstock.com/image-vector/cartoon-room-interior-home-furniture-600nw-2423784435.jpg",
    "opportunity": "Light Bulbs",
    "description": "Replace 30 incandescent light bulbs with 30 LED lamps (in your living room or elsewhere at home)",
    "impact": "You'll reduce emissions by ~1,800 kg CO₂ every year.",
    "impact_cost_effectiveness": "High",
    "next_room": "Bathroom",
  },
  {
    "room": "Bathroom",
    "room_image": "https://previews.123rf.com/images/fivestarspro/fivestarspro2002/fivestarspro200200532/140313863-team-of-plumbers-install-water-heater-in-bathroom-housewife-watching-working-process-workers-set.jpg",
    "opportunity": "Water Heater",
    "description": "Switching from a gas water heater to a heat pump water heater",
    "impact": "You'll reduce emissions by ~900 kg CO₂ every year.",
    "impact_cost_effectiveness": "Low",
    "next_room": "Laundry Room",
  },
  {
    "room": "Laundry Room",
    "room_image": "https://t3.ftcdn.net/jpg/05/04/07/54/360_F_504075455_3kjvzfg4bia9TGxanaMiZl118REf6XyW.jpg",
    "opportunity": "Drying",
    "description": "Switching from using a dryer to air drying",
    "impact": "You'll reduce emissions by ~1,000 kg CO₂ every year",
    "impact_cost_effectiveness": "High",
    "next_room": "Congrats on finishing!",
  },
]

# ROUTE 1

@app.route('/')

def welcome():
  return render_template('welcome.html', prospects=prospects)

# ROUTE 2

@app.route('/view/<int:id>')

def view(id):
  returned_prospect = {}
  for prospect in prospects:
     if prospect["id"] == id:
        returned_prospect = prospect
        break  
  return render_template('view.html', prospect = returned_prospect, id = id)

# ROUTE 3 --------------------------------------------------

@app.route('/search')

def search():
    global prospects
    
    player_name = request.args.get("Player_Name", "").strip()
    player_position = request.args.get("Position", "").strip()
    player_comp = request.args.get("Player_Comp", "").strip()
    
    search_terms = {"name": player_name, "position": player_position, "comparison": player_comp}

    search_results = []
    
    for prospect in prospects:
      if player_name and player_name.lower() in prospect["name"].lower():
        search_results.append({"name": prospect["name"], "id": prospect["id"], "position": prospect["position"], "comparisons": prospect["player_comps"]})
        continue
      if player_position and player_position.lower() in prospect["position"].lower():
        search_results.append({"name": prospect["name"], "id": prospect["id"], "position": prospect["position"], "comparisons": prospect["player_comps"]})
        continue
      if player_comp:
        for player_comp_data in prospect["player_comps"]:
          if player_comp.lower() in player_comp_data.lower():
            search_results.append({"name": prospect["name"], "id": prospect["id"], "position": prospect["position"], "comparisons": prospect["player_comps"]})
            break
    
    for result in search_results:
      result["name"] = highlight(result["name"], player_name)
      result["position"] = highlight(result["position"], player_position)
      result["comparisons"] = [highlight(comp, player_comp) for comp in result["comparisons"]]        

    return render_template('searchresults.html', search_terms = search_terms, results = search_results)

# ROUTE 4 --------------------------------------------------

@app.route('/prospect_form')

def prospect_form():
  return render_template('addprospect.html')

# ROUTE 5 --------------------------------------------------

@app.route('/add', methods=['POST'])

def add_prospect():
  global current_id
  
  request_data = request.get_json()
  current_id += 1
  new_entry = {
    "id": current_id,
    "name": request_data["name"],
    "image": request_data["image"],
    "summary": request_data["summary"],
    "ppg": request_data["ppg"],
    "position": request_data["position"],
    "player_comps": request_data["player_comps"]
  }
  prospects.append(new_entry)
  
  return jsonify(current_id)

# ROUTE 6 --------------------------------------------------

@app.route('/edit/<int:id>')

def edit_prospect_form(id):
  returned_prospect = {}
  for prospect in prospects:
     if prospect["id"] == id:
        returned_prospect = prospect
        break  
  return render_template('editprospect.html', prospect= returned_prospect, id = id)

# ROUTE 6 --------------------------------------------------

@app.route('/editing', methods=['POST'])

def edit_prospect():
  global prospects
  request_data = request.get_json()
  updated_entry = {
    "id": int(request_data["id"]),
    "name": request_data["name"],
    "image": request_data["image"],
    "summary": request_data["summary"],
    "ppg": request_data["ppg"],
    "position": request_data["position"],
    "player_comps": request_data["player_comps"]
  }
  for i, prospect in enumerate(prospects):
     if prospect["id"] == updated_entry["id"]:
        prospects[i] = updated_entry
        break  
  return jsonify("Success")