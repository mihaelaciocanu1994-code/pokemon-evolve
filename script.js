let pokemonMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
  loadCSV();
});

function loadCSV() {
  Papa.parse("pokemon.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      processPokemonData(results.data);
      populateDropdown();
    },
    error: (err) => {
      console.error("Error loading CSV:", err);
      alert("Could not load pokemon.csv. If opening directly in a browser, please use VS Code Live Server or host on GitHub Pages.");
    }
  });
}

function processPokemonData(data) {
  data.forEach((row) => {
    if (!row.id || !row.pokemon) return;

    const pokemon = {
      id: parseInt(row.id, 10),
      name: row.pokemon.trim(),
      speciesId: parseInt(row.species_id, 10),
      type1: row.type_1 || '',
      type2: row.type_2 && row.type_2 !== 'NA' ? row.type_2 : null,
      hp: parseInt(row.hp, 10) || 0,
      attack: parseInt(row.attack, 10) || 0,
      defense: parseInt(row.defense, 10) || 0,
      spAtk: parseInt(row.special_attack, 10) || 0,
      spDef: parseInt(row.special_defense, 10) || 0,
      speed: parseInt(row.speed, 10) || 0
    };

    pokemon.bst = pokemon.hp + pokemon.attack + pokemon.defense + pokemon.spAtk + pokemon.spDef + pokemon.speed;
    pokemonMap.set(pokemon.id, pokemon);
  });
}

function populateDropdown() {
  const select = document.getElementById("pokemon-select");
  select.innerHTML = '<option value="">-- Select a Pokémon --</option>';

  const sortedList = Array.from(pokemonMap.values()).sort((a, b) => a.id - b.id);

  sortedList.forEach((poke) => {
    const opt = document.createElement("option");
    opt.value = poke.id;
    opt.textContent = `#${poke.id} - ${capitalize(poke.name)}`;
    select.appendChild(opt);
  });

  select.disabled = false;
  select.addEventListener("change", (e) => {
    const selectedId = parseInt(e.target.value, 10);
    if (selectedId) {
      displayDecision(selectedId);
    } else {
      document.getElementById("result-card").classList.add("hidden");
    }
  });
}

function displayDecision(id) {
  const current = pokemonMap.get(id);
  if (!current) return;

  const card = document.getElementById("result-card");
  const verdictBox = document.getElementById("verdict-box");
  const verdictTitle = document.getElementById("verdict-title");
  const verdictDesc = document.getElementById("verdict-description");

  // Load image sprite directly from PokeAPI GitHub repository
  const imgElement = document.getElementById("pokemon-image");
  imgElement.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${current.id}.png`;

  document.getElementById("pokemon-name").textContent = `#${current.id} ${capitalize(current.name)}`;
  document.getElementById("pokemon-types").textContent = current.type2 
    ? `Type: ${capitalize(current.type1)} / ${capitalize(current.type2)}`
    : `Type: ${capitalize(current.type1)}`;

  // Set stats
  document.getElementById("stat-bst").textContent = current.bst;
  document.getElementById("stat-hp").textContent = current.hp;
  document.getElementById("stat-atk").textContent = current.attack;
  document.getElementById("stat-def").textContent = current.defense;
  document.getElementById("stat-spatk").textContent = current.spAtk;
  document.getElementById("stat-spdef").textContent = current.spDef;
  document.getElementById("stat-spd").textContent = current.speed;

  // Next species in ID sequence check (Sequential evolution fallback)
  const nextPokemon = pokemonMap.get(current.id + 1);

  // Evolution decision logic based on stat growth and ID placement
  if (nextPokemon && current.bst < 450 && nextPokemon.bst > current.bst) {
    const diff = nextPokemon.bst - current.bst;
    verdictBox.className = "verdict-box yes";
    verdictTitle.textContent = `YES! Evolve into ${capitalize(nextPokemon.name)}`;
    verdictDesc.textContent = `${capitalize(current.name)} has a Base Stat Total of ${current.bst}. Evolving will boost stats by +${diff} points to ${nextPokemon.bst}!`;
  } else {
    verdictBox.className = "verdict-box no";
    verdictTitle.textContent = "NO! Do Not Evolve";
    verdictDesc.textContent = `${capitalize(current.name)} has strong stats (BST: ${current.bst}) or is already at its final form. Save your candies!`;
  }

  card.classList.remove("hidden");
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}