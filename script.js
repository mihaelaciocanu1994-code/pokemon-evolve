JavaScript
let pokemonMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
  loadPokemonData();
});

function loadPokemonData() {
  fetch("pokemon.csv")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Could not fetch pokemon.csv");
      }
      return response.text();
    })
    .then((csvText) => {
      parseAndProcessCSV(csvText);
    })
    .catch((err) => {
      console.error("Error loading CSV:", err);
      showError("Failed to load pokemon.csv");
    });
}

function parseAndProcessCSV(text) {
  const lines = text.split("\n");
  if (lines.length < 2) {
    showError("CSV file is empty or corrupted.");
    return;
  }

  // Get headers from first line
  const headers = lines[0].split(",").map((h) => h.trim());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : "";
    });

    const id = parseInt(row.id, 10);
    const name = row.pokemon;

    if (isNaN(id) || !name) continue;

    const hp = parseInt(row.hp, 10) || 0;
    const attack = parseInt(row.attack, 10) || 0;
    const defense = parseInt(row.defense, 10) || 0;
    const spAtk = parseInt(row.special_attack, 10) || 0;
    const spDef = parseInt(row.special_defense, 10) || 0;
    const speed = parseInt(row.speed, 10) || 0;

    const pokemon = {
      id: id,
      name: name,
      type1: row.type_1 || "",
      type2: row.type_2 && row.type_2 !== "NA" ? row.type_2 : null,
      hp: hp,
      attack: attack,
      defense: defense,
      spAtk: spAtk,
      spDef: spDef,
      speed: speed,
      bst: hp + attack + defense + spAtk + spDef + speed
    };

    pokemonMap.set(pokemon.id, pokemon);
  }

  populateDropdown();
}

function populateDropdown() {
  const select = document.getElementById("pokemon-select");
  if (!select) return;

  select.innerHTML = '<option value="">-- Select a Pokémon --</option>';

  const sortedList = Array.from(pokemonMap.values()).sort((a, b) => a.id - b.id);

  sortedList.forEach((poke) => {
    const opt = document.createElement("option");
    opt.value = poke.id;
    opt.textContent = `#${poke.id} - ${capitalize(poke.name)}`;
    select.appendChild(opt);
  });

  select.disabled = false;
  select.onchange = (e) => {
    const selectedId = parseInt(e.target.value, 10);
    if (!isNaN(selectedId)) {
      displayDecision(selectedId);
    } else {
      const card = document.getElementById("result-card");
      if (card) card.classList.add("hidden");
    }
  };
}

function displayDecision(id) {
  const current = pokemonMap.get(id);
  if (!current) return;

  const card = document.getElementById("result-card");
  const verdictBox = document.getElementById("verdict-box");
  const verdictTitle = document.getElementById("verdict-title");
  const verdictDesc = document.getElementById("verdict-description");

  // Fetch official sprite from PokeAPI GitHub repository
  const imgElement = document.getElementById("pokemon-image");
  imgElement.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${current.id}.png`;

  document.getElementById("pokemon-name").textContent = `#${current.id} ${capitalize(current.name)}`;
  document.getElementById("pokemon-types").textContent = current.type2
    ? `Type: ${capitalize(current.type1)} / ${capitalize(current.type2)}`
    : `Type: ${capitalize(current.type1)}`;

  // Populate numerical base stats
  document.getElementById("stat-bst").textContent = current.bst;
  document.getElementById("stat-hp").textContent = current.hp;
  document.getElementById("stat-atk").textContent = current.attack;
  document.getElementById("stat-def").textContent = current.defense;
  document.getElementById("stat-spatk").textContent = current.spAtk;
  document.getElementById("stat-spdef").textContent = current.spDef;
  document.getElementById("stat-spd").textContent = current.speed;

  // Next evolution sequence check
  const nextPokemon = pokemonMap.get(current.id + 1);

  // Recommendation logic based on Base Stat Total comparison
  if (nextPokemon && current.bst < 480 && nextPokemon.bst > current.bst) {
    const diff = nextPokemon.bst - current.bst;
    verdictBox.className = "verdict-box yes";
    verdictTitle.textContent = `YES! Evolve into ${capitalize(nextPokemon.name)}`;
    verdictDesc.textContent = `${capitalize(current.name)} has a Base Stat Total of ${current.bst}. Evolving will boost stats by +${diff} points to ${nextPokemon.bst}!`;
  } else {
    verdictBox.className = "verdict-box no";
    verdictTitle.textContent = "NO! Do Not Evolve";
    verdictDesc.textContent = `${capitalize(current.name)} is already at its final stage or has strong base stats (BST: ${current.bst}).`;
  }

  card.classList.remove("hidden");
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function showError(msg) {
  const select = document.getElementById("pokemon-select");
  if (select) {
    select.innerHTML = `<option value="">Error: ${msg}</option>`;
  }
}
